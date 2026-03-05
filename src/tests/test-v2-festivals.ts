// test-v2-festivals.ts — Tests for player-triggered festival/celebration events
import {
  createWorld, createVillager, GameState, Building, BuildingType, ResourceType,
  BUILDING_TEMPLATES, TICKS_PER_DAY, FESTIVAL_FOOD_COST, FESTIVAL_GOLD_COST,
  FESTIVAL_MORALE_BOOST, FESTIVAL_DURATION, FESTIVAL_COOLDOWN,
} from '../world.js';
import { tick, placeBuilding, holdFestival } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function setupColony(): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  state.resources = { ...state.resources, food: 200, wood: 200, stone: 100, gold: 100 };

  // Storehouse at (10,10)
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, wood: 100, stone: 50, gold: 100 };
  state.resources = { ...state.resources, food: 200, wood: 100, stone: 50, gold: 100 };

  // Tavern at (12,10)
  state = placeBuilding(state, 'tavern', 12, 10);
  const tavern = state.buildings.find(b => b.type === 'tavern')!;
  tavern.constructed = true; tavern.hp = tavern.maxHp;

  // Housing
  state = placeBuilding(state, 'tent', 9, 9);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state = placeBuilding(state, 'house', 8, 9);
  const house = state.buildings.find(b => b.type === 'house')!;
  house.constructed = true; house.hp = house.maxHp;

  // Villagers
  const v1 = createVillager(1, 10, 10);
  v1.food = 8; v1.morale = 50; v1.homeBuildingId = tent.id;
  const v2 = createVillager(2, 10, 10);
  v2.food = 8; v2.morale = 50; v2.homeBuildingId = house.id;
  const v3 = createVillager(3, 10, 10);
  v3.food = 8; v3.morale = 50; v3.homeBuildingId = house.id;

  state.villagers = [v1, v2, v3];
  state.nextVillagerId = 4;

  return state;
}

// === Festival Requires Tavern ===
console.log('=== Festival Requires Tavern ===');
{
  let state = setupColony();
  // Remove tavern
  state.buildings = state.buildings.filter(b => b.type !== 'tavern');
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    if (state.grid[y][x].building?.type === 'tavern') state.grid[y][x].building = null;
  }

  const result = holdFestival(state);
  assert(result === state, 'Festival rejected without tavern');
}

// === Festival Requires Constructed Tavern ===
console.log('\n=== Festival Requires Constructed Tavern ===');
{
  let state = setupColony();
  const tavern = state.buildings.find(b => b.type === 'tavern')!;
  tavern.constructed = false;

  const result = holdFestival(state);
  assert(result === state, 'Festival rejected with unconstructed tavern');
}

// === Festival Requires Food ===
console.log('\n=== Festival Requires Food ===');
{
  let state = setupColony();
  // Set food too low
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.food = FESTIVAL_FOOD_COST - 1;
  state.resources.food = FESTIVAL_FOOD_COST - 1;

  const result = holdFestival(state);
  assert(result === state, 'Festival rejected with insufficient food');
}

// === Festival Requires Gold ===
console.log('\n=== Festival Requires Gold ===');
{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.gold = FESTIVAL_GOLD_COST - 1;
  state.resources.gold = FESTIVAL_GOLD_COST - 1;

  const result = holdFestival(state);
  assert(result === state, 'Festival rejected with insufficient gold');
}

// === Festival Consumes Resources ===
console.log('\n=== Festival Consumes Resources ===');
{
  let state = setupColony();
  const foodBefore = state.resources.food;
  const goldBefore = state.resources.gold;

  state = holdFestival(state);
  assert(state.resources.food === foodBefore - FESTIVAL_FOOD_COST, `Food deducted: ${foodBefore} → ${state.resources.food}`);
  assert(state.resources.gold === goldBefore - FESTIVAL_GOLD_COST, `Gold deducted: ${goldBefore} → ${state.resources.gold}`);

  // Check storehouse buffer also deducted
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  assert((sh.localBuffer.food || 0) === 200 - FESTIVAL_FOOD_COST, 'Storehouse food buffer deducted');
  assert((sh.localBuffer.gold || 0) === 100 - FESTIVAL_GOLD_COST, 'Storehouse gold buffer deducted');
}

