// simulation.ts — All game rules. Pure functions: old state in, new state out.

import {
  GameState, BuildingType, Building, Resources, Villager, VillagerRole,
  Tile, BUILDING_TEMPLATES, createVillager,
} from './world.js';

// --- BFS Pathfinding ---
export function findPath(
  grid: Tile[][],
  width: number,
  height: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number }[] {
  if (fromX === toX && fromY === toY) return [];

  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [];
  queue.push({ x: fromX, y: fromY, path: [] });
  visited.add(`${fromX},${fromY}`);

  const dirs = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited.has(key)) continue;
      if (grid[ny][nx].terrain === 'water') continue;
      const newPath = [...current.path, { x: nx, y: ny }];
      if (nx === toX && ny === toY) return newPath;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: newPath });
    }
  }

  return []; // unreachable
}

// --- Helpers ---
const HOUSE_CAPACITY = 2;
const MAX_COMMUTE = 20; // tiles — beyond this, villager can't work that day

function getBuildingEntrance(b: Building): { x: number; y: number } {
  return { x: b.x, y: b.y };
}

function roleForBuilding(type: BuildingType): VillagerRole {
  switch (type) {
    case 'farm': return 'farmer';
    case 'woodcutter': return 'woodcutter';
    case 'quarry': return 'quarrier';
    default: return 'idle';
  }
}

function findHome(villager: Villager, buildings: Building[], villagers: Villager[]): string | null {
  for (const b of buildings) {
    if (b.type !== 'house') continue;
    const residents = villagers.filter(v => v.homeBuildingId === b.id);
    if (residents.length < HOUSE_CAPACITY) return b.id;
  }
  return null;
}

// --- State Validation ---
export function validateState(state: GameState): string[] {
  const errors: string[] = [];

  for (const [key, val] of Object.entries(state.resources)) {
    if (val < 0) errors.push(`ERROR: Negative resource ${key}=${val}`);
  }

  if (state.grid.length !== state.height) {
    errors.push(`ERROR: Grid height ${state.grid.length} != state.height ${state.height}`);
  }
  for (let y = 0; y < state.grid.length; y++) {
    if (state.grid[y].length !== state.width) {
      errors.push(`ERROR: Grid row ${y} width ${state.grid[y].length} != state.width ${state.width}`);
    }
  }

  for (const b of state.buildings) {
    if (b.x < 0 || b.y < 0 || b.x + b.width > state.width || b.y + b.height > state.height) {
      errors.push(`ERROR: Building ${b.id} (${b.type}) out of bounds`);
    }
  }

  for (let i = 0; i < state.buildings.length; i++) {
    for (let j = i + 1; j < state.buildings.length; j++) {
      const a = state.buildings[i];
      const b = state.buildings[j];
      if (!(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)) {
        errors.push(`ERROR: Buildings ${a.id} and ${b.id} overlap`);
      }
    }
  }

  for (const v of state.villagers) {
    if (v.x < 0 || v.y < 0 || v.x >= state.width || v.y >= state.height) {
      errors.push(`ERROR: Villager ${v.id} out of bounds at (${v.x},${v.y})`);
    }
    if (v.jobBuildingId) {
      const job = state.buildings.find(b => b.id === v.jobBuildingId);
      if (!job) errors.push(`ERROR: Villager ${v.id} assigned to nonexistent building ${v.jobBuildingId}`);
    }
    if (v.homeBuildingId) {
      const home = state.buildings.find(b => b.id === v.homeBuildingId);
      if (!home) errors.push(`ERROR: Villager ${v.id} assigned to nonexistent home ${v.homeBuildingId}`);
    }
  }

  return errors;
}

