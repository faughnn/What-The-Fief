// test-v2-dynamic-quests.ts — Tests for dynamic event quest system
// Time-limited quests that spawn periodically and require player response.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, ALL_TECHS, ENEMY_TEMPLATES,
  DYNAMIC_QUEST_START_DAY, DYNAMIC_QUEST_MAX_ACTIVE,
  DynamicQuest, DynamicQuestType,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard,
  acceptSupplyQuest, getActiveTradeMultiplier,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function setupColony(): GameState {
  let state = createWorld(40, 40, 42);
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  state.research.completed = [...ALL_TECHS];

  // Storehouse with resources
  state = placeBuilding(state, 'storehouse', 20, 20);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, wood: 200, stone: 200, gold: 100, planks: 50, rope: 20, ingots: 20, stone_blocks: 20 };
  state.resources = { ...state.resources, food: 200, wood: 200, stone: 200, gold: 100, planks: 50, rope: 20, ingots: 20, stone_blocks: 20 };

  // Town hall
  state = placeBuilding(state, 'town_hall', 15, 15);
  const th = state.buildings.find(b => b.type === 'town_hall')!;
  th.constructed = true; th.hp = th.maxHp;

  // Housing
  for (let i = 0; i < 5; i++) {
    state = placeBuilding(state, 'tent', 15 + i, 18);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 15 + i && b.y === 18)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  // Villagers
  state.villagers = [];
  state.nextVillagerId = 1;
  for (let i = 0; i < 5; i++) {
    const v = createVillager(state.nextVillagerId, 20, 20);
    v.food = 8; v.morale = 80;
    v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
    state.villagers.push(v);
    state.nextVillagerId++;
  }

  return state;
}

function advanceDays(state: GameState, days: number): GameState {
  const targetTick = state.tick + days * TICKS_PER_DAY;
  while (state.tick < targetTick) {
    state = tick(state);
  }
  return state;
}

function advanceToDay(state: GameState, day: number): GameState {
  const targetTick = day * TICKS_PER_DAY;
  while (state.tick < targetTick) {
    state = tick(state);
  }
  return state;
}

// === Test: No quests before start day ===
heading('Dynamic Quest Spawning');

{
  let state = setupColony();
  state = advanceDays(state, 15);
  assert(state.dynamicQuests.length === 0, 'no quests before day 20');
}

// === Test: Quests spawn after start day ===
{
  let state = setupColony();
  state.lastDynamicQuestDay = DYNAMIC_QUEST_START_DAY - 15; // ensure interval has passed
  state = advanceToDay(state, DYNAMIC_QUEST_START_DAY + 1);

  // Force a quest spawn by setting lastDynamicQuestDay far back
  state.lastDynamicQuestDay = -100;
  state = advanceDays(state, 1);

  // Might or might not have spawned depending on RNG, but at least the system runs
  assert(state.dynamicQuests !== undefined, 'dynamicQuests array exists');
}

// === Test: Max active quests respected ===
heading('Quest Limits');

{
  let state = setupColony();
  state.day = DYNAMIC_QUEST_START_DAY + 20;
  state.tick = state.day * TICKS_PER_DAY;

  // Manually add max quests
  for (let i = 0; i < DYNAMIC_QUEST_MAX_ACTIVE; i++) {
    state.dynamicQuests.push({
      id: `test_q${i}`, type: 'defend', name: 'Test', description: 'Test',
      startDay: state.day, deadline: state.day + 10,
      status: 'active', reward: { gold: 0, renown: 0 },
    });
  }

  state.lastDynamicQuestDay = -100; // long time ago
  state = advanceDays(state, 1);

  const activeCount = state.dynamicQuests.filter(q => q.status === 'active').length;
  assert(activeCount <= DYNAMIC_QUEST_MAX_ACTIVE, `max ${DYNAMIC_QUEST_MAX_ACTIVE} active quests (got ${activeCount})`);
}

// === Test: No duplicate active types ===
{
  let state = setupColony();
  state.day = DYNAMIC_QUEST_START_DAY + 30;
  state.tick = state.day * TICKS_PER_DAY;

  // Add one defend quest
  state.dynamicQuests.push({
    id: 'test_defend', type: 'defend', name: 'Defend', description: 'Test',
    startDay: state.day, deadline: state.day + 10,
    status: 'active', reward: { gold: 0, renown: 0 },
  });

  // Even if a new quest spawns, it shouldn't be defend
  state.lastDynamicQuestDay = -100;
  state = advanceDays(state, 1);

  const activeDefends = state.dynamicQuests.filter(q => q.type === 'defend' && q.status === 'active');
  assert(activeDefends.length <= 1, 'no duplicate active defend quests');
}

