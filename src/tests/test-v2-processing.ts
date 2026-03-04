// test-v2-processing.ts — V2 processing building input hauling tests
// Processing buildings (mill, bakery, etc.) consume inputs from their local buffer.
// Workers must haul inputs from storehouse to the processing building.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, CONSTRUCTION_TICKS,
  BUILDING_TEMPLATES, CARRY_CAPACITY,
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
// TEST 1: Mill doesn't produce without wheat in local buffer
// ================================================================
heading('Mill Requires Local Inputs');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  // Place tent and mill
  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'mill', 4, 5);
  const homeId = state.buildings[0].id;
  const millId = state.buildings.find(b => b.type === 'mill')!.id;

  state = assignVillager(state, 'v1', millId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Force mill to constructed
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.id === millId ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b
    ),
  };

  // No wheat in global resources and no wheat in mill buffer
  state = { ...state, resources: { ...state.resources, wheat: 0 } };

  // Advance 2 full days
  state = advance(state, TICKS_PER_DAY * 2);

  const mill = state.buildings.find(b => b.id === millId)!;
  const localFlour = mill.localBuffer['flour'] || 0;
  assert(localFlour === 0, 'Mill produces no flour without wheat inputs');
}

// ================================================================
// TEST 2: Mill produces when wheat is in its local buffer
// ================================================================
heading('Mill Produces With Local Buffer Inputs');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'mill', 4, 5);
  // Storehouse so hauled resources have somewhere to go
  state = placeBuilding(state, 'storehouse', 7, 5);
  const homeId = state.buildings[0].id;
  const millId = state.buildings.find(b => b.type === 'mill')!.id;

  state = assignVillager(state, 'v1', millId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Force mill to constructed and pre-fill local buffer with wheat
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.id === millId ? {
        ...b,
        constructed: true,
        constructionProgress: b.constructionRequired,
        localBuffer: { wheat: 15 },
      } : b
    ),
  };

  // Advance 2 full days — worker should process wheat into flour
  state = advance(state, TICKS_PER_DAY * 2);

  const mill = state.buildings.find(b => b.id === millId)!;
  const localFlour = mill.localBuffer['flour'] || 0;
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const shFlour = sh.localBuffer['flour'] || 0;
  const remainingWheat = mill.localBuffer['wheat'] || 0;
  assert(localFlour > 0 || shFlour > 0 || state.resources.flour > 0,
    `Mill produced flour: local=${localFlour}, storehouse=${shFlour}, global=${state.resources.flour}`);
  assert(remainingWheat < 15,
    `Mill consumed wheat: started with 15, now ${remainingWheat}`);
}

// ================================================================
// TEST 3: Worker hauls inputs from storehouse to processing building
// ================================================================
heading('Worker Hauls Inputs From Storehouse');

{
  let state = flatWorld(15, 10);
  state = addVillager(state, 2, 3);

  // Place buildings on separate rows to avoid blocking each other's paths
  state = placeBuilding(state, 'tent', 2, 3);
  state = placeBuilding(state, 'storehouse', 4, 3);
  state = placeBuilding(state, 'mill', 7, 3);
  const homeId = state.buildings[0].id;
  const millId = state.buildings.find(b => b.type === 'mill')!.id;

  state = assignVillager(state, 'v1', millId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Force all buildings to constructed; put wheat and bread in storehouse buffer
  const storehouseId = state.buildings.find(b => b.type === 'storehouse')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id === millId) return { ...b, constructed: true, constructionProgress: b.constructionRequired };
      if (b.id === storehouseId) return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { wheat: 20, bread: 10 } };
      return { ...b, constructed: true, constructionProgress: b.constructionRequired };
    }),
    resources: { ...state.resources, wheat: 20, bread: 10 },
  };

  // Advance several days — worker should go to mill, find no inputs,
  // travel to storehouse, pick up wheat, bring it back, and process
  state = advance(state, TICKS_PER_DAY * 5);

  const mill = state.buildings.find(b => b.id === millId)!;
  const localFlour = mill.localBuffer['flour'] || 0;
  const globalFlour = state.resources.flour;
  const remainingWheat = state.resources.wheat;

  assert(localFlour > 0 || globalFlour > 0,
    `Worker hauled wheat and produced flour: localFlour=${localFlour}, globalFlour=${globalFlour}`);
  assert(remainingWheat < 20,
    `Wheat was consumed from global storage: started 20, now ${remainingWheat}`);
}

// ================================================================
// TEST 4: Processing building doesn't consume from global directly
// ================================================================
heading('Processing Does Not Consume Global Resources Directly');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'mill', 4, 5);
  const homeId = state.buildings[0].id;
  const millId = state.buildings.find(b => b.type === 'mill')!.id;

  state = assignVillager(state, 'v1', millId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Force mill to constructed, put wheat in global but NOT in local buffer
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.id === millId ? {
        ...b,
        constructed: true,
        constructionProgress: b.constructionRequired,
        localBuffer: {}, // Empty local buffer
      } : b
    ),
    resources: { ...state.resources, wheat: 20 },
  };

  const wheatBefore = state.resources.wheat;

  // Advance just 5 daytime ticks — not enough for worker to haul
  // (worker at (3,5), mill at (4,5) — arrives in 1 tick, but then needs to
  //  go to storehouse and back)
  // With no storehouse placed, worker can't haul inputs.
  // Even with storehouse, the working state should NOT directly consume global wheat
  state = advance(state, NIGHT_TICKS + 5);

  const mill = state.buildings.find(b => b.id === millId)!;
  const localFlour = mill.localBuffer['flour'] || 0;
  // Key assertion: no flour was produced (because local buffer had no wheat,
  // and consuming from global directly is not allowed)
  assert(localFlour === 0, 'Mill did not produce flour without inputs in local buffer');
}

// ================================================================
// TEST 5: Worker physically travels to storehouse and back
// ================================================================
heading('Worker Input Hauling Requires Physical Travel');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 2, 5);

  state = placeBuilding(state, 'tent', 2, 5);
  state = placeBuilding(state, 'storehouse', 15, 5);
  state = placeBuilding(state, 'mill', 3, 5);
  const homeId = state.buildings[0].id;
  const millId = state.buildings.find(b => b.type === 'mill')!.id;

  state = assignVillager(state, 'v1', millId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Force mill to constructed; put wheat in storehouse buffer
  const shId5 = state.buildings.find(b => b.type === 'storehouse')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id === millId) return { ...b, constructed: true, constructionProgress: b.constructionRequired };
      if (b.id === shId5) return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { wheat: 20 } };
      return { ...b, constructed: true, constructionProgress: b.constructionRequired };
    }),
    resources: { ...state.resources, wheat: 20 },
  };

  // Advance a few ticks past dawn — worker should head to mill first
  state = advance(state, NIGHT_TICKS + 3);

  const v = state.villagers.find(v => v.id === 'v1')!;
  const mill = state.buildings.find(b => b.id === millId)!;

  // Worker should be somewhere between home and mill, or at mill
  // The mill is only 1 tile away, so they'd arrive quickly and then
  // realize no inputs → start traveling to storehouse (12 tiles away)
  // After 3 ticks, worker should be traveling toward storehouse
  // (at most 3 tiles from mill)
  assert(v.x <= 6,
    `Worker hasn't teleported to storehouse (at x=${v.x}, storehouse at x=15)`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Processing Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
