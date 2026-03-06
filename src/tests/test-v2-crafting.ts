// test-v2-crafting.ts — Tests for additional crafting buildings
// Bellwright: butchery (meat processing), compost pile (fertilizer), drying rack (preservation)

import {
  createWorld, createVillager, GameState,
  TICKS_PER_DAY, ALL_TECHS, BUILDING_TEMPLATES,
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

  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return state;
}

function addWorker(state: GameState, x: number, y: number): GameState {
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

// ================================================================
// TEST 1: Butchery template exists
// ================================================================
heading('Butchery Template');

{
  const t = BUILDING_TEMPLATES['butchery'];
  assert(t !== undefined, 'butchery template exists');
  assert(t.production !== undefined, 'butchery has production');
  assert(t.production!.inputs !== undefined, 'butchery has inputs');
  assert(t.production!.inputs!.food !== undefined, 'butchery requires food input');
  assert(t.production!.output === 'meat', 'butchery produces meat');
  assert(t.maxWorkers >= 1, 'butchery has worker slots');
}

// ================================================================
// TEST 2: Meat resource type exists
// ================================================================
heading('Meat Resource');

{
  const state = createWorld(20, 20, 1);
  assert('meat' in state.resources, 'meat resource exists');
  assert(state.resources.meat === 0, 'meat starts at 0');
}

// ================================================================
// TEST 3: Butchery produces meat from food
// ================================================================
heading('Butchery Production');

{
  let state = setupColony();

  state = placeBuilding(state, 'butchery', 10, 8);
  const butchery = state.buildings.find(b => b.type === 'butchery')!;
  butchery.constructed = true; butchery.hp = butchery.maxHp;
  butchery.localBuffer = { food: 20 };

  state = addWorker(state, 10, 8);
  state = assignVillager(state, state.villagers[0].id, butchery.id);

  state = advance(state, TICKS_PER_DAY);

  const ref = state.buildings.find(b => b.type === 'butchery')!;
  const meatBuffer = ref.localBuffer.meat || 0;
  const meatGlobal = state.resources.meat || 0;
  assert(meatBuffer > 0 || meatGlobal > 0, `butchery produced meat (buffer=${meatBuffer}, global=${meatGlobal})`);
}

// ================================================================
// TEST 4: Meat has higher food satisfaction than raw food
// ================================================================
heading('Meat Satisfaction');

{
  const { FOOD_PRIORITY } = require('../world.js');
  const meatEntry = FOOD_PRIORITY.find((f: any) => f.resource === 'meat');
  const foodEntry = FOOD_PRIORITY.find((f: any) => f.resource === 'food');
  assert(meatEntry !== undefined, 'meat in FOOD_PRIORITY');
  assert(meatEntry.satisfaction > foodEntry.satisfaction, `meat satisfaction (${meatEntry.satisfaction}) > food (${foodEntry.satisfaction})`);
}

// ================================================================
// TEST 5: Compost pile template exists
// ================================================================
heading('Compost Pile Template');

{
  const t = BUILDING_TEMPLATES['compost_pile'];
  assert(t !== undefined, 'compost_pile template exists');
  assert(t.production !== undefined, 'compost_pile has production');
  assert(t.production!.output === 'fertilizer', 'compost_pile produces fertilizer');
  assert(t.production!.inputs !== undefined, 'compost_pile has inputs');
  assert(t.production!.inputs!.food !== undefined, 'compost_pile uses food');
}

// ================================================================
// TEST 6: Fertilizer resource type exists
// ================================================================
heading('Fertilizer Resource');

{
  const state = createWorld(20, 20, 1);
  assert('fertilizer' in state.resources, 'fertilizer resource exists');
  assert(state.resources.fertilizer === 0, 'fertilizer starts at 0');
}

// ================================================================
// TEST 7: Compost pile produces fertilizer
// ================================================================
heading('Compost Pile Production');

{
  let state = setupColony();

  state = placeBuilding(state, 'compost_pile', 10, 8);
  const compost = state.buildings.find(b => b.type === 'compost_pile')!;
  compost.constructed = true; compost.hp = compost.maxHp;
  compost.localBuffer = { food: 20 };

  state = addWorker(state, 10, 8);
  state = assignVillager(state, state.villagers[0].id, compost.id);

  state = advance(state, TICKS_PER_DAY);

  const ref = state.buildings.find(b => b.type === 'compost_pile')!;
  const fertBuffer = ref.localBuffer.fertilizer || 0;
  const fertGlobal = state.resources.fertilizer || 0;
  assert(fertBuffer > 0 || fertGlobal > 0, `compost produced fertilizer (buffer=${fertBuffer}, global=${fertGlobal})`);
}

// ================================================================
// TEST 8: Drying rack template exists
// ================================================================
heading('Drying Rack Template');

{
  const t = BUILDING_TEMPLATES['drying_rack'];
  assert(t !== undefined, 'drying_rack template exists');
  assert(t.production !== undefined, 'drying_rack has production');
  assert(t.production!.output === 'dried_food', 'drying_rack produces dried_food');
  assert(t.production!.inputs !== undefined, 'drying_rack has inputs');
}

// ================================================================
// TEST 9: Dried food resource exists
// ================================================================
heading('Dried Food Resource');

{
  const state = createWorld(20, 20, 1);
  assert('dried_food' in state.resources, 'dried_food resource exists');
}

// ================================================================
// TEST 10: Drying rack produces dried food
// ================================================================
heading('Drying Rack Production');

{
  let state = setupColony();

  state = placeBuilding(state, 'drying_rack', 10, 8);
  const rack = state.buildings.find(b => b.type === 'drying_rack')!;
  rack.constructed = true; rack.hp = rack.maxHp;
  rack.localBuffer = { food: 20 };

  state = addWorker(state, 10, 8);
  state = assignVillager(state, state.villagers[0].id, rack.id);

  state = advance(state, TICKS_PER_DAY);

  const ref = state.buildings.find(b => b.type === 'drying_rack')!;
  const driedBuffer = ref.localBuffer.dried_food || 0;
  const driedGlobal = state.resources.dried_food || 0;
  assert(driedBuffer > 0 || driedGlobal > 0, `drying rack produced dried food (buffer=${driedBuffer}, global=${driedGlobal})`);
}

// ================================================================
// TEST 11: Dried food has lower spoilage rate
// ================================================================
heading('Dried Food Spoilage');

{
  const { SPOILAGE_RATES } = require('../world.js');
  assert(SPOILAGE_RATES !== undefined, 'SPOILAGE_RATES exists');
  assert(SPOILAGE_RATES.dried_food < SPOILAGE_RATES.food, 'dried food spoils slower than raw food');
}

// ================================================================
// TEST 12: Building cost verification
// ================================================================
heading('Building Costs');

{
  const bt = BUILDING_TEMPLATES['butchery'];
  assert(bt.cost.wood > 0, 'butchery costs wood');

  const cp = BUILDING_TEMPLATES['compost_pile'];
  assert(cp.cost.wood > 0, 'compost costs wood');

  const dr = BUILDING_TEMPLATES['drying_rack'];
  assert(dr.cost.wood > 0, 'drying rack costs wood');
}

// ================================================================
// TEST 13: Butchery also produces leather as byproduct
// ================================================================
heading('Butchery Leather Byproduct');

{
  let state = setupColony();

  state = placeBuilding(state, 'butchery', 10, 8);
  const butchery = state.buildings.find(b => b.type === 'butchery')!;
  butchery.constructed = true; butchery.hp = butchery.maxHp;
  butchery.localBuffer = { food: 30 };

  state = addWorker(state, 10, 8);
  state = assignVillager(state, state.villagers[0].id, butchery.id);

  // Run for 2 days to ensure some byproduct
  state = advance(state, TICKS_PER_DAY * 2);

  const leatherGlobal = state.resources.leather || 0;
  const ref = state.buildings.find(b => b.type === 'butchery')!;
  const leatherBuffer = ref.localBuffer.leather || 0;
  assert(leatherBuffer > 0 || leatherGlobal > 0, `butchery produced leather byproduct (buffer=${leatherBuffer}, global=${leatherGlobal})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Crafting Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
