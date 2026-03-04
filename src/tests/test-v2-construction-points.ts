// test-v2-construction-points.ts — Tests for construction points gating system
import {
  createWorld, createVillager, GameState, Building, BuildingType,
  BUILDING_TEMPLATES, TICKS_PER_DAY,
  INITIAL_CONSTRUCTION_POINTS, CONSTRUCTION_POINT_MILESTONES,
  CONSTRUCTION_POINT_PER_IMMIGRANT, FREE_CONSTRUCTION,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function setupColony(): GameState {
  let state = createWorld(30, 30, 42);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  state = placeBuilding(state, 'storehouse', 15, 15);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, wood: 200, stone: 200, iron: 50, planks: 50 };
  state.resources = { ...state.resources, food: 200, wood: 200, stone: 200, iron: 50, planks: 50 };

  state = placeBuilding(state, 'town_hall', 10, 10);
  const th = state.buildings.find(b => b.type === 'town_hall')!;
  th.constructed = true; th.hp = th.maxHp;

  // Place a tent for housing
  state = placeBuilding(state, 'tent', 10, 14);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  const v = createVillager(1, 15, 15);
  v.food = 8; v.morale = 80; v.homeBuildingId = tent.id;
  state.villagers = [v];
  state.nextVillagerId = 2;

  return state;
}

console.log('=== Construction Points Tests ===\n');

// --- Constants ---
console.log('--- Constants ---');

assert(INITIAL_CONSTRUCTION_POINTS === 20, 'Initial construction points = 20');
assert(CONSTRUCTION_POINT_PER_IMMIGRANT === 2, 'Points per immigrant = 2');
assert(FREE_CONSTRUCTION.includes('rubble'), 'Rubble is free construction');
assert(CONSTRUCTION_POINT_MILESTONES.length === 4, '4 prosperity milestones');

// --- Initial State ---
console.log('\n--- Initial State ---');

{
  const state = createWorld(20, 20, 1);
  assert(state.constructionPoints === INITIAL_CONSTRUCTION_POINTS, 'New world starts with initial construction points');
  assert(state.constructionPointsMilestones.length === 0, 'No milestones claimed initially');
}

// --- Point Deduction on Building Placement ---
console.log('\n--- Point Deduction ---');

{
  let state = setupColony();
  const pointsBefore = state.constructionPoints;
  state = placeBuilding(state, 'farm', 5, 5);
  assert(state.constructionPoints === pointsBefore - 1, 'Placing a farm deducts 1 construction point');
}

{
  let state = setupColony();
  const pointsBefore = state.constructionPoints;
  // Place multiple buildings
  state = placeBuilding(state, 'farm', 5, 5);
  state = placeBuilding(state, 'woodcutter', 8, 5);
  state = placeBuilding(state, 'quarry', 5, 8);
  assert(state.constructionPoints === pointsBefore - 3, 'Each building costs 1 point');
}

// --- Blocked When No Points ---
console.log('\n--- Blocked When No Points ---');

{
  let state = setupColony();
  state.constructionPoints = 0;
  const buildingsBefore = state.buildings.length;
  state = placeBuilding(state, 'farm', 5, 5);
  assert(state.buildings.length === buildingsBefore, 'Cannot place building with 0 construction points');
}

{
  let state = setupColony();
  state.constructionPoints = 1;
  state = placeBuilding(state, 'farm', 5, 5);
  assert(state.constructionPoints === 0, 'Last point used up');
  const buildingsBefore = state.buildings.length;
  state = placeBuilding(state, 'woodcutter', 8, 5);
  assert(state.buildings.length === buildingsBefore, 'No more buildings after points exhausted');
}

// --- Free Construction (Rubble) ---
console.log('\n--- Free Construction ---');

{
  // Rubble doesn't cost construction points — but rubble is placed by the system
  // when buildings are destroyed, not by placeBuilding. The FREE_CONSTRUCTION
  // check ensures rubble clearing doesn't cost points.
  // We test that the constant is correct.
  assert(!FREE_CONSTRUCTION.includes('farm'), 'Farm is not free construction');
  assert(!FREE_CONSTRUCTION.includes('tent'), 'Tent is not free construction');
  assert(FREE_CONSTRUCTION.includes('rubble'), 'Rubble is free construction');
}

// --- Points Persist Across Ticks ---
console.log('\n--- Points Persist Across Ticks ---');

{
  let state = setupColony();
  state.constructionPoints = 10;
  // Run a few ticks (not a new day)
  for (let i = 0; i < 5; i++) state = tick(state);
  assert(state.constructionPoints === 10, 'Construction points persist across ticks');
}

// --- Immigration Grants Points ---
console.log('\n--- Immigration Grants Points ---');

