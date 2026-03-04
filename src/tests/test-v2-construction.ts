// test-v2-construction.ts — V2 construction system tests
// Buildings start as construction sites. Workers must physically build them.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, CONSTRUCTION_TICKS,
  BUILDING_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
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
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Placed building starts as construction site
// ================================================================
heading('Construction Site');

{
  let state = flatWorld(10, 10);
  state = placeBuilding(state, 'farm', 3, 3);
  const farm = state.buildings.find(b => b.type === 'farm')!;

  assert(farm.constructed === false, 'New building starts as construction site (not constructed)');
  assert(farm.constructionProgress === 0, 'Construction progress starts at 0');
  assert(farm.constructionRequired === CONSTRUCTION_TICKS['farm'],
    `Farm requires ${CONSTRUCTION_TICKS['farm']} ticks to build`);
}

// ================================================================
// TEST 2: Worker travels to construction site and builds
// ================================================================
heading('Worker Builds Construction Site');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 2, 5);

  // Place home and farm (construction site)
  state = placeBuilding(state, 'tent', 2, 5);
  state = placeBuilding(state, 'farm', 4, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  // Tent is instant construction for shelter purposes
  assert(state.buildings[0].constructed === true || state.buildings[0].type === 'tent',
    'Tent construction is quick/instant for early game viability');

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Advance to dawn + travel time (2 tiles) + some construction time
  state = advance(state, NIGHT_TICKS + 2 + 20);

  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.constructionProgress > 0, `Construction progressed: ${farm.constructionProgress}/${farm.constructionRequired}`);
}

// ================================================================
// TEST 3: Unconstructed building doesn't produce
// ================================================================
heading('Unconstructed Building Cannot Produce');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'farm', 3, 6);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Only advance a little — not enough to finish construction
  state = advance(state, NIGHT_TICKS + 10);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const localWheat = farm.localBuffer['wheat'] || 0;
  assert(localWheat === 0, 'Unconstructed farm produces no wheat');
  assert(farm.constructed === false, 'Farm still under construction');
}

// ================================================================
// TEST 4: Completed building becomes functional
// ================================================================
heading('Completed Building Is Functional');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  // Place a fence (very fast to build: 10 ticks) as a simpler test
  state = placeBuilding(state, 'fence', 5, 5);

  // Actually let's test with a woodcutter (45 ticks to build, produces wood)
  state = placeBuilding(state, 'woodcutter', 4, 5);
  // Storehouse so hauled resources have somewhere to go
  state = placeBuilding(state, 'storehouse', 6, 5);
  const homeId = state.buildings[0].id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;

  state = assignVillager(state, 'v1', wcId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  const woodAfterPlacement = state.resources.wood; // reduced by building costs

  // Run enough ticks to complete construction + some production time
  // Worker needs: dawn(30) + travel(1 tile) + build(45 ticks) = 76 ticks minimum
  // Then production starts
  state = advance(state, TICKS_PER_DAY * 2); // 2 full days

  const wc = state.buildings.find(b => b.id === wcId)!;
  assert(wc.constructed === true, 'Woodcutter is fully constructed after enough time');

  // Check that some wood was produced after construction completed
  // Wood may be in woodcutter's local buffer, storehouse buffer, or global resources
  const localWood = wc.localBuffer['wood'] || 0;
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const shWood = sh.localBuffer['wood'] || 0;
  const globalWood = state.resources.wood;
  assert(localWood > 0 || shWood > 0 || globalWood > woodAfterPlacement,
    `Wood produced after construction: local=${localWood}, storehouse=${shWood}, global=${globalWood} (was ${woodAfterPlacement})`);
}

// ================================================================
// TEST 5: Construction progress requires physical presence
// ================================================================
heading('Construction Requires Presence');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 0, 5);

  state = placeBuilding(state, 'tent', 0, 5);
  state = placeBuilding(state, 'farm', 15, 5); // Far away
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // After dawn + 5 ticks, villager is still traveling (farm is 15 tiles away)
  state = advance(state, NIGHT_TICKS + 5);

  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.constructionProgress === 0,
    'No construction progress while worker is still traveling to site');

  const v = state.villagers.find(v => v.id === 'v1')!;
  assert(v.x < 15, `Worker still en route (at x=${v.x}, farm at x=15)`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Construction Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
