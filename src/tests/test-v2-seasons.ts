// test-v2-seasons.ts — Seasonal farming and weather tests
// Farms should NOT produce in winter. Outdoor buildings affected by weather.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, DAYS_PER_SEASON, DAYS_PER_YEAR,
  BUILDING_TEMPLATES,
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

// Create a minimal colony for season testing:
// storehouse(1,3), tent(3,3), farm(4,3), all pre-constructed
function seasonTestSetup(startDay: number): { state: GameState, farmId: string } {
  let state = flatWorld(10, 10);
  state = { ...state, resources: { ...state.resources, wood: 80, stone: 20, food: 100 } };
  state = addVillager(state, 3, 3);

  state = placeBuilding(state, 'storehouse', 1, 3);
  // Use house for winter morale survival
  state = placeBuilding(state, 'house', 3, 3);
  state = placeBuilding(state, 'farm', 5, 3);
  const homeId = state.buildings.find(b => b.type === 'house')!.id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  // Pre-construct everything, stock storehouse with food + clothing
  state = {
    ...state,
    resources: { ...state.resources, linen: 5 },
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { food: 80, linen: 5 } : {},
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: {
            ...tile.building,
            constructed: true,
            constructionProgress: tile.building.constructionRequired,
            localBuffer: tile.building.type === 'storehouse' ? { food: 80, linen: 5 } : {},
          }}
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: homeId, food: 10 })),
  };

  state = assignVillager(state, 'v1', farmId);

  // Jump to target day by setting tick to 1 before boundary so next tick() triggers new day
  state = { ...state, tick: TICKS_PER_DAY * startDay - 1, day: Math.max(0, startDay - 1) };

  return { state, farmId };
}

// ================================================================
// TEST 1: Farm produces wheat in spring (day 0 to DAYS_PER_SEASON-1)
// ================================================================
heading('Farm Produces in Spring');

{
  const { state: s0, farmId } = seasonTestSetup(0);
  let state = advance(s0, TICKS_PER_DAY * 3);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const totalWheat = (farm.localBuffer['wheat'] || 0) + state.resources.wheat;
  assert(totalWheat > 0, `Farm produced wheat in spring (total=${totalWheat})`);
}

// ================================================================
// TEST 2: Farm does NOT produce wheat in winter
// ================================================================
heading('Farm Does Not Produce in Winter');

{
  const { state: s0, farmId } = seasonTestSetup(DAYS_PER_SEASON * 3);

  // Verify we're actually in winter
  let state = advance(s0, 1); // trigger season computation
  assert(state.season === 'winter', `Season is winter (${state.season})`);

  // Record wheat, clear any existing
  state = {
    ...state,
    resources: { ...state.resources, wheat: 0 },
    buildings: state.buildings.map(b =>
      b.id === farmId ? { ...b, localBuffer: {} } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.id === farmId
        ? { ...tile, building: { ...tile.building, localBuffer: {} } }
        : tile
    )),
  };

  // Run 2 full days in winter — farmer works the whole time
  state = advance(state, TICKS_PER_DAY * 2);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const totalWheat = (farm.localBuffer['wheat'] || 0) + state.resources.wheat;
  assert(totalWheat === 0, `Farm produced ZERO wheat in winter (total=${totalWheat})`);
}

// ================================================================
// TEST 3: Farm resumes production in spring after winter
// ================================================================
heading('Farm Resumes After Winter');

{
  // Start at day DAYS_PER_YEAR (second spring cycle)
  const { state: s0, farmId } = seasonTestSetup(DAYS_PER_YEAR);

  let state = advance(s0, 1); // trigger season
  assert(state.season === 'spring', `Season is spring at day ${DAYS_PER_YEAR} (${state.season})`);

  // Clear wheat to isolate production
  state = {
    ...state,
    resources: { ...state.resources, wheat: 0 },
    buildings: state.buildings.map(b =>
      b.id === farmId ? { ...b, localBuffer: {} } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.id === farmId
        ? { ...tile, building: { ...tile.building, localBuffer: {} } }
        : tile
    )),
  };

  state = advance(state, TICKS_PER_DAY * 3);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const totalWheat = (farm.localBuffer['wheat'] || 0) + state.resources.wheat;
  assert(totalWheat > 0, `Farm resumed in new spring (wheat=${totalWheat})`);
}

// ================================================================
// TEST 4: Woodcutter still produces in winter (not a farm)
// ================================================================
heading('Woodcutter Produces in Winter');

{
  let state = flatWorld(10, 10);
  state = { ...state, resources: { ...state.resources, wood: 80, stone: 20, food: 100 } };
  state = addVillager(state, 3, 3);

  state = placeBuilding(state, 'storehouse', 1, 3);
  // Use house (+10 morale) so villager survives winter with clothing penalty
  state = placeBuilding(state, 'house', 3, 3);
  state = placeBuilding(state, 'woodcutter', 5, 3);
  const homeId = state.buildings.find(b => b.type === 'house')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;

  // Pre-construct everything, stock storehouse with food + clothing
  state = {
    ...state,
    resources: { ...state.resources, linen: 5 },
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { food: 80, linen: 5 } : {},
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: {
            ...tile.building,
            constructed: true,
            constructionProgress: tile.building.constructionRequired,
            localBuffer: tile.building.type === 'storehouse' ? { food: 80, linen: 5 } : {},
          }}
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: homeId, food: 10 })),
    tick: TICKS_PER_DAY * DAYS_PER_SEASON * 3 - 1, day: DAYS_PER_SEASON * 3 - 1,
  };

  state = assignVillager(state, 'v1', wcId);

  let state2 = advance(state, 1);
  assert(state2.season === 'winter', `Season is winter (${state2.season})`);

  // Clear wood to isolate production
  state2 = {
    ...state2,
    resources: { ...state2.resources, wood: 0 },
    buildings: state2.buildings.map(b =>
      b.id === wcId ? { ...b, localBuffer: {} } : b
    ),
    grid: state2.grid.map(row => row.map(tile =>
      tile.building && tile.building.id === wcId
        ? { ...tile, building: { ...tile.building, localBuffer: {} } }
        : tile
    )),
  };

  state2 = advance(state2, TICKS_PER_DAY * 3);

  const wc = state2.buildings.find(b => b.id === wcId)!;
  const totalWood = (wc.localBuffer['wood'] || 0) + state2.resources.wood;
  assert(totalWood > 0, `Woodcutter produced in winter (total=${totalWood})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Season Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
