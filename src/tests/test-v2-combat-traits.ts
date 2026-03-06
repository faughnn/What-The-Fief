// test-v2-combat-traits.ts — Tests for brave/coward/resilient/nimble combat traits

import {
  createWorld, GameState, createVillager,
  GUARD_COMBAT, ENEMY_TEMPLATES, ALL_TECHS, MILITIA_COMBAT,
  TICKS_PER_DAY, EnemyType,
  EnemyEntity,
} from '../world.js';
import { placeBuilding } from '../simulation/buildings.js';
import { tick } from '../simulation/index.js';

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
  state.resources.wood = 200;
  state.resources.stone = 200;
  state.resources.food = 200;
  state.villagers = [];
  state.nextVillagerId = 1;

  // Place storehouse
  const s = placeBuilding(state, 'storehouse', 10, 10);
  const sh = s.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };

  // Place tent
  const s2 = placeBuilding(s, 'tent', 8, 10);
  const tent = s2.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return s2;
}

function addGuard(state: GameState, x: number, y: number, traits: string[] = []): ReturnType<typeof createVillager> {
  const v = createVillager(state.nextVillagerId, x, y);
  v.role = 'guard';
  v.state = 'idle';
  v.traits = traits;
  state.nextVillagerId++;
  state.villagers.push(v);
  return v;
}

function addEnemy(state: GameState, x: number, y: number, type: EnemyType = 'bandit'): EnemyEntity {
  const t = ENEMY_TEMPLATES[type];
  const e: EnemyEntity = {
    id: `e${state.nextEnemyId}`, type, x, y,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  };
  state.nextEnemyId++;
  state.enemies.push(e);
  return e;
}

// ================================================================
// TEST 1: Brave guard deals more damage than normal guard
// ================================================================
heading('Brave Guard Attack Bonus');
{
  // Normal guard vs bandit
  let state1 = makeWorld();
  const g1 = addGuard(state1, 5, 5, []);
  const e1 = addEnemy(state1, 5, 6);
  const e1StartHp = e1.hp;

  // Brave guard vs bandit
  let state2 = makeWorld();
  const g2 = addGuard(state2, 5, 5, ['brave']);
  const e2 = addEnemy(state2, 5, 6);
  const e2StartHp = e2.hp;

  // Run 1 tick during daytime (guards fight during day)
  state1.tick = TICKS_PER_DAY - 10; // near end of day
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const e1Damage = e1StartHp - state1.enemies[0].hp;
  const e2Damage = e2StartHp - state2.enemies[0].hp;
  assert(e2Damage > e1Damage, `brave guard deals more damage (${e2Damage} > ${e1Damage})`);
}

// ================================================================
// TEST 2: Coward guard deals less damage
// ================================================================
heading('Coward Guard Attack Penalty');
{
  let state1 = makeWorld();
  const g1 = addGuard(state1, 5, 5, []);
  const e1 = addEnemy(state1, 5, 6);
  const e1StartHp = e1.hp;

  let state2 = makeWorld();
  const g2 = addGuard(state2, 5, 5, ['coward']);
  const e2 = addEnemy(state2, 5, 6);
  const e2StartHp = e2.hp;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const e1Damage = e1StartHp - state1.enemies[0].hp;
  const e2Damage = e2StartHp - state2.enemies[0].hp;
  assert(e2Damage < e1Damage, `coward guard deals less damage (${e2Damage} < ${e1Damage})`);
}

