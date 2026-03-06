// test-v2-villages.ts — NPC village trust system and liberation tests

import {
  createWorld, GameState, TICKS_PER_DAY, EnemyEntity,
  TRUST_KILL_BANDIT, TRUST_VILLAGE_RADIUS, TRUST_THRESHOLDS,
  LIBERATION_BRIGAND_COUNT, LIBERATION_RENOWN_REWARD,
  NpcSettlement,
} from '../world.js';
import { tick, liberateVillage } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function makeSmallWorld(): GameState {
  // 40x40 to get NPC villages generated
  return createWorld(40, 40, 4);
}

function addVillage(state: GameState, id: string, x: number, y: number): GameState {
  const village: NpcSettlement = {
    id, name: 'TestVillage', direction: 'n', specialty: 'wood',
    x, y, trust: 0, trustRank: 'stranger', liberated: false, liberationInProgress: false,
  };
  return { ...state, npcSettlements: [...state.npcSettlements, village] };
}

function spawnEnemy(state: GameState, x: number, y: number, hp: number = 1): GameState {
  const e: EnemyEntity = {
    id: `e${state.nextEnemyId}`, type: 'bandit',
    x, y, hp, maxHp: 10, attack: 3, defense: 1, range: 0, siege: 'none', ticksAlive: 0,
  };
  return { ...state, enemies: [...state.enemies, e], nextEnemyId: state.nextEnemyId + 1 };
}

// ========================
// TRUST SYSTEM
// ========================

console.log('\n=== Villages: createWorld generates NPC villages on large maps ===');
{
  const state = createWorld(40, 40, 4);
  assert(state.npcSettlements.length === 4, `4 NPC villages generated (got ${state.npcSettlements.length})`);
  for (const v of state.npcSettlements) {
    assert(v.trust === 0, `${v.name} starts at trust 0`);
    assert(v.trustRank === 'stranger', `${v.name} starts as stranger`);
    assert(v.liberated === false, `${v.name} not liberated`);
    assert(v.x >= 0 && v.x < 40, `${v.name} x in bounds (${v.x})`);
    assert(v.y >= 0 && v.y < 40, `${v.name} y in bounds (${v.y})`);
  }
}

console.log('\n=== Villages: small maps get no NPC villages ===');
{
  const state = createWorld(20, 20, 2);
  assert(state.npcSettlements.length === 0, 'No villages on 20x20 map');
}

console.log('\n=== Trust: killing enemy near village grants trust ===');
{
  let state = createWorld(20, 20, 2);
  // Add a village manually at (10, 10)
  state = addVillage(state, 'v1', 10, 10);
  // Spawn a 1-HP enemy within TRUST_VILLAGE_RADIUS of village
  state = spawnEnemy(state, 12, 10, 1);
  // Spawn a guard adjacent to the enemy to kill it
  const guard = state.villagers[0];
  guard.role = 'guard';
  guard.hp = 100;
  guard.x = 12;
  guard.y = 11;
  guard.guardMode = 'charge';
  guard.guardLine = 'front';
  // Tick until enemy dies
  for (let i = 0; i < 20; i++) state = tick(state);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  assert(village.trust >= TRUST_KILL_BANDIT, `Trust increased (${village.trust} >= ${TRUST_KILL_BANDIT})`);
}

console.log('\n=== Trust: killing enemy FAR from village gives no trust ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 2, 2);
  // Enemy at (18, 18) — far from village at (2, 2)
  state = spawnEnemy(state, 18, 18, 1);
  const guard = state.villagers[0];
  guard.role = 'guard';
  guard.hp = 100;
  guard.x = 18;
  guard.y = 17;
  guard.guardMode = 'charge';
  guard.guardLine = 'front';
  for (let i = 0; i < 20; i++) state = tick(state);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  assert(village.trust === 0, `Trust unchanged for far kill (${village.trust})`);
}

console.log('\n=== Trust: rank progresses through thresholds ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  // Manually set trust to test rank progression
  village.trust = 0;
  assert(village.trustRank === 'stranger', 'Rank at 0 trust = stranger');

  village.trust = 100;
  // Simulate rank update (same logic as combat.ts)
  let rank: string = 'stranger';
  for (const t of TRUST_THRESHOLDS) { if (village.trust >= t.trust) rank = t.rank; }
  assert(rank === 'associate', 'Rank at 100 trust = associate');

  village.trust = 500;
  rank = 'stranger';
  for (const t of TRUST_THRESHOLDS) { if (village.trust >= t.trust) rank = t.rank; }
  assert(rank === 'friend', 'Rank at 500 trust = friend');

  village.trust = 1200;
  rank = 'stranger';
  for (const t of TRUST_THRESHOLDS) { if (village.trust >= t.trust) rank = t.rank; }
  assert(rank === 'protector', 'Rank at 1200 trust = protector');
}

console.log('\n=== Trust: liberated villages don\'t gain more trust ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  village.liberated = true;
  village.trust = 500;
  // Spawn and kill an enemy near the village
  state = spawnEnemy(state, 11, 10, 1);
  const guard = state.villagers[0];
  guard.role = 'guard';
  guard.hp = 100;
  guard.x = 11;
  guard.y = 11;
  guard.guardMode = 'charge';
  guard.guardLine = 'front';
  for (let i = 0; i < 20; i++) state = tick(state);
  const v = state.npcSettlements.find(v => v.id === 'v1')!;
  assert(v.trust === 500, `Liberated village trust unchanged (${v.trust})`);
}

