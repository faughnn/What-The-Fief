// dynamic-quests.ts — Dynamic event quest system
// Time-limited quests that spawn periodically and require player response.

import {
  GameState, DynamicQuest, DynamicQuestType,
  DYNAMIC_QUEST_START_DAY, DYNAMIC_QUEST_MIN_INTERVAL, DYNAMIC_QUEST_MAX_INTERVAL,
  DYNAMIC_QUEST_MAX_ACTIVE, DYNAMIC_QUEST_WEIGHTS,
  EnemyEntity, ENEMY_TEMPLATES, ResourceType,
  createVillager, TICKS_PER_DAY,
} from '../world.js';
import { TickState, isStorehouse, addToBuffer, addResource, getBuildingEntrance, findHome } from './helpers.js';

// --- Constants ---
const DEFEND_RAID_DELAY = 3;     // days after quest appears before raid spawns
const DEFEND_DEADLINE = 6;       // days to complete after quest start (3 prep + 3 fight)
const DEFEND_RAID_SIZE = 5;      // enemies in defend quest raid
const DEFEND_GOLD = 20;
const DEFEND_RENOWN = 15;

const SUPPLY_DEADLINE = 5;
const SUPPLY_GOLD = 15;
const SUPPLY_TRUST = 50;

const HUNT_DEADLINE = 5;
const HUNT_GOLD = 15;
const HUNT_RENOWN = 10;

const RESCUE_DEADLINE = 7;

const TRADE_DEADLINE = 3;
const TRADE_MULTIPLIER = 1.5;   // 50% better prices

// --- Spawn Logic ---

function questRng(day: number, salt: number): number {
  return ((day * 2654435761 + salt * 374761393 + 1442695) & 0x7fffffff) / 0x7fffffff;
}

function pickQuestType(day: number, activeTypes: Set<DynamicQuestType>): DynamicQuestType | null {
  const available = DYNAMIC_QUEST_WEIGHTS.filter(w => !activeTypes.has(w.type));
  if (available.length === 0) return null;
  const totalWeight = available.reduce((s, w) => s + w.weight, 0);
  let roll = questRng(day, 999) * totalWeight;
  for (const w of available) {
    roll -= w.weight;
    if (roll <= 0) return w.type;
  }
  return available[available.length - 1].type;
}

function findEdgePosition(state: GameState, day: number): { x: number; y: number } {
  const side = day % 4;
  const rng = questRng(day, 777);
  let x: number, y: number;
  if (side === 0) { x = Math.floor(rng * state.width); y = 0; }
  else if (side === 1) { x = state.width - 1; y = Math.floor(rng * state.height); }
  else if (side === 2) { x = Math.floor(rng * state.width); y = state.height - 1; }
  else { x = 0; y = Math.floor(rng * state.height); }
  // Ensure passable
  if (state.grid[y][x].terrain === 'water') {
    x = Math.min(state.width - 1, x + 1);
    if (state.grid[y][x].terrain === 'water') x = Math.max(0, x - 2);
  }
  return { x, y };
}

function createDefendQuest(state: GameState, id: string, day: number): DynamicQuest | null {
  // Only spawn defend quests if the colony has guards
  const hasGuards = state.villagers.some(v => v.role === 'guard' && v.hp > 0);
  if (!hasGuards) return null;
  return {
    id, type: 'defend',
    name: 'Defend the Settlement',
    description: `A large raiding party will attack in ${DEFEND_RAID_DELAY} days. Prepare your defenses!`,
    startDay: day, deadline: day + DEFEND_DEADLINE,
    status: 'active', raidSpawned: false,
    reward: { gold: DEFEND_GOLD, renown: DEFEND_RENOWN },
  };
}

