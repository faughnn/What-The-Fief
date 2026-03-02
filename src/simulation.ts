// simulation.ts — All game rules. Pure functions: old state in, new state out.

import {
  GameState, BuildingType, Building, Resources,
  BUILDING_TEMPLATES, Tile,
} from './world.js';

// --- State Validation ---
export function validateState(state: GameState): string[] {
  const errors: string[] = [];

  // No negative resources
  for (const [key, val] of Object.entries(state.resources)) {
    if (val < 0) {
      errors.push(`ERROR: Negative resource ${key}=${val}`);
    }
  }

  // Grid dimensions match
  if (state.grid.length !== state.height) {
    errors.push(`ERROR: Grid height ${state.grid.length} != state.height ${state.height}`);
  }
  for (let y = 0; y < state.grid.length; y++) {
    if (state.grid[y].length !== state.width) {
      errors.push(`ERROR: Grid row ${y} width ${state.grid[y].length} != state.width ${state.width}`);
    }
  }

  // Population >= 0
  if (state.population < 0) {
    errors.push(`ERROR: Negative population ${state.population}`);
  }

  // No out-of-bounds buildings
  for (const b of state.buildings) {
    if (b.x < 0 || b.y < 0 || b.x + b.width > state.width || b.y + b.height > state.height) {
      errors.push(`ERROR: Building ${b.id} (${b.type}) out of bounds at (${b.x},${b.y}) size ${b.width}x${b.height}`);
    }
  }

  // No overlapping buildings
  for (let i = 0; i < state.buildings.length; i++) {
    for (let j = i + 1; j < state.buildings.length; j++) {
      const a = state.buildings[i];
      const b = state.buildings[j];
      if (buildingsOverlap(a, b)) {
        errors.push(`ERROR: Buildings ${a.id} (${a.type}) and ${b.id} (${b.type}) overlap`);
      }
    }
  }

  return errors;
}

function buildingsOverlap(a: Building, b: Building): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
           a.y + a.height <= b.y || b.y + b.height <= a.y);
}

// --- Tick ---
export function tick(state: GameState): GameState {
  // Phase 1: just advance the day and validate
  const newState: GameState = {
    ...state,
    day: state.day + 1,
  };

  // Run invariant checks — print errors to stdout
  const errors = validateState(newState);
  for (const err of errors) {
    console.log(err);
  }

  return newState;
}

// --- Building Placement ---
export function placeBuilding(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
): GameState {
  const template = BUILDING_TEMPLATES[type];
  if (!template) {
    console.log(`ERROR: Unknown building type '${type}'`);
    return state;
  }

  const { width: bw, height: bh } = template;

  // Bounds check
  if (x < 0 || y < 0 || x + bw > state.width || y + bh > state.height) {
    console.log(`ERROR: Building ${type} at (${x},${y}) would be out of bounds`);
    return state;
  }

  // Terrain check
  for (let dy = 0; dy < bh; dy++) {
    for (let dx = 0; dx < bw; dx++) {
      const tile = state.grid[y + dy][x + dx];
      if (!template.allowedTerrain.includes(tile.terrain)) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — tile (${x + dx},${y + dy}) is ${tile.terrain}, needs ${template.allowedTerrain.join('/')}`);
        return state;
      }
      if (tile.building !== null) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — tile (${x + dx},${y + dy}) already has building ${tile.building.id}`);
        return state;
      }
    }
  }

  // Resource check
  const cost = template.cost;
  const newResources: Resources = { ...state.resources };
  for (const [res, amount] of Object.entries(cost)) {
    const key = res as keyof Resources;
    if (newResources[key] < (amount as number)) {
      console.log(`ERROR: Cannot place ${type} — need ${amount} ${res}, have ${newResources[key]}`);
      return state;
    }
    newResources[key] -= amount as number;
  }

  // Create building
  const building: Building = {
    id: `b${state.nextBuildingId}`,
    type,
    x, y,
    width: bw,
    height: bh,
    assignedWorkers: [],
  };

  // Update grid — stamp building onto tiles
  const newGrid: Tile[][] = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      if (gx >= x && gx < x + bw && gy >= y && gy < y + bh) {
        return { ...tile, building };
      }
      return tile;
    })
  );

  return {
    ...state,
    grid: newGrid,
    resources: newResources,
    buildings: [...state.buildings, building],
    nextBuildingId: state.nextBuildingId + 1,
  };
}
