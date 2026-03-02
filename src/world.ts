// world.ts — Pure data types and factory functions. NO logic.

// --- Terrain ---
export type Terrain = 'grass' | 'forest' | 'water' | 'stone';

// --- Tile ---
export interface Tile {
  terrain: Terrain;
  building: Building | null;
}

// --- Building ---
export type BuildingType = 'house' | 'farm' | 'woodcutter' | 'quarry' | 'storehouse';

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedWorkers: string[];
}

export interface BuildingTemplate {
  type: BuildingType;
  width: number;
  height: number;
  allowedTerrain: Terrain[];
  cost: Partial<Resources>;
  description: string;
  maxWorkers: number;
}

// --- Resources ---
export interface Resources {
  wood: number;
  stone: number;
  food: number;
}

// --- Villager ---
export type VillagerRole = 'idle' | 'farmer' | 'woodcutter' | 'quarrier';

export type VillagerState =
  | 'sleeping'
  | 'walking_to_work'
  | 'working'
  | 'walking_home'
  | 'eating'
  | 'idle';

export interface Villager {
  id: string;
  name: string;
  x: number;
  y: number;
  destX: number | null;
  destY: number | null;
  path: { x: number; y: number }[];
  role: VillagerRole;
  jobBuildingId: string | null;
  homeBuildingId: string | null;
  state: VillagerState;
  food: number;       // 0-10, personal food reserve / satiation
  homeless: number;   // consecutive days without a house
}

// --- Game State ---
export interface GameState {
  day: number;
  grid: Tile[][];
  width: number;
  height: number;
  resources: Resources;
  buildings: Building[];
  nextBuildingId: number;
  villagers: Villager[];
  nextVillagerId: number;
}

// --- Building Templates ---
export const BUILDING_TEMPLATES: Record<BuildingType, BuildingTemplate> = {
  house: {
    type: 'house',
    width: 1, height: 1,
    allowedTerrain: ['grass'],
    cost: { wood: 10 },
    description: 'Shelter for villagers',
    maxWorkers: 0,
  },
  farm: {
    type: 'farm',
    width: 2, height: 2,
    allowedTerrain: ['grass'],
    cost: { wood: 5 },
    description: 'Produces food',
    maxWorkers: 2,
  },
  woodcutter: {
    type: 'woodcutter',
    width: 1, height: 1,
    allowedTerrain: ['grass', 'forest'],
    cost: { wood: 5 },
    description: 'Harvests wood from nearby forests',
    maxWorkers: 1,
  },
  quarry: {
    type: 'quarry',
    width: 2, height: 2,
    allowedTerrain: ['stone', 'grass'],
    cost: { wood: 10 },
    description: 'Extracts stone',
    maxWorkers: 2,
  },
  storehouse: {
    type: 'storehouse',
    width: 2, height: 1,
    allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 5 },
    description: 'Increases storage capacity',
    maxWorkers: 0,
  },
};

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
    destX: null, destY: null,
    path: [],
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

      // River with ford crossings every ~4 rows
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

  // Find 3 grass tiles near the center for starting villagers
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
    resources: { wood: 50, stone: 20, food: 30 },
    buildings: [],
    nextBuildingId: 1,
    villagers,
    nextVillagerId: placed + 1,
  };
}
