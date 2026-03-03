// test-v2-healing.ts — Healing system tests
// Sick villagers travel to storehouse with herbs and consume 1 herb to cure.

import {
  createWorld, createVillager, GameState, Building,
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
// TEST 1: Sick villager travels to storehouse and gets healed by herbs
// ================================================================
heading('Sick Villager Healed by Herbs');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, herbs: 5 } };

  // Place storehouse with herbs in buffer
  state = placeBuilding(state, 'storehouse', 10, 10);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { herbs: 5 } : b.localBuffer,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };

  // Sick villager at (5, 10) — needs to walk to storehouse at (10, 10)
  const v = createVillager(1, 5, 10);
  v.sick = true;
  v.sickDays = 10;
  v.food = 10;
  v.state = 'idle';

  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // Run enough ticks for villager to walk to storehouse and heal
  // Distance = 5 tiles, plus some processing time
  state = advance(state, TICKS_PER_DAY);

  const healed = state.villagers.find(v => v.id === 'v1');
  assert(healed !== undefined, 'Villager survived');
  if (healed) {
    assert(healed.sick === false, `Villager healed by herbs (sick=${healed.sick})`);
  }

  // Herbs should have been consumed
  const sh = state.buildings.find(b => b.type === 'storehouse');
  if (sh) {
    const herbsLeft = sh.localBuffer.herbs || 0;
    assert(herbsLeft < 5, `Herbs consumed from storehouse (herbs=${herbsLeft})`);
  }
}

// ================================================================
// TEST 2: Sick villager NOT healed without herbs
// ================================================================
heading('No Herbs No Healing');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  // Storehouse with NO herbs
  state = placeBuilding(state, 'storehouse', 10, 10);
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

  const v = createVillager(1, 10, 10);
  v.sick = true;
  v.sickDays = 10; // Long duration
  v.food = 10;
  v.state = 'idle';

  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // Run a few ticks — villager should still be sick (no herbs to cure)
  state = advance(state, 30);

  const stillSick = state.villagers.find(v => v.id === 'v1');
  assert(stillSick !== undefined, 'Villager survived');
  if (stillSick) {
    assert(stillSick.sick === true, `Still sick without herbs (sick=${stillSick.sick})`);
  }
}

// ================================================================
// TEST 3: Herb consumption is physical (must be at storehouse)
// ================================================================
heading('Herb Healing Requires Physical Presence');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, herbs: 5 } };

  // Storehouse far away at (18, 18)
  state = placeBuilding(state, 'storehouse', 18, 18);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { herbs: 5 } : b.localBuffer,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };

  // Sick villager at (0, 0) — far from storehouse
  const v = createVillager(1, 0, 0);
  v.sick = true;
  v.sickDays = 10;
  v.food = 10;
  v.state = 'idle';

  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // After just 5 ticks, villager hasn't reached storehouse yet
  state = advance(state, 5);

  const v1 = state.villagers.find(v => v.id === 'v1');
  assert(v1 !== undefined, 'Villager exists');
  if (v1) {
    assert(v1.sick === true, `Still sick — hasn't reached storehouse yet (sick=${v1.sick})`);
  }
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Healing Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
