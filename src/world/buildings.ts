// world/buildings.ts — Building templates, HP, upgrades, and related constants

import type { BuildingType, BuildingTemplate, Resources, Terrain } from './types.js';

export const OUTDOOR_BUILDINGS: BuildingType[] = [
  'farm', 'woodcutter', 'quarry', 'herb_garden', 'flax_field', 'hemp_field',
  'chicken_coop', 'apiary', 'livestock_barn', 'foraging_hut', 'fishing_hut', 'forester',
  'large_farm', 'deep_quarry', 'trappers_camp',
  'barley_field', 'vegetable_garden',
];

export const BUILDING_TEMPLATES: Record<BuildingType, BuildingTemplate> = {
  tent: {
    type: 'tent', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 3 }, description: 'Basic shelter for 1 villager',
    maxWorkers: 0, production: null, mapChar: 't',
  },
  cottage: {
    type: 'cottage', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 6 }, description: 'Small home for 2 villagers',
    maxWorkers: 0, production: null, mapChar: 'c',
  },
  house: {
    type: 'house', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10 }, description: 'Solid home for 2 villagers',
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
    maxWorkers: 1, production: { output: 'ingots', amountPerWorker: 1, inputs: { iron_ore: 2, charcoal: 1 } }, mapChar: 'E',
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
    cost: { wood: 25, stone: 20 }, description: 'Forges iron armor from ingots and leather',
    maxWorkers: 1, production: { output: 'iron_armor', amountPerWorker: 1, inputs: { ingots: 3, leather: 1 } }, mapChar: 'A',
  },
  coal_burner: {
    type: 'coal_burner', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 5 }, description: 'Burns wood into charcoal for fuel',
    maxWorkers: 1, production: { output: 'charcoal', amountPerWorker: 2, inputs: { wood: 2 } }, mapChar: 'c',
  },
  carpenter: {
    type: 'carpenter', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 12, stone: 5, planks: 5 }, description: 'Crafts furniture from planks',
    maxWorkers: 1, production: { output: 'furniture', amountPerWorker: 1, inputs: { planks: 3 } }, mapChar: 'P',
  },
  town_hall: {
    type: 'town_hall', width: 3, height: 3, allowedTerrain: ['grass'],
    cost: { wood: 30, stone: 20, planks: 10 }, description: 'Enables territory expansion',
    maxWorkers: 0, production: null, mapChar: 'T',
  },
  wall: {
    type: 'wall', width: 1, height: 1, allowedTerrain: ['grass', 'stone', 'hill'],
    cost: { stone: 3 }, description: 'Stone wall — blocks enemies',
    maxWorkers: 0, production: null, mapChar: '#',
  },
  fence: {
    type: 'fence', width: 1, height: 1, allowedTerrain: ['grass', 'hill'],
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
  foraging_hut: {
    type: 'foraging_hut', width: 1, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 6 }, description: 'Gathers food and herbs from nearby forest',
    maxWorkers: 1, production: { output: 'food', amountPerWorker: 2, inputs: null }, mapChar: 'G',
  },
  fishing_hut: {
    type: 'fishing_hut', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8 }, description: 'Catches fish from adjacent water',
    maxWorkers: 1, production: { output: 'fish', amountPerWorker: 2, inputs: null }, mapChar: 'f',
  },
  gate: {
    type: 'gate', width: 1, height: 1, allowedTerrain: ['grass', 'hill'],
    cost: { wood: 5, stone: 2 }, description: 'Lets allies through, blocks enemies',
    maxWorkers: 0, production: null, mapChar: '=',
  },
  watchtower: {
    type: 'watchtower', width: 1, height: 1, allowedTerrain: ['grass', 'hill'],
    cost: { wood: 15, stone: 10 }, description: 'Guards shoot enemies at range (5 tiles)',
    maxWorkers: 1, production: null, mapChar: 'T',
  },
  tavern: {
    type: 'tavern', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 5 }, description: 'Villagers visit for morale boost',
    maxWorkers: 0, production: null, mapChar: 'V',
  },
  inn: {
    type: 'inn', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 20, stone: 15, planks: 10, rope: 5 }, description: 'Upgraded tavern — higher morale, houses 4',
    maxWorkers: 0, production: null, mapChar: 'I',
  },
  well: {
    type: 'well', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { stone: 10 }, description: 'Produces water and reduces fire risk nearby',
    maxWorkers: 1, production: { output: 'water', amountPerWorker: 3 }, mapChar: 'O',
  },
  water_collector: {
    type: 'water_collector', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 5 }, description: 'Collects rainwater passively (more in rain)',
    maxWorkers: 0, production: { output: 'water', amountPerWorker: 1 }, mapChar: '~',
  },
  butchery: {
    type: 'butchery', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8, stone: 3 }, description: 'Processes raw food into meat and leather',
    maxWorkers: 1, production: { output: 'meat', amountPerWorker: 2, inputs: { food: 3 }, byproduct: { resource: 'leather', amount: 1 } }, mapChar: 'U',
  },
  compost_pile: {
    type: 'compost_pile', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 5 }, description: 'Converts surplus food into fertilizer',
    maxWorkers: 1, production: { output: 'fertilizer', amountPerWorker: 1, inputs: { food: 2 } }, mapChar: '%',
  },
  drying_rack: {
    type: 'drying_rack', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 6 }, description: 'Dries food for long-term preservation',
    maxWorkers: 1, production: { output: 'dried_food', amountPerWorker: 2, inputs: { food: 2 } }, mapChar: '=',
  },
  smoking_rack: {
    type: 'smoking_rack', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8, stone: 2 }, description: 'Smokes meat with charcoal for long preservation',
    maxWorkers: 1, production: { output: 'smoked_food', amountPerWorker: 2, inputs: { meat: 2, charcoal: 1 } }, mapChar: '~',
  },
  food_cellar: {
    type: 'food_cellar', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8, stone: 12, planks: 2 }, description: 'Reduces food spoilage by 50%',
    maxWorkers: 0, production: null, mapChar: 'C',
  },
  church: {
    type: 'church', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 20, stone: 10, stone_blocks: 5 }, description: 'Boosts morale of nearby villagers',
    maxWorkers: 0, production: null, mapChar: 'C',
  },
  graveyard: {
    type: 'graveyard', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { stone: 5 }, description: 'Resting place for the departed',
    maxWorkers: 0, production: null, mapChar: '+',
  },
  rubble: {
    type: 'rubble', width: 1, height: 1, allowedTerrain: ['grass', 'stone'],
    cost: {}, description: 'Clearable rubble from a destroyed building',
    maxWorkers: 1, production: null, mapChar: '%',
  },
  large_farm: {
    type: 'large_farm', width: 3, height: 3, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 5, planks: 5 }, description: 'Large farm — 3 workers, 4 wheat each',
    maxWorkers: 3, production: { output: 'wheat', amountPerWorker: 4, inputs: null }, mapChar: 'F',
  },
  lumber_mill: {
    type: 'lumber_mill', width: 2, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 15, stone: 10, planks: 5 }, description: 'Upgraded sawmill — 2 workers, 4 planks each',
    maxWorkers: 2, production: { output: 'planks', amountPerWorker: 4, inputs: { wood: 2 } }, mapChar: 'M',
  },
  deep_quarry: {
    type: 'deep_quarry', width: 2, height: 2, allowedTerrain: ['stone', 'grass'],
    cost: { wood: 20, stone: 10, planks: 5 }, description: 'Deep quarry — 3 workers, 3 stone each',
    maxWorkers: 3, production: { output: 'stone', amountPerWorker: 3, inputs: null }, mapChar: 'Q',
  },
  advanced_smelter: {
    type: 'advanced_smelter', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { stone: 20, planks: 10, ingots: 5 }, description: 'Blast furnace — 2 workers, 2 ingots each',
    maxWorkers: 2, production: { output: 'ingots', amountPerWorker: 2, inputs: { iron_ore: 2, charcoal: 1 } }, mapChar: 'E',
  },
  windmill: {
    type: 'windmill', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 10, planks: 5, rope: 3 }, description: 'Windmill — 2 workers, 4 flour each',
    maxWorkers: 2, production: { output: 'flour', amountPerWorker: 4, inputs: { wheat: 3 } }, mapChar: 'L',
  },
  kitchen: {
    type: 'kitchen', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 10, planks: 5 }, description: 'Kitchen — 2 workers, 4 bread each',
    maxWorkers: 2, production: { output: 'bread', amountPerWorker: 4, inputs: { flour: 2, water: 1 } }, mapChar: 'B',
  },
  large_storehouse: {
    type: 'large_storehouse', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 25, stone: 15, planks: 10 }, description: 'Large storehouse — double storage bonus',
    maxWorkers: 0, production: null, mapChar: 'S',
  },
  weaponsmith: {
    type: 'weaponsmith', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 10 }, description: 'Forges swords from ingots and planks',
    maxWorkers: 1, production: { output: 'sword', amountPerWorker: 1, inputs: { ingots: 2, planks: 1 } }, mapChar: 'W',
  },
  fletcher: {
    type: 'fletcher', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 5 }, description: 'Crafts bows from wood and rope',
    maxWorkers: 1, production: { output: 'bow', amountPerWorker: 1, inputs: { wood: 2, rope: 1 } }, mapChar: 'f',
  },
  leather_workshop: {
    type: 'leather_workshop', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 12, stone: 8 }, description: 'Crafts leather armor from leather and linen',
    maxWorkers: 1, production: { output: 'leather_armor', amountPerWorker: 1, inputs: { leather: 2, linen: 1 } }, mapChar: 'L',
  },
  garden: {
    type: 'garden', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 5 }, description: 'Flower garden — boosts morale of nearby homes',
    maxWorkers: 0, production: null, mapChar: 'g',
  },
  fountain: {
    type: 'fountain', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { stone: 5, stone_blocks: 3 }, description: 'Fountain — boosts morale + reduces fire risk',
    maxWorkers: 0, production: null, mapChar: 'o',
  },
  statue: {
    type: 'statue', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { stone_blocks: 5, gold: 5 }, description: 'Statue — strong morale boost to nearby homes',
    maxWorkers: 0, production: null, mapChar: '!',
  },
  outpost: {
    type: 'outpost', width: 1, height: 1, allowedTerrain: ['grass', 'forest', 'stone'],
    cost: { wood: 10, stone: 5 }, description: 'Remote supply point — acts as mini-storehouse',
    maxWorkers: 0, production: null, mapChar: 'O',
  },
  road: {
    type: 'road', width: 1, height: 1, allowedTerrain: ['grass', 'forest', 'stone'],
    cost: { stone: 1 }, description: 'Dirt road — doubles movement speed',
    maxWorkers: 0, production: null, mapChar: '=',
  },
  reinforced_wall: {
    type: 'reinforced_wall', width: 1, height: 1, allowedTerrain: ['grass', 'stone', 'hill'],
    cost: { stone_blocks: 3, ingots: 2 }, description: 'Reinforced stone wall — extra durable',
    maxWorkers: 0, production: null, mapChar: '#',
  },
  barracks: {
    type: 'barracks', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 20, stone: 15, planks: 10 }, description: 'Military housing — guards gain 2x combat XP',
    maxWorkers: 0, production: null, mapChar: 'B',
  },
  training_ground: {
    type: 'training_ground', width: 2, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 5 }, description: 'Guards train here — passive combat XP gain',
    maxWorkers: 2, production: null, mapChar: 'G',
  },
  spike_trap: {
    type: 'spike_trap', width: 1, height: 1, allowedTerrain: ['grass', 'hill'],
    cost: { wood: 3, ingots: 1 }, description: 'Damages enemies that step on it',
    maxWorkers: 0, production: null, mapChar: '^',
  },
  forester: {
    type: 'forester', width: 1, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 5, stone: 3 }, description: 'Plants and harvests trees — renewable wood',
    maxWorkers: 2, production: { output: 'wood', amountPerWorker: 1, inputs: null }, mapChar: 'F',
  },
  apothecary: {
    type: 'apothecary', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 8, stone: 5, herbs: 3 }, description: 'Healer crafts bandages from herbs',
    maxWorkers: 1, production: { output: 'bandage', amountPerWorker: 2, inputs: { herbs: 1 } }, mapChar: '+',
  },
  library: {
    type: 'library', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 10, planks: 5 }, description: 'Boosts research speed when constructed',
    maxWorkers: 0, production: null, mapChar: 'L',
  },
  foraging_lodge: {
    type: 'foraging_lodge', width: 1, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 12, stone: 5, planks: 3 }, description: 'Upgraded foraging hut — 2 workers, better yield',
    maxWorkers: 2, production: { output: 'food', amountPerWorker: 3, inputs: null }, mapChar: 'G',
  },
  weapon_rack: {
    type: 'weapon_rack', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 6, planks: 3, ingots: 2 }, description: 'Stores weapons and armor — nearby guards auto-equip',
    maxWorkers: 0, production: null, mapChar: 'R',
  },
  mint: {
    type: 'mint', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { stone: 15, planks: 8, ingots: 5 }, description: 'Mints gold coins from ingots',
    maxWorkers: 1, production: { output: 'gold', amountPerWorker: 2, inputs: { ingots: 1 } }, mapChar: '$',
  },
  village_hall: {
    type: 'village_hall', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 30, stone: 20, planks: 15, stone_blocks: 10 }, description: 'Upgraded town hall — extended maintenance aura, research boost',
    maxWorkers: 0, production: null, mapChar: 'V',
  },
  stonemason: {
    type: 'stonemason', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 8 }, description: 'Cuts raw stone into shaped stone blocks',
    maxWorkers: 1, production: { output: 'stone_blocks', amountPerWorker: 2, inputs: { stone: 3 } }, mapChar: 'S',
  },
  trappers_camp: {
    type: 'trappers_camp', width: 1, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 8, rope: 2 }, description: 'Sets traps for small game — food and leather',
    maxWorkers: 1, production: { output: 'food', amountPerWorker: 2, inputs: null, byproduct: { resource: 'leather', amount: 1 } }, mapChar: 'T',
  },
  barley_field: {
    type: 'barley_field', width: 2, height: 2, allowedTerrain: ['grass'],
    cost: { wood: 5 }, description: 'Grows barley for brewing',
    maxWorkers: 2, production: { output: 'barley', amountPerWorker: 3, inputs: null }, mapChar: 'B',
  },
  vegetable_garden: {
    type: 'vegetable_garden', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 4 }, description: 'Grows vegetables',
    maxWorkers: 1, production: { output: 'vegetables', amountPerWorker: 3, inputs: null }, mapChar: 'V',
  },
  brewery: {
    type: 'brewery', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { wood: 10, stone: 5, planks: 3 }, description: 'Brews ale from barley',
    maxWorkers: 1, production: { output: 'ale', amountPerWorker: 2, inputs: { barley: 2 } }, mapChar: 'b',
  },
  guard_tower: {
    type: 'guard_tower', width: 1, height: 1, allowedTerrain: ['grass', 'hill'],
    cost: { stone: 20, planks: 10, ingots: 5 }, description: 'Upgraded watchtower — range 7, damage 3',
    maxWorkers: 1, production: null, mapChar: 'G',
  },
  logging_camp: {
    type: 'logging_camp', width: 1, height: 1, allowedTerrain: ['grass', 'forest'],
    cost: { wood: 15, stone: 5, planks: 5 }, description: 'Upgraded woodcutter — 2 workers',
    maxWorkers: 2, production: { output: 'wood', amountPerWorker: 2, inputs: null }, mapChar: 'L',
  },
  river_dock: {
    type: 'river_dock', width: 1, height: 1, allowedTerrain: ['grass'],
    cost: { planks: 10, rope: 5, wood: 5 }, description: 'Dock — allows crossing adjacent water tiles',
    maxWorkers: 0, production: null, mapChar: 'D',
  },
};

