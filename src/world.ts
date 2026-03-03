// world.ts — Pure data types and factory functions. NO logic.

// --- Seasons & Weather ---
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherType = 'clear' | 'rain' | 'storm';

export const SEASON_NAMES: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_FARM_MULT: Record<Season, number> = {
  spring: 1.0, summer: 1.3, autumn: 0.7, winter: 0,
};

export const SEASON_MORALE: Record<Season, number> = {
  spring: 0, summer: 5, autumn: 0, winter: -10,
};

export const WEATHER_MORALE: Record<WeatherType, number> = {
  clear: 0, rain: -5, storm: -10,
};

export const WEATHER_OUTDOOR_MULT: Record<WeatherType, number> = {
  clear: 1.0, rain: 0.8, storm: 0.5,
};

export const OUTDOOR_BUILDINGS: BuildingType[] = [
  'farm', 'woodcutter', 'quarry', 'herb_garden', 'flax_field', 'hemp_field',
  'chicken_coop', 'apiary', 'livestock_barn',
];

// --- Housing Tiers ---
export const HOUSING_INFO: Partial<Record<BuildingType, { capacity: number; morale: number }>> = {
  tent: { capacity: 1, morale: 0 },
  house: { capacity: 2, morale: 10 },
  manor: { capacity: 4, morale: 20 },
};

// --- Terrain ---
export type Terrain = 'grass' | 'forest' | 'water' | 'stone';

// --- Tile ---
export type Deposit = 'iron' | 'fertile' | 'herbs' | null;

export interface Tile {
  terrain: Terrain;
  building: Building | null;
  deposit: Deposit;
}

// --- Building ---
export type BuildingType =
  | 'house' | 'tent' | 'manor' | 'farm' | 'woodcutter' | 'quarry' | 'storehouse'
  | 'herb_garden' | 'flax_field' | 'hemp_field' | 'iron_mine'
  | 'sawmill' | 'smelter' | 'mill' | 'bakery' | 'tanner' | 'weaver' | 'ropemaker'
  | 'blacksmith' | 'toolmaker' | 'armorer'
  | 'town_hall' | 'wall' | 'fence'
  | 'research_desk'
  | 'chicken_coop' | 'livestock_barn' | 'apiary' | 'marketplace' | 'hunting_lodge'
  | 'gate'
  | 'watchtower'
  | 'rubble';

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedWorkers: string[];
  // V2 fields
  hp: number;
  maxHp: number;
  constructed: boolean;
  constructionProgress: number;
  constructionRequired: number;
  localBuffer: Partial<Record<ResourceType, number>>;
  bufferCapacity: number;
}

// --- Resources ---
export type ResourceType =
  | 'wood' | 'stone' | 'food' | 'wheat' | 'iron_ore' | 'herbs' | 'flax' | 'hemp'
  | 'planks' | 'ingots' | 'flour' | 'bread' | 'leather' | 'linen' | 'rope'
  | 'basic_tools' | 'sturdy_tools' | 'iron_tools'
  | 'gold';

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  wheat: number;
  iron_ore: number;
  herbs: number;
  flax: number;
  hemp: number;
  planks: number;
  ingots: number;
  flour: number;
  bread: number;
  leather: number;
  linen: number;
  rope: number;
  basic_tools: number;
  sturdy_tools: number;
  iron_tools: number;
  gold: number;
}

export function emptyResources(): Resources {
  return {
    wood: 0, stone: 0, food: 0, wheat: 0, iron_ore: 0, herbs: 0, flax: 0, hemp: 0,
    planks: 0, ingots: 0, flour: 0, bread: 0, leather: 0, linen: 0, rope: 0,
    basic_tools: 0, sturdy_tools: 0, iron_tools: 0,
    gold: 0,
  };
}

// All resource keys for iteration
export const ALL_RESOURCES: ResourceType[] = [
  'wood', 'stone', 'food', 'wheat', 'iron_ore', 'herbs', 'flax', 'hemp',
  'planks', 'ingots', 'flour', 'bread', 'leather', 'linen', 'rope',
  'basic_tools', 'sturdy_tools', 'iron_tools',
  'gold',
];

// --- Tools ---
export type ToolTier = 'none' | 'basic' | 'sturdy' | 'iron';

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