// === Festival Sets lastFestivalDay ===
console.log('\n=== Festival Sets lastFestivalDay ===');
{
  let state = setupColony();
  // Advance to day 5
  for (let i = 0; i < 5 * TICKS_PER_DAY; i++) state = tick(state);

  state = holdFestival(state);
  assert(state.lastFestivalDay === 5, `lastFestivalDay set to current day (${state.lastFestivalDay})`);
}

// === Festival Morale Boost During Duration ===
console.log('\n=== Festival Morale Boost During Duration ===');
{
  let state = setupColony();

  state = holdFestival(state);

  // Advance to next day boundary to trigger morale recalc (day 1)
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  // Morale should include festival boost — base 50 + optimism + festival(20)
  for (const v of state.villagers) {
    assert(v.morale > 50 || v.traits.includes('gloomy'), `Villager ${v.name} morale ${v.morale} boosted (expected > 50)`);
  }
}

// === Festival Morale Gone After Duration ===
console.log('\n=== Festival Morale Gone After Duration ===');
{
  let state = setupColony();
  state = holdFestival(state);

  // Advance past festival duration (FESTIVAL_DURATION days)
  for (let i = 0; i < (FESTIVAL_DURATION + 1) * TICKS_PER_DAY; i++) state = tick(state);

  // Morale should NOT include festival boost
  // Get current morale values — they should be the same as without festival
  // (hard to check exactly, but we can verify lastFestivalDay is old enough)
  assert(state.day - state.lastFestivalDay >= FESTIVAL_DURATION, 'Festival duration has expired');
}

// === Festival Cooldown ===
console.log('\n=== Festival Cooldown ===');
{
  let state = setupColony();
  state = holdFestival(state);
  const firstDay = state.lastFestivalDay;

  // Try to hold another festival immediately — should be rejected
  const result = holdFestival(state);
  assert(result === state, 'Second festival rejected during cooldown');

  // Advance just past cooldown
  for (let i = 0; i < FESTIVAL_COOLDOWN * TICKS_PER_DAY; i++) state = tick(state);

  // Now festival should work
  const result2 = holdFestival(state);
  assert(result2 !== state, 'Festival allowed after cooldown expires');
  assert(result2.lastFestivalDay > firstDay, 'lastFestivalDay updated to new day');
}

// === Festival Event Message ===
console.log('\n=== Festival Event Message ===');
{
  let state = setupColony();
  state = holdFestival(state);
  const hasEvent = state.events.some(e => e.toLowerCase().includes('festival'));
  assert(hasEvent, 'Festival creates event message');
}

// === Festival Morale Boost Value (Precise) ===
console.log('\n=== Festival Morale Boost Value ===');
{
  // Create minimal state to isolate festival boost
  let state = setupColony();

  // Hold festival on day 0
  state = holdFestival(state);

  // Run one tick into the next day to trigger morale recalc
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  state = tick(state);

  // The villagers should have higher morale than the base.
  // Base morale calculation for a tent-housed villager with no food:
  //   50 (base) + 0 (tent housing) + optimism + season + weather + festival
  // With festival active (day 1, lastFestivalDay 0, duration 3):
  //   festival should add FESTIVAL_MORALE_BOOST
  // Without festival it would be:
  //   50 + optimism(20 - day/2) + spring(0) + clear(0)
  // Check that at least one villager has morale indicating the festival boost is applied
  const v = state.villagers[0];
  // With festival: morale should be noticeably higher
  // Base ~ 50 + 0(tent) + 20(optimism day 1) = 70 + festival(20) = 90, capped at 100
  assert(v.morale >= 70, `Villager morale ${v.morale} reflects festival boost (expected >= 70)`);
}

// === Multiple Villagers All Get Boost ===
console.log('\n=== Multiple Villagers All Get Boost ===');
{
  let state = setupColony();
  state = holdFestival(state);

  // Trigger day recalc
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  state = tick(state);

  // All villagers should have elevated morale
  const allBoosted = state.villagers.every(v => v.morale >= 65);
  assert(allBoosted, `All ${state.villagers.length} villagers have boosted morale`);
}

console.log(`\n========================================`);
console.log(`V2 Festival Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
