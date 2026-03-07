// test-v2-demolish.ts — Tests for demolish building command

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, HOUSING_INFO,
} from '../world.js';
import { tick, placeBuilding, assignVillager, demolishBuilding } from '../simulation.js';
import { TICKS_PER_DAY } from '../timing.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  let state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, rope: 50, ingots: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 7, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { wood: 200, stone: 200, food: 200, rope: 50 }
        : b.localBuffer,
    })),
  };
  return state;
}

// ================================================================
// TEST 1: Basic demolish removes building
// ================================================================
heading('Basic Demolish');
{
  let state = makeWorld();
  state = placeBuilding(state, 'farm', 2, 2);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  const buildingsBefore = state.buildings.length;
  state = demolishBuilding(state, farmId);

  assert(!state.buildings.some(b => b.id === farmId), 'farm removed after demolish');
  // Rubble should be created at the farm's tiles (2x2 = 4 rubble tiles)
  const rubbleCount = state.buildings.filter(b => b.type === 'rubble').length;
  assert(rubbleCount === 4, `4 rubble tiles created for 2x2 farm (got ${rubbleCount})`);
}

// ================================================================
// TEST 2: Demolish 1x1 building
// ================================================================
heading('Demolish 1x1');
{
  let state = makeWorld();
  state = placeBuilding(state, 'woodcutter', 2, 2);
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;

  state = demolishBuilding(state, wcId);

  assert(!state.buildings.some(b => b.id === wcId), 'woodcutter removed');
  const rubbleCount = state.buildings.filter(b => b.type === 'rubble').length;
  assert(rubbleCount === 1, `1 rubble tile for 1x1 building (got ${rubbleCount})`);
}

// ================================================================
// TEST 3: Workers unassigned on demolish
// ================================================================
heading('Workers Unassigned');
{
  let state = makeWorld();
  state = placeBuilding(state, 'farm', 2, 2);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'farm' ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b),
  };
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  const v1 = createVillager(1, 2, 2);
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', farmId);

  assert(state.villagers[0].jobBuildingId === farmId, 'worker assigned to farm before demolish');
  state = demolishBuilding(state, farmId);

  assert(state.villagers[0].jobBuildingId === null, 'worker job cleared after demolish');
  assert(state.villagers[0].role === 'idle', 'worker role set to idle after demolish');
}

// ================================================================
// TEST 4: Residents displaced on housing demolish
// ================================================================
heading('Residents Displaced');
{
  let state = makeWorld();
  state = placeBuilding(state, 'house', 2, 2);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'house' ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b),
  };
  const houseId = state.buildings.find(b => b.type === 'house')!.id;

  const v1 = createVillager(1, 2, 2);
  v1.homeBuildingId = houseId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };

  state = demolishBuilding(state, houseId);

  assert(state.villagers[0].homeBuildingId === null, 'resident homeless after housing demolish');
}

// ================================================================
// TEST 5: Material refund (50% of build cost)
// ================================================================
heading('Material Refund');
{
  let state = makeWorld();
  // Farm costs wood: 5
  state = placeBuilding(state, 'farm', 2, 2);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'farm' ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b),
  };
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  const woodBefore = state.resources.wood;
  state = demolishBuilding(state, farmId);
  const woodAfter = state.resources.wood;

  // 50% refund of 5 wood = 2 (floor)
  assert(woodAfter === woodBefore + 2, `50% wood refund on demolish (expected +2, got +${woodAfter - woodBefore})`);
}

// ================================================================
// TEST 6: Local buffer salvaged to storehouse
// ================================================================
heading('Buffer Salvaged');
{
  let state = makeWorld();
  state = placeBuilding(state, 'farm', 2, 2);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'farm' ? { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { wheat: 10 } } : b),
  };
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  const wheatBefore = state.resources.wheat;
  state = demolishBuilding(state, farmId);
  const wheatAfter = state.resources.wheat;

  assert(wheatAfter === wheatBefore + 10, `buffer wheat salvaged to global (expected +10, got +${wheatAfter - wheatBefore})`);
}

// ================================================================
// TEST 7: Cannot demolish town_hall or storehouse (critical buildings)
// ================================================================
heading('Cannot Demolish Critical Buildings');
{
  let state = makeWorld();
  const shId = state.buildings.find(b => b.type === 'storehouse')!.id;

  const buildingsBefore = state.buildings.length;
  state = demolishBuilding(state, shId);
  const buildingsAfter = state.buildings.length;

  assert(buildingsAfter === buildingsBefore, 'storehouse not demolished (critical building)');
  assert(state.buildings.some(b => b.id === shId), 'storehouse still exists');
}

// ================================================================
// TEST 8: Cannot demolish non-existent building
// ================================================================
heading('Invalid Building ID');
{
  let state = makeWorld();
  const buildingsBefore = state.buildings.length;
  state = demolishBuilding(state, 'nonexistent');
  assert(state.buildings.length === buildingsBefore, 'no change when demolishing non-existent building');
}

// ================================================================
// TEST 9: Grid tiles cleared after demolish
// ================================================================
heading('Grid Tiles Cleared');
{
  let state = makeWorld();
  state = placeBuilding(state, 'farm', 2, 2);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  // Farm is 2x2 at (2,2) — tiles (2,2) (3,2) (2,3) (3,3)
  assert(state.grid[2][2].building !== null, 'grid has farm before demolish');
  state = demolishBuilding(state, farmId);

  // After demolish, tiles should have rubble (not null, since rubble is placed)
  const rubbleAt22 = state.grid[2][2].building;
  assert(rubbleAt22 !== null && rubbleAt22.type === 'rubble', 'grid tile has rubble after demolish');
}

// ================================================================
// TEST 10: Demolish unconstructed building (construction site)
// ================================================================
heading('Demolish Construction Site');
{
  let state = makeWorld();
  state = placeBuilding(state, 'bakery', 3, 3);
  // bakery is NOT constructed by default
  const bakeryId = state.buildings.find(b => b.type === 'bakery')!.id;
  assert(!state.buildings.find(b => b.id === bakeryId)!.constructed, 'bakery not yet constructed');

  state = demolishBuilding(state, bakeryId);
  assert(!state.buildings.some(b => b.id === bakeryId), 'construction site removed on demolish');
  // No material refund for unconstructed buildings
}

// ================================================================
// SUMMARY
// ================================================================
console.log(`\nDemolish: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