// --- Storage ---
export const BASE_STORAGE_CAP = 100;
export const STOREHOUSE_BONUS = 50;

// --- V2 Tick Constants ---
export const TICKS_PER_DAY = 120;
export const NIGHT_TICKS = 30;       // ticks 0-29 = night, 30-119 = day
export const CARRY_CAPACITY = 5;
export const DEFAULT_BUFFER_CAP = 20;
export const STOREHOUSE_BUFFER_CAP = 100;
export const HOME_DEPARTURE_TICK = 95; // villagers start heading home at this tick-in-day

// --- Spoilage rates (fraction lost per tick) ---
export const SPOILAGE: Partial<Record<ResourceType, number>> = {
  food: 0.02,
  wheat: 0.01,
  flour: 0.01,
};

// --- Food priority (best first) ---
export const FOOD_PRIORITY: { resource: ResourceType; satisfaction: number }[] = [
  { resource: 'bread', satisfaction: 2 },
  { resource: 'flour', satisfaction: 1.5 },
  { resource: 'wheat', satisfaction: 1 },
  { resource: 'food', satisfaction: 1 },
];

// --- Production ---
export interface ProductionRule {
  output: ResourceType;
  amountPerWorker: number;
  inputs: Partial<Record<ResourceType, number>> | null;
}

// --- Building Templates ---
export interface BuildingTemplate {
  type: BuildingType;
  width: number;
  height: number;
  allowedTerrain: Terrain[];
  cost: Partial<Resources>;
  description: string;
  maxWorkers: number;
  production: ProductionRule | null;
  mapChar: string;
}

