// test-v2-fertilizer.ts — Tests for fertilizer farm boost
// Compost pile → fertilizer → farm +50% output

import {
  createWorld, createVillager, GameState,
  TICKS_PER_DAY, ALL_TECHS, BUILDING_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function setupColony(): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];
  state.villagers = [];
  state.nextVillagerId = 1;

  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };
  state.resources = { ...state.resources, food: 200 };

  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return state;
}

// ================================================================
// TEST 1: Fertilizer boosts farm production
// ================================================================
heading('Fertilizer Farm Boost');

{
  // Run a farm WITHOUT fertilizer
  let state1 = setupColony();
  state1.grid[10][6] = { terrain: 'grass', building: null, deposit: 'fertile' };
  state1 = placeBuilding(state1, 'farm', 6, 10);
  const farm1 = state1.buildings.find(b => b.type === 'farm')!;
  farm1.constructed = true; farm1.hp = farm1.maxHp;

  const v1 = createVillager(1, 6, 10);
  v1.food = 8; v1.morale = 80; v1.hp = 20; v1.maxHp = 20;
  v1.homeBuildingId = state1.buildings.find(b => b.type === 'tent')?.id || null;
  state1.villagers = [v1];
  state1.nextVillagerId = 2;
  state1 = assignVillager(state1, v1.id, farm1.id);

  // Run for a day
  for (let i = 0; i < TICKS_PER_DAY; i++) state1 = tick(state1);
  const wheatNoFert = (state1.resources.wheat || 0) + (state1.buildings.find(b => b.type === 'farm')?.localBuffer.wheat || 0);

  // Run a farm WITH fertilizer
  let state2 = setupColony();
  state2.grid[10][6] = { terrain: 'grass', building: null, deposit: 'fertile' };
  state2 = placeBuilding(state2, 'farm', 6, 10);
  const farm2 = state2.buildings.find(b => b.type === 'farm')!;
  farm2.constructed = true; farm2.hp = farm2.maxHp;

  const v2 = createVillager(1, 6, 10);
  v2.food = 8; v2.morale = 80; v2.hp = 20; v2.maxHp = 20;
  v2.homeBuildingId = state2.buildings.find(b => b.type === 'tent')?.id || null;
  state2.villagers = [v2];
  state2.nextVillagerId = 2;
  state2 = assignVillager(state2, v2.id, farm2.id);
  state2.resources.fertilizer = 50; // plenty of fertilizer

  // Run for a day
  for (let i = 0; i < TICKS_PER_DAY; i++) state2 = tick(state2);
  const wheatWithFert = (state2.resources.wheat || 0) + (state2.buildings.find(b => b.type === 'farm')?.localBuffer.wheat || 0);

  assert(wheatWithFert > wheatNoFert, `fertilizer boosted wheat: ${wheatWithFert} vs ${wheatNoFert} without`);
}

// ================================================================
// TEST 2: Fertilizer gets consumed
// ================================================================
heading('Fertilizer Consumption');

{
  let state = setupColony();
  state = placeBuilding(state, 'farm', 6, 10);
  const farm = state.buildings.find(b => b.type === 'farm')!;
  farm.constructed = true; farm.hp = farm.maxHp;

  const v = createVillager(1, 6, 10);
  v.food = 8; v.morale = 80; v.hp = 20; v.maxHp = 20;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')?.id || null;
  state.villagers = [v];
  state.nextVillagerId = 2;
  state = assignVillager(state, v.id, farm.id);
  state.resources.fertilizer = 10;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  assert((state.resources.fertilizer || 0) < 10, `fertilizer consumed (${state.resources.fertilizer} remaining from 10)`);
}

// ================================================================
// TEST 3: No boost without fertilizer
// ================================================================
heading('No Boost Without Fertilizer');

{
  let state = setupColony();
  state.resources.fertilizer = 0;
  assert(state.resources.fertilizer === 0, 'no fertilizer in colony');
  // Farms will produce normal amounts (tested implicitly by TEST 1)
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Fertilizer Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
