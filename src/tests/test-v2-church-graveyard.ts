// test-v2-church-graveyard.ts — Church morale and graveyard tests
// Church provides area morale boost. Graveyard receives dead villagers.

import {
  createWorld, createVillager, GameState, Building, EnemyEntity,
  TICKS_PER_DAY, NIGHT_TICKS,
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

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Church can be placed
// ================================================================
heading('Church Placement');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };
  state = placeBuilding(state, 'church', 5, 5);

  const church = state.buildings.find(b => b.type === 'church');
  assert(church !== undefined, 'Church placed successfully');
}

// ================================================================
// TEST 2: Church provides morale bonus to nearby villagers
// ================================================================
heading('Church Morale Bonus');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  state = placeBuilding(state, 'church', 5, 5);
  state = placeBuilding(state, 'house', 8, 5); // Adjacent to church (within 5 tiles)

  // Pre-construct
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };

  // Villager near church
  const v1 = createVillager(1, 8, 5);
  v1.food = 10;
  v1.homeBuildingId = state.buildings.find(b => b.type === 'house')!.id;
  v1.traits = [];

  // Place a second house far from church for comparison
  state = placeBuilding(state, 'house', 18, 18);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };

  // Villager far from church (same traits for comparison)
  const v2 = createVillager(2, 18, 18);
  v2.food = 10;
  v2.traits = [];
  v2.homeBuildingId = state.buildings.find(b => b.type === 'house' && b.x === 18)!.id;

  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  state = advance(state, TICKS_PER_DAY);

  const near = state.villagers.find(v => v.id === 'v1');
  const far = state.villagers.find(v => v.id === 'v2');

  if (near && far) {
    assert(near.morale > far.morale, `Near church has higher morale (near=${near.morale}, far=${far.morale})`);
  }
}

// ================================================================
// TEST 3: Graveyard records dead villagers
// ================================================================
heading('Graveyard Records Dead');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  state = placeBuilding(state, 'graveyard', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };

  // Villager with 0 HP (will die)
  const v1 = createVillager(1, 5, 5);
  v1.hp = 0;
  v1.food = 10;

  state = { ...state, villagers: [v1], nextVillagerId: 2 };

  assert(state.graveyard.length === 0, 'No graves initially');

  state = advance(state, 1);

  assert(state.graveyard.length === 1, `Dead villager recorded in graveyard (count=${state.graveyard.length})`);
  if (state.graveyard.length > 0) {
    assert(state.graveyard[0].name !== undefined, 'Grave has name');
  }
}

// ================================================================
// TEST 4: Graveyard persists across days
// ================================================================
heading('Graveyard Persists');

{
  let state = flatWorld(20, 20);
  state = { ...state, graveyard: [{ name: 'Edric', day: 5 }] };

  state = advance(state, TICKS_PER_DAY * 5);

  assert(state.graveyard.length === 1, 'Graveyard persists');
  assert(state.graveyard[0].name === 'Edric', 'Grave name persists');
}

// ================================================================
// TEST 5: Church can be placed with stone cost
// ================================================================
heading('Church Cost');

{
  let state = flatWorld(20, 20);
  // Not enough stone
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 0 } };
  const beforeCount = state.buildings.length;
  state = placeBuilding(state, 'church', 5, 5);
  assert(state.buildings.length === beforeCount, 'Church rejected without stone');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Church & Graveyard Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