export const BUILDING_TEMPLATES: Record<BuildingType, BuildingTemplate> = {
  tent: {
    type: 'tent', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 3 }, description: 'Basic shelter for 1 villager',
    maxWorkers: 0, production: null, mapChar: 't',
  },
  house: {
    type: 'house', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10 }, description: 'Cottage for 2 villagers',
    maxWorkers: 0, production: null, mapChar: 'H',
  },
  manor: {
    type: 'manor', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 25, stone: 15, planks: 10 }, description: 'Manor for 4 villagers',
    maxWorkers: 0, production: null, mapChar: 'U',
  },
  farm: {
    type: 'farm', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 5 }, description: 'Produces wheat',
    maxWorkers: 2, production: { output: 'wheat', amountPerWorker: 3, inputs: null }, mapChar: 'F',
  },
  woodcutter: {
    type: 'woodcutter', width: 1, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 5 }, description: 'Harvests wood',
    maxWorkers: 1, production: { output: 'wood', amountPerWorker: 2, inputs: null }, mapChar: 'W',
  },
  quarry: {
    type: 'quarry', width: 2, height: 2, allowedTerrain: ['stone', 'grass'],
    cost: { wood: 10 }, description: 'Extracts stone',
    maxWorkers: 2, production: { output: 'stone', amountPerWorker: 2, inputs: null }, mapChar: 'Q',
  },
  storehouse: {
    type: 'storehouse', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 5 }, description: 'Increases storage capacity',
    maxWorkers: 0, production: null, mapChar: 'S',
  },
  herb_garden: {
    type: 'herb_garden', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 3 }, description: 'Grows herbs',
    maxWorkers: 1, production: { output: 'herbs', amountPerWorker: 2, inputs: null }, mapChar: 'G',
  },
  flax_field: {
    type: 'flax_field', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 4 }, description: 'Grows flax',
    maxWorkers: 1, production: { output: 'flax', amountPerWorker: 2, inputs: null }, mapChar: 'X',
  },
  hemp_field: {
    type: 'hemp_field', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 4 }, description: 'Grows hemp',
    maxWorkers: 1, production: { output: 'hemp', amountPerWorker: 2, inputs: null }, mapChar: 'P',
  },
  iron_mine: {
    type: 'iron_mine', width: 1, height: 1, allowedTerrain: ['stone'],
    cost: { wood: 15, stone: 5 }, description: 'Mines iron ore',
    maxWorkers: 2, production: { output: 'iron_ore', amountPerWorker: 1, inputs: null }, mapChar: 'I',
  },
  sawmill: {
    type: 'sawmill', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 5 }, description: 'Processes wood into planks',
    maxWorkers: 1, production: { output: 'planks', amountPerWorker: 3, inputs: { wood: 2 } }, mapChar: 'M',
  },
  smelter: {
    type: 'smelter', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 10 }, description: 'Smelts iron ore into ingots',
    maxWorkers: 1, production: { output: 'ingots', amountPerWorker: 1, inputs: { iron_ore: 2 } }, mapChar: 'E',
  },
  mill: {
    type: 'mill', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8 }, description: 'Grinds wheat into flour',
    maxWorkers: 1, production: { output: 'flour', amountPerWorker: 3, inputs: { wheat: 3 } }, mapChar: 'L',
  },
  bakery: {
    type: 'bakery', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 3 }, description: 'Bakes flour into bread',
    maxWorkers: 1, production: { output: 'bread', amountPerWorker: 3, inputs: { flour: 2 } }, mapChar: 'B',
  },
  tanner: {
    type: 'tanner', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8 }, description: 'Produces leather',
    maxWorkers: 1, production: { output: 'leather', amountPerWorker: 1, inputs: null }, mapChar: 'N',
  },
  weaver: {
    type: 'weaver', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8 }, description: 'Weaves flax into linen',
    maxWorkers: 1, production: { output: 'linen', amountPerWorker: 2, inputs: { flax: 2 } }, mapChar: 'V',
  },
  ropemaker: {
    type: 'ropemaker', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 6 }, description: 'Makes rope from hemp',
    maxWorkers: 1, production: { output: 'rope', amountPerWorker: 2, inputs: { hemp: 2 } }, mapChar: 'R',
  },
  blacksmith: {
    type: 'blacksmith', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8, stone: 5 }, description: 'Crafts basic wood/stone tools',
    maxWorkers: 1, production: { output: 'basic_tools', amountPerWorker: 2, inputs: { wood: 3, stone: 2 } }, mapChar: 'K',
  },
  toolmaker: {
    type: 'toolmaker', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 20, stone: 15 }, description: 'Crafts sturdy tools',
    maxWorkers: 1, production: { output: 'sturdy_tools', amountPerWorker: 1, inputs: { ingots: 2, planks: 1 } }, mapChar: 'O',
  },
  armorer: {
    type: 'armorer', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 25, stone: 20 }, description: 'Forges iron tools and equipment',
    maxWorkers: 1, production: { output: 'iron_tools', amountPerWorker: 1, inputs: { ingots: 3, leather: 1 } }, mapChar: 'A',
  },
  town_hall: {
    type: 'town_hall', width: 3, height: 3, allowedTerrain: ['grass'],
    cost: { wood: 30, stone: 20, planks: 10 }, description: 'Enables territory expansion',
    maxWorkers: 0, production: null, mapChar: 'T',
  },
  wall: {
    type: 'wall', width: 1, height: 1, allowedTerrain: ['grass', 'stone'],
    cost: { stone: 3 }, description: 'Stone wall — blocks enemies',
    maxWorkers: 0, production: null, mapChar: '#',
  },
  fence: {
    type: 'fence', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 2 }, description: 'Wooden fence',
    maxWorkers: 0, production: null, mapChar: '=',
  },
  research_desk: {
    type: 'research_desk', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 5 }, description: 'Produces knowledge for research',
    maxWorkers: 1, production: null, mapChar: 'D',
  },
  chicken_coop: {
    type: 'chicken_coop', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8 }, description: 'Raises chickens for food',
    maxWorkers: 1, production: { output: 'food', amountPerWorker: 2, inputs: null }, mapChar: 'C',
  },
  livestock_barn: {
    type: 'livestock_barn', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 5 }, description: 'Raises livestock for leather and food',
    maxWorkers: 1, production: { output: 'leather', amountPerWorker: 1, inputs: null }, mapChar: 'J',
  },
  apiary: {
    type: 'apiary', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 6 }, description: 'Bee hives for herbs',
    maxWorkers: 1, production: { output: 'herbs', amountPerWorker: 1, inputs: null }, mapChar: 'Y',
  },
  marketplace: {
    type: 'marketplace', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 20, stone: 10, planks: 5 }, description: 'Enables merchant trading',
    maxWorkers: 1, production: null, mapChar: '$',
  },
  hunting_lodge: {
    type: 'hunting_lodge', width: 1, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 10 }, description: 'Hunters track and kill wildlife',
    maxWorkers: 2, production: null, mapChar: 'H',
  },
  gate: {
    type: 'gate', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 5, stone: 2 }, description: 'Lets allies through, blocks enemies',
    maxWorkers: 0, production: null, mapChar: '=',
  },
  watchtower: {
    type: 'watchtower', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 10 }, description: 'Guards shoot enemies at range (5 tiles)',
    maxWorkers: 1, production: null, mapChar: 'T',
  },
  rubble: {
    type: 'rubble', width: 1, height: 1, allowedTerrain: ['grass', 'stone'],
    cost: {}, description: 'Clearable rubble from a destroyed building',
    maxWorkers: 1, production: null, mapChar: '%',
  },
};

