// world/combat.ts — Enemy, animal, raid, and combat constants

import type {
  EnemyType, Enemy, AnimalType, AnimalTemplate,
  ResourceType, ToolTier, LootDrop, TrustRank,
} from './types.js';

export const ENEMY_TEMPLATES: Record<EnemyType, Omit<Enemy, 'hp'> & { maxHp: number; range?: number }> = {
  bandit: { type: 'bandit', maxHp: 10, attack: 3, defense: 1 },
  bandit_archer: { type: 'bandit_archer', maxHp: 7, attack: 2, defense: 0, range: 3 },
  bandit_brute: { type: 'bandit_brute', maxHp: 18, attack: 5, defense: 3 },
  bandit_warlord: { type: 'bandit_warlord', maxHp: 30, attack: 7, defense: 5 },
  wolf: { type: 'wolf', maxHp: 6, attack: 4, defense: 0 },
  boar: { type: 'boar', maxHp: 15, attack: 2, defense: 2 },
  elite_beast: { type: 'elite_beast', maxHp: 25, attack: 5, defense: 2 },
};

export const ENEMY_LOOT: Record<EnemyType, LootDrop[]> = {
  bandit: [{ resource: 'gold', amount: 1 }],
  bandit_archer: [{ resource: 'gold', amount: 1 }],
  bandit_brute: [{ resource: 'gold', amount: 3 }],
  bandit_warlord: [{ resource: 'gold', amount: 10 }, { resource: 'sword', amount: 1 }],
  wolf: [{ resource: 'leather', amount: 1 }],
  boar: [{ resource: 'food', amount: 2 }],
  elite_beast: [{ resource: 'leather', amount: 3 }, { resource: 'food', amount: 5 }],
};

export const ANIMAL_TEMPLATES: Record<AnimalType, AnimalTemplate> = {
  deer: { type: 'deer', maxHp: 8, attack: 0, behavior: 'passive', drops: { food: 3, leather: 1 } },
  rabbit: { type: 'rabbit', maxHp: 3, attack: 0, behavior: 'passive', drops: { food: 1 } },
  wild_wolf: { type: 'wild_wolf', maxHp: 8, attack: 4, behavior: 'hostile', drops: { food: 1 } },
  wild_boar: { type: 'wild_boar', maxHp: 12, attack: 3, behavior: 'hostile', drops: { food: 4, leather: 2 } },
};

// --- Guard / Militia Combat Stats ---
export const GUARD_COMBAT: Record<ToolTier, { attack: number; defense: number }> = {
  none: { attack: 3, defense: 2 },
  basic: { attack: 4, defense: 3 },
  sturdy: { attack: 5, defense: 4 },
  iron: { attack: 7, defense: 5 },
};

export const MILITIA_COMBAT = { attack: 2, defense: 0 };

// --- Bandit Camp Constants ---
export const CAMP_BASE_HP = 30;
export const CAMP_HP_PER_LEVEL = 10;
export const CAMP_RAID_INTERVAL = 25;
export const CAMP_SPAWN_DAY = 25;
export const CAMP_SPAWN_INTERVAL = 30;
export const CAMP_MAX_COUNT = 3;
export const CAMP_CLEAR_GOLD = 30;
export const CAMP_CLEAR_RENOWN = 10;

// --- Raid Composition Thresholds ---
export const ARCHER_RAID_THRESHOLD = 3;
export const BRUTE_RAID_THRESHOLD = 5;
export const WARLORD_RAID_THRESHOLD = 8;
export const WOLF_SPAWN_THRESHOLD = 3;
export const RAM_SPAWN_THRESHOLD = 3;
export const MAX_RAMS = 2;
export const SIEGE_TOWER_THRESHOLD = 5;
export const WOLF_STRENGTH_OFFSET = 2;

// --- Raid Variety ---
export const MULTI_WAVE_MIN_STRENGTH = 6;
export const MULTI_WAVE_DELAY_DAYS = 1;
export const RECLAMATION_DELAY_DAYS = 3;
export const NIGHT_RAID_CHANCE = 0.3;

// --- Night Danger ---
export const NIGHT_DANGER_ATK_BONUS = 2;
export const NIGHT_DANGER_SPAWN_MULT = 1.5;

// --- Trust System ---
export const TRUST_THRESHOLDS: { rank: TrustRank; trust: number }[] = [
  { rank: 'stranger', trust: 0 },
  { rank: 'associate', trust: 100 },
  { rank: 'friend', trust: 500 },
  { rank: 'protector', trust: 1200 },
];
export const TRUST_KILL_BANDIT = 15;
export const TRUST_KILL_WILDLIFE = 5;
export const TRUST_VILLAGE_RADIUS = 10;
export const LIBERATION_BRIGAND_COUNT = 4;
export const LIBERATION_RENOWN_REWARD = 30;