// --- Tick ---
// Each tick = 1 full day. Within a day: wake → travel to work → work → eat → travel home → sleep.
// Travel is resolved instantly (path distance used as a work-time penalty in later phases).
export function tick(state: GameState): GameState {
  let villagers = state.villagers.map(v => ({ ...v, path: [...v.path] }));
  const resources: Resources = { ...state.resources };
  const buildings = state.buildings.map(b => ({ ...b, assignedWorkers: [...b.assignedWorkers] }));

  // 1. Auto-assign homeless villagers to houses
  for (const v of villagers) {
    if (!v.homeBuildingId) {
      const homeId = findHome(v, buildings, villagers);
      if (homeId) v.homeBuildingId = homeId;
    }
  }

  // 2. Day cycle for each villager: travel → work → travel home
  for (const v of villagers) {
    if (v.jobBuildingId) {
      const job = buildings.find(b => b.id === v.jobBuildingId);
      if (job) {
        const entrance = getBuildingEntrance(job);
        const pathToWork = findPath(state.grid, state.width, state.height, v.x, v.y, entrance.x, entrance.y);
        const canReach = v.x === entrance.x && v.y === entrance.y || pathToWork.length > 0;
        const commuteDist = pathToWork.length;

        if (canReach && commuteDist <= MAX_COMMUTE) {
          // Move to workplace
          v.x = entrance.x;
          v.y = entrance.y;
          v.state = 'working';

          // Produce
          switch (job.type) {
            case 'farm':
              resources.food += 3;
              break;
            case 'woodcutter':
              resources.wood += 2;
              break;
            case 'quarry':
              resources.stone += 2;
              break;
          }

          // Travel home
          if (v.homeBuildingId) {
            const home = buildings.find(b => b.id === v.homeBuildingId);
            if (home) {
              const homeEntrance = getBuildingEntrance(home);
              v.x = homeEntrance.x;
              v.y = homeEntrance.y;
              v.state = 'sleeping';
            }
          }
        } else {
          v.state = 'idle';
        }
      }
    } else {
      // No job — stay idle at current position, or go home
      if (v.homeBuildingId) {
        const home = buildings.find(b => b.id === v.homeBuildingId);
        if (home) {
          const entrance = getBuildingEntrance(home);
          v.x = entrance.x;
          v.y = entrance.y;
          v.state = 'sleeping';
        }
      } else {
        v.state = 'idle';
      }
    }
  }

  // 3. Eat — consume 1 food per villager from global storage
  for (const v of villagers) {
    if (resources.food > 0) {
      resources.food -= 1;
      v.food = Math.min(10, v.food + 1);
    } else {
      v.food -= 1;
    }
  }

  // 4. Housing check
  for (const v of villagers) {
    if (!v.homeBuildingId) {
      v.homeless += 1;
    } else {
      v.homeless = 0;
    }
  }

  // 5. Departure — starving or homeless too long
  const departing = villagers.filter(v => v.food <= 0 || v.homeless >= 5);
  for (const d of departing) {
    for (const b of buildings) {
      b.assignedWorkers = b.assignedWorkers.filter(id => id !== d.id);
    }
  }
  villagers = villagers.filter(v => v.food > 0 && v.homeless < 5);

  // 6. Immigration — if food > population*3 and there's an empty house slot
  if (resources.food > villagers.length * 3) {
    const emptyHome = findHome(
      { homeBuildingId: null } as Villager,
      buildings,
      villagers,
    );
    if (emptyHome) {
      const home = buildings.find(b => b.id === emptyHome)!;
      const entrance = getBuildingEntrance(home);
      const newV = createVillager(state.nextVillagerId, entrance.x, entrance.y);
      newV.homeBuildingId = emptyHome;
      newV.state = 'sleeping';
      villagers.push(newV);
    }
  }

  const newState: GameState = {
    ...state,
    day: state.day + 1,
    resources,
    buildings,
    villagers,
    nextVillagerId: villagers.length > state.villagers.length
      ? state.nextVillagerId + 1
      : state.nextVillagerId,
  };

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

  if (x < 0 || y < 0 || x + bw > state.width || y + bh > state.height) {
    console.log(`ERROR: Building ${type} at (${x},${y}) would be out of bounds`);
    return state;
  }

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

  const building: Building = {
    id: `b${state.nextBuildingId}`,
    type, x, y,
    width: bw, height: bh,
    assignedWorkers: [],
  };

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

// --- Assign Villager to Job ---
export function assignVillager(
  state: GameState,
  villagerId: string,
  buildingId: string,
): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) {
    console.log(`ERROR: Villager ${villagerId} not found`);
    return state;
  }

  const building = state.buildings.find(b => b.id === buildingId);
  if (!building) {
    console.log(`ERROR: Building ${buildingId} not found`);
    return state;
  }

  const template = BUILDING_TEMPLATES[building.type];
  if (template.maxWorkers === 0) {
    console.log(`ERROR: Building ${buildingId} (${building.type}) cannot have workers`);
    return state;
  }

  if (building.assignedWorkers.length >= template.maxWorkers) {
    console.log(`ERROR: Building ${buildingId} is full (${building.assignedWorkers.length}/${template.maxWorkers})`);
    return state;
  }

  const newBuildings = state.buildings.map(b => {
    if (b.assignedWorkers.includes(villagerId)) {
      return { ...b, assignedWorkers: b.assignedWorkers.filter(id => id !== villagerId) };
    }
    return b;
  });

  const targetIdx = newBuildings.findIndex(b => b.id === buildingId);
  newBuildings[targetIdx] = {
    ...newBuildings[targetIdx],
    assignedWorkers: [...newBuildings[targetIdx].assignedWorkers, villagerId],
  };

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      return {
        ...v,
        jobBuildingId: buildingId,
        role: roleForBuilding(building.type),
      };
    }
    return v;
  });

  return { ...state, buildings: newBuildings, villagers: newVillagers };
}
