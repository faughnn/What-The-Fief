// test-v2-aging.ts — Tests for villager aging and old age death

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES,
  ELDER_AGE, OLD_AGE_DEATH_START, OLD_AGE_DEATH_CHANCE, ELDER_SPEED_PENALTY,
  MIN_VILLAGER_AGE, MAX_VILLAGER_AGE,
  DAYS_PER_YEAR,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation.js';
import { TICKS_PER_DAY } from '../timing.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  const state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, wheat: 500 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advanceDays(state: GameState, days: number): GameState {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Villagers have age
// ================================================================
heading('Villager Age');
{
  const v = createVillager(1, 5, 5);
  assert(v.age >= MIN_VILLAGER_AGE, `age >= ${MIN_VILLAGER_AGE} (${v.age})`);
  assert(v.age <= MAX_VILLAGER_AGE, `age <= ${MAX_VILLAGER_AGE} (${v.age})`);
}

// ================================================================
// TEST 2: Different villagers get different ages
// ================================================================
heading('Deterministic Age Spread');
{
  const ages = new Set<number>();
  for (let i = 1; i <= 20; i++) {
    const v = createVillager(i, 0, 0);
    ages.add(v.age);
  }
  assert(ages.size >= 5, `at least 5 distinct ages from 20 villagers (got ${ages.size})`);
}

// ================================================================
// TEST 3: Aging constants exist
// ================================================================
heading('Aging Constants');
{
  assert(ELDER_AGE === 60, `ELDER_AGE = 60 (${ELDER_AGE})`);
  assert(OLD_AGE_DEATH_START === 65, `OLD_AGE_DEATH_START = 65 (${OLD_AGE_DEATH_START})`);
  assert(OLD_AGE_DEATH_CHANCE > 0, `OLD_AGE_DEATH_CHANCE > 0 (${OLD_AGE_DEATH_CHANCE})`);
  assert(ELDER_SPEED_PENALTY === 0.5, `ELDER_SPEED_PENALTY = 0.5 (${ELDER_SPEED_PENALTY})`);
}

// ================================================================
// TEST 4: Villagers age on year boundary
// ================================================================
heading('Year Boundary Aging');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 9999, wheat: 9999 } : b.localBuffer,
    })),
  };
  const v = createVillager(1, 5, 5);
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  const startAge = v.age;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // Advance exactly DAYS_PER_YEAR days
  state = advanceDays(state, DAYS_PER_YEAR);
  assert(state.villagers[0].age === startAge + 1,
    `villager aged 1 year after ${DAYS_PER_YEAR} days (${startAge} → ${state.villagers[0].age})`);
}

// ================================================================
// TEST 5: Villagers don't age before year boundary
// ================================================================
heading('No Premature Aging');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 9999, wheat: 9999 } : b.localBuffer,
    })),
  };
  const v = createVillager(1, 5, 5);
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  const startAge = v.age;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  // Advance DAYS_PER_YEAR - 1 days
  state = advanceDays(state, DAYS_PER_YEAR - 1);
  assert(state.villagers[0].age === startAge,
    `villager not aged after ${DAYS_PER_YEAR - 1} days (still ${state.villagers[0].age})`);
}

// ================================================================
// TEST 6: Old villagers can die of old age
// ================================================================
heading('Old Age Death');
{
  // Create many old villagers and run for a while — some should die
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'tent', 6, 5);
  state = placeBuilding(state, 'tent', 7, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 99999, wheat: 99999 } : b.localBuffer,
    })),
  };

  const villagers: any[] = [];
  for (let i = 1; i <= 10; i++) {
    const v = createVillager(i, 5, 5);
    v.age = 70; // very old
    v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
    villagers.push(v);
  }
  state = { ...state, villagers, nextVillagerId: 11 };

  const startPop = state.villagers.length;
  // Run for 60 days (1 year) — some should die of old age
  state = advanceDays(state, 60);
  const endPop = state.villagers.length;
  // With 10 villagers at age 70, death chance ~5%/day increasing, very likely at least 1 dies
  assert(endPop < startPop, `some villagers died of old age: ${startPop} → ${endPop}`);
}

// ================================================================
// TEST 7: Young villagers don't die of old age
// ================================================================
heading('Young Villagers Safe');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 99999, wheat: 99999 } : b.localBuffer,
    })),
  };
  const v = createVillager(1, 5, 5);
  v.age = 30; // young
  v.food = 8; v.morale = 80;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v], nextVillagerId: 2 };
  // Disable raids/threats
  state.raidBar = 0;
  state.banditCamps = [];

  state = advanceDays(state, 30);
  assert(state.villagers.length === 1, `young villager survived 30 days (pop=${state.villagers.length})`);
}

// ================================================================
// TEST 8: Elder speed penalty constant
// ================================================================
heading('Elder Speed Penalty');
{
  assert(ELDER_SPEED_PENALTY < 1.0, `penalty reduces speed (${ELDER_SPEED_PENALTY})`);
  assert(ELDER_SPEED_PENALTY > 0.0, `penalty > 0 (${ELDER_SPEED_PENALTY})`);
}

// ================================================================
// TEST 9: Old age death event message
// ================================================================
heading('Death Event Message');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'tent', 6, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 99999, wheat: 99999 } : b.localBuffer,
    })),
  };

  const villagers: any[] = [];
  for (let i = 1; i <= 20; i++) {
    const v = createVillager(i, 5, 5);
    v.age = 75;
    v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
    villagers.push(v);
  }
  state = { ...state, villagers, nextVillagerId: 21 };

  // Collect events across all ticks (events reset each tick)
  let allEvents: string[] = [];
  for (let i = 0; i < 60 * TICKS_PER_DAY; i++) {
    state = tick(state);
    allEvents = allEvents.concat(state.events.filter(e => e.includes('old age')));
  }
  assert(allEvents.length > 0, `old age death events generated (${allEvents.length})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Aging Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
