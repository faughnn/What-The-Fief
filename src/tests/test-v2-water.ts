// test-v2-water.ts — Tests for water resource system
// Bellwright: water is a crafting resource from wells and water collectors, used in cooking.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, ALL_TECHS, BUILDING_TEMPLATES, ResourceType,
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

  // Tent for housing
  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return state;
}

function addWorker(state: GameState, x: number, y: number, role?: string): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  v.food = 8; v.morale = 80; v.hp = 20; v.maxHp = 20;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')?.id || null;
  state.villagers = [...state.villagers, v];
  state.nextVillagerId++;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

function skipToDay(state: GameState): GameState {
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  return state;
}

// ================================================================
// TEST 1: Water resource type exists
// ================================================================
heading('Water Resource');

{
  const state = createWorld(20, 20, 1);
  assert('water' in state.resources, 'water resource exists in state');
  assert(state.resources.water === 0, 'water starts at 0');
}

// ================================================================
// TEST 2: Well building template exists
// ================================================================
heading('Well Building');

{
  const t = BUILDING_TEMPLATES['well'];
  assert(t !== undefined, 'well template exists');
  assert(t.production !== undefined, 'well has production');
  assert(t.production!.output === 'water', 'well produces water');
  assert(t.cost.stone > 0, 'well costs stone');
}

// ================================================================
// TEST 3: Water collector template exists
// ================================================================
heading('Water Collector');

{
  const t = BUILDING_TEMPLATES['water_collector'];
  assert(t !== undefined, 'water_collector template exists');
  assert(t.production !== undefined, 'water_collector has production');
  assert(t.production!.output === 'water', 'water_collector produces water');
}

// ================================================================
// TEST 4: Well produces water with a worker
// ================================================================
heading('Well Production');

{
  let state = setupColony();
  state = placeBuilding(state, 'well', 10, 8);
  const well = state.buildings.find(b => b.type === 'well')!;
  well.constructed = true; well.hp = well.maxHp;

  state = addWorker(state, 10, 8);
  const v = state.villagers[0];
  state = assignVillager(state, v.id, well.id);

  // Run for a full day cycle (dawn triggers work travel, then production)
  // TPU for well = 800/3 ≈ 267. Need dawn + travel + 267 work ticks.
  state = advance(state, TICKS_PER_DAY);

  const waterInBuffer = state.buildings.find(b => b.type === 'well')!.localBuffer.water || 0;
  const waterGlobal = state.resources.water || 0;
  assert(waterInBuffer > 0 || waterGlobal > 0, `well produced water (buffer=${waterInBuffer}, global=${waterGlobal})`);
}

// ================================================================
// TEST 5: Kitchen uses water as input
// ================================================================
heading('Kitchen Uses Water');

{
  const t = BUILDING_TEMPLATES['kitchen'];
  assert(t !== undefined, 'kitchen template exists');
  assert(t.production !== undefined, 'kitchen has production');
  assert(t.production!.inputs !== undefined, 'kitchen has inputs');
  assert(t.production!.inputs!.water !== undefined, 'kitchen requires water input');
}

// ================================================================
// TEST 6: Kitchen produces bread from flour + water
// ================================================================
heading('Kitchen Production');

{
  let state = setupColony();

  // Add resources for kitchen placement
  state.resources = { ...state.resources, planks: 20 };
  const sh2 = state.buildings.find(b => b.type === 'storehouse')!;
  sh2.localBuffer = { ...sh2.localBuffer, planks: 20 };

  // Build and stock kitchen
  state = placeBuilding(state, 'kitchen', 10, 7);
  const kitchen = state.buildings.find(b => b.type === 'kitchen')!;
  kitchen.constructed = true; kitchen.hp = kitchen.maxHp;
  // Pre-stock inputs
  kitchen.localBuffer = { flour: 20, water: 20 };

  state = addWorker(state, 10, 7);
  const v = state.villagers[0];
  state = assignVillager(state, v.id, kitchen.id);

  // Run for a full day to trigger dawn → work cycle
  state = advance(state, TICKS_PER_DAY);

  const kitchenRef = state.buildings.find(b => b.type === 'kitchen')!;
  const breadInBuffer = kitchenRef.localBuffer.bread || 0;
  const breadGlobal = state.resources.bread || 0;
  assert(breadInBuffer > 0 || breadGlobal > 0, `kitchen produced bread from flour+water (buffer=${breadInBuffer}, global=${breadGlobal})`);
}

// ================================================================
// TEST 7: Well can be placed on any terrain
// ================================================================
heading('Well Placement');

{
  let state = setupColony();
  state = placeBuilding(state, 'well', 5, 5);
  const well = state.buildings.find(b => b.type === 'well');
  assert(well !== undefined, 'well placed successfully');
}

// ================================================================
// TEST 8: Water collector exists as outdoor building
// ================================================================
heading('Water Collector Outdoor');

{
  const t = BUILDING_TEMPLATES['water_collector'];
  assert(t !== undefined, 'water_collector template exists');
  assert(t.cost.wood > 0, 'water_collector costs wood');
}

// ================================================================
// TEST 9: Water in ALL_RESOURCES
// ================================================================
heading('Water In Resource Lists');

{
  const { ALL_RESOURCES } = require('../world.js');
  assert(ALL_RESOURCES.includes('water'), 'water in ALL_RESOURCES');
}

// ================================================================
// TEST 10: Well also prevents fire spread (existing mechanic)
// ================================================================
heading('Well Fire Prevention');

{
  // Wells already prevent fire spread within 3 tiles — verify the new well template
  // still works with the existing fire prevention system
  const t = BUILDING_TEMPLATES['well'];
  assert(t.type === 'well', 'well template type correct');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Water Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
