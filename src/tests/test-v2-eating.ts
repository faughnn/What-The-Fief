// test-v2-eating.ts — V2 spatial eating tests
// Villagers must physically travel to a food source to eat. No teleporting food.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, CARRY_CAPACITY,
  BUILDING_TEMPLATES, HOME_DEPARTURE_TICK,
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
// TEST 1: Hungry villager travels to storehouse to eat
// ================================================================
heading('Hungry Villager Travels to Eat');

{
  let state = flatWorld(15, 10);
  state = addVillager(state, 2, 5);

  state = placeBuilding(state, 'tent', 2, 5);
  state = placeBuilding(state, 'storehouse', 8, 5);
  const homeId = state.buildings[0].id;

  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId, food: 3 } : v
    ),
    resources: { ...state.resources, bread: 5 },
  };

  // Advance past dawn — hungry villager should travel to eat
  state = advance(state, NIGHT_TICKS + 1);

  const v = state.villagers.find(v => v.id === 'v1')!;
  assert(v.state === 'traveling_to_eat' || v.state === 'eating',
    `Hungry villager traveling/eating (state=${v.state})`);
}

// ================================================================
// TEST 2: Villager eats at storehouse (consumes global food)
// ================================================================
heading('Villager Eats at Storehouse');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'storehouse', 5, 5);
  const homeId = state.buildings[0].id;

  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId, food: 3 } : v
    ),
    resources: { ...state.resources, bread: 5 },
  };

  const breadBefore = state.resources.bread;

  // Advance enough to travel to storehouse (2 tiles) and eat
  state = advance(state, NIGHT_TICKS + 5);

  const v = state.villagers.find(v => v.id === 'v1')!;
  const breadAfter = state.resources.bread;

  assert(breadAfter < breadBefore, `Bread consumed: ${breadBefore} → ${breadAfter}`);
  assert(v.food > 3, `Villager food increased: was 3, now ${v.food}`);
}

// ================================================================
// TEST 3: Eating requires physical travel (no instant feeding)
// ================================================================
heading('Eating Requires Physical Travel');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 2, 5);

  state = placeBuilding(state, 'tent', 2, 5);
  state = placeBuilding(state, 'storehouse', 15, 5); // 13 tiles away
  const homeId = state.buildings[0].id;

  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId, food: 3 } : v
    ),
    resources: { ...state.resources, bread: 5 },
  };

  const breadBefore = state.resources.bread;

  // Advance just 3 ticks past dawn — not enough to reach storehouse
  state = advance(state, NIGHT_TICKS + 3);

  const v = state.villagers.find(v => v.id === 'v1')!;
  const breadAfter = state.resources.bread;

  assert(v.state === 'traveling_to_eat',
    `Villager still traveling to eat (state=${v.state}, x=${v.x})`);
  assert(breadAfter === breadBefore,
    `No bread consumed yet while traveling (${breadBefore} → ${breadAfter})`);
  assert(v.x < 15, `Villager hasn't teleported to storehouse (at x=${v.x})`);
}

// ================================================================
// TEST 4: Well-fed villager goes straight to work (skips eating)
// ================================================================
heading('Well-Fed Villager Skips Eating');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'farm', 5, 5);
  state = placeBuilding(state, 'storehouse', 7, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId, food: 8 } : v
    ),
    // Force farm constructed
    buildings: state.buildings.map(b =>
      b.id === farmId ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b
    ),
  };

  // Advance past dawn
  state = advance(state, NIGHT_TICKS + 1);

  const v = state.villagers.find(v => v.id === 'v1')!;
  assert(v.state === 'traveling_to_work',
    `Well-fed villager goes to work, not eating (state=${v.state})`);
}

// ================================================================
// TEST 5: Villager resumes work after eating
// ================================================================
heading('Villager Resumes Work After Eating');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'storehouse', 4, 5);
  state = placeBuilding(state, 'farm', 6, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId, food: 3 } : v
    ),
    buildings: state.buildings.map(b =>
      b.id === farmId ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b
    ),
    resources: { ...state.resources, bread: 5 },
  };

  // Advance enough to eat and go to work (storehouse 1 tile away, farm 3 tiles from storehouse)
  state = advance(state, NIGHT_TICKS + 10);

  const v = state.villagers.find(v => v.id === 'v1')!;
  assert(v.state === 'working' || v.state === 'traveling_to_work',
    `Villager resumed work after eating (state=${v.state})`);
}

// ================================================================
// TEST 6: No food available — villager starves but doesn't freeze
// ================================================================
heading('No Food Available — Villager Goes To Work');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);

  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'farm', 5, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId, food: 3 } : v
    ),
    buildings: state.buildings.map(b =>
      b.id === farmId ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b
    ),
    // No food, no storehouse
    resources: { ...state.resources, bread: 0, flour: 0, wheat: 0, food: 0 },
  };

  // Advance past dawn — no food and no storehouse, so villager goes to work
  state = advance(state, NIGHT_TICKS + 3);

  const v = state.villagers.find(v => v.id === 'v1')!;
  assert(v.state === 'traveling_to_work' || v.state === 'working' || v.state === 'traveling_to_build',
    `Villager goes to work when no food available (state=${v.state})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Eating Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