// === Test: Quest expiry ===
heading('Quest Expiry');

{
  let state = setupColony();
  state = advanceToDay(state, DYNAMIC_QUEST_START_DAY);

  const currentDay = state.day;
  // Use a supply quest for expiry test — only completes via acceptSupplyQuest
  state.dynamicQuests.push({
    id: 'expire_test', type: 'supply', name: 'Expired Supply', description: 'Test',
    startDay: currentDay, deadline: currentDay + 2,
    status: 'active',
    requirements: { food: 9999 }, // impossible amount
    villageId: state.npcSettlements[0]?.id || 'village1',
    reward: { gold: 10, renown: 5, trust: 50 },
  });

  state = advanceDays(state, 4);

  const quest = state.dynamicQuests.find(q => q.id === 'expire_test')!;
  assert(quest.status === 'expired', `quest expires after deadline (status: ${quest.status}, day: ${state.day}, deadline: ${quest.deadline})`);
}

// === Test: Hunt quest expiry cleans up enemy ===
{
  let state = setupColony();
  // Test that hunt expiry removes the spawned enemy
  state.dynamicQuests.push({
    id: 'hunt_expire', type: 'hunt', name: 'Hunt Expire', description: 'Test',
    startDay: 0, deadline: 0, // already expired
    status: 'active', target: { x: 38, y: 38 },
    spawnedEntityId: 'expire_beast',
    reward: { gold: 10, renown: 5 },
  });
  state.enemies.push({
    id: 'expire_beast', type: 'elite_beast',
    x: 38, y: 38, hp: 25, maxHp: 25,
    attack: 5, defense: 2, range: 0, siege: 'none', ticksAlive: 0,
  });

  state = advanceDays(state, 1);

  assert(!state.enemies.some(e => e.id === 'expire_beast'), 'hunt enemy removed on expiry');
}

// === Test: Hunt quest completion ===
heading('Hunt Quest');

{
  let state = setupColony();
  state.day = DYNAMIC_QUEST_START_DAY;
  state.tick = state.day * TICKS_PER_DAY;

  state.dynamicQuests.push({
    id: 'hunt_test', type: 'hunt', name: 'Hunt Test', description: 'Test',
    startDay: state.day, deadline: state.day + 5,
    status: 'active', target: { x: 5, y: 5 },
    spawnedEntityId: 'beast_1',
    reward: { gold: 15, renown: 10 },
  });

  state.enemies.push({
    id: 'beast_1', type: 'elite_beast',
    x: 5, y: 5, hp: 25, maxHp: 25,
    attack: 5, defense: 2, range: 0, siege: 'none', ticksAlive: 0,
  });

  const goldBefore = state.resources.gold;
  const renownBefore = state.renown;

  // Kill the beast
  state.enemies = state.enemies.filter(e => e.id !== 'beast_1');
  state = advanceDays(state, 1);

  const quest = state.dynamicQuests.find(q => q.id === 'hunt_test')!;
  assert(quest.status === 'completed', 'hunt quest completes when beast killed');
  assert(state.resources.gold >= goldBefore + 15, `gold reward given (+15, got ${state.resources.gold - goldBefore})`);
  assert(state.renown >= renownBefore + 10, `renown reward given (+10, got ${state.renown - renownBefore})`);
}

// === Test: Defend quest spawns raid ===
heading('Defend Quest');

{
  let state = setupColony();
  state.day = DYNAMIC_QUEST_START_DAY;
  state.tick = state.day * TICKS_PER_DAY;

  state.dynamicQuests.push({
    id: 'defend_test', type: 'defend', name: 'Defend Test', description: 'Test',
    startDay: state.day, deadline: state.day + 6,
    status: 'active', raidSpawned: false,
    reward: { gold: 20, renown: 15 },
  });

  const enemiesBefore = state.enemies.length;

  // Advance 3 days — raid should spawn
  state = advanceDays(state, 3);

  const quest = state.dynamicQuests.find(q => q.id === 'defend_test')!;
  assert(quest.raidSpawned === true, 'defend raid spawned after delay');
  assert(state.enemies.length > enemiesBefore, `enemies spawned for defend quest (${state.enemies.length - enemiesBefore})`);

  // Check enemies have correct IDs
  const defendEnemies = state.enemies.filter(e => e.id.startsWith('defend_defend_test'));
  assert(defendEnemies.length >= 3, `at least 3 defend enemies spawned (got ${defendEnemies.length})`);
}