function createSupplyQuest(state: GameState, id: string, day: number): DynamicQuest | null {
  const villages = state.npcSettlements.filter(s => !s.liberated);
  if (villages.length === 0) return null;
  const village = villages[day % villages.length];
  const possibleResources: ResourceType[] = ['food', 'wood', 'stone'];
  const resource = possibleResources[day % possibleResources.length];
  const amount = 15 + (day % 10);
  return {
    id, type: 'supply',
    name: `Supply ${village.name}`,
    description: `${village.name} needs ${amount} ${resource} within ${SUPPLY_DEADLINE} days.`,
    startDay: day, deadline: day + SUPPLY_DEADLINE,
    status: 'active',
    requirements: { [resource]: amount } as Partial<Record<ResourceType, number>>,
    villageId: village.id,
    reward: { gold: SUPPLY_GOLD, renown: 0, trust: SUPPLY_TRUST },
  };
}

function createHuntQuest(state: GameState, id: string, day: number): DynamicQuest {
  const pos = findEdgePosition(state, day);
  // Spawn elite beast
  const template = ENEMY_TEMPLATES.elite_beast;
  const enemy: EnemyEntity = {
    id: `hunt_beast_${id}`,
    type: 'elite_beast',
    x: pos.x, y: pos.y,
    hp: template.maxHp, maxHp: template.maxHp,
    attack: template.attack, defense: template.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  };
  state.enemies.push(enemy);
  return {
    id, type: 'hunt',
    name: 'Hunt the Beast',
    description: `A dangerous beast has been spotted at (${pos.x}, ${pos.y}). Kill it for a reward!`,
    startDay: day, deadline: day + HUNT_DEADLINE,
    status: 'active',
    target: pos,
    spawnedEntityId: enemy.id,
    reward: { gold: HUNT_GOLD, renown: HUNT_RENOWN },
  };
}

function createRescueQuest(state: GameState, id: string, day: number): DynamicQuest {
  const pos = findEdgePosition(state, day);
  // Create a traveler villager at the position (not part of colony yet)
  const travelerId = `rescue_traveler_${id}`;
  return {
    id, type: 'rescue',
    name: 'Rescue the Traveler',
    description: `A lost traveler is stranded at (${pos.x}, ${pos.y}). Send someone to bring them home.`,
    startDay: day, deadline: day + RESCUE_DEADLINE,
    status: 'active',
    target: pos,
    spawnedEntityId: travelerId,
    reward: { gold: 0, renown: 5, villager: true },
  };
}

function createTradeQuest(state: GameState, id: string, day: number): DynamicQuest {
  return {
    id, type: 'trade',
    name: 'Trade Opportunity',
    description: `A merchant offers exceptional prices for ${TRADE_DEADLINE} days!`,
    startDay: day, deadline: day + TRADE_DEADLINE,
    status: 'active',
    tradeMultiplier: TRADE_MULTIPLIER,
    reward: { gold: 0, renown: 0 },
  };
}

// --- Main Processing ---

export function processDynamicQuests(ts: TickState): void {
  // Initialize if missing (backward compat)
  if (!ts.dynamicQuests) {
    ts.dynamicQuests = [];
    ts.lastDynamicQuestDay = -100;
    ts.nextDynamicQuestId = 1;
  }

  if (ts.dynamicQuests.length === 0 && !ts.isNewDay) return;

  const day = ts.newDay;

  // Per-tick: check completion for physical quests (hunt, rescue, defend)
  checkQuestCompletion(ts, day);

  // Daily-only checks
  if (ts.isNewDay) {
    // Check expiry
    checkQuestExpiry(ts, day);

    // Defend quest: spawn raid when delay elapses
    spawnDefendRaid(ts, day);

    // Spawn new quests
    spawnNewQuest(ts, day);
  }
}