// --- Skills ---
export type SkillType = 'farming' | 'mining' | 'crafting' | 'woodcutting' | 'cooking' | 'herbalism';

export const ALL_SKILLS: SkillType[] = ['farming', 'mining', 'crafting', 'woodcutting', 'cooking', 'herbalism'];

export const BUILDING_SKILL_MAP: Partial<Record<BuildingType, SkillType>> = {
  farm: 'farming', flax_field: 'farming', hemp_field: 'farming',
  quarry: 'mining', iron_mine: 'mining',
  sawmill: 'crafting', smelter: 'crafting', tanner: 'crafting', weaver: 'crafting', ropemaker: 'crafting',
  woodcutter: 'woodcutting',
  mill: 'cooking', bakery: 'cooking',
  herb_garden: 'herbalism',
  research_desk: 'crafting',
  chicken_coop: 'farming',
  livestock_barn: 'farming',
  apiary: 'herbalism',
};

export function skillMultiplier(level: number): number {
  if (level <= 25) return 0.8;
  if (level <= 50) return 1.0;
  if (level <= 75) return 1.2;
  return 1.5;
}

// --- Traits ---
export type Trait = 'strong' | 'lazy' | 'skilled_crafter' | 'fast_learner' | 'glutton' | 'frugal' | 'cheerful' | 'gloomy';

export const ALL_TRAITS: Trait[] = ['strong', 'lazy', 'skilled_crafter', 'fast_learner', 'glutton', 'frugal', 'cheerful', 'gloomy'];

// --- Villager ---
export type VillagerRole =
  | 'idle' | 'farmer' | 'woodcutter' | 'quarrier' | 'herbalist'
  | 'flaxer' | 'hemper' | 'miner' | 'sawyer' | 'smelter'
  | 'miller' | 'baker' | 'tanner_worker' | 'weaver_worker' | 'ropemaker_worker'
  | 'blacksmith_worker' | 'toolmaker_worker' | 'armorer_worker'
  | 'scout' | 'guard' | 'researcher' | 'hunter'
  | 'chicken_keeper' | 'rancher' | 'beekeeper' | 'trader';

export type VillagerState =
  | 'sleeping'
  | 'traveling_to_work'
  | 'working'
  | 'traveling_to_storage'
  | 'traveling_to_eat'
  | 'eating'
  | 'traveling_home'
  | 'idle'
  | 'scouting'
  | 'traveling_to_build'
  | 'constructing'
  | 'hunting'
  | 'hauling_drop';
export type FoodEaten = 'bread' | 'flour' | 'wheat' | 'food' | 'nothing';
export type Direction = 'n' | 's' | 'e' | 'w';

export interface Villager {
  id: string;
  name: string;
  x: number;
  y: number;
  role: VillagerRole;
  jobBuildingId: string | null;
  homeBuildingId: string | null;
  state: VillagerState;
  food: number;
  homeless: number;
  skills: Record<SkillType, number>;
  traits: Trait[];
  morale: number;
  lastAte: FoodEaten;
  tool: ToolTier;
  toolDurability: number;
  scoutDirection: Direction | null;
  scoutTicksLeft: number;
  hp: number;
  maxHp: number;
  // V2 fields
  path: { x: number; y: number }[];
  pathIndex: number;
  carrying: Partial<Record<ResourceType, number>>;
  carryTotal: number;
  workProgress: number;
  haulingToWork: boolean; // true = picking up inputs for processing building
  // Guard patrol
  patrolRoute: { x: number; y: number }[]; // waypoints for guard patrol
  patrolIndex: number; // current waypoint index
  // Clothing
  clothed: boolean;
  clothingDurability: number; // days remaining
}