// ================================================================
// TEST 3: Resilient guard takes less damage
// ================================================================
heading('Resilient Guard Defense Bonus');
{
  // Strip defense techs so guard base defense is visible
  // No techs: guard def=2, brute atk=5. Normal: max(1,5-2)=3. Resilient(+2): max(1,5-4)=1.
  let state1 = makeWorld();
  state1.research.completed = [];
  const g1 = addGuard(state1, 5, 5, []);
  const e1 = addEnemy(state1, 5, 6, 'bandit_brute');
  const g1StartHp = g1.hp;

  let state2 = makeWorld();
  state2.research.completed = [];
  const g2 = addGuard(state2, 5, 5, ['resilient']);
  const e2 = addEnemy(state2, 5, 6, 'bandit_brute');
  const g2StartHp = g2.hp;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const g1Damage = g1StartHp - state1.villagers[0].hp;
  const g2Damage = g2StartHp - state2.villagers[0].hp;
  assert(g2Damage < g1Damage, `resilient guard takes less damage (${g2Damage} < ${g1Damage})`);
}

// ================================================================
// TEST 4: Nimble gives both attack and defense
// ================================================================
heading('Nimble Guard Attack Bonus');
{
  // No techs. Bandit def=1, guard atk=3. Normal: max(1,3-1)=2. Nimble(+1 atk): max(1,4-1)=3.
  let state1 = makeWorld();
  state1.research.completed = [];
  const g1 = addGuard(state1, 5, 5, []);
  const e1 = addEnemy(state1, 5, 6);
  const e1StartHp = e1.hp;

  let state2 = makeWorld();
  state2.research.completed = [];
  const g2 = addGuard(state2, 5, 5, ['nimble']);
  const e2 = addEnemy(state2, 5, 6);
  const e2StartHp = e2.hp;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const e1Damage = e1StartHp - state1.enemies[0].hp;
  const e2Damage = e2StartHp - state2.enemies[0].hp;
  assert(e2Damage > e1Damage, `nimble guard deals more damage (${e2Damage} > ${e1Damage})`);
}

heading('Nimble Guard Defense Bonus');
{
  // No techs. Brute atk=5, guard def=2. Normal: max(1,5-2)=3. Nimble(+1 def): max(1,5-3)=2.
  let state1 = makeWorld();
  state1.research.completed = [];
  const g1 = addGuard(state1, 5, 5, []);
  const e1 = addEnemy(state1, 5, 6, 'bandit_brute');
  const g1StartHp = g1.hp;

  let state2 = makeWorld();
  state2.research.completed = [];
  const g2 = addGuard(state2, 5, 5, ['nimble']);
  const e2 = addEnemy(state2, 5, 6, 'bandit_brute');
  const g2StartHp = g2.hp;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const g1Damage = g1StartHp - state1.villagers[0].hp;
  const g2Damage = g2StartHp - state2.villagers[0].hp;
  assert(g2Damage < g1Damage, `nimble guard takes less damage (${g2Damage} < ${g1Damage})`);
}

// ================================================================
// TEST 5: Militia with brave trait deals more damage
// ================================================================
heading('Militia Trait Bonus');
{
  // Place militia near settlement center, enemy far away moving toward militia
  // Militia at (10,8), enemy at (10,5) — enemy moves toward center (10,10)
  // After 2 ticks enemy reaches (10,7), militia moves to (10,7) — same tile, adjacent
  let state1 = makeWorld();
  state1.callToArms = true;
  const m1 = addGuard(state1, 10, 8, []);
  m1.role = 'militia';
  const e1 = addEnemy(state1, 10, 5);
  const e1StartHp = e1.hp;

  let state2 = makeWorld();
  state2.callToArms = true;
  const m2 = addGuard(state2, 10, 8, ['brave']);
  m2.role = 'militia';
  const e2 = addEnemy(state2, 10, 5);
  const e2StartHp = e2.hp;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  // Run enough ticks for militia and enemy to meet and fight
  for (let i = 0; i < 5; i++) { state1 = tick(state1); state2 = tick(state2); }

  const e1Damage = e1StartHp - (state1.enemies[0]?.hp ?? e1StartHp);
  const e2Damage = e2StartHp - (state2.enemies[0]?.hp ?? e2StartHp);
  assert(e2Damage > e1Damage, `brave militia deals more damage (${e2Damage} > ${e1Damage})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Combat Traits Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
