// test-v2-maintenance.ts — Tests for building maintenance decay
// Buildings slowly lose HP over time, requiring periodic repair

import {
  createWorld, createVillager, GameState,
  TICKS_PER_DAY, DAYS_PER_SEASON, ALL_TECHS, BUILDING_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding,
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
  state.resources = { ...state.resources, food: 200, wood: 50, stone: 50 };

  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return state;
}

// ================================================================
// TEST 1: Buildings lose HP over time (daily decay)
// ================================================================
heading('Building Maintenance Decay');

{
  let state = setupColony();
  state.prosperity = 0; // prevent immigration that would repair buildings
  state.renown = 0;
  state = placeBuilding(state, 'farm', 6, 10);
  const farm = state.buildings.find(b => b.type === 'farm')!;
  farm.constructed = true; farm.hp = farm.maxHp;
  const startHp = farm.hp;

  // Run for 10 days (decay fires every 5 days = 2 decay events)
  for (let i = 0; i < TICKS_PER_DAY * 10; i++) state = tick(state);

  const farmAfter = state.buildings.find(b => b.id === farm.id)!;
  // Allow ±1 due to possible immigrant repair
  assert(farmAfter.hp < startHp, `farm lost HP from decay (${farmAfter.hp} < ${startHp})`);
  assert(farmAfter.hp > 0, `farm still standing after decay (hp=${farmAfter.hp})`);
}

// ================================================================
// TEST 2: Walls and fences don't decay (defensive structures exempt)
// ================================================================
heading('Defensive Structures Exempt');

{
  let state = setupColony();
  state = placeBuilding(state, 'wall', 6, 10);
  const wall = state.buildings.find(b => b.type === 'wall')!;
  wall.constructed = true; wall.hp = wall.maxHp;
  const startHp = wall.hp;

  for (let i = 0; i < TICKS_PER_DAY * 10; i++) state = tick(state);

  const wallAfter = state.buildings.find(b => b.id === wall.id)!;
  assert(wallAfter.hp === startHp, `wall doesn't decay (${wallAfter.hp} === ${startHp})`);
}

// ================================================================
// TEST 3: Rubble doesn't decay
// ================================================================
heading('Rubble Exempt');

{
  let state = setupColony();
  state = placeBuilding(state, 'farm', 6, 10);
  const farm = state.buildings.find(b => b.type === 'farm')!;
  farm.constructed = true;
  farm.type = 'rubble' as any; // simulate destroyed building
  farm.hp = 1;

  for (let i = 0; i < TICKS_PER_DAY * 5; i++) state = tick(state);

  const rubbleAfter = state.buildings.find(b => b.id === farm.id)!;
  assert(rubbleAfter.hp >= 1, `rubble doesn't decay further (hp=${rubbleAfter.hp})`);
}

// ================================================================
// TEST 4: Unconstructed buildings don't decay
// ================================================================
heading('Unconstructed Exempt');

{
  let state = setupColony();
  state.prosperity = 0; // prevent immigration
  state.renown = 0;
  state = placeBuilding(state, 'farm', 6, 10);
  const farm = state.buildings.find(b => b.type === 'farm')!;
  // farm is NOT constructed
  const startHp = farm.hp;

  // Run only 1 day — no villagers means no construction
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farmAfter = state.buildings.find(b => b.id === farm.id)!;
  assert(!farmAfter.constructed, `farm stayed unconstructed (constructed=${farmAfter.constructed})`);
  assert(farmAfter.hp === startHp, `unconstructed building doesn't decay (${farmAfter.hp} === ${startHp})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Maintenance Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
