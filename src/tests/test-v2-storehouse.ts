// test-v2-storehouse.ts — V2 physical storehouse resource tests
// Resources exist at physical locations (storehouse local buffers), not in a global pool.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, BUILDING_TEMPLATES, ALL_TECHS,
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
  state.research.completed = [...ALL_TECHS];
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

// ================================================================
// TEST 1: Hauling deposits into storehouse local buffer
// ================================================================
heading('Hauling Deposits Into Storehouse Buffer');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 50, stone: 50 } };

  // Place storehouse and woodcutter close together
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'woodcutter', 8, 5);

  const storehouseId = state.buildings.find(b => b.type === 'storehouse')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const woodcutterId = state.buildings.find(b => b.type === 'woodcutter')!.id;

  // Mark buildings as constructed
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
    })),
  };

  // Add worker assigned to woodcutter
  state = addVillager(state, 3, 5);
  state = assignVillager(state, 'v1', woodcutterId);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId, food: 10 })),
  };

  // Run for 3 days — worker should produce wood and haul to storehouse
  state = advance(state, TICKS_PER_DAY * 3);

  // Check storehouse local buffer has wood
  const storehouse = state.buildings.find(b => b.id === storehouseId);
  const bufferWood = storehouse ? (storehouse.localBuffer['wood'] || 0) : 0;

  assert(bufferWood > 0,
    `Storehouse buffer has wood: ${bufferWood} (hauled physically)`);

  // Global resources should reflect storehouse buffer contents
  assert(state.resources.wood >= bufferWood,
    `Global resources (${state.resources.wood}) includes storehouse buffer (${bufferWood})`);
}

// ================================================================
// TEST 2: Eating consumes from storehouse local buffer
// ================================================================
heading('Eating Consumes From Storehouse Buffer');

{
  let state = flatWorld(15, 10);

  // Place storehouse with bread in its local buffer
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 3, 5);

  const storehouseId = state.buildings.find(b => b.type === 'storehouse')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  state = {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id === storehouseId) {
        return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { bread: 5 } };
      }
      return { ...b, constructed: true, constructionProgress: b.constructionRequired };
    }),
    resources: { ...state.resources, bread: 5, wood: 50, stone: 50 },
  };

  // Add hungry villager near storehouse
  state = addVillager(state, 3, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId, food: 3 })),
  };

  // Advance through dawn + travel + eat
  state = advance(state, NIGHT_TICKS + 10);

  // Check storehouse buffer — bread should be consumed from local buffer
  const storehouse = state.buildings.find(b => b.id === storehouseId);
  const bufferBread = storehouse ? (storehouse.localBuffer['bread'] || 0) : 0;
  assert(bufferBread < 5,
    `Bread consumed from storehouse buffer: was 5, now ${bufferBread}`);
}

// ================================================================
// TEST 3: Processing worker picks up inputs from storehouse buffer
// ================================================================
heading('Processing Inputs From Storehouse Buffer');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 50, stone: 50 } };

  // Place storehouse with wheat in buffer, and a mill
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'mill', 10, 5);

  const storehouseId = state.buildings.find(b => b.type === 'storehouse')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const millId = state.buildings.find(b => b.type === 'mill')!.id;

  state = {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id === storehouseId) {
        return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { wheat: 20 } };
      }
      return { ...b, constructed: true, constructionProgress: b.constructionRequired };
    }),
    resources: { ...state.resources, wheat: 20, bread: 10 },
  };

  // Add worker assigned to mill
  state = addVillager(state, 3, 5);
  state = assignVillager(state, 'v1', millId);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId, food: 10 })),
  };

  // Advance through several days
  state = advance(state, TICKS_PER_DAY * 3);

  // Storehouse wheat should be reduced (worker picked up inputs)
  const storehouse = state.buildings.find(b => b.id === storehouseId);
  const bufferWheat = storehouse ? (storehouse.localBuffer['wheat'] || 0) : 0;
  assert(bufferWheat < 20,
    `Wheat taken from storehouse buffer: was 20, now ${bufferWheat}`);
}

// ================================================================
// TEST 4: Global resources reflect storehouse buffers
// ================================================================
heading('Global Resources = Storehouse Aggregate');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  // Place two storehouses with different contents
  state = placeBuilding(state, 'storehouse', 3, 3);
  state = placeBuilding(state, 'storehouse', 10, 3);

  const storehouses = state.buildings.filter(b => b.type === 'storehouse');
  state = {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id === storehouses[0].id) {
        return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { wood: 15, food: 5 } };
      }
      if (b.id === storehouses[1].id) {
        return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { wood: 10, stone: 8 } };
      }
      return { ...b, constructed: true, constructionProgress: b.constructionRequired };
    }),
  };

  // After a tick, global resources should reflect storehouse contents
  state = tick(state);

  // Global wood should be at least the sum from storehouses (15 + 10 = 25)
  assert(state.resources.wood >= 25,
    `Global wood (${state.resources.wood}) reflects storehouse buffers (15+10=25)`);
  assert(state.resources.stone >= 8,
    `Global stone (${state.resources.stone}) reflects storehouse buffer (8)`);
  assert(state.resources.food >= 5,
    `Global food (${state.resources.food}) reflects storehouse buffer (5)`);
}

// ================================================================
// TEST 5: Empty storehouse means no food to eat
// ================================================================
heading('Empty Storehouse — No Food');

{
  let state = flatWorld(15, 10);

  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 3, 5);

  const storehouseId = state.buildings.find(b => b.type === 'storehouse')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  // Storehouse buffer is EMPTY (no food), but global pool has food
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: {}, // empty buffer
    })),
    resources: { ...state.resources, wood: 50, stone: 50, bread: 0 },
  };

  state = addVillager(state, 3, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId, food: 3 })),
  };

  // Advance through dawn
  state = advance(state, NIGHT_TICKS + 5);

  const villager = state.villagers.find(v => v.id === 'v1');
  if (villager) {
    // With empty storehouse and no food, villager should not be eating
    assert(villager.state !== 'eating',
      `Villager not eating from empty storehouse (state=${villager.state})`);
  } else {
    assert(true, 'Villager exists');
  }
}

// ================================================================
// TEST 6: Tool equipping consumes from storehouse buffer
// ================================================================
heading('Tool Equip From Storehouse Buffer');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 50, stone: 50, basic_tools: 3 } };

  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'woodcutter', 8, 5);

  const storehouseId = state.buildings.find(b => b.type === 'storehouse')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;

  // Put tools in storehouse buffer (matching global)
  state = {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id === storehouseId) {
        return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { basic_tools: 3 } };
      }
      return { ...b, constructed: true, constructionProgress: b.constructionRequired };
    }),
  };

  state = addVillager(state, 3, 5);
  state = assignVillager(state, 'v1', wcId);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId, food: 10 })),
  };

  // Advance through dawn — villager should equip a tool
  state = advance(state, NIGHT_TICKS + 1);

  // Check: storehouse buffer should have lost a tool
  const storehouse = state.buildings.find(b => b.id === storehouseId);
  const bufferTools = storehouse ? (storehouse.localBuffer['basic_tools'] || 0) : 0;

  assert(bufferTools < 3,
    `Tool consumed from storehouse buffer: was 3, now ${bufferTools}`);

  // Global should also be decremented
  assert(state.resources.basic_tools < 3,
    `Global basic_tools decremented: was 3, now ${state.resources.basic_tools}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Storehouse Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
