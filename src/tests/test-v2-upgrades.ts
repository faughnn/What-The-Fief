// test-v2-upgrades.ts — Building upgrade system tests
// Buildings upgrade along defined paths: tent→house→manor

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, CONSTRUCTION_TICKS,
  BUILDING_TEMPLATES, BUILDING_MAX_HP,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, upgradeBuilding,
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

// ================================================================
// TEST 1: Upgrade tent to house — basic upgrade
// ================================================================
heading('Upgrade Tent to House');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 50, stone: 20 } };

  // Place tent
  state = placeBuilding(state, 'tent', 3, 3);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  // Upgrade tent → house
  state = upgradeBuilding(state, tentId);

  const upgraded = state.buildings.find(b => b.id === tentId)!;
  assert(upgraded.type === 'house', `Tent upgraded to house (type=${upgraded.type})`);
  assert(upgraded.constructed === false, 'Upgraded building is a construction site');
  assert(upgraded.constructionProgress === 0, 'Upgrade construction starts at 0');
}

// ================================================================
// TEST 2: Upgrade deducts resources
// ================================================================
heading('Upgrade Costs Resources');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 50 } };

  state = placeBuilding(state, 'tent', 3, 3); // costs 3 wood → 47
  const woodAfterTent = state.resources.wood;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  state = upgradeBuilding(state, tentId);
  assert(state.resources.wood < woodAfterTent, `Wood consumed by upgrade: ${woodAfterTent} → ${state.resources.wood}`);
}

// ================================================================
// TEST 3: Upgrade fails without enough resources
// ================================================================
heading('Upgrade Fails Without Resources');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 5 } };

  state = placeBuilding(state, 'tent', 3, 3); // costs 3 wood → 2
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  const before = state.buildings.find(b => b.id === tentId)!;
  state = upgradeBuilding(state, tentId);
  const after = state.buildings.find(b => b.id === tentId)!;

  assert(after.type === 'tent', `Upgrade rejected — still tent (type=${after.type})`);
}

// ================================================================
// TEST 4: Upgraded building requires worker to physically build
// ================================================================
heading('Upgrade Requires Physical Construction');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 20 } };
  state = addVillager(state, 3, 3);

  state = placeBuilding(state, 'tent', 3, 3);
  state = placeBuilding(state, 'woodcutter', 5, 3);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;

  // Assign villager to woodcutter (they need a job to act as builder)
  state = { ...state, villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })) };
  state = assignVillager(state, 'v1', wcId);

  // Complete woodcutter construction first
  state = advance(state, TICKS_PER_DAY * 2);
  const wcBefore = state.buildings.find(b => b.id === wcId)!;
  assert(wcBefore.constructed === true, `Woodcutter constructed before upgrade test`);

  // Now upgrade the tent
  state = upgradeBuilding(state, tentId);
  const house = state.buildings.find(b => b.id === tentId)!;
  assert(house.constructed === false, 'House upgrade is a construction site');

  // Advance time — idle villager should build it
  state = advance(state, TICKS_PER_DAY * 2);
  const houseAfter = state.buildings.find(b => b.id === tentId)!;
  assert(houseAfter.constructionProgress > 0, `Upgrade construction progressed: ${houseAfter.constructionProgress}/${houseAfter.constructionRequired}`);
}

// ================================================================
// TEST 5: Home assignments preserved through upgrade
// ================================================================
heading('Home Assignments Preserved');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 50 } };
  state = addVillager(state, 3, 3);

  state = placeBuilding(state, 'tent', 3, 3);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })) };

  // Verify home assignment
  assert(state.villagers[0].homeBuildingId === tentId, 'Villager assigned to tent');

  // Upgrade
  state = upgradeBuilding(state, tentId);

  // Home still points to same building ID
  assert(state.villagers[0].homeBuildingId === tentId, 'Home assignment preserved after upgrade');
  const house = state.buildings.find(b => b.id === tentId)!;
  assert(house.type === 'house', 'Building is now a house');
}

// ================================================================
// TEST 6: Cannot upgrade building with no upgrade path
// ================================================================
heading('No Upgrade Path');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 50, stone: 20 } };

  state = placeBuilding(state, 'farm', 3, 3);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  state = upgradeBuilding(state, farmId);
  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.type === 'farm', `Farm has no upgrade path — still farm (type=${farm.type})`);
}

// ================================================================
// TEST 7: Size-changing upgrade checks adjacent tiles
// ================================================================
heading('Size-Changing Upgrade (House to Manor)');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 30, planks: 20 } };

  // Place house at (3,3) — 1x1
  state = placeBuilding(state, 'house', 3, 3);
  const houseId = state.buildings.find(b => b.type === 'house')!.id;

  // Upgrade house → manor (2x2) — needs tiles (3,3), (4,3), (3,4), (4,4)
  state = upgradeBuilding(state, houseId);

  const manor = state.buildings.find(b => b.id === houseId)!;
  assert(manor.type === 'manor', `House upgraded to manor (type=${manor.type})`);
  assert(manor.width === 2, `Manor width is 2 (width=${manor.width})`);
  assert(manor.height === 2, `Manor height is 2 (height=${manor.height})`);

  // Check grid tiles are claimed
  assert(state.grid[3][4].building !== null, 'Grid tile (4,3) claimed by manor');
  assert(state.grid[4][3].building !== null, 'Grid tile (3,4) claimed by manor');
  assert(state.grid[4][4].building !== null, 'Grid tile (4,4) claimed by manor');
}

// ================================================================
// TEST 8: Size-changing upgrade blocked by occupied tiles
// ================================================================
heading('Size-Changing Upgrade Blocked');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 30, planks: 20 } };

  // Place house at (3,3) and a fence at (4,3) blocking expansion
  state = placeBuilding(state, 'house', 3, 3);
  state = placeBuilding(state, 'fence', 4, 3);
  const houseId = state.buildings.find(b => b.type === 'house')!.id;

  // Upgrade should fail — (4,3) is occupied by fence
  state = upgradeBuilding(state, houseId);

  const b = state.buildings.find(b => b.id === houseId)!;
  assert(b.type === 'house', `Upgrade blocked by occupied tile — still house (type=${b.type})`);
}

// ================================================================
// TEST 9: Upgraded building gets new HP
// ================================================================
heading('Upgraded Building HP');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, wood: 50 } };

  state = placeBuilding(state, 'tent', 3, 3);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  state = upgradeBuilding(state, tentId);
  const house = state.buildings.find(b => b.id === tentId)!;

  assert(house.maxHp === BUILDING_MAX_HP['house'], `House maxHp is ${BUILDING_MAX_HP['house']} (got ${house.maxHp})`);
  assert(house.hp === BUILDING_MAX_HP['house'], `House hp is full (${house.hp}/${house.maxHp})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Upgrade Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
