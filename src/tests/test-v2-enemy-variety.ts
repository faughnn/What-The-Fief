// test-v2-enemy-variety.ts — Tests for diverse raid enemy types
// Bellwright has tiered bandits (light, armored, archers). Our raids should
// include bandit_archer (ranged) and bandit_brute (heavily armored) enemies
// that scale with raid difficulty.

import {
  createWorld, createVillager, GameState, Building,
  ENEMY_TEMPLATES, EnemyEntity, EnemyType,
  TICKS_PER_DAY, ALL_TECHS,
  WATCHTOWER_RANGE, WATCHTOWER_DAMAGE,
  WEAPON_STATS,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard,
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
  state.research.completed = [...ALL_TECHS];
  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

function addEnemy(state: GameState, type: EnemyType, x: number, y: number): GameState {
  const t = ENEMY_TEMPLATES[type];
  const enemy: EnemyEntity = {
    id: `e${state.nextEnemyId}`, type,
    x, y, hp: t.maxHp, maxHp: t.maxHp,
    attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
    range: t.range || 0,
  };
  return { ...state, enemies: [...state.enemies, enemy], nextEnemyId: state.nextEnemyId + 1 };
}

// ================================================================
// TEST 1: Enemy templates exist with correct stats
// ================================================================
heading('Enemy Template Definitions');

{
  assert(ENEMY_TEMPLATES['bandit'] !== undefined, 'bandit template exists');
  assert(ENEMY_TEMPLATES['bandit_archer'] !== undefined, 'bandit_archer template exists');
  assert(ENEMY_TEMPLATES['bandit_brute'] !== undefined, 'bandit_brute template exists');

  const archer = ENEMY_TEMPLATES['bandit_archer'];
  assert(archer.maxHp < ENEMY_TEMPLATES['bandit'].maxHp, `Archer has less HP than regular bandit (${archer.maxHp} < ${ENEMY_TEMPLATES['bandit'].maxHp})`);
  assert((archer as any).range > 0, `Archer has ranged attack (range=${(archer as any).range})`);
  assert(archer.defense === 0, `Archer has 0 defense (got ${archer.defense})`);

  const brute = ENEMY_TEMPLATES['bandit_brute'];
  assert(brute.maxHp > ENEMY_TEMPLATES['bandit'].maxHp, `Brute has more HP than regular bandit (${brute.maxHp} > ${ENEMY_TEMPLATES['bandit'].maxHp})`);
  assert(brute.defense > ENEMY_TEMPLATES['bandit'].defense, `Brute has more defense than regular bandit (${brute.defense} > ${ENEMY_TEMPLATES['bandit'].defense})`);
  assert(brute.attack > ENEMY_TEMPLATES['bandit'].attack, `Brute has more attack than regular bandit (${brute.attack} > ${ENEMY_TEMPLATES['bandit'].attack})`);
}

// ================================================================
// TEST 2: Bandit archer shoots at range (doesn't need adjacency)
// ================================================================
heading('Bandit Archer Ranged Attack');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 10, 5);

  // Place tent and home
  state = placeBuilding(state, 'tent', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  // Make villager a guard
  state = setGuard(state, 'v1');

  // Place archer at range 3 from guard (within archer range, not adjacent)
  state = addEnemy(state, 'bandit_archer', 13, 5);
  const guardHpBefore = state.villagers[0].hp;

  // Run a few ticks — archer should shoot at guard
  state = advance(state, 3);

  const guardHpAfter = state.villagers.find(v => v.id === 'v1')!.hp;
  assert(guardHpAfter < guardHpBefore, `Archer damaged guard at range (hp: ${guardHpBefore} → ${guardHpAfter})`);
}

// ================================================================
// TEST 3: Bandit archer doesn't shoot beyond its range
// ================================================================
heading('Bandit Archer Range Limit');

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
  state = setGuard(state, 'v1');

  // Place archer way beyond range (range is 3, place at distance 8)
  state = addEnemy(state, 'bandit_archer', 13, 5);
  const guardHpBefore = state.villagers[0].hp;

  // Run 1 tick — archer should move, not shoot (too far)
  state = advance(state, 1);

  const guard = state.villagers.find(v => v.id === 'v1')!;
  // Guard shouldn't take ranged damage yet (archer out of range)
  // Archer moves 1 tile closer per tick, so distance goes from 8 to 7 — still beyond range 3
  assert(guard.hp === guardHpBefore, `Archer didn't shoot beyond range (hp unchanged: ${guard.hp})`);
}

