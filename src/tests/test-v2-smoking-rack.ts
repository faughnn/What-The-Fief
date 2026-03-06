// test-v2-smoking-rack.ts — Tests for smoking rack (meat + charcoal → smoked_food)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, BUILDING_SKILL_MAP, SPOILAGE, FOOD_PRIORITY,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation.js';
import { TICKS_PER_DAY, CONSTRUCTION_TICKS } from '../timing.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  const state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, wheat: 500, meat: 100, charcoal: 100 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Smoking rack template exists
// ================================================================
heading('Smoking Rack Template');
{
  const template = BUILDING_TEMPLATES['smoking_rack'];
  assert(template !== undefined, 'smoking_rack template exists');
  if (template) {
    assert(template.width === 1, 'smoking_rack is 1x1');
    assert(template.maxWorkers === 1, 'smoking_rack has 1 worker');
    assert(template.production !== null, 'smoking_rack has production');
    if (template.production) {
      assert(template.production.output === 'smoked_food', 'produces smoked_food');
      assert(template.production.amountPerWorker === 2, '2 per worker');
      assert(template.production.inputs !== null && template.production.inputs!.meat === 2, 'requires 2 meat');
      assert(template.production.inputs !== null && template.production.inputs!.charcoal === 1, 'requires 1 charcoal');
    }
  }
}

// ================================================================
// TEST 2: Smoking rack tech requirement
// ================================================================
heading('Tech Requirement');
{
  const req = BUILDING_TECH_REQUIREMENTS['smoking_rack'];
  assert(req !== undefined, `smoking_rack has tech requirement: ${req}`);
  assert(req === 'basic_cooking', 'requires basic_cooking');
}

// ================================================================
// TEST 3: Smoking rack has HP
// ================================================================
heading('HP Entry');
{
  assert(BUILDING_MAX_HP['smoking_rack'] !== undefined, 'smoking_rack has maxHP');
  assert(BUILDING_MAX_HP['smoking_rack'] >= 20, `HP >= 20 (${BUILDING_MAX_HP['smoking_rack']})`);
}

// ================================================================
// TEST 4: Smoking rack has construction ticks
// ================================================================
heading('Construction');
{
  assert(CONSTRUCTION_TICKS['smoking_rack'] !== undefined, 'has construction ticks');
  assert(CONSTRUCTION_TICKS['smoking_rack'] > 0, `ticks > 0 (${CONSTRUCTION_TICKS['smoking_rack']})`);
}

// ================================================================
// TEST 5: Smoking rack uses cooking skill
// ================================================================
heading('Skill Mapping');
{
  assert(BUILDING_SKILL_MAP['smoking_rack'] === 'cooking', 'uses cooking skill');
}

// ================================================================
// TEST 6: Smoked food has low spoilage rate
// ================================================================
heading('Smoked Food Spoilage');
{
  const smokedSpoil = SPOILAGE['smoked_food'];
  const meatSpoil = SPOILAGE['meat'];
  assert(smokedSpoil !== undefined, 'smoked_food has spoilage rate');
  assert(smokedSpoil! < meatSpoil!, `smoked_food spoils slower than meat (${smokedSpoil} < ${meatSpoil})`);
  const driedSpoil = SPOILAGE['dried_food'];
  assert(smokedSpoil! <= driedSpoil!, `smoked_food spoils same or slower than dried_food (${smokedSpoil} <= ${driedSpoil})`);
}

// ================================================================
// TEST 7: Smoked food in food priority
// ================================================================
heading('Food Priority');
{
  const smokedEntry = FOOD_PRIORITY.find(f => f.resource === 'smoked_food');
  assert(smokedEntry !== undefined, 'smoked_food in food priority');
  if (smokedEntry) {
    assert(smokedEntry.satisfaction > 1.8, `satisfaction > dried_food (${smokedEntry.satisfaction} > 1.8)`);
    assert(smokedEntry.satisfaction < 2.5, `satisfaction < meat (${smokedEntry.satisfaction} < 2.5)`);
  }
}

// ================================================================
// TEST 8: Can place smoking rack
// ================================================================
heading('Place Smoking Rack');
{
  let state = makeWorld();
  state = placeBuilding(state, 'smoking_rack', 5, 5);
  const rack = state.buildings.find(b => b.type === 'smoking_rack');
  assert(rack !== undefined, 'smoking_rack placed');
}

// ================================================================
// TEST 9: Smoking rack produces smoked_food from meat + charcoal
// ================================================================
heading('Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'smoking_rack', 7, 5);

  const rack = state.buildings.find(b => b.type === 'smoking_rack')!;
  rack.constructed = true; rack.hp = rack.maxHp;
  // Stock inputs directly in the smoking rack's local buffer
  rack.localBuffer = { meat: 20, charcoal: 10 };

  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' || b.type === 'tent'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired,
            localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer }
        : b),
  };

  const v1 = createVillager(1, 7, 5);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', rack.id);

  state = advance(state, TICKS_PER_DAY * 2);

  const rackRef = state.buildings.find(b => b.type === 'smoking_rack')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const smokedInRack = rackRef.localBuffer.smoked_food || 0;
  const smokedInSh = shRef.localBuffer.smoked_food || 0;
  const smokedGlobal = state.resources.smoked_food || 0;
  const totalSmoked = smokedInRack + smokedInSh + smokedGlobal;
  assert(totalSmoked > 0, `produced smoked_food (rack=${smokedInRack} sh=${smokedInSh} global=${smokedGlobal})`);
  assert((rackRef.localBuffer.meat || 0) < 20, `consumed meat (${rackRef.localBuffer.meat || 0} remaining)`);
  assert((rackRef.localBuffer.charcoal || 0) < 10, `consumed charcoal (${rackRef.localBuffer.charcoal || 0} remaining)`);
}

// ================================================================
// TEST 10: Smoking rack requires both meat and charcoal
// ================================================================
heading('Input Requirements');
{
  // No charcoal available — should produce nothing
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'smoking_rack', 7, 5);

  const rack = state.buildings.find(b => b.type === 'smoking_rack')!;
  rack.constructed = true; rack.hp = rack.maxHp;
  // Only meat, no charcoal
  rack.localBuffer = { meat: 20 };

  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' || b.type === 'tent'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired,
            localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer }
        : b),
  };

  const v1 = createVillager(1, 7, 5);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', rack.id);

  state = advance(state, TICKS_PER_DAY * 2);

  const rackRef = state.buildings.find(b => b.type === 'smoking_rack')!;
  const totalSmoked = (rackRef.localBuffer.smoked_food || 0) + (state.resources.smoked_food || 0);
  assert(totalSmoked === 0, `no smoked_food without charcoal: ${totalSmoked}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Smoking Rack Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