// --- Combat ---
export type EnemyType = 'bandit' | 'wolf' | 'boar';

export interface Enemy {
  type: EnemyType;
  hp: number;
  attack: number;
  defense: number;
}

export interface ActiveRaid {
  enemies: Enemy[];
  resolved: boolean;
}

export const ENEMY_TEMPLATES: Record<EnemyType, Omit<Enemy, 'hp'> & { maxHp: number }> = {
  bandit: { type: 'bandit', maxHp: 10, attack: 3, defense: 1 },
  wolf: { type: 'wolf', maxHp: 6, attack: 4, defense: 0 },
  boar: { type: 'boar', maxHp: 15, attack: 2, defense: 2 },
};

// V2: Grid-based enemy entity (replaces abstract Enemy for simulation)
export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
}

// V2: Wildlife — grid-based animals that roam the map
export type AnimalType = 'deer' | 'rabbit' | 'wild_wolf' | 'wild_boar';

export interface AnimalEntity {
  id: string;
  type: AnimalType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  behavior: 'passive' | 'hostile'; // passive = flee, hostile = attack
}

export interface AnimalTemplate {
  type: AnimalType;
  maxHp: number;
  attack: number;
  behavior: 'passive' | 'hostile';
  drops: Partial<Record<ResourceType, number>>; // what they drop on death
}

export const ANIMAL_TEMPLATES: Record<AnimalType, AnimalTemplate> = {
  deer: { type: 'deer', maxHp: 8, attack: 0, behavior: 'passive', drops: { food: 3, leather: 1 } },
  rabbit: { type: 'rabbit', maxHp: 3, attack: 0, behavior: 'passive', drops: { food: 1 } },
  wild_wolf: { type: 'wild_wolf', maxHp: 8, attack: 4, behavior: 'hostile', drops: { food: 1 } },
  wild_boar: { type: 'wild_boar', maxHp: 12, attack: 3, behavior: 'hostile', drops: { food: 4, leather: 2 } },
};

// V2: Resource drops on the ground (from animal kills, etc.)
export interface ResourceDrop {
  id: string;
  x: number;
  y: number;
  resources: Partial<Record<ResourceType, number>>;
}

// V2: Building max HP by type
export const BUILDING_MAX_HP: Record<BuildingType, number> = {
  tent: 20, house: 50, manor: 80,
  farm: 30, woodcutter: 30, quarry: 40, storehouse: 60,
  herb_garden: 25, flax_field: 25, hemp_field: 25, iron_mine: 50,
  sawmill: 40, smelter: 50, mill: 35, bakery: 35,
  tanner: 35, weaver: 35, ropemaker: 35,
  blacksmith: 45, toolmaker: 45, armorer: 50,
  town_hall: 100, wall: 100, fence: 30,
  research_desk: 30, chicken_coop: 25, livestock_barn: 40,
  apiary: 20, marketplace: 60, hunting_lodge: 30, gate: 80,
  watchtower: 70,
  rubble: 1,
};

// V2: Construction time (work ticks needed to complete a building)
export const CONSTRUCTION_TICKS: Record<BuildingType, number> = {
  tent: 30, house: 90, manor: 180,
  farm: 60, woodcutter: 45, quarry: 90, storehouse: 90,
  herb_garden: 40, flax_field: 40, hemp_field: 40, iron_mine: 120,
  sawmill: 75, smelter: 100, mill: 60, bakery: 60,
  tanner: 60, weaver: 60, ropemaker: 50,
  blacksmith: 80, toolmaker: 100, armorer: 120,
  town_hall: 240, wall: 20, fence: 10,
  research_desk: 60, chicken_coop: 45, livestock_barn: 75,
  apiary: 35, marketplace: 120, hunting_lodge: 50, gate: 15,
  watchtower: 90,
  rubble: 30,
};

