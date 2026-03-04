// Debug: use EXACT stress-report playerAI to find death cause
import {
  createWorld, createVillager, GameState, BuildingType, TICKS_PER_DAY, BUILDING_TEMPLATES, FOOD_PRIORITY,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, setPatrol, upgradeBuilding, setResearch, assaultCamp, setFormation,
} from '../simulation.js';

// Exact copy of stress-report helper functions
function canAfford(state: GameState, type: BuildingType): boolean {
  const cost = BUILDING_TEMPLATES[type].cost;
  for (const [res, amt] of Object.entries(cost)) {
    if ((state.resources[res as keyof typeof state.resources] || 0) < (amt as number)) return false;
  }
  return true;
}
function countBuildings(state: GameState, type: BuildingType): number {
  return state.buildings.filter(b => b.type === type && b.type !== 'rubble').length;
}
function countConstructed(state: GameState, type: BuildingType): number {
  return state.buildings.filter(b => b.type === type && b.constructed).length;
}
function idleVillagers(state: GameState): string[] {
  return state.villagers.filter(v => v.role === 'idle').map(v => v.id);
}
function totalFood(state: GameState): number {
  let total = 0;
  for (const { resource } of FOOD_PRIORITY) total += state.resources[resource];
  return total;
}
function isReservedTile(state: GameState, cx: number, cy: number): boolean {
  if (cy === 12 || cy === 18) { if (cx >= 12 && cx <= 18) return true; }
  if (cx === 12 || cx === 18) { if (cy >= 12 && cy <= 18) return true; }
  for (const b of state.buildings) {
    if (b.type !== 'storehouse' && b.type !== 'large_storehouse') continue;
    if (cx === b.x && cy >= b.y - 3 && cy <= b.y + 3) return true;
    if (cy === b.y + 1 && cx >= b.x - 3 && cx <= b.x + 3) return true;
  }
  return false;
}
function findBuildSpots(state: GameState, nearX: number, nearY: number, w: number, h: number, maxSpots: number = 5): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  for (let r = 1; r < 15; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = nearX + dx; const y = nearY + dy;
        let fits = true;
        for (let by = 0; by < h && fits; by++) {
          for (let bx = 0; bx < w && fits; bx++) {
            const cx = x + bx; const cy = y + by;
            if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) { fits = false; break; }
            if (!state.territory[cy][cx]) { fits = false; break; }
            const tile = state.grid[cy][cx];
            if (tile.terrain !== 'grass' || tile.building !== null) { fits = false; break; }
            if (isReservedTile(state, cx, cy)) { fits = false; break; }
          }
        }
        if (fits) { spots.push({ x, y }); if (spots.length >= maxSpots) return spots; }
      }
    }
  }
  return spots;
}
function tryBuild(state: GameState, type: BuildingType, centerX: number, centerY: number): GameState {
  if (!canAfford(state, type)) return state;
  const template = BUILDING_TEMPLATES[type];
  const spots = findBuildSpots(state, centerX, centerY, template.width, template.height);
  for (const spot of spots) {
    const prevCount = state.buildings.length;
    const newState = placeBuilding(state, type, spot.x, spot.y);
    if (newState.buildings.length > prevCount) return newState;
  }
  return state;
}

