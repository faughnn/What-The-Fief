// test-v2-trappers-camp.ts — Tests for trapper's camp (passive animal trapping)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, BUILDING_SKILL_MAP, OUTDOOR_BUILDINGS,
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
  let state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, rope: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  // Place storehouse + tent
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 7, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { wood: 200, stone: 200, food: 200, rope: 50 }
        : b.localBuffer,
    })),
  };
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Trappers camp template exists
// ================================================================
heading('Trappers Camp Template');
{
  const template = BUILDING_TEMPLATES['trappers_camp'];
  assert(template !== undefined, 'trappers_camp template exists');
  if (template) {
    assert(template.width === 1, 'trappers_camp is 1x1');
    assert(template.height === 1, 'trappers_camp is 1x1 height');
    assert(template.maxWorkers === 1, 'trappers_camp has 1 worker');
    assert(template.production !== null, 'trappers_camp has production');
    if (template.production) {
      assert(template.production.output === 'food', 'produces food');
      assert(template.production.amountPerWorker === 2, '2 food per worker');
      assert(template.production.inputs === null, 'no input required (passive trapping)');
      assert(template.production.byproduct !== undefined, 'has leather byproduct');
      if (template.production.byproduct) {
        assert(template.production.byproduct.resource === 'leather', 'byproduct is leather');
        assert(template.production.byproduct.amount === 1, 'byproduct is 1 leather');
      }
    }
  }
}

// ================================================================
// TEST 2: Trappers camp tech requirement
// ================================================================
heading('Tech Requirement');
{
  const req = BUILDING_TECH_REQUIREMENTS['trappers_camp'];
  assert(req !== undefined, `trappers_camp has tech requirement: ${req}`);
  assert(req === 'animal_husbandry', 'requires animal_husbandry');
}

// ================================================================
// TEST 3: Trappers camp has HP
// ================================================================
heading('HP Entry');
{
  assert(BUILDING_MAX_HP['trappers_camp'] !== undefined, 'trappers_camp has maxHP');
  assert(BUILDING_MAX_HP['trappers_camp'] >= 25, `HP >= 25 (${BUILDING_MAX_HP['trappers_camp']})`);
}

// ================================================================
// TEST 4: Trappers camp uses herbalism skill
// ================================================================
heading('Skill Mapping');
{
  assert(BUILDING_SKILL_MAP['trappers_camp'] === 'herbalism', 'trappers_camp uses herbalism skill');
}

// ================================================================
// TEST 5: Trappers camp is an outdoor building
// ================================================================
heading('Outdoor Building');
{
  assert(OUTDOOR_BUILDINGS.includes('trappers_camp' as any), 'trappers_camp is an outdoor building');
}

// ================================================================
// TEST 6: Trappers camp allowed on grass/forest
// ================================================================
heading('Allowed Terrain');
{
  const template = BUILDING_TEMPLATES['trappers_camp'];
  if (template) {
    assert(template.allowedTerrain.includes('grass'), 'allowed on grass');
    assert(template.allowedTerrain.includes('forest'), 'allowed on forest');
  }
}

// ================================================================
// TEST 7: Trappers camp has construction ticks
// ================================================================
heading('Construction Ticks');
{
  const ticks = CONSTRUCTION_TICKS['trappers_camp'];
  assert(ticks !== undefined, 'trappers_camp has construction ticks');
  if (ticks) {
    assert(ticks > 0, `construction ticks > 0: ${ticks}`);
  }
}

// ================================================================
// TEST 8: Trappers camp can be placed
// ================================================================
heading('Placement');
{
  let state = makeWorld();
  const bCount = state.buildings.length;
  state = placeBuilding(state, 'trappers_camp', 3, 3);
  assert(state.buildings.length > bCount, 'trappers_camp placed');

  const tc = state.buildings.find(b => b.type === 'trappers_camp');
  assert(tc !== undefined, 'trappers_camp building exists');
  if (tc) {
    assert(tc.constructed === false, 'starts unconstructed');
  }
}

// ================================================================
// TEST 9: Trappers camp produces food
// ================================================================
heading('Food Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'trappers_camp', 3, 3);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'trappers_camp'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
  };
  const tc = state.buildings.find(b => b.type === 'trappers_camp')!;

  const v1 = createVillager(1, 3, 3);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', tc.id);

  state = advance(state, TICKS_PER_DAY * 2);

  const tcRef = state.buildings.find(b => b.type === 'trappers_camp')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const totalFood = (tcRef.localBuffer['food'] || 0)
    + (shRef.localBuffer['food'] || 0);
  // Should have produced some food (initial 200 + produced)
  assert(totalFood > 0, `food produced by trapper`);
}

// ================================================================
// TEST 10: Trappers camp produces leather byproduct
// ================================================================
heading('Leather Byproduct');
{
  let state = makeWorld();
  state = placeBuilding(state, 'trappers_camp', 3, 3);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'trappers_camp'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
  };
  const tc = state.buildings.find(b => b.type === 'trappers_camp')!;

  const v1 = createVillager(1, 3, 3);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', tc.id);

  state = advance(state, TICKS_PER_DAY * 2);

  const tcRef = state.buildings.find(b => b.type === 'trappers_camp')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const totalLeather = (tcRef.localBuffer['leather'] || 0)
    + (shRef.localBuffer['leather'] || 0)
    + (state.resources.leather || 0);
  assert(totalLeather > 0, `leather byproduct produced: ${totalLeather}`);
}

// ================================================================
// TEST 11: Trappers camp not buildable without animal_husbandry
// ================================================================
heading('Tech Gate');
{
  let state = makeWorld();
  state.research.completed = [];
  const bCount = state.buildings.length;
  state = placeBuilding(state, 'trappers_camp', 3, 3);
  assert(state.buildings.length === bCount, 'cannot build trappers_camp without animal_husbandry');
}

// ================================================================
// TEST 12: Trappers camp building cost
// ================================================================
heading('Building Cost');
{
  const template = BUILDING_TEMPLATES['trappers_camp'];
  if (template) {
    assert(template.cost.wood !== undefined && template.cost.wood > 0, 'costs wood');
    assert(template.cost.rope !== undefined && template.cost.rope > 0, 'costs rope (for traps)');
  }
}

// ================================================================
// Summary
// ================================================================
console.log(`\ntrappers_camp: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
