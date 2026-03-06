// test-v2-call-to-arms.ts — Tests for Call to Arms emergency mobilization
// Bellwright lets you mobilize villagers as temporary militia during raids.
// callToArms converts workers to militia, standDown restores them.

import {
  createWorld, createVillager, GameState, Building,
  ENEMY_TEMPLATES, EnemyEntity, EnemyType,
  TICKS_PER_DAY, ALL_TECHS, MILITIA_COMBAT,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, callToArms, standDown,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function flatWorld(w: number, h: number): GameState {
  const state = createWorld(w, h, 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function addVillager(state: GameState, x: number, y: number, name?: string): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  if (name) v.name = name;
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function addEnemy(state: GameState, x: number, y: number): GameState {
  const t = ENEMY_TEMPLATES['bandit'];
  const enemy: EnemyEntity = {
    id: `e${state.nextEnemyId}`, type: 'bandit',
    x, y, hp: t.maxHp, maxHp: t.maxHp,
    attack: t.attack, defense: t.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  };
  return { ...state, enemies: [...state.enemies, enemy], nextEnemyId: state.nextEnemyId + 1 };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: callToArms converts workers to militia
// ================================================================
heading('Call to Arms Converts Workers');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 10, 5);
  state = addVillager(state, 12, 5);

  state = placeBuilding(state, 'tent', 10, 5);
  state = placeBuilding(state, 'farm', 12, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };
  state = assignVillager(state, 'v1', farmId);

  // Both villagers should be workers/farmers
  assert(state.villagers[0].role === 'farmer', `V1 is farmer before call (${state.villagers[0].role})`);

  state = callToArms(state);

  assert(state.callToArms === true, 'callToArms flag is set');
  const v1 = state.villagers.find(v => v.id === 'v1')!;
  const v2 = state.villagers.find(v => v.id === 'v2')!;
  assert(v1.role === 'militia', `V1 became militia (${v1.role})`);
  assert(v2.role === 'militia', `V2 became militia (${v2.role})`);
}

// ================================================================
// TEST 2: Guards are NOT affected by callToArms
// ================================================================
heading('Guards Unaffected');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 10, 5);
  state = addVillager(state, 12, 5);

  state = placeBuilding(state, 'tent', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  state = setGuard(state, 'v1');
  assert(state.villagers[0].role === 'guard', 'V1 is guard');

  state = callToArms(state);

  const guard = state.villagers.find(v => v.id === 'v1')!;
  const militia = state.villagers.find(v => v.id === 'v2')!;
  assert(guard.role === 'guard', `Guard stays guard (${guard.role})`);
  assert(militia.role === 'militia', `Non-guard becomes militia (${militia.role})`);
}

// ================================================================
// TEST 3: standDown restores previous roles
// ================================================================
heading('Stand Down Restores Roles');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 10, 5);
  state = addVillager(state, 12, 5);

  state = placeBuilding(state, 'tent', 10, 5);
  state = placeBuilding(state, 'farm', 12, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };
  state = assignVillager(state, 'v1', farmId);

  state = callToArms(state);
  assert(state.villagers[0].role === 'militia', 'V1 is militia');

  state = standDown(state);

  assert(state.callToArms === false, 'callToArms flag cleared');
  const v1 = state.villagers.find(v => v.id === 'v1')!;
  const v2 = state.villagers.find(v => v.id === 'v2')!;
  assert(v1.role === 'farmer', `V1 restored to farmer (${v1.role})`);
  assert(v2.role === 'idle', `V2 restored to idle (${v2.role})`);
}

// ================================================================
// TEST 4: Militia fight adjacent enemies
// ================================================================
heading('Militia Fight Adjacent Enemies');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  state = callToArms(state);

  // Place enemy adjacent to militia
  state = addEnemy(state, 11, 5);
  const enemyHpBefore = state.enemies[0].hp;

  state = advance(state, 1);

  const enemy = state.enemies.find(e => e.id === 'e1');
  const enemyHpAfter = enemy ? enemy.hp : 0;
  assert(enemyHpAfter < enemyHpBefore, `Militia damaged adjacent enemy (hp: ${enemyHpBefore} → ${enemyHpAfter})`);
}

// ================================================================
// TEST 5: Militia are weaker than guards
// ================================================================
heading('Militia Combat Stats');

{
  assert(MILITIA_COMBAT.attack < 3, `Militia attack < guard base attack (${MILITIA_COMBAT.attack} < 3)`);
  assert(MILITIA_COMBAT.defense === 0, `Militia defense is 0 (${MILITIA_COMBAT.defense})`);
}

// ================================================================
// TEST 6: Auto-stand-down when no enemies remain
// ================================================================
heading('Auto Stand Down');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 10, 5);
  state = placeBuilding(state, 'farm', 12, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };
  state = assignVillager(state, 'v1', farmId);

  // Add enemy, call to arms
  state = addEnemy(state, 11, 5);
  state = callToArms(state);
  assert(state.callToArms === true, 'CTA active');
  assert(state.villagers[0].role === 'militia', 'V1 is militia');

  // Kill the enemy manually
  state = { ...state, enemies: [] };

  // Advance a few ticks — should auto-stand-down
  state = advance(state, 3);

  assert(state.callToArms === false, 'Auto-stand-down when no enemies');
  const v1 = state.villagers.find(v => v.id === 'v1')!;
  assert(v1.role === 'farmer', `Role restored after auto-stand-down (${v1.role})`);
}

// ================================================================
// TEST 7: Militia move toward enemies (not passive)
// ================================================================
heading('Militia Move Toward Enemies');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 5, 5);

  state = placeBuilding(state, 'tent', 5, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  state = callToArms(state);
  state = addEnemy(state, 10, 5);

  const xBefore = state.villagers[0].x;
  state = advance(state, 1);

  const militia = state.villagers.find(v => v.id === 'v1')!;
  assert(militia.x > xBefore, `Militia moved toward enemy (x: ${xBefore} → ${militia.x})`);
}

// ================================================================
// TEST 8: Double call to arms is idempotent
// ================================================================
heading('Idempotent Call');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 10, 5);
  state = placeBuilding(state, 'tent', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  state = callToArms(state);
  const prevRole1 = state.villagers[0].previousRole;

  // Call again — should not overwrite previousRole
  state = callToArms(state);
  assert(state.villagers[0].previousRole === prevRole1, 'Double call preserves previousRole');
}

// ================================================================
// TEST 9: standDown without callToArms is no-op
// ================================================================
heading('Stand Down No-Op');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 10, 5);
  state = placeBuilding(state, 'tent', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  const roleBefore = state.villagers[0].role;
  state = standDown(state);
  assert(state.villagers[0].role === roleBefore, `standDown no-op when not mobilized (${state.villagers[0].role})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Call to Arms Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