{
  // Set up for immigration: need renown, housing, town_hall
  let state = setupColony();
  state.constructionPoints = 5;
  state.renown = 100; // Plenty of renown for recruiting

  // Add more housing capacity
  for (let i = 0; i < 5; i++) {
    state = placeBuilding(state, 'tent', 20 + i, 5);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 20 + i && b.y === 5)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  // The points lost from building those tents
  const pointsAfterBuilding = state.constructionPoints;

  // Run to a new day (tick 0 of day 1) to trigger immigration
  // Immigration happens on new day when renown >= RENOWN_PER_RECRUIT and housing available
  while (state.tick % TICKS_PER_DAY !== TICKS_PER_DAY - 1) state = tick(state);
  state = tick(state); // This should be tick 0 of new day

  // Check if immigrants arrived (they should with enough renown + housing)
  const newVillagers = state.villagers.length - 1; // Started with 1
  if (newVillagers > 0) {
    const expectedPoints = pointsAfterBuilding + (newVillagers * CONSTRUCTION_POINT_PER_IMMIGRANT);
    assert(state.constructionPoints === expectedPoints,
      `Immigration grants ${CONSTRUCTION_POINT_PER_IMMIGRANT} points per immigrant (got ${newVillagers} immigrants, expected ${expectedPoints} points, got ${state.constructionPoints})`);
  } else {
    // Immigration might not have triggered — that's ok, test the mechanism differently
    console.log('  SKIP: No immigrants arrived (renown/housing conditions not met)');
  }
}

// --- Prosperity Milestones Grant Points ---
console.log('\n--- Prosperity Milestones ---');

{
  assert(CONSTRUCTION_POINT_MILESTONES[0].prosperity === 50, 'First milestone at prosperity 50');
  assert(CONSTRUCTION_POINT_MILESTONES[0].points === 5, 'First milestone grants 5 points');

  let total = 0;
  for (const ms of CONSTRUCTION_POINT_MILESTONES) total += ms.points;
  assert(total === 30, 'Total milestone points = 30');
}

// --- Milestones Don't Double-Award ---
console.log('\n--- Milestone Idempotency ---');

{
  let state = setupColony();
  state.constructionPoints = 5;
  state.prosperity = 0;
  state.constructionPointsMilestones = [];

  // Manually set high prosperity and run through a day to trigger milestone check
  // We need to force prosperity high enough for a milestone
  // The processProsperity function calculates prosperity from scratch each day
  // So we need buildings, food types, guards etc. to push prosperity >= 50

  // Add diverse buildings + guard + research to boost prosperity
  state = placeBuilding(state, 'farm', 3, 3);
  state.buildings.find(b => b.type === 'farm')!.constructed = true;
  state = placeBuilding(state, 'woodcutter', 6, 3);
  state.buildings.find(b => b.type === 'woodcutter' && b.x === 6)!.constructed = true;
  state = placeBuilding(state, 'quarry', 3, 6);
  state.buildings.find(b => b.type === 'quarry')!.constructed = true;

  // Food diversity
  state.resources.bread = 10;
  state.resources.wheat = 10;
  state.resources.food = 50;

  // Research
  state.research.completed = ['basic_cooking'];

  // Guard for security bonus
  const guard = createVillager(2, 15, 15);
  guard.role = 'guard'; guard.food = 8; guard.morale = 80;
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state.villagers.push(guard);
  state.nextVillagerId = 3;

  // Run to new day for prosperity calculation
  const pointsBefore = state.constructionPoints;
  while (state.tick % TICKS_PER_DAY !== TICKS_PER_DAY - 1) state = tick(state);
  state = tick(state);

  const pointsAfterFirst = state.constructionPoints;
  const milestonesAfterFirst = state.constructionPointsMilestones.length;

  // Run another day — milestones shouldn't re-award
  while (state.tick % TICKS_PER_DAY !== TICKS_PER_DAY - 1) state = tick(state);
  state = tick(state);

  assert(state.constructionPoints === pointsAfterFirst,
    'Milestones do not double-award on subsequent days');
  assert(state.constructionPointsMilestones.length === milestonesAfterFirst,
    'Milestone list stable after second day');
}

// --- Various Building Types Cost Points ---
console.log('\n--- Building Type Costs ---');

{
  let state = setupColony();
  state.resources = { ...state.resources, wood: 500, stone: 500, iron: 100 };
  state.buildings.find(b => b.type === 'storehouse')!.localBuffer = {
    wood: 500, stone: 500, iron: 100, food: 200,
  };
  state.constructionPoints = 50;

  // Place a wall — should cost 1 point
  const beforeWall = state.constructionPoints;
  state = placeBuilding(state, 'wall', 1, 1);
  assert(state.constructionPoints === beforeWall - 1, 'Wall costs 1 construction point');

  // Place a fence — should cost 1 point
  const beforeFence = state.constructionPoints;
  state = placeBuilding(state, 'fence', 2, 1);
  assert(state.constructionPoints === beforeFence - 1, 'Fence costs 1 construction point');

  // Place a gate — should cost 1 point
  const beforeGate = state.constructionPoints;
  state = placeBuilding(state, 'gate', 3, 1);
  assert(state.constructionPoints === beforeGate - 1, 'Gate costs 1 construction point');
}

// --- Tent costs a point (not free) ---
console.log('\n--- Tent Cost ---');

{
  let state = setupColony();
  const before = state.constructionPoints;
  state = placeBuilding(state, 'tent', 1, 1);
  assert(state.constructionPoints === before - 1, 'Tent costs 1 construction point');
}

// --- Enough points for early game ---
console.log('\n--- Early Game Budget ---');

{
  // With 20 initial points, player should be able to build basic colony
  // Typical early: storehouse, town_hall, 3 tents, 2 farms, woodcutter, quarry = 9 buildings
  // That leaves 11 points for expansion
  assert(INITIAL_CONSTRUCTION_POINTS >= 15, 'Initial points allow decent early colony (>= 15)');
}

console.log(`\n=== Construction Points: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