// ================================================================
// TEST 4: Bandit brute is tanky (survives multiple hits)
// ================================================================
heading('Bandit Brute Tankiness');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, food: 50 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 8, 5);
  state = placeBuilding(state, 'watchtower', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId, x: 10, y: 5 })),
  };

  state = setGuard(state, 'v1');
  state = assignVillager(state, 'v1', towerId);

  // Place brute within watchtower range
  state = addEnemy(state, 'bandit_brute', 14, 5);
  const bruteHpBefore = state.enemies[0].hp;

  // Run 3 ticks — watchtower shoots
  state = advance(state, 3);

  const brute = state.enemies.find(e => e.id === 'e1');
  assert(brute !== undefined && brute.hp > 0, `Brute survived 3 watchtower shots (hp: ${brute?.hp}/${bruteHpBefore})`);
}

// ================================================================
// TEST 5: Regular bandit has no ranged attack
// ================================================================
heading('Regular Bandit Has No Range');

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
  state = setGuard(state, 'v1');

  // Place regular bandit at range 3 (not adjacent)
  state = addEnemy(state, 'bandit', 13, 5);
  const guardHpBefore = state.villagers[0].hp;

  // Run 1 tick — bandit should move, NOT shoot
  state = advance(state, 1);

  const guard = state.villagers.find(v => v.id === 'v1')!;
  assert(guard.hp === guardHpBefore, `Regular bandit didn't shoot at range (hp unchanged: ${guard.hp})`);
}

// ================================================================
// TEST 6: Raid composition scales with raid level
// ================================================================
heading('Raid Composition Scaling');

{
  // At raid level 1-2: all regular bandits
  // At raid level 3+: some archers appear
  // At raid level 5+: some brutes appear

  // Test by spawning a raid from a camp at different strength levels
  // We'll check enemy types in the spawned raid

  // Low level raid (strength 1) — all regular bandits
  let state = flatWorld(30, 30);
  state = { ...state, resources: { ...state.resources, wood: 200, stone: 100, food: 100 } };

  // Add enough villagers and buildings for raids to trigger
  for (let i = 0; i < 8; i++) state = addVillager(state, 10 + i, 15);
  for (let i = 0; i < 4; i++) {
    state = placeBuilding(state, 'tent', 10 + i, 14);
    state.buildings[state.buildings.length - 1].constructed = true;
  }
  for (let i = 0; i < 4; i++) {
    state = placeBuilding(state, 'farm', 10 + i, 16);
    state.buildings[state.buildings.length - 1].constructed = true;
  }
  state = placeBuilding(state, 'storehouse', 15, 15);
  state.buildings[state.buildings.length - 1].constructed = true;

  // Create a camp at strength 1
  state.banditCamps = [{
    id: 'camp1', x: 0, y: 0, hp: 30, maxHp: 30,
    strength: 1, lastRaidDay: -100, raidInterval: 1,
  }];

  // Advance to next day to trigger raid
  while (state.tick % TICKS_PER_DAY !== TICKS_PER_DAY - 1) state = tick(state);
  state = tick(state); // new day

  const lowLevelEnemies = state.enemies.filter(e => e.type !== 'wolf');
  const lowArchers = lowLevelEnemies.filter(e => e.type === 'bandit_archer');
  const lowBrutes = lowLevelEnemies.filter(e => e.type === 'bandit_brute');
  assert(lowArchers.length === 0, `Low-level raid (str 1) has no archers (got ${lowArchers.length})`);
  assert(lowBrutes.length === 0, `Low-level raid (str 1) has no brutes (got ${lowBrutes.length})`);
}