// EXACT playerAI from stress-report (with my recent changes)
function playerAI(state: GameState): GameState {
  const pop = state.villagers.length;
  const food = totalFood(state);
  const day = state.day;
  const centerX = 15;
  const centerY = 15;

  if (countBuildings(state, 'storehouse') === 0 && countBuildings(state, 'large_storehouse') === 0 && canAfford(state, 'storehouse')) {
    state = tryBuild(state, 'storehouse', centerX, centerY);
  }

  const homes = state.buildings.filter(b => ['tent', 'house', 'manor'].includes(b.type) && b.type !== 'rubble');
  const homeCapacity = homes.reduce((sum, b) => {
    const cap = b.type === 'tent' ? 1 : b.type === 'house' ? 2 : 4;
    return sum + cap;
  }, 0);
  const tentCount = homes.filter(b => b.type === 'tent').length;
  const woodReserve = day < 8 ? 8 : 18;
  if (homeCapacity <= pop && tentCount < 10 && canAfford(state, 'tent') && state.resources.wood >= woodReserve) {
    state = tryBuild(state, 'tent', centerX, centerY);
  }

  const farmCount = countBuildings(state, 'farm') + countBuildings(state, 'large_farm');
  if (farmCount === 0) state = tryBuild(state, 'farm', 13, 17);
  if (farmCount < 2 && pop >= 3 && day >= 3) state = tryBuild(state, 'farm', 13, 14);
  if (farmCount < 3 && pop >= 6) state = tryBuild(state, 'farm', 13, 16);
  if (countBuildings(state, 'woodcutter') === 0 && day >= 2) state = tryBuild(state, 'woodcutter', 17, 14);
  if (countBuildings(state, 'quarry') === 0 && day >= 3) state = tryBuild(state, 'quarry', 17, 17);
  if (day >= 5 && countBuildings(state, 'tanner') === 0) state = tryBuild(state, 'tanner', 17, 13);

  // Worker assignment
  const assignmentOrder: BuildingType[] = ['farm', 'mill', 'bakery', 'woodcutter', 'quarry', 'tanner', 'sawmill', 'research_desk', 'hemp_field', 'ropemaker', 'fletcher', 'large_farm', 'lumber_mill', 'windmill', 'kitchen'];
  for (const type of assignmentOrder) {
    for (const b of state.buildings.filter(b => b.type === type && b.constructed && b.assignedWorkers.length === 0)) {
      const idle = idleVillagers(state);
      if (idle.length === 0) break;
      state = assignVillager(state, idle[0], b.id);
    }
  }

  // Emergency food response
  const storehouseFoodCheck = state.buildings.find(b => (b.type === 'storehouse' || b.type === 'large_storehouse') && b.constructed);
  const shFood = storehouseFoodCheck ? (storehouseFoodCheck.localBuffer.food || 0) + (storehouseFoodCheck.localBuffer.wheat || 0) + (storehouseFoodCheck.localBuffer.bread || 0) : 0;
  if (shFood < pop * 5) {
    const unstaffedFarms = state.buildings.filter(b => b.type === 'farm' && b.constructed && b.assignedWorkers.length === 0);
    const nonEssentialTypes = ['quarry', 'woodcutter'];
    for (const farm of unstaffedFarms) {
      for (const nt of nonEssentialTypes) {
        const building = state.buildings.find(b => b.type === nt && b.constructed && b.assignedWorkers.length > 0);
        if (building) {
          const workerId = building.assignedWorkers[0];
          const worker = state.villagers.find(v => v.id === workerId);
          if (worker) {
            worker.jobBuildingId = null;
            worker.role = 'idle' as any;
            worker.state = 'idle';
            building.assignedWorkers = building.assignedWorkers.filter(w => w !== workerId);
            state = assignVillager(state, workerId, farm.id);
            break;
          }
        }
      }
    }
  }

  // Research
  if (!state.research.current) {
    const techOrder = ['crop_rotation', 'improved_tools', 'fortification'] as const;
    for (const tech of techOrder) {
      if (!state.research.completed.includes(tech as any) && state.research.current !== tech) {
        state = setResearch(state, tech as any);
        break;
      }
    }
  }

  return state;
}

// Setup
let state = createWorld(40, 40, 42);
for (let y = 0; y < 40; y++) {
  for (let x = 0; x < 40; x++) {
    state.fog[y][x] = true; state.territory[y][x] = true;
    state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
  }
}
state = { ...state, resources: { ...state.resources, wood: 80, stone: 30, food: 50, gold: 20 } };
state = placeBuilding(state, 'storehouse', 15, 15);
state = placeBuilding(state, 'tent', 14, 14);
state = {
  ...state,
  buildings: state.buildings.map(b => ({
    ...b, constructed: true, constructionProgress: b.constructionRequired,
    localBuffer: b.type === 'storehouse' ? { food: 50, wood: 80, stone: 30, gold: 20 } : b.localBuffer,
  })),
  grid: state.grid.map(row => row.map(tile =>
    tile.building ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } } : tile
  )),
};
const sv1 = createVillager(1, 15, 15); sv1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id; sv1.food = 8;
const sv2 = createVillager(2, 15, 15); sv2.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id; sv2.food = 8;
const sv3 = createVillager(3, 15, 15); sv3.food = 8;
state = { ...state, villagers: [sv1, sv2, sv3], nextVillagerId: 4 };

// Initial AI call (same as stress-report)
const origLog = console.log;
console.log = (...args: any[]) => {};
state = playerAI(state);
console.log = origLog;

// Run with diagnostics
for (let day = 0; day < 10; day++) {
  const prevGraveyardLen = state.graveyard.length;
  const prevVillagers = state.villagers.map(v => v.id);

  console.log = (...args: any[]) => {};
  state = playerAI(state);
  console.log = origLog;

  for (let t = 0; t < TICKS_PER_DAY; t++) {
    const snap = state.villagers.map(v => ({ id: v.id, hp: v.hp, food: v.food, morale: v.morale, homeless: v.homeless }));
    console.log = (...args: any[]) => {};
    state = tick(state);
    console.log = origLog;

    for (const s of snap) {
      const cv = state.villagers.find(v => v.id === s.id);
      if (!cv) {
        const ng = state.graveyard.slice(prevGraveyardLen);
        console.log(`Day ${day} tick ${t}: ${s.id} GONE! hp=${s.hp} food=${s.food.toFixed(1)} morale=${s.morale} homeless=${s.homeless}`);
        if (ng.length > 0) console.log(`  Graveyard: ${ng.map(g => `${g.name}(d${g.day})`).join(', ')}`);
        console.log(`  Events: ${state.events.join('; ')}`);
      }
    }
  }

  const lost = prevVillagers.filter(id => !state.villagers.some(v => v.id === id));
  console.log(`After day ${state.day}: pop=${state.villagers.length}${lost.length > 0 ? ' LOST: ' + lost.join(', ') : ''}`);
  for (const v of state.villagers) {
    console.log(`  ${v.name} hp=${v.hp} food=${v.food.toFixed(1)} morale=${v.morale} role=${v.role} homeless=${v.homeless}`);
  }
}