// --- Building Max HP ---
export const BUILDING_MAX_HP: Record<BuildingType, number> = {
  tent: 20, cottage: 35, house: 50, manor: 80,
  farm: 30, woodcutter: 30, quarry: 40, storehouse: 60,
  herb_garden: 25, flax_field: 25, hemp_field: 25, iron_mine: 50,
  sawmill: 40, smelter: 50, mill: 35, bakery: 35,
  tanner: 35, weaver: 35, ropemaker: 35,
  blacksmith: 45, toolmaker: 45, armorer: 50, coal_burner: 35, carpenter: 40,
  town_hall: 100, wall: 100, fence: 30,
  research_desk: 30, chicken_coop: 25, livestock_barn: 40,
  apiary: 20, marketplace: 60, hunting_lodge: 30, foraging_hut: 25, fishing_hut: 30, gate: 80,
  watchtower: 70,
  tavern: 40,
  well: 50,
  water_collector: 20,
  butchery: 35, compost_pile: 15, drying_rack: 20, smoking_rack: 25, food_cellar: 40,
  church: 80,
  graveyard: 20,
  rubble: 1,
  large_farm: 60, lumber_mill: 50, deep_quarry: 60,
  advanced_smelter: 70, windmill: 50, kitchen: 45,
  large_storehouse: 60,
  weaponsmith: 45, fletcher: 35, leather_workshop: 35,
  garden: 20, fountain: 30, statue: 40,
  outpost: 40, road: 10,
  inn: 60,
  reinforced_wall: 200,
  barracks: 80,
  training_ground: 40,
  spike_trap: 10,
  forester: 30,
  apothecary: 35,
  library: 50,
  foraging_lodge: 35,
  weapon_rack: 30,
  mint: 40,
  village_hall: 150,
  stonemason: 40,
  trappers_camp: 25,
  barley_field: 30,
  vegetable_garden: 20,
  brewery: 40,
  guard_tower: 120,
  logging_camp: 40,
  river_dock: 40,
};