{
  // High level raid (strength 4) — should include archers
  let state = flatWorld(30, 30);
  state = { ...state, resources: { ...state.resources, wood: 200, stone: 100, food: 100 } };

  for (let i = 0; i < 8; i++) state = addVillager(state, 10 + i, 15);
  for (let i = 0; i < 4; i++) {
    state = placeBuilding(state, 'tent', 10 + i, 14);
    state.buildings[state.buildings.length - 1].constructed = true;
  }
  for (let i = 0; i < 4; i++) {
    state = placeBuilding(state, 'farm', 10 + i, 16);
    state.buildings[state.buildings.length - 1].constructed = true;
  }
  state = placeBuilding(state, 'storehouse', 15, 15);
  state.buildings[state.buildings.length - 1].constructed = true;

  state.banditCamps = [{
    id: 'camp1', x: 0, y: 0, hp: 60, maxHp: 60,
    strength: 4, lastRaidDay: -100, raidInterval: 1,
  }];

  while (state.tick % TICKS_PER_DAY !== TICKS_PER_DAY - 1) state = tick(state);
  state = tick(state);

  const midEnemies = state.enemies.filter(e => e.siege === 'none');
  const midArchers = midEnemies.filter(e => e.type === 'bandit_archer');
  assert(midArchers.length > 0, `Mid-level raid (str 4) includes archers (got ${midArchers.length})`);
}

{
  // Very high level raid (strength 6) — should include brutes
  let state = flatWorld(30, 30);
  state = { ...state, resources: { ...state.resources, wood: 200, stone: 100, food: 100 } };

  for (let i = 0; i < 8; i++) state = addVillager(state, 10 + i, 15);
  for (let i = 0; i < 4; i++) {
    state = placeBuilding(state, 'tent', 10 + i, 14);
    state.buildings[state.buildings.length - 1].constructed = true;
  }
  for (let i = 0; i < 4; i++) {
    state = placeBuilding(state, 'farm', 10 + i, 16);
    state.buildings[state.buildings.length - 1].constructed = true;
  }
  state = placeBuilding(state, 'storehouse', 15, 15);
  state.buildings[state.buildings.length - 1].constructed = true;

  state.banditCamps = [{
    id: 'camp1', x: 0, y: 0, hp: 90, maxHp: 90,
    strength: 6, lastRaidDay: -100, raidInterval: 1,
  }];

  while (state.tick % TICKS_PER_DAY !== TICKS_PER_DAY - 1) state = tick(state);
  state = tick(state);

  const highEnemies = state.enemies.filter(e => e.siege === 'none');
  const highBrutes = highEnemies.filter(e => e.type === 'bandit_brute');
  assert(highBrutes.length > 0, `High-level raid (str 6) includes brutes (got ${highBrutes.length})`);
}

// ================================================================
// TEST 7: Archer stops moving when in range of a target
// ================================================================
heading('Archer Stops Moving When In Range');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 50 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 10, 5);
  state = placeBuilding(state, 'storehouse', 12, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };
  state = setGuard(state, 'v1');
  // Guard at 10,5. Place archer at 13,5 (distance 3 = within archer range)
  state = addEnemy(state, 'bandit_archer', 13, 5);
  const archerXBefore = state.enemies[0].x;

  // Run 1 tick
  state = advance(state, 1);

  const archer = state.enemies.find(e => e.id === 'e1');
  // Archer should stay put (or not move closer) since it's in range
  assert(archer !== undefined, 'Archer still alive');
  if (archer) {
    // Archer should not have moved closer to guard
    const distAfter = Math.abs(archer.x - 10) + Math.abs(archer.y - 5);
    assert(distAfter >= 2, `Archer maintains distance when in range (dist=${distAfter})`);
  }
}

// ================================================================
// TEST 8: EnemyEntity has range field
// ================================================================
heading('EnemyEntity Range Field');

{
  let state = flatWorld(10, 10);
  state = addEnemy(state, 'bandit_archer', 5, 5);
  const archer = state.enemies[0];
  assert(archer.range !== undefined, 'EnemyEntity has range field');
  assert(archer.range > 0, `Archer range > 0 (got ${archer.range})`);

  state = addEnemy(state, 'bandit', 6, 5);
  const bandit = state.enemies[1];
  assert(bandit.range === 0, `Regular bandit range = 0 (got ${bandit.range})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Enemy Variety Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
