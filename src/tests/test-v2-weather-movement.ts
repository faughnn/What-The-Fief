// test-v2-weather-movement.ts — Tests for storm movement penalty

import {
  createWorld, GameState, createVillager,
  ALL_TECHS, TICKS_PER_DAY, NIGHT_TICKS,
} from '../world.js';
import { placeBuilding } from '../simulation/buildings.js';
import { tick } from '../simulation/index.js';

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
  state.resources = { ...state.resources, wood: 200, stone: 200, food: 200 };
  state.villagers = [];
  state.nextVillagerId = 1;

  const s = placeBuilding(state, 'storehouse', 10, 10);
  const sh = s.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };

  const s2 = placeBuilding(s, 'tent', 0, 0);
  const tent = s2.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return s2;
}

// ================================================================
// TEST 1: Villager travels faster in clear weather than storm
// ================================================================
heading('Storm Slows Villager Movement');
{
  // Clear weather: villager at (0,0) traveling to (10,10)
  // Storm weather: same path but slower
  let clearState = makeWorld();
  const v1 = createVillager(1, 0, 10);
  v1.role = 'idle';
  v1.state = 'traveling_home';
  v1.homeBuildingId = clearState.buildings.find(b => b.type === 'tent')!.id;
  // Manually set path to tent at (0,0)
  v1.path = [];
  for (let x = 0; x >= 0; x--) v1.path.push({ x, y: 10 });
  // Create a straight path: walk from (0,10) to (0,5) — 5 steps
  v1.path = [{ x: 0, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 }, { x: 0, y: 5 }];
  v1.pathIndex = 0;
  clearState.villagers.push(v1);
  clearState.nextVillagerId = 2;
  clearState.weather = 'clear';
  clearState.tick = NIGHT_TICKS; // start at dawn
  clearState.prosperity = 0; clearState.renown = 0;

  let stormState = makeWorld();
  const v2 = createVillager(1, 0, 10);
  v2.role = 'idle';
  v2.state = 'traveling_home';
  v2.homeBuildingId = stormState.buildings.find(b => b.type === 'tent')!.id;
  v2.path = [{ x: 0, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 }, { x: 0, y: 5 }];
  v2.pathIndex = 0;
  stormState.villagers.push(v2);
  stormState.nextVillagerId = 2;
  stormState.weather = 'storm';
  stormState.tick = NIGHT_TICKS; // start at dawn
  stormState.prosperity = 0; stormState.renown = 0;

  // Run 4 ticks
  for (let i = 0; i < 4; i++) {
    clearState = tick(clearState);
    stormState = tick(stormState);
  }

  const clearV = clearState.villagers[0];
  const stormV = stormState.villagers[0];
  const clearDist = Math.abs(clearV.y - 10);
  const stormDist = Math.abs(stormV.y - 10);
  assert(clearDist > stormDist, `clear weather villager traveled further (${clearDist} > ${stormDist})`);
}

// ================================================================
// TEST 2: Clear weather has no movement penalty
// ================================================================
heading('Clear Weather Normal Speed');
{
  let state = makeWorld();
  const v = createVillager(1, 0, 10);
  v.role = 'idle';
  v.state = 'traveling_home';
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v.path = [{ x: 0, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 }, { x: 0, y: 5 }];
  v.pathIndex = 0;
  state.villagers.push(v);
  state.nextVillagerId = 2;
  state.weather = 'clear';
  state.tick = NIGHT_TICKS;
  state.prosperity = 0; state.renown = 0;

  // Run 3 ticks
  for (let i = 0; i < 3; i++) state = tick(state);

  const vAfter = state.villagers[0];
  // Should have moved 3 tiles (1 per tick, no penalty)
  const dist = 10 - vAfter.y;
  assert(dist >= 3, `villager moved at least 3 tiles in clear weather (moved ${dist})`);
}

// ================================================================
// TEST 3: Rain has no movement penalty
// ================================================================
heading('Rain No Movement Penalty');
{
  let clearState = makeWorld();
  const v1 = createVillager(1, 0, 10);
  v1.role = 'idle';
  v1.state = 'traveling_home';
  v1.homeBuildingId = clearState.buildings.find(b => b.type === 'tent')!.id;
  v1.path = [{ x: 0, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 }, { x: 0, y: 5 }];
  v1.pathIndex = 0;
  clearState.villagers.push(v1);
  clearState.nextVillagerId = 2;
  clearState.weather = 'clear';
  clearState.tick = NIGHT_TICKS;
  clearState.prosperity = 0; clearState.renown = 0;

  let rainState = makeWorld();
  const v2 = createVillager(1, 0, 10);
  v2.role = 'idle';
  v2.state = 'traveling_home';
  v2.homeBuildingId = rainState.buildings.find(b => b.type === 'tent')!.id;
  v2.path = [{ x: 0, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 }, { x: 0, y: 5 }];
  v2.pathIndex = 0;
  rainState.villagers.push(v2);
  rainState.nextVillagerId = 2;
  rainState.weather = 'rain';
  rainState.tick = NIGHT_TICKS;
  rainState.prosperity = 0; rainState.renown = 0;

  for (let i = 0; i < 4; i++) {
    clearState = tick(clearState);
    rainState = tick(rainState);
  }

  const clearDist = 10 - clearState.villagers[0].y;
  const rainDist = 10 - rainState.villagers[0].y;
  assert(clearDist === rainDist, `rain doesn't slow movement (${rainDist} === ${clearDist})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Weather Movement Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
