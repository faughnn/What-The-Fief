// test-v2-combat-skill.ts — Tests for combat skill XP and bonuses

import {
  createWorld, GameState, createVillager,
  GUARD_COMBAT, ENEMY_TEMPLATES, ALL_TECHS,
  TICKS_PER_DAY, EnemyEntity, EnemyType, ALL_SKILLS,
} from '../world.js';
import { placeBuilding } from '../simulation/buildings.js';
import { tick } from '../simulation/index.js';
import { combatSkillAttackBonus, combatSkillDefenseBonus } from '../simulation/helpers.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  const state = createWorld(20, 20, 42);
  state.research.completed = [];
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

  const s = placeBuilding(state, 'storehouse', 10, 10);
  const sh = s.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };

  const s2 = placeBuilding(s, 'tent', 8, 10);
  const tent = s2.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return s2;
}

function addGuard(state: GameState, x: number, y: number, combatSkill = 0): ReturnType<typeof createVillager> {
  const v = createVillager(state.nextVillagerId, x, y);
  v.role = 'guard';
  v.state = 'idle';
  v.traits = [];
  v.skills.combat = combatSkill;
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
// TEST 1: Combat skill type exists
// ================================================================
heading('Combat Skill Type');
{
  assert(ALL_SKILLS.includes('combat'), 'combat is a valid skill type');
  const v = createVillager(1, 0, 0);
  assert(v.skills.combat === 0, `new villager starts with 0 combat skill (${v.skills.combat})`);
}

// ================================================================
// TEST 2: Guards gain combat XP from fighting
// ================================================================
heading('Guard Combat XP');
{
  let state = makeWorld();
  const g = addGuard(state, 5, 5, 0);
  const e = addEnemy(state, 5, 6);

  state.tick = TICKS_PER_DAY - 10;
  state = tick(state);

  const gAfter = state.villagers[0];
  assert(gAfter.skills.combat > 0, `guard gained combat XP after fighting (${gAfter.skills.combat})`);
}

// ================================================================
// TEST 3: Higher combat skill = more damage dealt
// ================================================================
heading('Combat Skill Attack Bonus');
{
  // combat 0: bonus 0. combat 50: bonus 2. Guard atk=3, bandit def=1.
  // Normal: max(1, 3-1) = 2. Skilled: max(1, 3+2-1) = 4.
  let state1 = makeWorld();
  addGuard(state1, 5, 5, 0);
  const e1 = addEnemy(state1, 5, 6);
  const e1Start = e1.hp;

  let state2 = makeWorld();
  addGuard(state2, 5, 5, 50);
  const e2 = addEnemy(state2, 5, 6);
  const e2Start = e2.hp;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const e1Damage = e1Start - state1.enemies[0].hp;
  const e2Damage = e2Start - state2.enemies[0].hp;
  assert(e2Damage > e1Damage, `skilled guard deals more damage (${e2Damage} > ${e1Damage})`);
}

// ================================================================
// TEST 4: Higher combat skill = less damage taken
// ================================================================
heading('Combat Skill Defense Bonus');
{
  // combat 0: def bonus 0. combat 50: def bonus 1.
  // Guard def=2, brute atk=5. Normal: max(1,5-2)=3. Skilled: max(1,5-3)=2.
  let state1 = makeWorld();
  const g1 = addGuard(state1, 5, 5, 0);
  addEnemy(state1, 5, 6, 'bandit_brute');
  const g1Start = g1.hp;

  let state2 = makeWorld();
  const g2 = addGuard(state2, 5, 5, 50);
  addEnemy(state2, 5, 6, 'bandit_brute');
  const g2Start = g2.hp;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const g1Damage = g1Start - state1.villagers[0].hp;
  const g2Damage = g2Start - state2.villagers[0].hp;
  assert(g2Damage < g1Damage, `skilled guard takes less damage (${g2Damage} < ${g1Damage})`);
}

// ================================================================
// TEST 5: Fast learner trait gives more combat XP
// ================================================================
heading('Fast Learner Combat XP');
{
  let state1 = makeWorld();
  const g1 = addGuard(state1, 5, 5, 0);
  addEnemy(state1, 5, 6);

  let state2 = makeWorld();
  const g2 = addGuard(state2, 5, 5, 0);
  g2.traits = ['fast_learner'];
  addEnemy(state2, 5, 6);

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const xp1 = state1.villagers[0].skills.combat;
  const xp2 = state2.villagers[0].skills.combat;
  assert(xp2 > xp1, `fast_learner gains more combat XP (${xp2} > ${xp1})`);
}

// ================================================================
// TEST 6: New villagers don't start with combat skill
// ================================================================
heading('No Starting Combat Skill');
{
  // Create multiple villagers, none should have combat as starting aptitude
  let hasCombat = false;
  for (let i = 1; i <= 50; i++) {
    const v = createVillager(i, 0, 0);
    if (v.skills.combat > 0) hasCombat = true;
  }
  assert(!hasCombat, 'no villager starts with combat skill');
}

// ================================================================
// TEST 7: Combat skill bonus at key thresholds
// ================================================================
heading('Combat Skill Bonus Thresholds');
{
  // Attack: +1 per 25 skill. Defense: +1 per 50 skill.
  let state = makeWorld();
  const g0 = addGuard(state, 5, 5, 0);
  const g25 = addGuard(state, 6, 5, 25);
  const g50 = addGuard(state, 7, 5, 50);
  const g100 = addGuard(state, 8, 5, 100);

  assert(combatSkillAttackBonus(g0) === 0, 'combat 0: +0 attack');
  assert(combatSkillAttackBonus(g25) === 1, 'combat 25: +1 attack');
  assert(combatSkillAttackBonus(g50) === 2, 'combat 50: +2 attack');
  assert(combatSkillAttackBonus(g100) === 4, 'combat 100: +4 attack');

  assert(combatSkillDefenseBonus(g0) === 0, 'combat 0: +0 defense');
  assert(combatSkillDefenseBonus(g25) === 0, 'combat 25: +0 defense');
  assert(combatSkillDefenseBonus(g50) === 1, 'combat 50: +1 defense');
  assert(combatSkillDefenseBonus(g100) === 2, 'combat 100: +2 defense');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Combat Skill Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