// V2: Building upgrade paths — from → { to, cost }
export const UPGRADE_PATHS: Partial<Record<BuildingType, { to: BuildingType; cost: Partial<Resources> }>> = {
  tent: { to: 'house', cost: { wood: 7 } },
  house: { to: 'manor', cost: { wood: 15, stone: 15, planks: 10 } },
};

export const WATCHTOWER_RANGE = 5;
export const WATCHTOWER_DAMAGE = 2;

export const GUARD_COMBAT: Record<ToolTier, { attack: number; defense: number }> = {
  none: { attack: 3, defense: 2 },
  basic: { attack: 4, defense: 3 },
  sturdy: { attack: 5, defense: 4 },
  iron: { attack: 7, defense: 5 },
};

// --- Research ---
export type TechId =
  | 'crop_rotation' | 'masonry' | 'herbalism_lore' | 'metallurgy'
  | 'improved_tools' | 'fortification' | 'military_tactics' | 'civil_engineering';

export interface TechDefinition {
  id: TechId;
  name: string;
  cost: number;  // knowledge points required
  description: string;
}

export const TECH_TREE: Record<TechId, TechDefinition> = {
  crop_rotation: { id: 'crop_rotation', name: 'Crop Rotation', cost: 10, description: 'Farms +1 wheat/worker' },
  masonry: { id: 'masonry', name: 'Masonry', cost: 10, description: 'Quarries +1 stone/worker' },
  herbalism_lore: { id: 'herbalism_lore', name: 'Herbalism Lore', cost: 10, description: 'Herb gardens +1 herbs/worker' },
  metallurgy: { id: 'metallurgy', name: 'Metallurgy', cost: 20, description: 'Smelters +1 ingot/worker' },
  improved_tools: { id: 'improved_tools', name: 'Improved Tools', cost: 15, description: 'Tool durability +20%' },
  fortification: { id: 'fortification', name: 'Fortification', cost: 20, description: 'Guards +1 defense' },
  military_tactics: { id: 'military_tactics', name: 'Military Tactics', cost: 25, description: 'Guards +2 attack' },
  civil_engineering: { id: 'civil_engineering', name: 'Civil Engineering', cost: 30, description: 'Building costs -25%' },
};

export const ALL_TECHS: TechId[] = [
  'crop_rotation', 'masonry', 'herbalism_lore', 'metallurgy',
  'improved_tools', 'fortification', 'military_tactics', 'civil_engineering',
];

export interface ResearchState {
  completed: TechId[];
  current: TechId | null;
  progress: number;
}

// --- Trade ---
export interface MerchantState {
  ticksLeft: number;
  x: number;
  y: number;
}

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
};

// --- Game State ---
export interface GameState {
  tick: number;  // total tick count; day = Math.floor(tick / TICKS_PER_DAY)
  day: number;   // convenience: Math.floor(tick / TICKS_PER_DAY)
  grid: Tile[][];
  width: number;
  height: number;
  resources: Resources;  // represents storehouse contents
  storageCap: number;
  buildings: Building[];
  nextBuildingId: number;
  villagers: Villager[];
  nextVillagerId: number;
  enemies: EnemyEntity[];  // V2: grid-based enemies
  nextEnemyId: number;
  animals: AnimalEntity[];  // V2: wildlife on the map
  nextAnimalId: number;
  resourceDrops: ResourceDrop[];  // V2: items on the ground
  nextDropId: number;
  fog: boolean[][];
  territory: boolean[][];
  raidBar: number;
  raidLevel: number;
  activeRaid: ActiveRaid | null;
  research: ResearchState;
  merchant: MerchantState | null;
  merchantTimer: number;
  prosperity: number;
  season: Season;
  weather: WeatherType;
  renown: number;
  events: string[];
  completedQuests: string[];
}

// --- Names ---
const VILLAGER_NAMES = [
  'Edric', 'Mara', 'Aldric', 'Blythe', 'Cedric', 'Delia', 'Emory', 'Fern',
  'Gareth', 'Hilda', 'Ivo', 'Jocelyn', 'Kendrick', 'Lena', 'Magnus', 'Nell',
  'Osric', 'Petra', 'Quinn', 'Rowena', 'Silas', 'Thea', 'Ulric', 'Vera',
  'Wynn', 'Xara', 'Yoren', 'Zelda', 'Bryn', 'Cora',
];

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function emptySkills(): Record<SkillType, number> {
  return { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0 };
}

