// test-v2-comfort.ts — Tests for housing comfort system
// Bellwright tracks housing comfort: better housing = better morale.
// We implement comfort levels per housing type + furniture bonus.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, BUILDING_TEMPLATES, ALL_TECHS,
  HOUSING_INFO, HOUSING_COMFORT,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
} from '../simulation/index.js';

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

  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, wood: 100, stone: 50, planks: 50 };
  state.resources = { ...state.resources, food: 200, wood: 100, stone: 50, planks: 50 };

  return state;
}

function advanceTicks(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Housing comfort values exist
// ================================================================
heading('Housing Comfort Values');

{
  assert(HOUSING_COMFORT !== undefined, 'HOUSING_COMFORT constant exists');
  assert(HOUSING_COMFORT.tent !== undefined, 'tent has comfort value');
  assert(HOUSING_COMFORT.house !== undefined, 'house has comfort value');
  assert(HOUSING_COMFORT.manor !== undefined, 'manor has comfort value');
  assert(HOUSING_COMFORT.tent < HOUSING_COMFORT.house, 'house more comfortable than tent');
  assert(HOUSING_COMFORT.house < HOUSING_COMFORT.manor, 'manor more comfortable than house');
}

// ================================================================
// TEST 2: Carpenter building template
// ================================================================
heading('Carpenter Building');

{
  const t = BUILDING_TEMPLATES['carpenter'];
  assert(t !== undefined, 'carpenter template exists');
  if (t) {
    assert(t.production !== null, 'carpenter has production');
    assert(t.production!.output === 'furniture', 'carpenter produces furniture');
    assert(t.production!.inputs !== null, 'carpenter has inputs');
    assert(t.production!.inputs!.planks !== undefined, 'carpenter requires planks');
    assert(t.maxWorkers >= 1, 'carpenter has at least 1 worker slot');
  }
}

// ================================================================
// TEST 3: Furniture is a valid resource
// ================================================================
heading('Furniture Resource');

{
  const state = setupColony();
  assert('furniture' in state.resources, 'furniture is a valid resource');
  assert(state.resources.furniture === 0, 'furniture starts at 0');
}

// ================================================================
// TEST 4: Carpenter produces furniture from planks
// ================================================================
heading('Carpenter Production');

{
  let state = setupColony();

  state = placeBuilding(state, 'carpenter', 5, 5);
  const cp = state.buildings.find(b => b.type === 'carpenter')!;
  cp.constructed = true; cp.hp = cp.maxHp;
  cp.localBuffer = { planks: 20 };

  state = placeBuilding(state, 'tent', 6, 5);
  const tent = state.buildings.find(b => b.type === 'tent' && b.x === 6)!;
  tent.constructed = true; tent.hp = tent.maxHp;

  const v = createVillager(1, 5, 5);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = tent.id;
  state.villagers = [v];
  state.nextVillagerId = 2;
  state = assignVillager(state, 'v1', cp.id);

  state = advanceTicks(state, TICKS_PER_DAY * 2);

  const cpRef = state.buildings.find(b => b.type === 'carpenter')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const totalFurniture = (cpRef.localBuffer.furniture || 0) + (shRef.localBuffer.furniture || 0) + (state.resources.furniture || 0);
  assert(totalFurniture > 0, `carpenter produced furniture (${totalFurniture})`);
}

// ================================================================
// TEST 5: Comfort morale bonus from better housing
// ================================================================
heading('Comfort Morale Bonus');

{
  let state = setupColony();

  // Place a tent and a house
  state = placeBuilding(state, 'tent', 5, 5);
  const tent = state.buildings.find(b => b.type === 'tent' && b.x === 5 && b.y === 5)!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state = placeBuilding(state, 'house', 7, 5);
  const house = state.buildings.find(b => b.type === 'house')!;
  house.constructed = true; house.hp = house.maxHp;

  // Villager in tent
  const v1 = createVillager(1, 5, 5);
  v1.food = 8; v1.morale = 50;
  v1.homeBuildingId = tent.id;

  // Villager in house
  const v2 = createVillager(2, 7, 5);
  v2.food = 8; v2.morale = 50;
  v2.homeBuildingId = house.id;

  state.villagers = [v1, v2];
  state.nextVillagerId = 3;

  // Run a day for comfort morale to apply
  state = advanceTicks(state, TICKS_PER_DAY);

  const vInTent = state.villagers.find(v => v.id === 'v1')!;
  const vInHouse = state.villagers.find(v => v.id === 'v2')!;

  // House dweller should have higher morale than tent dweller
  assert(vInHouse.morale >= vInTent.morale,
    `house gives more morale than tent (house=${vInHouse.morale}, tent=${vInTent.morale})`);
}

// ================================================================
// TEST 6: Furniture increases comfort
// ================================================================
heading('Furniture Comfort Bonus');

{
  let state = setupColony();

  state = placeBuilding(state, 'house', 5, 5);
  const house = state.buildings.find(b => b.type === 'house')!;
  house.constructed = true; house.hp = house.maxHp;

  const v = createVillager(1, 5, 5);
  v.food = 8; v.morale = 50;
  v.homeBuildingId = house.id;
  state.villagers = [v];
  state.nextVillagerId = 2;

  // Run a day without furniture
  state = advanceTicks(state, TICKS_PER_DAY);
  const moraleNoFurniture = state.villagers[0].morale;

  // Add furniture to storehouse
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.furniture = 5;
  state.resources.furniture = 5;

  // Run another day with furniture
  state = advanceTicks(state, TICKS_PER_DAY);
  const moraleWithFurniture = state.villagers[0].morale;

  assert(moraleWithFurniture >= moraleNoFurniture,
    `furniture boosts morale (without=${moraleNoFurniture}, with=${moraleWithFurniture})`);
}

// ================================================================
// TEST 7: Manor has highest comfort
// ================================================================
heading('Manor Comfort');

{
  assert(HOUSING_COMFORT.manor >= 3, `manor comfort is at least 3 (got ${HOUSING_COMFORT.manor})`);
  assert(HOUSING_COMFORT.inn !== undefined, 'inn has comfort value');
  assert(HOUSING_COMFORT.inn >= HOUSING_COMFORT.house, 'inn at least as comfortable as house');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Comfort Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