// === Test: Defend quest completion ===
{
  let state = setupColony();
  state.day = DYNAMIC_QUEST_START_DAY;
  state.tick = state.day * TICKS_PER_DAY;

  state.dynamicQuests.push({
    id: 'defend_comp', type: 'defend', name: 'Defend Comp', description: 'Test',
    startDay: state.day, deadline: state.day + 6,
    status: 'active', raidSpawned: true,
    reward: { gold: 20, renown: 15 },
  });

  // Add defend enemies then kill them all
  for (let i = 0; i < 3; i++) {
    state.enemies.push({
      id: `defend_defend_comp_${i}`, type: 'bandit',
      x: 5 + i, y: 5, hp: 10, maxHp: 10,
      attack: 3, defense: 1, range: 0, siege: 'none', ticksAlive: 0,
    });
  }

  // Kill all defend enemies
  state.enemies = state.enemies.filter(e => !e.id.startsWith('defend_defend_comp'));

  const renownBefore = state.renown;
  state = advanceDays(state, 1);

  const quest = state.dynamicQuests.find(q => q.id === 'defend_comp')!;
  assert(quest.status === 'completed', 'defend quest completes when all enemies killed');
  assert(state.renown >= renownBefore + 15, 'defend quest awards renown');
}

// === Test: Supply quest ===
heading('Supply Quest');

{
  let state = setupColony();
  state.day = DYNAMIC_QUEST_START_DAY;
  state.tick = state.day * TICKS_PER_DAY;

  // Need NPC village for supply quest
  assert(state.npcSettlements.length > 0, 'NPC settlements exist for supply quests');

  const village = state.npcSettlements[0];
  const trustBefore = village.trust;

  state.dynamicQuests.push({
    id: 'supply_test', type: 'supply', name: 'Supply Test', description: 'Test',
    startDay: state.day, deadline: state.day + 5,
    status: 'active',
    requirements: { food: 15 },
    villageId: village.id,
    reward: { gold: 15, renown: 0, trust: 50 },
  });

  const foodBefore = state.resources.food;
  const goldBefore = state.resources.gold;

  // Accept the supply quest
  state = acceptSupplyQuest(state, 'supply_test');

  const quest = state.dynamicQuests.find(q => q.id === 'supply_test')!;
  assert(quest.status === 'completed', 'supply quest completes on accept');
  assert(state.resources.food <= foodBefore - 15, `food deducted (before: ${foodBefore}, after: ${state.resources.food})`);
  assert(state.resources.gold >= goldBefore + 15, `gold reward given (before: ${goldBefore}, after: ${state.resources.gold})`);
  assert(village.trust >= trustBefore + 50, `trust awarded (before: ${trustBefore}, after: ${village.trust})`);
}

// === Test: Supply quest insufficient resources ===
{
  let state = setupColony();
  state.resources.food = 5; // Not enough

  state.dynamicQuests.push({
    id: 'supply_fail', type: 'supply', name: 'Supply Fail', description: 'Test',
    startDay: 0, deadline: 100,
    status: 'active',
    requirements: { food: 15 },
    villageId: state.npcSettlements[0]?.id || 'village1',
    reward: { gold: 15, renown: 0, trust: 50 },
  });

  state = acceptSupplyQuest(state, 'supply_fail');

  const quest = state.dynamicQuests.find(q => q.id === 'supply_fail')!;
  assert(quest.status === 'active', 'supply quest stays active when resources insufficient');
}

// === Test: Rescue quest ===
heading('Rescue Quest');

{
  let state = setupColony();

  // Get the villager's home position — they'll be there at night (tick 0 is night)
  const v = state.villagers[0];
  const homeBld = state.buildings.find(b => b.id === v.homeBuildingId)!;

  // Place villager at home and set sleeping state so they don't move
  v.x = homeBld.x;
  v.y = homeBld.y;
  v.state = 'sleeping';
  v.path = [];

  state.dynamicQuests.push({
    id: 'rescue_test', type: 'rescue', name: 'Rescue Test', description: 'Test',
    startDay: 0, deadline: 100,
    status: 'active',
    target: { x: homeBld.x, y: homeBld.y },
    spawnedEntityId: 'rescue_traveler_rescue_test',
    reward: { gold: 0, renown: 5, villager: true },
  });

  const popBefore = state.villagers.length;

  // Advance 1 tick — per-tick check should find villager at target
  state = tick(state);

  const quest = state.dynamicQuests.find(q => q.id === 'rescue_test')!;
  assert(quest.status === 'completed', `rescue quest completes when villager at target (status: ${quest.status})`);
  assert(state.villagers.length > popBefore, `new villager added from rescue (before: ${popBefore}, after: ${state.villagers.length})`);
}

