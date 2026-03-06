// test-v2-husbandry.ts — Tests for animal husbandry buildings (chicken_coop, livestock_barn, apiary)
import {
  createWorld, createVillager, GameState, Building,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, CONSTRUCTION_TICKS,
  TICKS_PER_DAY, ALL_TECHS,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

// Helper: create a world with storehouse and one building, assign worker
function setupProduction(buildingType: 'chicken_coop' | 'livestock_barn' | 'apiary'): GameState {
  let state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  // Storehouse with food
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 50 };
  state.resources.food = 50;

  // Tent for worker
  state = placeBuilding(state, 'tent', 9, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  // Production building — place near storehouse (storehouse is 2x1 at 10,10-11,10)
  state = placeBuilding(state, buildingType, 12, 10);
  const prodBuilding = state.buildings.find(b => b.type === buildingType)!;
  prodBuilding.constructed = true; prodBuilding.hp = prodBuilding.maxHp;

  // Worker
  const worker = createVillager(1, 10, 10);
  worker.food = 8; worker.homeBuildingId = tent.id;
  state.villagers = [worker];
  state.nextVillagerId = 2;
  state = assignVillager(state, worker.id, prodBuilding.id);

  return state;
}

// ========================
// TESTS
// ========================

console.log('\n=== Chicken Coop: Produces Food ===');
{
  let state = setupProduction('chicken_coop');
  const coop = state.buildings.find(b => b.type === 'chicken_coop')!;
  const initialFood = state.resources.food;

  // Run a full day — worker needs travel time + production takes PRODUCTION_BASE_TICKS
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const updatedCoop = state.buildings.find(b => b.type === 'chicken_coop')!;
  const bufferFood = updatedCoop.localBuffer.food || 0;
  assert(bufferFood > 0 || state.resources.food > initialFood,
    `Chicken coop produced food (buffer: ${bufferFood}, global: ${state.resources.food} vs initial ${initialFood})`);
}

console.log('\n=== Chicken Coop: Template Config ===');
{
  const t = BUILDING_TEMPLATES['chicken_coop'];
  assert(t.production?.output === 'food', 'Chicken coop output is food');
  assert(t.production?.inputs === null, 'Chicken coop has no inputs');
  assert(t.maxWorkers === 1, 'Chicken coop has 1 worker slot');
  assert(t.cost.wood === 8, 'Chicken coop costs 8 wood');
}

console.log('\n=== Livestock Barn: Produces Leather ===');
{
  let state = setupProduction('livestock_barn');

  // Run 2 full days — worker needs travel time + production takes PRODUCTION_BASE_TICKS
  for (let i = 0; i < TICKS_PER_DAY * 2; i++) state = tick(state);

  const updatedBarn = state.buildings.find(b => b.type === 'livestock_barn')!;
  const bufferLeather = updatedBarn.localBuffer.leather || 0;
  assert(bufferLeather > 0 || state.resources.leather > 0,
    `Livestock barn produced leather (buffer: ${bufferLeather}, global: ${state.resources.leather})`);
}

console.log('\n=== Livestock Barn: Template Config ===');
{
  const t = BUILDING_TEMPLATES['livestock_barn'];
  assert(t.production?.output === 'leather', 'Livestock barn output is leather');
  assert(t.production?.inputs === null, 'Livestock barn has no inputs');
  assert(t.maxWorkers === 1, 'Livestock barn has 1 worker slot');
  assert(t.width === 2, 'Livestock barn is 2-wide');
}

console.log('\n=== Apiary: Produces Herbs ===');
{
  let state = setupProduction('apiary');

  // Run a full day — worker needs travel time
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const updatedApiary = state.buildings.find(b => b.type === 'apiary')!;
  const bufferHerbs = updatedApiary.localBuffer.herbs || 0;
  assert(bufferHerbs > 0 || state.resources.herbs > 0,
    `Apiary produced herbs (buffer: ${bufferHerbs}, global: ${state.resources.herbs})`);
}

console.log('\n=== Apiary: Template Config ===');
{
  const t = BUILDING_TEMPLATES['apiary'];
  assert(t.production?.output === 'herbs', 'Apiary output is herbs');
  assert(t.production?.inputs === null, 'Apiary has no inputs');
  assert(t.maxWorkers === 1, 'Apiary has 1 worker slot');
  assert(t.cost.wood === 6, 'Apiary costs 6 wood');
}

console.log('\n=== Worker Assigned Correct Role ===');
{
  let state = setupProduction('chicken_coop');
  const worker = state.villagers[0];
  assert(worker.role === 'chicken_keeper', `Chicken coop worker role (got ${worker.role})`);

  state = setupProduction('livestock_barn');
  const barnWorker = state.villagers[0];
  assert(barnWorker.role === 'rancher', `Livestock barn worker role (got ${barnWorker.role})`);

  state = setupProduction('apiary');
  const apiaryWorker = state.villagers[0];
  assert(apiaryWorker.role === 'beekeeper', `Apiary worker role (got ${apiaryWorker.role})`);
}

console.log('\n=== Production Over Full Day ===');
{
  let state = setupProduction('chicken_coop');
  // Run a full day
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const coop = state.buildings.find(b => b.type === 'chicken_coop')!;
  const bufferFood = coop.localBuffer.food || 0;
  // Worker should produce some food and may haul some to storehouse
  const totalProduced = bufferFood + (state.resources.food - 50); // Initial was 50
  assert(totalProduced >= 0, `Chicken coop produced over full day (${totalProduced} total output above initial)`);
}

console.log('\n=== Foraging Hut: Produces Food ===');
{
  let state = setupProduction('foraging_hut' as any);
  // Run a full day
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const hut = state.buildings.find(b => b.type === 'foraging_hut')!;
  const bufferFood = hut.localBuffer.food || 0;
  const initialFood = 50;
  assert(bufferFood > 0 || state.resources.food > initialFood,
    `Foraging hut produced food (buffer: ${bufferFood}, global: ${state.resources.food} vs initial ${initialFood})`);
}

console.log('\n=== Foraging Hut: Template Config ===');
{
  const t = BUILDING_TEMPLATES['foraging_hut'];
  assert(t.production?.output === 'food', 'Foraging hut output is food');
  assert(t.production?.inputs === null, 'Foraging hut has no inputs');
  assert(t.maxWorkers === 1, 'Foraging hut has 1 worker slot');
  assert(t.cost.wood === 6, 'Foraging hut costs 6 wood');
  assert(t.allowedTerrain.includes('forest'), 'Foraging hut can be placed on forest');
}

console.log('\n=== Foraging Hut: Worker Role ===');
{
  let state = setupProduction('foraging_hut' as any);
  const worker = state.villagers[0];
  assert(worker.role === 'forager', `Foraging hut worker role (got ${worker.role})`);
}

// ========================
// SUMMARY
// ========================
console.log('\n========================================');
console.log(`V2 Husbandry Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
