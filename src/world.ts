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
}

// --- Resources ---
export interface Resources {
  wood: number;
  stone: number;
  food: number;
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
  population: number;
}

// --- Building Templates ---
export const BUILDING_TEMPLATES: Record<BuildingType, BuildingTemplate> = {
  house: {
    type: 'house',
    width: 1, height: 1,
    allowedTerrain: ['grass'],
    cost: { wood: 10 },
    description: 'Shelter for villagers',
  },
  farm: {
    type: 'farm',
    width: 2, height: 2,
    allowedTerrain: ['grass'],
    cost: { wood: 5 },
    description: 'Produces food',
  },
  woodcutter: {
    type: 'woodcutter',
    width: 1, height: 1,
    allowedTerrain: ['grass', 'forest'],
    cost: { wood: 5 },
    description: 'Harvests wood from nearby forests',
  },
  quarry: {
    type: 'quarry',
    width: 2, height: 2,
    allowedTerrain: ['stone', 'grass'],
    cost: { wood: 10 },
    description: 'Extracts stone',
  },
  storehouse: {
    type: 'storehouse',
    width: 2, height: 1,
    allowedTerrain: ['grass'],
    cost: { wood: 15, stone: 5 },
    description: 'Increases storage capacity',
  },
};

// --- Simple seeded RNG ---
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// --- Factory ---
export function createWorld(width: number, height: number, seed: number = 42): GameState {
  const rng = seededRng(seed);

  // Generate terrain
  const grid: Tile[][] = [];

  // River column range (2 adjacent columns somewhere in the middle third)
  const riverStart = Math.floor(width / 3) + Math.floor(rng() * Math.floor(width / 3));

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      let terrain: Terrain = 'grass';

      // Water: river
      if (x === riverStart || x === riverStart + 1) {
        terrain = 'water';
      }
      // Forest: clusters
      else if (rng() < 0.15) {
        terrain = 'forest';
      }
      // Stone: small patches
      else if (rng() < 0.05) {
        terrain = 'stone';
      }

      row.push({ terrain, building: null });
    }
    grid.push(row);
  }

  return {
    day: 0,
    grid,
    width,
    height,
    resources: { wood: 50, stone: 20, food: 30 },
    buildings: [],
    nextBuildingId: 1,
    population: 3,
  };
}
