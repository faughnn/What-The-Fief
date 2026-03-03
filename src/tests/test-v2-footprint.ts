// test-v2-footprint.ts — Multi-tile building footprint tests
// Town hall is 2x2. Sawmill is 2x1. These must block movement on all their tiles.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, BUILDING_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding,
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

// ================================================================
// TEST 1: Town hall is 3x3
// ================================================================
heading('Town Hall 3x3 Footprint');

{
  const template = BUILDING_TEMPLATES['town_hall'];
  assert(template.width === 3, `Town hall width is 3 (got ${template.width})`);
  assert(template.height === 3, `Town hall height is 3 (got ${template.height})`);
}

// ================================================================
// TEST 2: Town hall occupies all 9 tiles on grid
// ================================================================
heading('Town Hall Occupies 9 Tiles');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 200, stone: 200, planks: 50 } };
  state = placeBuilding(state, 'town_hall', 5, 5);

  // Check all 9 tiles have the building reference
  let allOccupied = true;
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      if (!state.grid[5 + dy][5 + dx].building) allOccupied = false;
    }
  }
  assert(allOccupied, 'All 9 tiles have building reference');

  // All should reference same building
  const ids = new Set<string>();
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const b = state.grid[5 + dy][5 + dx].building;
      if (b) ids.add(b.id);
    }
  }
  assert(ids.size === 1, 'All 9 tiles reference same building');
}

// ================================================================
// TEST 3: Cannot place building overlapping town hall
// ================================================================
heading('Cannot Overlap Town Hall');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 200, stone: 200, planks: 50 } };
  state = placeBuilding(state, 'town_hall', 5, 5);
  const buildingsBefore = state.buildings.length;

  // Try to place a house on an overlapping tile (6,6 is inside 3x3 town hall)
  state = placeBuilding(state, 'house', 6, 6);

  assert(state.buildings.length === buildingsBefore, 'Overlapping placement rejected');
}

// ================================================================
// TEST 4: Sawmill is 2x1
// ================================================================
heading('Sawmill 2x1 Footprint');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 200, stone: 200 } };
  state = placeBuilding(state, 'sawmill', 5, 5);

  // Check both tiles
  assert(state.grid[5][5].building !== null, 'Tile (5,5) has sawmill');
  assert(state.grid[5][6].building !== null, 'Tile (6,5) has sawmill');

  // Tile below should NOT have the building (it's 2x1, not 2x2)
  assert(state.grid[6][5].building === null, 'Tile (5,6) is empty (sawmill is 2x1)');
}

// ================================================================
// TEST 5: Building placement respects map bounds for multi-tile
// ================================================================
heading('Multi-tile Bounds Check');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 200, stone: 200 } };
  const buildingsBefore = state.buildings.length;

  // Try to place 2x2 town hall at edge (19,19) — goes out of bounds
  state = placeBuilding(state, 'town_hall', 19, 19);

  assert(state.buildings.length === buildingsBefore, 'Out-of-bounds multi-tile placement rejected');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Footprint Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
