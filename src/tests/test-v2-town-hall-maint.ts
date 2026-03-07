// test-v2-town-hall-maint.ts — Tests for town hall maintenance aura

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_MAX_HP,
  TOWN_HALL_MAINT_RANGE,
} from '../world.js';
import { tick, placeBuilding } from '../simulation.js';
import { TICKS_PER_DAY } from '../timing.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  const state = createWorld(30, 30, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 999, stone: 999, food: 999, planks: 200, wheat: 999 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advanceDays(state: GameState, days: number): GameState {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Constant exists
// ================================================================
heading('Constants');
{
  assert(TOWN_HALL_MAINT_RANGE >= 5, `range >= 5 (${TOWN_HALL_MAINT_RANGE})`);
}

// ================================================================
// TEST 2: Building near town hall doesn't decay
// ================================================================
heading('Near Town Hall - No Decay');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 10, 10);
  state = placeBuilding(state, 'tent', 10, 9);
  state = placeBuilding(state, 'town_hall', 10, 12);
  state = placeBuilding(state, 'farm', 13, 11); // within range

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 9999, wheat: 9999 } : b.localBuffer,
    })),
  };

  const v = createVillager(1, 10, 10);
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v.food = 10; v.morale = 80;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  const farm = state.buildings.find(b => b.type === 'farm')!;
  const startHp = farm.hp;

  // Advance 10 days (2 decay cycles at day 5 and 10)
  state = advanceDays(state, 10);

  const farmAfter = state.buildings.find(b => b.type === 'farm')!;
  assert(farmAfter.hp === startHp, `farm near town hall didn't decay: ${farmAfter.hp} === ${startHp}`);
}

// ================================================================
// TEST 3: Building far from town hall decays normally
// ================================================================
heading('Far From Town Hall - Normal Decay');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 10, 10);
  state = placeBuilding(state, 'tent', 10, 9);
  state = placeBuilding(state, 'town_hall', 10, 14);
  state = placeBuilding(state, 'farm', 25, 25); // far outside range

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 9999, wheat: 9999 } : b.localBuffer,
    })),
  };

  const v = createVillager(1, 10, 10);
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v.food = 10; v.morale = 80;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  const farm = state.buildings.find(b => b.type === 'farm')!;
  const startHp = farm.hp;

  state = advanceDays(state, 10);

  const farmAfter = state.buildings.find(b => b.type === 'farm')!;
  assert(farmAfter.hp < startHp, `far farm decayed: ${farmAfter.hp} < ${startHp}`);
}

// ================================================================
// TEST 4: No town hall — all buildings decay
// ================================================================
heading('No Town Hall');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 10, 10);
  state = placeBuilding(state, 'tent', 10, 9);
  state = placeBuilding(state, 'farm', 11, 11);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 9999, wheat: 9999 } : b.localBuffer,
    })),
  };

  const v = createVillager(1, 10, 10);
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v.food = 10; v.morale = 80;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  const farm = state.buildings.find(b => b.type === 'farm')!;
  const startHp = farm.hp;

  state = advanceDays(state, 10);

  const farmAfter = state.buildings.find(b => b.type === 'farm')!;
  assert(farmAfter.hp < startHp, `farm without town hall decayed: ${farmAfter.hp} < ${startHp}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Town Hall Maintenance Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
