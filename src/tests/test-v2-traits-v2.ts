// test-v2-traits-v2.ts — Tests for 7 new Bellwright-inspired traits
// defender, fierce, nomad, prodigy, dullard, scholar, swordsman

import {
  createWorld, createVillager, GameState, Building, ALL_TRAITS,
  TICKS_PER_DAY, ALL_TECHS, BUILDING_TEMPLATES, Trait,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, setResearch,
} from '../simulation/index.js';
import { gainSkillXp, gainCombatXp } from '../simulation/helpers.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

// === Test: New traits exist in ALL_TRAITS ===
heading('Trait Definitions');

{
  const newTraits: Trait[] = ['defender', 'fierce', 'nomad', 'prodigy', 'dullard', 'scholar', 'swordsman'];
  for (const t of newTraits) {
    assert(ALL_TRAITS.includes(t), `${t} exists in ALL_TRAITS`);
  }
  assert(ALL_TRAITS.length === 24, `24 total traits (got ${ALL_TRAITS.length})`);
}

// === Test: Prodigy skill XP boost ===
heading('Prodigy Trait');

{
  const v1 = createVillager(1, 0, 0);
  v1.traits = ['prodigy'];
  v1.skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0, combat: 0 };

  const v2 = createVillager(2, 0, 0);
  v2.traits = [];
  v2.skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0, combat: 0 };

  gainSkillXp(v1, 'farm');
  gainSkillXp(v2, 'farm');

  assert(v1.skills.farming > v2.skills.farming, `prodigy gains more XP (${v1.skills.farming} > ${v2.skills.farming})`);
}

// === Test: Dullard skill XP penalty ===
heading('Dullard Trait');

{
  const v1 = createVillager(1, 0, 0);
  v1.traits = ['dullard', 'fast_learner'];
  v1.skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0, combat: 0 };

  const v2 = createVillager(2, 0, 0);
  v2.traits = ['fast_learner'];
  v2.skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0, combat: 0 };

  for (let i = 0; i < 10; i++) {
    gainSkillXp(v1, 'farm');
    gainSkillXp(v2, 'farm');
  }

  assert(v1.skills.farming < v2.skills.farming, `dullard gains less XP (${v1.skills.farming} < ${v2.skills.farming})`);
}

// === Test: Prodigy combat XP boost ===
{
  const v1 = createVillager(1, 0, 0);
  v1.traits = ['prodigy'];
  v1.skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0, combat: 0 };

  const v2 = createVillager(2, 0, 0);
  v2.traits = [];
  v2.skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0, combat: 0 };

  gainCombatXp(v1);
  gainCombatXp(v2);

  assert(v1.skills.combat > v2.skills.combat, `prodigy combat XP boost (${v1.skills.combat} > ${v2.skills.combat})`);
}

// === Test: Nomad storm immunity ===
heading('Nomad Trait');

{
  let state = createWorld(20, 10, 42);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];
  state = placeBuilding(state, 'storehouse', 15, 5);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100 };
  state.resources = { ...state.resources, food: 100 };

  // Place tent at (0,5) as home, farm at (18,5) as workplace — long commute
  state = placeBuilding(state, 'tent', 0, 5);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state = placeBuilding(state, 'farm', 18, 5);
  const farm = state.buildings.find(b => b.type === 'farm')!;
  farm.constructed = true; farm.hp = farm.maxHp;

  state.villagers = [];
  const nomad = createVillager(1, 0, 5);
  nomad.traits = ['nomad'];
  nomad.food = 8; nomad.morale = 80;
  nomad.homeBuildingId = tent.id;
  nomad.assignedBuildingId = farm.id;
  nomad.role = 'worker';
  nomad.state = 'traveling_to_work';
  nomad.path = [];
  for (let x = 1; x <= 18; x++) nomad.path.push({ x, y: 5 });
  nomad.pathIndex = 0;

  const normal = createVillager(2, 0, 5);
  normal.traits = [];
  normal.food = 8; normal.morale = 80;
  normal.homeBuildingId = tent.id;
  normal.assignedBuildingId = farm.id;
  normal.role = 'worker';
  normal.state = 'traveling_to_work';
  normal.path = [];
  for (let x = 1; x <= 18; x++) normal.path.push({ x, y: 5 });
  normal.pathIndex = 0;

  state.villagers.push(nomad, normal);
  state.nextVillagerId = 3;
  state.weather = 'storm';
  // Start during daytime so villagers are active (night ends at tick 1600 with TICKS_PER_DAY=4000)
  state.tick = 1600;

  for (let i = 0; i < 10; i++) {
    state = tick(state);
  }

  const nomadV = state.villagers.find(v => v.id === 'v1')!;
  const normalV = state.villagers.find(v => v.id === 'v2')!;

  assert(nomadV.x > normalV.x, `nomad travels faster in storm (nomad x=${nomadV.x}, normal x=${normalV.x})`);
}