console.log('\n=== Trust: killing hostile wildlife near village grants trust ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  // Spawn a hostile wolf near the village with 1 HP
  state = { ...state, animals: [...state.animals, {
    id: `a${state.nextAnimalId}`, type: 'wild_wolf' as const,
    x: 11, y: 10, hp: 1, maxHp: 8, attack: 4, behavior: 'hostile' as const,
  }], nextAnimalId: state.nextAnimalId + 1 };
  // Place a guard adjacent to kill it
  const guard = state.villagers[0];
  guard.role = 'guard';
  guard.hp = 100;
  guard.x = 11;
  guard.y = 11;
  guard.guardMode = 'charge';
  guard.guardLine = 'front';
  for (let i = 0; i < 20; i++) state = tick(state);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  assert(village.trust >= 5, `Trust from wildlife kill (${village.trust} >= 5)`);
}

// ========================
// LIBERATION
// ========================

console.log('\n=== Liberation: requires protector rank ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  village.trust = 50;
  village.trustRank = 'stranger';

  // Import dynamically to test
  const result = liberateVillage(state, 'v1');
  // Should fail — not protector rank
  const v = result.npcSettlements.find(v => v.id === 'v1')!;
  assert(!v.liberationInProgress, 'Cannot liberate at stranger rank');
}

console.log('\n=== Liberation: starts at protector rank ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  village.trust = 1200;
  village.trustRank = 'protector';

  const result = liberateVillage(state, 'v1');
  const v = result.npcSettlements.find(v => v.id === 'v1')!;
  assert(v.liberationInProgress === true, 'Liberation started');
  // Should spawn brigands near the village
  assert(result.enemies.length >= LIBERATION_BRIGAND_COUNT,
    `Brigands spawned (${result.enemies.length} >= ${LIBERATION_BRIGAND_COUNT})`);
}

console.log('\n=== Liberation: brigands spawn near village position ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  state.npcSettlements.find(v => v.id === 'v1')!.trust = 1200;
  state.npcSettlements.find(v => v.id === 'v1')!.trustRank = 'protector';

  const result = liberateVillage(state, 'v1');
  // All brigands should be within ~5 tiles of village
  for (const e of result.enemies) {
    const dist = Math.abs(e.x - 10) + Math.abs(e.y - 10);
    assert(dist <= 6, `Brigand at (${e.x},${e.y}) near village (dist ${dist} <= 6)`);
  }
}

console.log('\n=== Liberation: defeating all brigands completes liberation ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  village.trust = 1200;
  village.trustRank = 'protector';

  state = liberateVillage(state, 'v1');
  assert(state.npcSettlements.find(v => v.id === 'v1')!.liberationInProgress === true, 'Liberation in progress');

  // Place a strong guard near the village to kill brigands
  const guard = state.villagers[0];
  guard.role = 'guard';
  guard.hp = 200;
  guard.attack = 50;
  guard.x = 10;
  guard.y = 10;
  guard.guardMode = 'charge';
  guard.guardLine = 'front';

  // Tick until all enemies are dead
  for (let i = 0; i < 60; i++) state = tick(state);

  const v = state.npcSettlements.find(v => v.id === 'v1')!;
  assert(v.liberated === true, `Village liberated after clearing brigands`);
  assert(v.liberationInProgress === false, `Liberation no longer in progress`);
  assert(v.trustRank === 'leader', `Trust rank upgraded to leader`);
}

console.log('\n=== Liberation: grants renown reward ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  state.npcSettlements.find(v => v.id === 'v1')!.trust = 1200;
  state.npcSettlements.find(v => v.id === 'v1')!.trustRank = 'protector';
  const startRenown = state.renown;

  state = liberateVillage(state, 'v1');

  // Kill all brigands with strong guard
  const guard = state.villagers[0];
  guard.role = 'guard';
  guard.hp = 200;
  guard.attack = 50;
  guard.x = 10;
  guard.y = 10;
  guard.guardMode = 'charge';
  guard.guardLine = 'front';
  for (let i = 0; i < 60; i++) state = tick(state);

  assert(state.renown >= startRenown + LIBERATION_RENOWN_REWARD,
    `Renown granted (${state.renown} >= ${startRenown + LIBERATION_RENOWN_REWARD})`);
}

console.log('\n=== Liberation: cannot liberate already liberated village ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  village.trust = 1200;
  village.trustRank = 'leader';
  village.liberated = true;

  const result = liberateVillage(state, 'v1');
  assert(result.enemies.length === 0, 'No brigands spawned for already liberated village');
}

console.log('\n=== Liberation: cannot liberate village already in progress ===');
{
  let state = createWorld(20, 20, 2);
  state = addVillage(state, 'v1', 10, 10);
  const village = state.npcSettlements.find(v => v.id === 'v1')!;
  village.trust = 1200;
  village.trustRank = 'protector';
  village.liberationInProgress = true;

  const enemiesBefore = state.enemies.length;
  const result = liberateVillage(state, 'v1');
  assert(result.enemies.length === enemiesBefore, 'No extra brigands spawned for in-progress liberation');
}

console.log('\n=== Liberation: invalid village ID ===');
{
  let state = createWorld(20, 20, 2);
  const result = liberateVillage(state, 'nonexistent');
  assert(result === state || result.enemies.length === 0, 'Graceful failure for invalid village');
}

// ========================
// SUMMARY
// ========================

console.log(`\n========================================`);
console.log(`V2 Village Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
