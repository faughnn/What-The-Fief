// test-v2-mint.ts — Tests for mint building (ingots → gold)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, BUILDING_SKILL_MAP,
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
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, wheat: 500, ingots: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Mint template exists
// ================================================================
heading('Mint Template');
{
  const template = BUILDING_TEMPLATES['mint'];
  assert(template !== undefined, 'mint template exists');
  if (template) {
    assert(template.width === 1, 'mint is 1x1');
    assert(template.maxWorkers === 1, 'mint has 1 worker');
    assert(template.production !== null, 'mint has production');
    if (template.production) {
      assert(template.production.output === 'gold', 'produces gold');
      assert(template.production.inputs !== null && template.production.inputs!.ingots === 1, 'requires 1 ingot');
    }
  }
}

// ================================================================
// TEST 2: Mint tech requirement
// ================================================================
heading('Tech Requirement');
{
  const req = BUILDING_TECH_REQUIREMENTS['mint'];
  assert(req !== undefined, `mint has tech requirement: ${req}`);
  assert(req === 'trade_routes', 'requires trade_routes');
}

// ================================================================
// TEST 3: Mint has HP
// ================================================================
heading('HP Entry');
{
  assert(BUILDING_MAX_HP['mint'] !== undefined, 'mint has maxHP');
  assert(BUILDING_MAX_HP['mint'] >= 30, `HP >= 30 (${BUILDING_MAX_HP['mint']})`);
}

// ================================================================
// TEST 4: Mint construction ticks
// ================================================================
heading('Construction');
{
  assert(CONSTRUCTION_TICKS['mint'] !== undefined, 'has construction ticks');
  assert(CONSTRUCTION_TICKS['mint'] > 0, `ticks > 0 (${CONSTRUCTION_TICKS['mint']})`);
}

// ================================================================
// TEST 5: Mint uses crafting skill
// ================================================================
heading('Skill Mapping');
{
  assert(BUILDING_SKILL_MAP['mint'] === 'crafting', 'uses crafting skill');
}

// ================================================================
// TEST 6: Can place mint
// ================================================================
heading('Place Mint');
{
  let state = makeWorld();
  state = placeBuilding(state, 'mint', 5, 5);
  const mint = state.buildings.find(b => b.type === 'mint');
  assert(mint !== undefined, 'mint placed');
}

// ================================================================
// TEST 7: Mint produces gold from ingots
// ================================================================
heading('Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'mint', 7, 5);

  const mint = state.buildings.find(b => b.type === 'mint')!;
  mint.constructed = true; mint.hp = mint.maxHp;
  mint.localBuffer = { ingots: 20 };

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
  state = assignVillager(state, 'v1', mint.id);

  const startGold = state.resources.gold;
  state = advance(state, TICKS_PER_DAY * 2);

  const mintRef = state.buildings.find(b => b.type === 'mint')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const goldInMint = mintRef.localBuffer.gold || 0;
  const goldInSh = shRef.localBuffer.gold || 0;
  const totalGold = goldInMint + goldInSh + state.resources.gold;
  assert(totalGold > startGold, `produced gold (mint=${goldInMint} sh=${goldInSh} global=${state.resources.gold} start=${startGold})`);
  assert((mintRef.localBuffer.ingots || 0) < 20, `consumed ingots (${mintRef.localBuffer.ingots || 0} remaining)`);
}

// ================================================================
// TEST 8: No production without ingots
// ================================================================
heading('No Ingots No Gold');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'mint', 7, 5);

  const mint = state.buildings.find(b => b.type === 'mint')!;
  mint.constructed = true; mint.hp = mint.maxHp;
  // No ingots in buffer

  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' || b.type === 'tent'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired,
            localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer }
        : b),
  };
  state.resources.ingots = 0;

  const v1 = createVillager(1, 7, 5);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', mint.id);

  const startGold = state.resources.gold;
  state = advance(state, TICKS_PER_DAY * 2);

  const mintRef = state.buildings.find(b => b.type === 'mint')!;
  const goldInMint = mintRef.localBuffer.gold || 0;
  assert(goldInMint === 0, `no gold without ingots: ${goldInMint}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Mint Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