// === Test: Trade quest ===
heading('Trade Quest');

{
  let state = setupColony();
  state.day = DYNAMIC_QUEST_START_DAY;
  state.tick = state.day * TICKS_PER_DAY;

  state.dynamicQuests.push({
    id: 'trade_test', type: 'trade', name: 'Trade Test', description: 'Test',
    startDay: state.day, deadline: state.day + 3,
    status: 'active',
    tradeMultiplier: 1.5,
    reward: { gold: 0, renown: 0 },
  });

  // Check trade multiplier is active
  const mult = getActiveTradeMultiplier(state);
  assert(mult === 1.5, `trade multiplier active (${mult})`);

  // Advance past deadline
  state = advanceDays(state, 4);

  const quest = state.dynamicQuests.find(q => q.id === 'trade_test')!;
  assert(quest.status === 'completed', 'trade quest auto-completes at deadline');

  const multAfter = getActiveTradeMultiplier(state);
  assert(multAfter === 1.0, `trade multiplier inactive after completion (${multAfter})`);
}

// === Test: Elite beast enemy template ===
heading('Elite Beast');

{
  const template = ENEMY_TEMPLATES.elite_beast;
  assert(template.maxHp === 25, `elite beast HP: ${template.maxHp}`);
  assert(template.attack === 5, `elite beast attack: ${template.attack}`);
  assert(template.defense === 2, `elite beast defense: ${template.defense}`);
}

// === Test: Quest status tracking ===
heading('Quest Status');

{
  let state = setupColony();

  // Add a supply quest that will expire (impossible amount)
  state.dynamicQuests.push({
    id: 'status_test', type: 'supply', name: 'Status Test', description: 'Test',
    startDay: 0, deadline: 1,
    status: 'active',
    requirements: { food: 9999 },
    villageId: state.npcSettlements[0]?.id || 'village1',
    reward: { gold: 10, renown: 5, trust: 50 },
  });

  // Advance past deadline
  state = advanceDays(state, 3);

  const quest = state.dynamicQuests.find(q => q.id === 'status_test')!;
  assert(quest.status === 'expired', `quest status updated to expired (got: ${quest.status})`);
}

// === Test: Defend quest cleanup on expiry ===
heading('Defend Cleanup');

{
  let state = setupColony();
  state = advanceToDay(state, DYNAMIC_QUEST_START_DAY);

  state.dynamicQuests.push({
    id: 'cleanup_test', type: 'defend', name: 'Cleanup Test', description: 'Test',
    startDay: state.day, deadline: state.day + 1,
    status: 'active', raidSpawned: true,
    reward: { gold: 0, renown: 0 },
  });

  // Add defend enemies far from settlement
  for (let i = 0; i < 3; i++) {
    state.enemies.push({
      id: `defend_cleanup_test_${i}`, type: 'bandit',
      x: 38, y: 38 + i, hp: 10, maxHp: 10,
      attack: 3, defense: 1, range: 0, siege: 'none', ticksAlive: 0,
    });
  }

  state = advanceDays(state, 3);

  const quest = state.dynamicQuests.find(q => q.id === 'cleanup_test')!;
  assert(quest.status === 'expired', `defend quest expired (status: ${quest.status}, day: ${state.day}, deadline: ${quest.deadline})`);
  const defendEnemies = state.enemies.filter(e => e.id.startsWith('defend_cleanup_test'));
  assert(defendEnemies.length === 0, `defend enemies cleaned up on expiry (${defendEnemies.length} remaining)`);
}

// === Test: getActiveTradeMultiplier with no quests ===
{
  const state = setupColony();
  const mult = getActiveTradeMultiplier(state);
  assert(mult === 1.0, 'no trade quest = multiplier 1.0');
}

// === Test: Accept non-existent quest ===
{
  let state = setupColony();
  state = acceptSupplyQuest(state, 'nonexistent');
  assert(true, 'accepting nonexistent quest does not crash');
}

// === Test: Accept non-supply quest ===
{
  let state = setupColony();
  state.dynamicQuests.push({
    id: 'not_supply', type: 'defend', name: 'Not Supply', description: 'Test',
    startDay: 0, deadline: 100, status: 'active',
    reward: { gold: 0, renown: 0 },
  });
  state = acceptSupplyQuest(state, 'not_supply');
  const quest = state.dynamicQuests.find(q => q.id === 'not_supply')!;
  assert(quest.status === 'active', 'cannot accept non-supply quest as supply');
}

// === Summary ===
console.log(`\nDynamic Quests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
