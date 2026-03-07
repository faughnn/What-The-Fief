// world/research.ts — Tech tree and building tech requirements

import type { TechId, TechDefinition, BuildingType } from './types.js';

export const TECH_TREE: Record<TechId, TechDefinition> = {
  // --- Tier 1: basic (cost 10-15, no prereqs) ---
  crop_rotation:    { id: 'crop_rotation', tier: 1, name: 'Crop Rotation', cost: 10, prerequisites: [], description: 'Farms +1 wheat/worker' },
  masonry:          { id: 'masonry', tier: 1, name: 'Masonry', cost: 10, prerequisites: [], description: 'Quarries +1 stone/worker' },
  herbalism_lore:   { id: 'herbalism_lore', tier: 1, name: 'Herbalism Lore', cost: 10, prerequisites: [], description: 'Herb gardens +1 herbs/worker' },
  improved_tools:   { id: 'improved_tools', tier: 1, name: 'Improved Tools', cost: 15, prerequisites: [], description: 'Tool durability +20%' },
  fortification:    { id: 'fortification', tier: 1, name: 'Fortification', cost: 15, prerequisites: [], description: 'Guards +1 defense' },
  animal_husbandry: { id: 'animal_husbandry', tier: 1, name: 'Animal Husbandry', cost: 10, prerequisites: [], description: 'Enables chicken coops and livestock barns' },
  basic_cooking:    { id: 'basic_cooking', tier: 1, name: 'Basic Cooking', cost: 10, prerequisites: [], description: 'Bakeries produce +1 bread/worker' },

  // --- Tier 2: intermediate (cost 20-30, require T1 prereqs) ---
  metallurgy:       { id: 'metallurgy', tier: 2, name: 'Metallurgy', cost: 20, prerequisites: ['masonry'], description: 'Smelters +1 ingot/worker' },
  military_tactics: { id: 'military_tactics', tier: 2, name: 'Military Tactics', cost: 25, prerequisites: ['fortification'], description: 'Guards +2 attack' },
  civil_engineering:{ id: 'civil_engineering', tier: 2, name: 'Civil Engineering', cost: 25, prerequisites: ['masonry'], description: 'Building costs -25%' },
  advanced_farming: { id: 'advanced_farming', tier: 2, name: 'Advanced Farming', cost: 20, prerequisites: ['crop_rotation'], description: 'Farms produce +1 additional wheat (total +2)' },
  archery:          { id: 'archery', tier: 2, name: 'Archery', cost: 20, prerequisites: ['fortification'], description: 'Watchtower range +2 tiles (7 total)' },
  medicine:         { id: 'medicine', tier: 2, name: 'Medicine', cost: 20, prerequisites: ['herbalism_lore'], description: 'Disease duration -2 days, regen +1 HP/day' },
  trade_routes:     { id: 'trade_routes', tier: 2, name: 'Trade Routes', cost: 25, prerequisites: ['improved_tools'], description: 'Caravans arrive 50% more often, carry +50% goods' },

  // --- Tier 3: advanced (cost 35-50, require T2 prereqs) ---
  steel_forging:    { id: 'steel_forging', tier: 3, name: 'Steel Forging', cost: 40, prerequisites: ['metallurgy'], description: 'Iron tools last 50% longer, guard attack +1' },
  siege_engineering:{ id: 'siege_engineering', tier: 3, name: 'Siege Engineering', cost: 35, prerequisites: ['military_tactics', 'civil_engineering'], description: 'Walls +50% HP, gates +50% HP' },
  master_crafting:  { id: 'master_crafting', tier: 3, name: 'Master Crafting', cost: 40, prerequisites: ['improved_tools', 'metallurgy'], description: 'All production buildings +1 output' },
  armored_guards:   { id: 'armored_guards', tier: 3, name: 'Armored Guards', cost: 45, prerequisites: ['military_tactics', 'metallurgy'], description: 'Guards +3 defense, +5 max HP' },
  irrigation:       { id: 'irrigation', tier: 3, name: 'Irrigation', cost: 35, prerequisites: ['advanced_farming'], description: 'Farms ignore autumn penalty (full output year-round except winter)' },
  architecture:     { id: 'architecture', tier: 3, name: 'Architecture', cost: 50, prerequisites: ['civil_engineering'], description: 'Building HP +50%, repair speed doubled' },
};

export const ALL_TECHS: TechId[] = Object.keys(TECH_TREE) as TechId[];

// --- Tech-gated building requirements ---
export const BUILDING_TECH_REQUIREMENTS: Partial<Record<BuildingType, TechId>> = {
  // Tier 1
  large_farm: 'crop_rotation',
  deep_quarry: 'masonry',
  town_hall: 'masonry',
  toolmaker: 'improved_tools',
  carpenter: 'improved_tools',
  watchtower: 'fortification',
  chicken_coop: 'animal_husbandry',
  livestock_barn: 'animal_husbandry',
  apiary: 'animal_husbandry',
  mill: 'basic_cooking',
  bakery: 'basic_cooking',
  food_cellar: 'basic_cooking',
  smoking_rack: 'basic_cooking',
  brewery: 'basic_cooking',
  barley_field: 'crop_rotation',
  vegetable_garden: 'crop_rotation',
  foraging_hut: 'herbalism_lore',
  // Tier 2
  smelter: 'metallurgy',
  coal_burner: 'metallurgy',
  iron_mine: 'metallurgy',
  armorer: 'metallurgy',
  marketplace: 'trade_routes',
  church: 'trade_routes',
  mint: 'trade_routes',
  manor: 'civil_engineering',
  large_storehouse: 'civil_engineering',
  outpost: 'civil_engineering',
  fountain: 'civil_engineering',
  statue: 'civil_engineering',
  fletcher: 'archery',
  hunting_lodge: 'military_tactics',
  fishing_hut: 'advanced_farming',
  garden: 'advanced_farming',
  // Tier 3
  weaponsmith: 'steel_forging',
  leather_workshop: 'master_crafting',
  lumber_mill: 'architecture',
  advanced_smelter: 'architecture',
  windmill: 'architecture',
  kitchen: 'architecture',
  inn: 'architecture',
  guard_tower: 'architecture',
  logging_camp: 'advanced_farming',
  reinforced_wall: 'siege_engineering',
  barracks: 'military_tactics',
  weapon_rack: 'military_tactics',
  training_ground: 'fortification',
  spike_trap: 'fortification',
  forester: 'advanced_farming',
  apothecary: 'medicine',
  library: 'civil_engineering',
  foraging_lodge: 'advanced_farming',
  village_hall: 'architecture',
  stonemason: 'masonry',
  trappers_camp: 'animal_husbandry',
  river_dock: 'civil_engineering',
};
