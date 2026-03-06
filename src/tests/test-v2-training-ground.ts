// test-v2-training-ground.ts — Tests for training ground building

import {
  createWorld, GameState, createVillager,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, ALL_TECHS,
  BUILDING_TECH_REQUIREMENTS, TICKS_PER_DAY,
} from '../world.js';
import { placeBuilding, assignVillager } from '../simulation/index.js';
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
  state.resources = { ...state.resources, wood: 200, stone: 200, food: 200 };
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

// ================================================================
// TEST 1: Template exists
// ================================================================
heading('Training Ground Template');
{
  assert(BUILDING_TEMPLATES.training_ground !== undefined, 'training_ground template exists');
  assert(BUILDING_TEMPLATES.training_ground.maxWorkers === 2, 'supports 2 guards');
  assert(BUILDING_MAX_HP.training_ground === 40, `HP is 40 (${BUILDING_MAX_HP.training_ground})`);
  assert(BUILDING_TECH_REQUIREMENTS.training_ground === 'fortification', 'requires fortification');
}

// ================================================================
// TEST 2: Guards assigned to training ground gain combat XP daily
// ================================================================
heading('Training Ground XP Gain');
{
  let state = makeWorld();
  state = placeBuilding(state, 'training_ground', 5, 5);
  const tg = state.buildings.find(b => b.type === 'training_ground')!;
  tg.constructed = true; tg.hp = tg.maxHp;

  const guard = createVillager(1, 5, 5);
  guard.role = 'guard';
  guard.state = 'idle';
  guard.traits = [];
  guard.skills.combat = 0;
  state.villagers.push(guard);
  state.nextVillagerId = 2;

  state = assignVillager(state, guard.id, tg.id);

  // Run 1 full day
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const guardAfter = state.villagers.find(v => v.id === guard.id)!;
  assert(guardAfter.skills.combat > 0, `guard gained combat XP from training (${guardAfter.skills.combat})`);
}

// ================================================================
// TEST 3: Assigning villager to training ground makes them a guard
// ================================================================
heading('Training Ground Makes Guard');
{
  let state = makeWorld();
  state = placeBuilding(state, 'training_ground', 5, 5);
  const tg = state.buildings.find(b => b.type === 'training_ground')!;
  tg.constructed = true; tg.hp = tg.maxHp;

  const worker = createVillager(1, 5, 5);
  worker.role = 'idle';
  worker.state = 'idle';
  worker.traits = [];
  state.villagers.push(worker);
  state.nextVillagerId = 2;

  state = assignVillager(state, worker.id, tg.id);

  const assigned = state.villagers.find(v => v.id === worker.id)!;
  assert(assigned.role === 'guard', `assigned villager becomes guard (${assigned.role})`);
}

// ================================================================
// TEST 4: Fast learner gets more training XP
// ================================================================
heading('Fast Learner Training Bonus');
{
  let state1 = makeWorld();
  state1 = placeBuilding(state1, 'training_ground', 5, 5);
  const tg1 = state1.buildings.find(b => b.type === 'training_ground')!;
  tg1.constructed = true; tg1.hp = tg1.maxHp;

  const g1 = createVillager(1, 5, 5);
  g1.role = 'guard'; g1.state = 'idle'; g1.traits = [];
  g1.skills.combat = 0;
  state1.villagers.push(g1);
  state1.nextVillagerId = 2;
  state1 = assignVillager(state1, g1.id, tg1.id);

  let state2 = makeWorld();
  state2 = placeBuilding(state2, 'training_ground', 5, 5);
  const tg2 = state2.buildings.find(b => b.type === 'training_ground')!;
  tg2.constructed = true; tg2.hp = tg2.maxHp;

  const g2 = createVillager(1, 5, 5);
  g2.role = 'guard'; g2.state = 'idle'; g2.traits = ['fast_learner'];
  g2.skills.combat = 0;
  state2.villagers.push(g2);
  state2.nextVillagerId = 2;
  state2 = assignVillager(state2, g2.id, tg2.id);

  for (let i = 0; i < TICKS_PER_DAY; i++) { state1 = tick(state1); state2 = tick(state2); }

  const xp1 = state1.villagers.find(v => v.id === g1.id)!.skills.combat;
  const xp2 = state2.villagers.find(v => v.id === g2.id)!.skills.combat;
  assert(xp2 > xp1, `fast_learner gains more training XP (${xp2} > ${xp1})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Training Ground Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