function checkQuestCompletion(ts: TickState, day: number): void {
  for (const quest of ts.dynamicQuests) {
    if (quest.status !== 'active') continue;

    if (quest.type === 'defend' && quest.raidSpawned) {
      // Complete when all defend-raid enemies are dead
      const hasDefendEnemies = ts.enemies.some(e => e.id.startsWith(`defend_${quest.id}`));
      if (!hasDefendEnemies) {
        completeQuest(ts, quest);
      }
    }

    if (quest.type === 'hunt' && quest.spawnedEntityId) {
      const beastAlive = ts.enemies.some(e => e.id === quest.spawnedEntityId);
      if (!beastAlive) {
        completeQuest(ts, quest);
      }
    }

    if (quest.type === 'rescue' && quest.target) {
      // Check if any villager is at or adjacent to the rescue target
      const tx = quest.target.x, ty = quest.target.y;
      const rescuer = ts.villagers.find(v =>
        Math.abs(v.x - tx) <= 1 && Math.abs(v.y - ty) <= 1
      );
      if (rescuer) {
        completeQuest(ts, quest);
        // Spawn rescued villager at storehouse
        const home = findHome(ts.buildings, ts.villagers);
        if (home) {
          const homeB = ts.buildings.find(b => b.id === home)!;
          const entrance = getBuildingEntrance(homeB);
          const newV = createVillager(ts.nextVillagerId, entrance.x, entrance.y);
          newV.homeBuildingId = home;
          newV.state = 'sleeping';
          ts.villagers.push(newV);
          ts.nextVillagerId++;
          ts.events.push(`Rescued traveler ${newV.name} has joined the colony!`);
        }
      }
    }

    // Trade quests auto-complete at deadline (benefit is during the window) — daily only
    if (quest.type === 'trade' && ts.isNewDay && day >= quest.deadline) {
      quest.status = 'completed';
      ts.events.push(`Trade opportunity has ended.`);
    }
  }
}

function checkQuestExpiry(ts: TickState, day: number): void {
  for (const quest of ts.dynamicQuests) {
    if (quest.status !== 'active') continue;
    if (day > quest.deadline) {
      quest.status = 'expired';
      ts.events.push(`Quest "${quest.name}" has expired.`);
      // Clean up spawned entities
      if (quest.type === 'hunt' && quest.spawnedEntityId) {
        ts.enemies = ts.enemies.filter(e => e.id !== quest.spawnedEntityId);
      }
      if (quest.type === 'defend' && quest.raidSpawned) {
        ts.enemies = ts.enemies.filter(e => !e.id.startsWith(`defend_${quest.id}`));
      }
    }
  }
}

function spawnDefendRaid(ts: TickState, day: number): void {
  for (const quest of ts.dynamicQuests) {
    if (quest.type !== 'defend' || quest.status !== 'active' || quest.raidSpawned) continue;
    if (day >= quest.startDay + DEFEND_RAID_DELAY) {
      quest.raidSpawned = true;
      const pos = findEdgePosition(ts, day);
      const template = ENEMY_TEMPLATES.bandit;
      // Scale raid size: 3 base + 1 per guard (max DEFEND_RAID_SIZE)
      const guardCount = ts.villagers.filter(v => v.role === 'guard' && v.hp > 0).length;
      const raidSize = Math.min(DEFEND_RAID_SIZE, 3 + guardCount);
      for (let i = 0; i < raidSize; i++) {
        const enemy: EnemyEntity = {
          id: `defend_${quest.id}_${i}`,
          type: 'bandit',
          x: pos.x + (i % 3), y: pos.y,
          hp: template.maxHp, maxHp: template.maxHp,
          attack: template.attack, defense: template.defense,
          range: 0, siege: 'none', ticksAlive: 0,
        };
        // Clamp to map bounds
        enemy.x = Math.min(ts.width - 1, Math.max(0, enemy.x));
        enemy.y = Math.min(ts.height - 1, Math.max(0, enemy.y));
        ts.enemies.push(enemy);
      }
      ts.events.push(`The raiding party from quest "${quest.name}" has arrived!`);
    }
  }
}

function spawnNewQuest(ts: TickState, day: number): void {
  if (day < DYNAMIC_QUEST_START_DAY) return;

  const activeQuests = ts.dynamicQuests.filter(q => q.status === 'active');
  if (activeQuests.length >= DYNAMIC_QUEST_MAX_ACTIVE) return;

  const daysSinceLast = day - ts.lastDynamicQuestDay;
  // Deterministic interval: min + (day-based hash) % (max - min + 1)
  const interval = DYNAMIC_QUEST_MIN_INTERVAL + (Math.floor(questRng(ts.lastDynamicQuestDay, 123) * (DYNAMIC_QUEST_MAX_INTERVAL - DYNAMIC_QUEST_MIN_INTERVAL + 1)));
  if (daysSinceLast < interval) return;

  const activeTypes = new Set(activeQuests.map(q => q.type));
  const type = pickQuestType(day, activeTypes);
  if (!type) return;

  const id = `dq_${ts.nextDynamicQuestId}`;
  ts.nextDynamicQuestId++;

  let quest: DynamicQuest | null = null;
  switch (type) {
    case 'defend': quest = createDefendQuest(ts, id, day); break;
    case 'supply': quest = createSupplyQuest(ts, id, day); break;
    case 'hunt': quest = createHuntQuest(ts, id, day); break;
    case 'rescue': quest = createRescueQuest(ts, id, day); break;
    case 'trade': quest = createTradeQuest(ts, id, day); break;
  }

  if (quest) {
    ts.dynamicQuests.push(quest);
    ts.lastDynamicQuestDay = day;
    ts.events.push(`New quest: "${quest.name}" — ${quest.description}`);
  }
}

