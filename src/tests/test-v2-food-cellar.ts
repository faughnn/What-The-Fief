// test-v2-food-cellar.ts — Tests for food cellar building
// Food cellar reduces spoilage rate by 50% when constructed

import {
  createWorld, createVillager, GameState,
  TICKS_PER_DAY, ALL_TECHS, SPOILAGE,
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

  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  // Provide building materials
  state.resources = { ...state.resources, wood: 50, stone: 50, planks: 20 };
  sh.localBuffer = { ...sh.localBuffer, wood: 50, stone: 50, planks: 20 };

  return state;
}

// ================================================================
// TEST 1: Food cellar reduces spoilage
// ================================================================
heading('Food Cellar Reduces Spoilage');

{
  // Colony WITHOUT food cellar
  let state1 = setupColony();
  state1.resources = { ...state1.resources, food: 100, wheat: 100, meat: 50 };
  const sh1 = state1.buildings.find(b => b.type === 'storehouse')!;
  sh1.localBuffer = { food: 100, wheat: 100, meat: 50 };

  // Run exactly 1 day
  for (let i = 0; i < TICKS_PER_DAY; i++) state1 = tick(state1);
  const foodLossNoCellar = 100 - (state1.resources.food || 0);
  const wheatLossNoCellar = 100 - (state1.resources.wheat || 0);

  // Colony WITH food cellar
  let state2 = setupColony();
  state2.resources = { ...state2.resources, food: 100, wheat: 100, meat: 50 };
  const sh2 = state2.buildings.find(b => b.type === 'storehouse')!;
  sh2.localBuffer = { food: 100, wheat: 100, meat: 50 };

  state2 = placeBuilding(state2, 'food_cellar', 12, 10);
  const cellar = state2.buildings.find(b => b.type === 'food_cellar')!;
  cellar.constructed = true; cellar.hp = cellar.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state2 = tick(state2);
  const foodLossWithCellar = 100 - (state2.resources.food || 0);
  const wheatLossWithCellar = 100 - (state2.resources.wheat || 0);

  assert(foodLossWithCellar < foodLossNoCellar, `food cellar reduces food spoilage (${foodLossWithCellar} < ${foodLossNoCellar})`);
  assert(wheatLossWithCellar < wheatLossNoCellar, `food cellar reduces wheat spoilage (${wheatLossWithCellar} < ${wheatLossNoCellar})`);
}

// ================================================================
// TEST 2: Unconstructed food cellar has no effect
// ================================================================
heading('Unconstructed Cellar Has No Effect');

{
  // Colony with unconstructed food cellar
  let state1 = setupColony();
  state1.resources = { ...state1.resources, food: 100 };
  const sh1 = state1.buildings.find(b => b.type === 'storehouse')!;
  sh1.localBuffer = { food: 100 };

  for (let i = 0; i < TICKS_PER_DAY; i++) state1 = tick(state1);
  const foodLossNoEffect = 100 - (state1.resources.food || 0);

  let state2 = setupColony();
  state2.resources = { ...state2.resources, food: 100 };
  const sh2 = state2.buildings.find(b => b.type === 'storehouse')!;
  sh2.localBuffer = { food: 100 };

  state2 = placeBuilding(state2, 'food_cellar', 12, 10);
  // NOT constructed — should have no effect

  for (let i = 0; i < TICKS_PER_DAY; i++) state2 = tick(state2);
  const foodLossUnconstructed = 100 - (state2.resources.food || 0);

  assert(foodLossUnconstructed === foodLossNoEffect, `unconstructed cellar has no effect (${foodLossUnconstructed} === ${foodLossNoEffect})`);
}

// ================================================================
// TEST 3: Food cellar building exists in templates
// ================================================================
heading('Food Cellar Template');

{
  const state = setupColony();
  const prev = state.buildings.length;
  const result = placeBuilding(state, 'food_cellar', 6, 10);
  assert(result.buildings.length > prev, 'food_cellar can be placed');
  const cellar = result.buildings.find(b => b.type === 'food_cellar');
  assert(cellar !== undefined, 'food_cellar exists in buildings');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Food Cellar Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