// === Test: Combat trait integration ===
heading('Combat Integration');

{
  let state = createWorld(20, 10, 42);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];
  state = placeBuilding(state, 'storehouse', 15, 5);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100 };
  state.resources = { ...state.resources, food: 100 };

  state = placeBuilding(state, 'tent', 15, 3);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state.villagers = [];
  const guard = createVillager(1, 5, 5);
  guard.traits = ['defender'];
  guard.food = 8; guard.morale = 80;
  guard.role = 'guard';
  guard.homeBuildingId = tent.id;
  guard.hp = 15;
  state.villagers.push(guard);
  state.nextVillagerId = 2;

  state.enemies.push({
    id: 'e1', type: 'bandit',
    x: 5, y: 4, hp: 10, maxHp: 10,
    attack: 3, defense: 1, range: 0, siege: 'none', ticksAlive: 0,
  });

  for (let i = 0; i < 10; i++) {
    state = tick(state);
  }

  const guardAfter = state.villagers.find(v => v.id === 'v1')!;
  assert(guardAfter.hp > 0, 'defender guard survived combat');
  const enemy = state.enemies.find(e => e.id === 'e1');
  if (enemy) {
    assert(enemy.hp < 10, `defender dealt damage to enemy (hp: ${enemy.hp})`);
  } else {
    assert(true, 'defender killed the enemy');
  }
}

// === Test: Fierce trait in combat ===
{
  let state = createWorld(20, 10, 42);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];
  state = placeBuilding(state, 'storehouse', 15, 5);
  const sh2 = state.buildings.find(b => b.type === 'storehouse')!;
  sh2.constructed = true; sh2.hp = sh2.maxHp;
  sh2.localBuffer = { food: 100 };
  state.resources = { ...state.resources, food: 100 };

  state = placeBuilding(state, 'tent', 15, 3);
  const tent2 = state.buildings.find(b => b.type === 'tent')!;
  tent2.constructed = true; tent2.hp = tent2.maxHp;

  state.villagers = [];
  const guard = createVillager(1, 5, 5);
  guard.traits = ['fierce'];
  guard.food = 8; guard.morale = 80;
  guard.role = 'guard';
  guard.homeBuildingId = tent2.id;
  guard.hp = 15;
  state.villagers.push(guard);
  state.nextVillagerId = 2;

  state.enemies.push({
    id: 'e2', type: 'bandit',
    x: 5, y: 4, hp: 10, maxHp: 10,
    attack: 3, defense: 1, range: 0, siege: 'none', ticksAlive: 0,
  });

  for (let i = 0; i < 5; i++) {
    state = tick(state);
  }

  // Fierce has +3 attack — enemy should take more damage
  const enemy = state.enemies.find(e => e.id === 'e2');
  if (enemy) {
    assert(enemy.hp < 8, `fierce guard deals extra damage (hp: ${enemy.hp})`);
  } else {
    assert(true, 'fierce guard killed enemy quickly');
  }
}

// === Summary ===
console.log(`\nExpanded Traits v2: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
