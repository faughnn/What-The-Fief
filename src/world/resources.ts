// world/resources.ts — Resource data, food, trade, storage constants

import type { ResourceType, Resources } from './types.js';

export function emptyResources(): Resources {
  return {
    wood: 0, stone: 0, food: 0, wheat: 0, fish: 0, iron_ore: 0, herbs: 0, flax: 0, hemp: 0,
    planks: 0, charcoal: 0, ingots: 0, flour: 0, bread: 0, leather: 0, linen: 0, rope: 0,
    basic_tools: 0, sturdy_tools: 0, iron_tools: 0,
    sword: 0, bow: 0,
    furniture: 0, water: 0, meat: 0, fertilizer: 0, dried_food: 0, smoked_food: 0,
    leather_armor: 0, iron_armor: 0,
    bandage: 0,
    gold: 0,
    stone_blocks: 0,
    barley: 0,
    vegetables: 0,
    ale: 0,
  };
}

export const ALL_RESOURCES: ResourceType[] = [
  'wood', 'stone', 'food', 'wheat', 'fish', 'iron_ore', 'herbs', 'flax', 'hemp',
  'planks', 'charcoal', 'ingots', 'flour', 'bread', 'leather', 'linen', 'rope',
  'basic_tools', 'sturdy_tools', 'iron_tools',
  'sword', 'bow',
  'furniture', 'water', 'meat', 'fertilizer', 'dried_food', 'smoked_food',
  'leather_armor', 'iron_armor',
  'bandage',
  'gold',
  'stone_blocks',
];

// --- Spoilage rates (fraction lost per tick) ---
export const SPOILAGE: Partial<Record<ResourceType, number>> = {
  food: 0.02,
  wheat: 0.01,
  flour: 0.01,
  meat: 0.015,
  dried_food: 0.005,
  smoked_food: 0.003,
};

export const SPOILAGE_RATES = SPOILAGE;

// --- Food priority (best first) ---
export const FOOD_PRIORITY: { resource: ResourceType; satisfaction: number }[] = [
  { resource: 'meat', satisfaction: 2.5 },
  { resource: 'smoked_food', satisfaction: 2.2 },
  { resource: 'bread', satisfaction: 2 },
  { resource: 'dried_food', satisfaction: 1.8 },
  { resource: 'fish', satisfaction: 1.5 },
  { resource: 'flour', satisfaction: 1.5 },
  { resource: 'vegetables', satisfaction: 1.3 },
  { resource: 'wheat', satisfaction: 1 },
  { resource: 'food', satisfaction: 1 },
  { resource: 'barley', satisfaction: 0.8 },
];

// --- Storage ---
export const BASE_STORAGE_CAP = 100;
export const STOREHOUSE_BONUS = 50;
export const DEFAULT_BUFFER_CAP = 20;
export const STOREHOUSE_BUFFER_CAP = 2000;
export const OUTPOST_BUFFER_CAP = 100;

// --- Food thresholds ---
export const FOOD_CAP = 10;
export const FOOD_EAT_THRESHOLD = 8;
export const FOOD_HUNGRY = 3;
export const FOOD_CRITICAL = 2;
export const FOOD_STARVATION_LOSS = 0.5;
export const RECENT_MEALS_LIMIT = 5;

// --- Trade ---
export const TRADE_PRICES: Partial<Record<ResourceType, { buy: number; sell: number }>> = {
  food: { buy: 2, sell: 1 },
  wheat: { buy: 3, sell: 1 },
  wood: { buy: 3, sell: 2 },
  stone: { buy: 4, sell: 2 },
  planks: { buy: 6, sell: 3 },
  ingots: { buy: 8, sell: 4 },
  bread: { buy: 5, sell: 3 },
  herbs: { buy: 4, sell: 2 },
  leather: { buy: 5, sell: 3 },
  linen: { buy: 6, sell: 3 },
  rope: { buy: 5, sell: 2 },
  stone_blocks: { buy: 7, sell: 4 },
  barley: { buy: 2, sell: 1 },
  vegetables: { buy: 3, sell: 2 },
  ale: { buy: 6, sell: 4 },
};

export const PRICE_SURPLUS_THRESHOLD = 50;
export const PRICE_SCARCITY_THRESHOLD = 10;
export const PRICE_MAX_MODIFIER = 0.3;

export function getDynamicPrice(resource: ResourceType, resources: Record<string, number>): { buy: number; sell: number } | null {
  const base = TRADE_PRICES[resource];
  if (!base) return null;
  const amount = resources[resource] || 0;
  let modifier = 0;
  if (amount >= PRICE_SURPLUS_THRESHOLD) {
    modifier = -Math.min(PRICE_MAX_MODIFIER, (amount - PRICE_SURPLUS_THRESHOLD) / 100);
  } else if (amount <= PRICE_SCARCITY_THRESHOLD) {
    modifier = Math.min(PRICE_MAX_MODIFIER, (PRICE_SCARCITY_THRESHOLD - amount) / 20);
  }
  return {
    buy: Math.max(1, Math.round(base.buy * (1 + modifier))),
    sell: Math.max(1, Math.round(base.sell * (1 + modifier))),
  };
}