// --- Building Upgrade Paths ---
export const UPGRADE_PATHS: Partial<Record<BuildingType, { to: BuildingType; cost: Partial<Resources> }>> = {
  tent: { to: 'cottage', cost: { wood: 3 } },
  cottage: { to: 'house', cost: { wood: 5, planks: 3 } },
  house: { to: 'manor', cost: { wood: 15, stone: 10, planks: 10, stone_blocks: 5 } },
  farm: { to: 'large_farm', cost: { wood: 10, stone: 5, planks: 5 } },
  sawmill: { to: 'lumber_mill', cost: { wood: 10, stone: 10, planks: 5 } },
  quarry: { to: 'deep_quarry', cost: { wood: 15, stone: 10, planks: 5 } },
  smelter: { to: 'advanced_smelter', cost: { stone: 15, planks: 10, ingots: 5 } },
  mill: { to: 'windmill', cost: { wood: 10, stone: 10, planks: 5, rope: 3 } },
  bakery: { to: 'kitchen', cost: { wood: 10, stone: 10, planks: 5 } },
  storehouse: { to: 'large_storehouse', cost: { wood: 20, stone: 5, planks: 10, stone_blocks: 5 } },
  tavern: { to: 'inn', cost: { wood: 15, stone: 10, planks: 8, rope: 3 } },
  foraging_hut: { to: 'foraging_lodge', cost: { wood: 8, stone: 3, planks: 2 } },
  town_hall: { to: 'village_hall', cost: { wood: 20, stone: 15, planks: 10, stone_blocks: 8 } },
  fence: { to: 'wall', cost: { stone: 3 } },
  wall: { to: 'reinforced_wall', cost: { stone_blocks: 3, ingots: 2 } },
  watchtower: { to: 'guard_tower', cost: { stone: 10, planks: 5, ingots: 3 } },
  woodcutter: { to: 'logging_camp', cost: { wood: 10, stone: 5, planks: 3 } },
};

// --- Construction & Building Constants ---
export const INITIAL_CONSTRUCTION_POINTS = 20;
export const CONSTRUCTION_POINT_MILESTONES: { prosperity: number; points: number }[] = [
  { prosperity: 50, points: 5 },
  { prosperity: 65, points: 5 },
  { prosperity: 80, points: 10 },
  { prosperity: 90, points: 10 },
];
export const CONSTRUCTION_POINT_PER_IMMIGRANT = 2;
export const FREE_CONSTRUCTION: BuildingType[] = ['rubble', 'road'];

export const WATCHTOWER_RANGE = 5;
export const WATCHTOWER_DAMAGE = 2;
export const GUARD_TOWER_RANGE = 7;
export const GUARD_TOWER_DAMAGE = 3;

export const TOWN_HALL_MAINT_RANGE = 10;
export const VILLAGE_HALL_MAINT_RANGE = 15;

export const WEAPON_RACK_RANGE = 5;
export const WEAPON_RACK_BUFFER = 50;

export const WELL_FIRE_PROTECTION_RANGE = 3;

export const LIBRARY_RESEARCH_BONUS = 0.5;
