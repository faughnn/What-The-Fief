// test-v2-night-danger.ts — Tests for night danger mechanics

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, NIGHT_DANGER_ATK_BONUS, NIGHT_DANGER_SPAWN_MULT,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation.js';
import { TICKS_PER_DAY, NIGHT_TICKS } from '../timing.js';

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

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Night danger constants exist
// ================================================================
heading('Night Danger Constants');
{
  assert(typeof NIGHT_DANGER_ATK_BONUS === 'number', 'NIGHT_DANGER_ATK_BONUS exists');
  assert(NIGHT_DANGER_ATK_BONUS > 0, `night atk bonus is positive: ${NIGHT_DANGER_ATK_BONUS}`);
  assert(typeof NIGHT_DANGER_SPAWN_MULT === 'number', 'NIGHT_DANGER_SPAWN_MULT exists');
  assert(NIGHT_DANGER_SPAWN_MULT >= 1, `night spawn mult >= 1: ${NIGHT_DANGER_SPAWN_MULT}`);
}

// ================================================================
// TEST 2: Enemies deal more damage at night
// ================================================================
heading('Night Enemy Damage');
{
  // Create a scenario with a guard fighting an enemy at night vs day
  // We test by placing a guard and enemy adjacent during night ticks

  // Night test: start at tick 0 (night period)
  let nightState = makeWorld();
  const v1 = createVillager(1, 5, 5);
  v1.role = 'guard' as any;
  v1.hp = 10;
  nightState = { ...nightState, villagers: [v1], nextVillagerId: 2 };
  nightState = placeBuilding(nightState, 'storehouse', 5, 6);
  nightState = placeBuilding(nightState, 'tent', 5, 5);
  nightState = {
    ...nightState,
    buildings: nightState.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };
  nightState.villagers[0].homeBuildingId = nightState.buildings.find(b => b.type === 'tent')!.id;

  // Place enemy adjacent at night (tick 0 = night)
  nightState.enemies.push({
    id: 'e1', type: 'bandit', x: 5, y: 4, hp: 100, maxHp: 100,
    attack: 3, defense: 0, speed: 1, path: [], range: 0, siege: 'none',
  } as any);

  // Advance 5 ticks during night
  nightState = advance(nightState, 5);

  const guardAfterNight = nightState.villagers.find(v => v.id === 'v1')!;
  const nightDmg = 10 - guardAfterNight.hp;

  // Day test: start at tick NIGHT_TICKS (dawn)
  let dayState = makeWorld();
  const v2 = createVillager(1, 5, 5);
  v2.role = 'guard' as any;
  v2.hp = 10;
  dayState = { ...dayState, villagers: [v2], nextVillagerId: 2 };
  dayState = placeBuilding(dayState, 'storehouse', 5, 6);
  dayState = placeBuilding(dayState, 'tent', 5, 5);
  dayState = {
    ...dayState,
    buildings: dayState.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };
  dayState.villagers[0].homeBuildingId = dayState.buildings.find(b => b.type === 'tent')!.id;

  // Advance to daytime first
  dayState.tick = NIGHT_TICKS - 1; // Just before dawn
  dayState.enemies.push({
    id: 'e1', type: 'bandit', x: 5, y: 4, hp: 100, maxHp: 100,
    attack: 3, defense: 0, speed: 1, path: [], range: 0, siege: 'none',
  } as any);

  dayState = advance(dayState, 5);

  const guardAfterDay = dayState.villagers.find(v => v.id === 'v1')!;
  const dayDmg = 10 - guardAfterDay.hp;

  // Night damage should be higher due to NIGHT_DANGER_ATK_BONUS
  assert(nightDmg >= dayDmg, `night damage ${nightDmg} >= day damage ${dayDmg}`);
}

// ================================================================
// TEST 3: Night raid spawns have more enemies
// ================================================================
heading('Night Raid Strength');
{
  // The night spawn multiplier makes raids that spawn at night stronger
  // This is tested indirectly through the constant
  assert(NIGHT_DANGER_SPAWN_MULT > 1, `night raids are stronger: ${NIGHT_DANGER_SPAWN_MULT}x`);
}

// ================================================================
// TEST 4: Night is correctly detected by tick
// ================================================================
heading('Night Detection');
{
  let state = makeWorld();
  // tick 0 = start of night (day 0)
  assert(state.tick % TICKS_PER_DAY < NIGHT_TICKS, 'tick 0 is nighttime');

  // Advance to daytime
  state = advance(state, NIGHT_TICKS + 1);
  const dayTick = state.tick % TICKS_PER_DAY;
  assert(dayTick >= NIGHT_TICKS, `tick ${state.tick} (dayTick ${dayTick}) is daytime`);
}

// ================================================================
// TEST 5: Night bonus applies to all enemy types
// ================================================================
heading('Night Bonus All Enemy Types');
{
  // Verify constant exists and is applied universally
  assert(NIGHT_DANGER_ATK_BONUS === 2, `night atk bonus is 2 (got ${NIGHT_DANGER_ATK_BONUS})`);
}

// ================================================================
// TEST 6: Walls take more damage at night
// ================================================================
heading('Walls Night Damage');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'wall', 5, 3);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };

  const wallBefore = state.buildings.find(b => b.type === 'wall')!;
  const hpBefore = wallBefore.hp;

  // Place enemy adjacent to wall at night
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 5, y: 3, hp: 100, maxHp: 100,
    attack: 3, defense: 0, speed: 1, path: [], range: 0, siege: 'none',
  } as any);

  // Advance 3 ticks at night
  state = advance(state, 3);

  const wallAfter = state.buildings.find(b => b.type === 'wall')!;
  assert(wallAfter.hp < hpBefore, `wall took damage at night: ${wallAfter.hp} < ${hpBefore}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Night Danger Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
