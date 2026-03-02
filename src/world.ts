// world.ts — Pure data types and factory functions. NO logic.

// --- Terrain ---
export type Terrain = 'grass' | 'forest' | 'water' | 'stone';

// --- Tile ---
export interface Tile {
  terrain: Terrain;
  building: Building | null;
}

// --- Building ---
export type BuildingType =
  | 'house' | 'farm' | 'woodcutter' | 'quarry' | 'storehouse'
  | 'herb_garden' | 'flax_field' | 'hemp_field' | 'iron_mine';

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedWorkers: string[];
}

// --- Resources ---
export type ResourceType = 'wood' | 'stone' | 'food' | 'wheat' | 'iron_ore' | 'herbs' | 'flax' | 'hemp';

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  wheat: number;
  iron_ore: number;
  herbs: number;
  flax: number;
  hemp: number;
}

export function emptyResources(): Resources {
  return { wood: 0, stone: 0, food: 0, wheat: 0, iron_ore: 0, herbs: 0, flax: 0, hemp: 0 };
}

// --- Storage ---
export const BASE_STORAGE_CAP = 100;
export const STOREHOUSE_BONUS = 50;

// --- Production ---
export interface ProductionRule {
  output: ResourceType;
  amountPerWorker: number;
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
  house: {
    type: 'house', width: 1, height: 1,
    allowedTerrain: ['grass'], cost: { wood: 10 },
    description: 'Shelter for villagers', maxWorkers: 0,
    production: null, mapChar: 'H',
  },
  farm: {
    type: 'farm', width: 2, height: 2,
    allowedTerrain: ['grass'], cost: { wood: 5 },
    description: 'Produces wheat', maxWorkers: 2,
    production: { output: 'wheat', amountPerWorker: 3 }, mapChar: 'F',
  },
  woodcutter: {
    type: 'woodcutter', width: 1, height: 1,
    allowedTerrain: ['grass', 'forest'], cost: { wood: 5 },
    description: 'Harvests wood', maxWorkers: 1,
    production: { output: 'wood', amountPerWorker: 2 }, mapChar: 'W',
  },
  quarry: {
    type: 'quarry', width: 2, height: 2,
    allowedTerrain: ['stone', 'grass'], cost: { wood: 10 },
    description: 'Extracts stone', maxWorkers: 2,
    production: { output: 'stone', amountPerWorker: 2 }, mapChar: 'Q',
  },
  storehouse: {
    type: 'storehouse', width: 2, height: 1,
    allowedTerrain: ['grass'], cost: { wood: 15, stone: 5 },
    description: 'Increases storage capacity', maxWorkers: 0,
    production: null, mapChar: 'S',
  },
  herb_garden: {
    type: 'herb_garden', width: 1, height: 1,
    allowedTerrain: ['grass'], cost: { wood: 3 },
    description: 'Grows herbs', maxWorkers: 1,
    production: { output: 'herbs', amountPerWorker: 2 }, mapChar: 'G',
  },
  flax_field: {
    type: 'flax_field', width: 2, height: 1,
    allowedTerrain: ['grass'], cost: { wood: 4 },
    description: 'Grows flax', maxWorkers: 1,
    production: { output: 'flax', amountPerWorker: 2 }, mapChar: 'X',
  },
  hemp_field: {
    type: 'hemp_field', width: 2, height: 1,
    allowedTerrain: ['grass'], cost: { wood: 4 },
    description: 'Grows hemp', maxWorkers: 1,
    production: { output: 'hemp', amountPerWorker: 2 }, mapChar: 'P',
  },
  iron_mine: {
    type: 'iron_mine', width: 1, height: 1,
    allowedTerrain: ['stone'], cost: { wood: 15, stone: 5 },
    description: 'Mines iron ore', maxWorkers: 2,
    production: { output: 'iron_ore', amountPerWorker: 1 }, mapChar: 'I',
  },
};

// --- Villager ---
export type VillagerRole = 'idle' | 'farmer' | 'woodcutter' | 'quarrier' | 'herbalist' | 'flaxer' | 'hemper' | 'miner';

export type VillagerState = 'sleeping' | 'working' | 'idle';

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
}

// --- Game State ---
export interface GameState {
  day: number;
  grid: Tile[][];
  width: number;
  height: number;
  resources: Resources;
  storageCap: number;
  buildings: Building[];
  nextBuildingId: number;
  villagers: Villager[];
  nextVillagerId: number;
}

// --- Names ---
const VILLAGER_NAMES = [
  'Edric', 'Mara', 'Aldric', 'Blythe', 'Cedric', 'Delia', 'Emory', 'Fern',
  'Gareth', 'Hilda', 'Ivo', 'Jocelyn', 'Kendrick', 'Lena', 'Magnus', 'Nell',
  'Osric', 'Petra', 'Quinn', 'Rowena', 'Silas', 'Thea', 'Ulric', 'Vera',
  'Wynn', 'Xara', 'Yoren', 'Zelda', 'Bryn', 'Cora',
];

// --- Simple seeded RNG ---
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// --- Factory: Create Villager ---
export function createVillager(id: number, x: number, y: number): Villager {
  return {
    id: `v${id}`,
    name: VILLAGER_NAMES[(id - 1) % VILLAGER_NAMES.length],
    x, y,
    role: 'idle',
    jobBuildingId: null,
    homeBuildingId: null,
    state: 'idle',
    food: 5,
    homeless: 0,
  };
}

// --- Factory: Create World ---
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

      row.push({ terrain, building: null });
    }
    grid.push(row);
  }

  const cx = Math.floor(width / 4);
  const cy = Math.floor(height / 2);
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
    day: 0,
    grid,
    width,
    height,
    resources: { wood: 50, stone: 20, food: 30, wheat: 0, iron_ore: 0, herbs: 0, flax: 0, hemp: 0 },
    storageCap: BASE_STORAGE_CAP,
    buildings: [],
    nextBuildingId: 1,
    villagers,
    nextVillagerId: placed + 1,
  };
}