function rollTraits(id: number): Trait[] {
  // Deterministic trait assignment based on villager ID
  const rng = seededRng(id * 7919);
  const numTraits = rng() < 0.3 ? 0 : rng() < 0.5 ? 1 : 2;
  const traits: Trait[] = [];
  const pool = [...ALL_TRAITS];
  for (let i = 0; i < numTraits && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    traits.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return traits;
}

export function createVillager(id: number, x: number, y: number): Villager {
  return {
    id: `v${id}`,
    name: VILLAGER_NAMES[(id - 1) % VILLAGER_NAMES.length],
    x, y, role: 'idle', jobBuildingId: null, homeBuildingId: null,
    state: 'idle', food: 5, homeless: 0,
    skills: emptySkills(), traits: rollTraits(id), morale: 50, lastAte: 'nothing',
    tool: 'none', toolDurability: 0,
    scoutDirection: null, scoutTicksLeft: 0,
    hp: 10, maxHp: 10,
    // V2 fields
    path: [], pathIndex: 0,
    carrying: {}, carryTotal: 0,
    workProgress: 0,
    haulingToWork: false,
    patrolRoute: [],
    patrolIndex: 0,
    clothed: false,
    clothingDurability: 0,
  };
}

export function createWorld(width: number, height: number, seed: number = 42): GameState {
  const rng = seededRng(seed);
  const grid: Tile[][] = [];
  const riverStart = Math.floor(width / 3) + Math.floor(rng() * Math.floor(width / 3));

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      let terrain: Terrain = 'grass';
      if ((x === riverStart || x === riverStart + 1) && y % 4 !== 0) {
        terrain = 'water';
      } else if (rng() < 0.15) {
        terrain = 'forest';
      } else if (rng() < 0.05) {
        terrain = 'stone';
      }
      // Deposits
      let deposit: Deposit = null;
      if (terrain === 'stone' && rng() < 0.3) deposit = 'iron';
      else if (terrain === 'grass' && rng() < 0.08) deposit = 'fertile';
      else if (terrain === 'grass' && rng() < 0.05) deposit = 'herbs';

      row.push({ terrain, building: null, deposit });
    }
    grid.push(row);
  }

  const cx = Math.floor(width / 4);
  const cy = Math.floor(height / 2);

  // Fog: reveal 10x10 around start
  const fog: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  for (let fy = Math.max(0, cy - 5); fy < Math.min(height, cy + 5); fy++) {
    for (let fx = Math.max(0, cx - 5); fx < Math.min(width, cx + 5); fx++) {
      fog[fy][fx] = true;
    }
  }

  // Territory: 5x5 around start
  const territory: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  for (let ty = Math.max(0, cy - 2); ty <= Math.min(height - 1, cy + 2); ty++) {
    for (let tx = Math.max(0, cx - 2); tx <= Math.min(width - 1, cx + 2); tx++) {
      territory[ty][tx] = true;
    }
  }

  const villagers: Villager[] = [];
  let placed = 0;
  for (let dy = 0; dy < height && placed < 3; dy++) {
    for (let dx = 0; dx < width && placed < 3; dx++) {
      const vy = (cy + dy) % height;
      const vx = (cx + dx) % width;
      if (grid[vy][vx].terrain === 'grass') {
        villagers.push(createVillager(placed + 1, vx, vy));
        placed++;
      }
    }
  }

  return {
    tick: 0, day: 0, grid, width, height,
    resources: { ...emptyResources(), wood: 50, stone: 20, food: 30 },
    storageCap: BASE_STORAGE_CAP,
    buildings: [], nextBuildingId: 1,
    villagers, nextVillagerId: placed + 1,
    enemies: [], nextEnemyId: 1,
    animals: [], nextAnimalId: 1,
    resourceDrops: [], nextDropId: 1,
    fog, territory,
    raidBar: 0, raidLevel: 0, activeRaid: null,
    research: { completed: [], current: null, progress: 0 },
    merchant: null, merchantTimer: 15, prosperity: 0,
    season: 'spring', weather: 'clear',
    renown: 0, events: [], completedQuests: [],
  };
}
