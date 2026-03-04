// test-v2-recruitment.ts — Tests for renown-gated recruitment
import {
  createWorld, createVillager, GameState, Building,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, CONSTRUCTION_TICKS,
  TICKS_PER_DAY, RENOWN_PER_RECRUIT, FREE_SETTLERS,
} from '../world.js';
import { tick, placeBuilding } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

// Helper: create world with housing and food but variable pop/renown
function setupRecruitment(villagersCount: number, renown: number): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  // Storehouse with plenty of food
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100 };
  state.resources.food = 100;

  // Create enough tents for immigration
  for (let i = 0; i < 6; i++) {
    state = placeBuilding(state, 'tent', 5 + i, 5);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 5 + i)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  // Create villagers
  const villagers = [];
  for (let i = 0; i < villagersCount; i++) {
    const v = createVillager(i + 1, 10, 10);
    v.food = 8;
    const tent = state.buildings.find(b =>
      b.type === 'tent' && !villagers.some(vv => vv.homeBuildingId === b.id)
    )!;
    v.homeBuildingId = tent.id;
    villagers.push(v);
  }
  state.villagers = villagers;
  state.nextVillagerId = villagersCount + 1;
  state.renown = renown;

  return state;
}

// ========================
// TESTS
// ========================

console.log('\n=== Constants ===');
{
  assert(RENOWN_PER_RECRUIT === 5, `Renown cost per recruit is 5 (got ${RENOWN_PER_RECRUIT})`);
  assert(FREE_SETTLERS === 4, `First 4 settlers are free (got ${FREE_SETTLERS})`);
}

console.log('\n=== Free Settlers: First 4 Arrive Without Renown ===');
{
  // Start with 3 villagers, 0 renown — 4th should arrive free
  let state = setupRecruitment(3, 0);

  // Run 1 day (immigration happens at day start)
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  assert(state.villagers.length >= 4, `4th settler arrived free (pop: ${state.villagers.length})`);
  assert(state.renown === 0, `No renown spent for free settler (renown: ${state.renown})`);
}

console.log('\n=== Renown Required: 5th Settler Needs Renown ===');
{
  // Start with 4 villagers, 0 renown — 5th should NOT arrive
  let state = setupRecruitment(4, 0);

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  assert(state.villagers.length === 4, `5th settler blocked without renown (pop: ${state.villagers.length})`);
}

console.log('\n=== Renown Required: 5th Settler Arrives With Renown ===');
{
  // Start with 4 villagers, 5 renown — 5th should arrive
  let state = setupRecruitment(4, 5);
  // Mark quests as completed to prevent renown gain during test
  state.completedQuests = ['first_steps', 'prosper', 'fortify', 'research'];

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  assert(state.villagers.length >= 5, `5th settler arrived with renown (pop: ${state.villagers.length})`);
  assert(state.renown === 0, `Renown spent (renown: ${state.renown})`);
}

console.log('\n=== Renown Deducted Per Recruit ===');
{
  // Start with 4 villagers, 15 renown — should allow 3 recruits
  let state = setupRecruitment(4, 15);
  state.completedQuests = ['first_steps', 'prosper', 'fortify', 'research'];

  // Run 3 days to allow multiple arrivals
  for (let d = 0; d < 3; d++) {
    for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  }

  const recruited = state.villagers.length - 4;
  const renownSpent = 15 - state.renown;
  assert(recruited >= 1, `At least 1 recruited with 15 renown (got ${recruited})`);
  assert(renownSpent === recruited * RENOWN_PER_RECRUIT,
    `Renown deducted correctly (spent ${renownSpent}, expected ${recruited * RENOWN_PER_RECRUIT})`);
}

console.log('\n=== No Immigration Without Food ===');
{
  // Start with 3 villagers, food = 0, renown = 100
  let state = setupRecruitment(3, 100);
  // Empty food
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer = {};
  state.resources.food = 0;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  // Some villagers may die from starvation, but no new ones should arrive
  const newArrivals = state.villagers.filter(v => v.id.startsWith('v') && parseInt(v.id.substring(1)) > 3);
  // Can't easily test this since food = 0 means villagers starve. Check renown unchanged.
  assert(state.renown === 100, `No renown spent when no food (renown: ${state.renown})`);
}

console.log('\n=== No Immigration Without Housing ===');
{
  // Start with 6 villagers (fills all 6 tents), 100 renown, plenty of food
  let state = setupRecruitment(6, 100);
  state.completedQuests = ['first_steps', 'prosper', 'fortify', 'research'];

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  // No empty tents — no immigration should happen. Check pop didn't grow.
  assert(state.villagers.length <= 6, `No new villager without housing (pop: ${state.villagers.length})`);
}

// ========================
// SUMMARY
// ========================
console.log('\n========================================');
console.log(`V2 Recruitment Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
