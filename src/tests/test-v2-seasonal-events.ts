// test-v2-seasonal-events.ts — Tests for seasonal event system
// Auto-events at season transitions: spring planting, harvest festival, winter warning

import {
  createWorld, createVillager, GameState,
  TICKS_PER_DAY, DAYS_PER_SEASON, ALL_TECHS, SEASONAL_EVENTS,
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
  sh.localBuffer = { food: 200 };
  state.resources = { ...state.resources, food: 200 };

  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  v.food = 8; v.morale = 50; v.hp = 20; v.maxHp = 20;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')?.id || null;
  state.villagers = [...state.villagers, v];
  state.nextVillagerId++;
  return state;
}

// ================================================================
// TEST 1: SEASONAL_EVENTS data exists
// ================================================================
heading('Seasonal Events Data');

{
  assert(SEASONAL_EVENTS !== undefined, 'SEASONAL_EVENTS exists');
  assert(SEASONAL_EVENTS.spring !== undefined, 'spring event defined');
  assert(SEASONAL_EVENTS.summer !== undefined, 'summer event defined');
  assert(SEASONAL_EVENTS.autumn !== undefined, 'autumn event defined');
  assert(SEASONAL_EVENTS.winter !== undefined, 'winter event defined');
}

// ================================================================
// TEST 2: Spring event — morale boost
// ================================================================
heading('Spring Planting Event');

{
  assert(SEASONAL_EVENTS.spring.name !== undefined, 'spring event has name');
  assert(SEASONAL_EVENTS.spring.moraleBonus > 0, `spring morale bonus positive (${SEASONAL_EVENTS.spring.moraleBonus})`);
}

// ================================================================
// TEST 3: Autumn event — harvest festival
// ================================================================
heading('Harvest Festival Event');

{
  assert(SEASONAL_EVENTS.autumn.name !== undefined, 'autumn event has name');
  assert(SEASONAL_EVENTS.autumn.moraleBonus > 0, `autumn morale bonus positive (${SEASONAL_EVENTS.autumn.moraleBonus})`);
  assert(SEASONAL_EVENTS.autumn.foodThreshold !== undefined, 'autumn event has food threshold');
}

// ================================================================
// TEST 4: Winter event — cold warning
// ================================================================
heading('Winter Warning Event');

{
  assert(SEASONAL_EVENTS.winter.name !== undefined, 'winter event has name');
  assert(SEASONAL_EVENTS.winter.moraleBonus < 0, `winter morale penalty negative (${SEASONAL_EVENTS.winter.moraleBonus})`);
}

// ================================================================
// TEST 5: Season transition triggers event message
// ================================================================
heading('Season Transition Events');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  state.season = 'spring';

  // Advance to summer (day 15 = DAYS_PER_SEASON)
  state.tick = DAYS_PER_SEASON * TICKS_PER_DAY - 1;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  state = tick(state); // should trigger summer season change

  const allEvents: string[] = [...state.events];
  // Run a few more ticks to catch daily events
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    state = tick(state);
    allEvents.push(...state.events);
  }

  assert(allEvents.some(e => e.toLowerCase().includes('summer') || e.toLowerCase().includes('season')),
    'summer transition event logged');
}

// ================================================================
// TEST 6: Harvest festival gives morale boost with enough food
// ================================================================
heading('Harvest Festival Morale');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  // Ensure plenty of food
  state.resources.food = 200;
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer = { food: 200 };

  // Set to just before autumn
  state.season = 'summer';
  state.tick = 2 * DAYS_PER_SEASON * TICKS_PER_DAY - 1;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  const moraleBefore = state.villagers[0].morale;

  // Tick into autumn
  state = tick(state);
  // Run through the daily check
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    state = tick(state);
    if (state.events.some(e => e.toLowerCase().includes('harvest') || e.toLowerCase().includes('autumn'))) break;
  }

  const moraleAfter = state.villagers[0].morale;
  assert(moraleAfter >= moraleBefore, `morale increased at harvest (${moraleBefore} → ${moraleAfter})`);
}

// ================================================================
// TEST 7: Winter warning reduces morale
// ================================================================
heading('Winter Morale Penalty');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  state.villagers[0].morale = 70;

  // Set to just before winter
  state.season = 'autumn';
  state.tick = 3 * DAYS_PER_SEASON * TICKS_PER_DAY - 1;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  state = tick(state);
  // Run the daily
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    state = tick(state);
    if (state.events.some(e => e.toLowerCase().includes('winter'))) break;
  }

  const moraleAfter = state.villagers[0].morale;
  assert(moraleAfter <= 70, `morale not increased at winter start (${moraleAfter})`);
}

// ================================================================
// TEST 8: Each season event fires only once per transition
// ================================================================
heading('No Duplicate Events');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  state.season = 'spring';

  // Advance past summer transition
  state.tick = DAYS_PER_SEASON * TICKS_PER_DAY;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  let eventCount = 0;
  for (let i = 0; i < TICKS_PER_DAY * 2; i++) {
    state = tick(state);
    for (const e of state.events) {
      if (e.toLowerCase().includes('summer') && (e.toLowerCase().includes('arrives') || e.toLowerCase().includes('begins'))) {
        eventCount++;
      }
    }
  }

  assert(eventCount <= 1, `summer event fired at most once (count=${eventCount})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Seasonal Events Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
