// test-v2-scout.ts — Scout system tests
// Scouts walk 1 tile/tick, reveal fog in radius 5, return to idle at map edge or when ticks expire.

import {
  createWorld, createVillager, GameState,
  TICKS_PER_DAY, NIGHT_TICKS,
} from '../world.js';
import {
  tick, placeBuilding, sendScout,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { console.log(`\n=== ${s} ===`); }

function flatWorld(w: number, h: number): GameState {
  const state = createWorld(w, h, 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = false; // Start with fog
      state.territory[y][x] = true;
    }
  }
  // Reveal center area for placement
  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) {
      state.fog[y][x] = true;
    }
  }
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Scout moves 1 tile per tick in direction
// ================================================================
heading('Scout Movement');

{
  let state = flatWorld(30, 30);
  const v = createVillager(1, 10, 10);
  v.state = 'idle';
  v.food = 10;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // Send scout east
  state = sendScout(state, 'v1', 'e');

  const before = state.villagers[0];
  assert(before.role === 'scout', 'Role set to scout');
  assert(before.state === 'scouting', 'State set to scouting');
  assert(before.scoutDirection === 'e', 'Direction set to east');

  // Skip night ticks (scouts only move during processing)
  // Actually scouts move regardless of night in the code
  state = advance(state, 5);

  const after = state.villagers.find(v => v.id === 'v1')!;
  assert(after.x === 15, `Scout moved 5 tiles east (x=${after.x})`);
  assert(after.y === 10, `Scout stayed on same y (y=${after.y})`);
}

// ================================================================
// TEST 2: Scout reveals fog
// ================================================================
heading('Scout Reveals Fog');

{
  let state = flatWorld(30, 30);
  const v = createVillager(1, 10, 10);
  v.state = 'idle';
  v.food = 10;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // Check fog at (20, 10) before scouting
  assert(state.fog[10][20] === false, 'Fog at (20,10) before scouting');

  state = sendScout(state, 'v1', 'e');

  // Scout moves east — after 10 ticks, scout is at (20, 10)
  state = advance(state, 10);

  const scout = state.villagers.find(v => v.id === 'v1')!;
  assert(scout.x === 20, `Scout at x=20 (x=${scout.x})`);

  // Fog should be revealed in radius 5 around scout path
  assert(state.fog[10][20] === true, 'Fog revealed at scout position (20,10)');
  assert(state.fog[10][18] === true, 'Fog revealed near path (18,10)');
  // Distant tile should still be fogged
  assert(state.fog[0][0] === false, 'Distant fog still hidden');
}

// ================================================================
// TEST 3: Scout stops at map edge
// ================================================================
heading('Scout Stops at Map Edge');

{
  let state = flatWorld(30, 30);
  const v = createVillager(1, 25, 10);
  v.state = 'idle';
  v.food = 10;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = sendScout(state, 'v1', 'e');

  // Move 10 ticks — should hit edge at x=29 and stop
  state = advance(state, 10);

  const scout = state.villagers.find(v => v.id === 'v1')!;
  assert(scout.x === 29, `Scout stopped at map edge (x=${scout.x})`);
  assert(scout.state !== 'scouting', `Scout no longer scouting at edge (state=${scout.state})`);
  assert(scout.role === 'idle', `Scout role reset to idle (role=${scout.role})`);
}

// ================================================================
// TEST 4: Scout ticks expire
// ================================================================
heading('Scout Ticks Expire');

{
  let state = flatWorld(60, 60);
  // Reveal whole map for this test
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      state.fog[y][x] = true;
    }
  }
  const v = createVillager(1, 5, 30);
  v.state = 'idle';
  v.food = 10;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // Start at daytime so scout doesn't immediately sleep after expiring
  state.tick = NIGHT_TICKS;
  state = sendScout(state, 'v1', 'e');
  // scoutTicksLeft = 50, map is 60 wide, so should expire before edge

  state = advance(state, 55);

  const scout = state.villagers.find(v => v.id === 'v1')!;
  assert(scout.state === 'idle', `Scout stopped after ticks expired (state=${scout.state})`);
  assert(scout.x === 55, `Scout moved 50 ticks to x=55 (x=${scout.x})`);
}

// ================================================================
// TEST 5: Scout can't be sent while already scouting
// ================================================================
heading('Scout Already Scouting Error');

{
  let state = flatWorld(30, 30);
  const v = createVillager(1, 10, 10);
  v.state = 'idle';
  v.food = 10;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = sendScout(state, 'v1', 'e');
  const state2 = sendScout(state, 'v1', 'n');

  // Should still be scouting east (second command rejected)
  const scout = state2.villagers.find(v => v.id === 'v1')!;
  assert(scout.scoutDirection === 'e', `Direction unchanged (dir=${scout.scoutDirection})`);
}

// ================================================================
// TEST 6: Scout moves south
// ================================================================
heading('Scout Moves South');

{
  let state = flatWorld(30, 30);
  const v = createVillager(1, 10, 10);
  v.state = 'idle';
  v.food = 10;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = sendScout(state, 'v1', 's');
  state = advance(state, 5);

  const scout = state.villagers.find(v => v.id === 'v1')!;
  assert(scout.y === 15, `Scout moved 5 south (y=${scout.y})`);
  assert(scout.x === 10, `Scout stayed on x (x=${scout.x})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Scout Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
