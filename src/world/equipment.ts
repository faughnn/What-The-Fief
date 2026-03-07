// world/equipment.ts — Tool, weapon, and armor constants

import type { ToolTier, WeaponType, ArmorType, ResourceType } from './types.js';

// --- Tools ---
export const TOOL_MULTIPLIER: Record<ToolTier, number> = {
  none: 1.0, basic: 1.3, sturdy: 1.6, iron: 2.0,
};

export const TOOL_DURABILITY: Record<Exclude<ToolTier, 'none'>, number> = {
  basic: 20, sturdy: 40, iron: 80,
};

export const TOOL_RESOURCE: Record<Exclude<ToolTier, 'none'>, ResourceType> = {
  iron: 'iron_tools', sturdy: 'sturdy_tools', basic: 'basic_tools',
};

export const TOOL_EQUIP_PRIORITY: Exclude<ToolTier, 'none'>[] = ['iron', 'sturdy', 'basic'];

// --- Weapons ---
export const WEAPON_STATS: Record<WeaponType, { attack: number; defense: number; range: number }> = {
  none: { attack: 0, defense: 0, range: 1 },
  sword: { attack: 6, defense: 2, range: 1 },
  bow: { attack: 2, defense: 0, range: 4 },
};

export const WEAPON_DURABILITY: Record<Exclude<WeaponType, 'none'>, number> = {
  sword: 40,
  bow: 30,
};

export const WEAPON_RESOURCE: Record<Exclude<WeaponType, 'none'>, ResourceType> = {
  sword: 'sword',
  bow: 'bow',
};

export const WEAPON_EQUIP_PRIORITY: Exclude<WeaponType, 'none'>[] = ['sword', 'bow'];

// --- Armor ---
export const ARMOR_STATS: Record<ArmorType, { defense: number }> = {
  none: { defense: 0 },
  leather_armor: { defense: 2 },
  iron_armor: { defense: 4 },
};

export const ARMOR_DURABILITY: Record<Exclude<ArmorType, 'none'>, number> = {
  leather_armor: 30,
  iron_armor: 50,
};

export const ARMOR_RESOURCE: Record<Exclude<ArmorType, 'none'>, ResourceType> = {
  leather_armor: 'leather_armor',
  iron_armor: 'iron_armor',
};

export const ARMOR_EQUIP_PRIORITY: Exclude<ArmorType, 'none'>[] = ['iron_armor', 'leather_armor'];