function completeQuest(ts: TickState, quest: DynamicQuest): void {
  quest.status = 'completed';
  ts.events.push(`Quest "${quest.name}" completed!`);

  // Award rewards
  if (quest.reward.gold > 0) {
    const sh = ts.buildings.find(b => isStorehouse(b.type) && b.constructed);
    if (sh) addToBuffer(sh.localBuffer, 'gold', quest.reward.gold, sh.bufferCapacity);
    addResource(ts.resources, 'gold', quest.reward.gold, ts.storageCap);
  }
  if (quest.reward.renown > 0) {
    ts.renown += quest.reward.renown;
  }
  if (quest.reward.trust && quest.villageId) {
    const village = ts.npcSettlements.find(s => s.id === quest.villageId);
    if (village) {
      village.trust += quest.reward.trust;
    }
  }
}

// --- Command: Accept Supply Quest ---
export function acceptSupplyQuest(state: GameState, questId: string): GameState {
  const quest = state.dynamicQuests.find(q => q.id === questId);
  if (!quest) { console.log(`ERROR: Quest ${questId} not found`); return state; }
  if (quest.type !== 'supply') { console.log(`ERROR: Quest ${questId} is not a supply quest`); return state; }
  if (quest.status !== 'active') { console.log(`ERROR: Quest ${questId} is not active`); return state; }
  if (!quest.requirements) { console.log(`ERROR: Quest ${questId} has no requirements`); return state; }

  // Check if player has enough resources in storehouse
  for (const [res, amount] of Object.entries(quest.requirements)) {
    const available = (state.resources as any)[res] || 0;
    if (available < (amount as number)) {
      console.log(`ERROR: Not enough ${res} (need ${amount}, have ${available})`);
      return state;
    }
  }

  // Deduct resources
  const sh = state.buildings.find(b => isStorehouse(b.type) && b.constructed);
  for (const [res, amount] of Object.entries(quest.requirements)) {
    const resType = res as ResourceType;
    const amt = amount as number;
    (state.resources as any)[resType] = Math.max(0, ((state.resources as any)[resType] || 0) - amt);
    if (sh) {
      const current = sh.localBuffer[resType] || 0;
      sh.localBuffer[resType] = Math.max(0, current - amt);
    }
  }

  quest.status = 'completed';
  state.events.push(`Quest "${quest.name}" completed! Supplies delivered to ${quest.villageId}.`);

  // Award rewards
  if (quest.reward.gold > 0) {
    if (sh) addToBuffer(sh.localBuffer, 'gold', quest.reward.gold, sh.bufferCapacity);
    addResource(state.resources, 'gold', quest.reward.gold, state.storageCap);
  }
  if (quest.reward.trust && quest.villageId) {
    const village = state.npcSettlements.find(s => s.id === quest.villageId);
    if (village) village.trust += quest.reward.trust;
  }
  if (quest.reward.renown > 0) {
    state.renown += quest.reward.renown;
  }

  return state;
}

// --- Query: Get active trade multiplier ---
export function getActiveTradeMultiplier(state: GameState): number {
  if (!state.dynamicQuests) return 1.0;
  const activeTradeQuest = state.dynamicQuests.find(
    q => q.type === 'trade' && q.status === 'active'
  );
  return activeTradeQuest?.tradeMultiplier || 1.0;
}
