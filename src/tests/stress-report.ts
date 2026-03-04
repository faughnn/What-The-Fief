// stress-report.ts — Detailed 100-day simulation with player AI
// Simulates a real Bellwright player making decisions each day.

import {
  createWorld, createVillager, GameState, Building, BuildingType,
  TICKS_PER_DAY, BUILDING_TEMPLATES, FOOD_PRIORITY,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, setPatrol, upgradeBuilding, setResearch, assaultCamp, setFormation,
} from '../simulation.js';

// ================================================================
// PLAYER AI — makes decisions like a real Bellwright player
// ================================================================

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

// Reserved tiles — keep clear for roads and perimeter defense
function isReservedTile(state: GameState, cx: number, cy: number): boolean {
  // Perimeter zone: (12,12)-(18,18) edges reserved for walls/fences
  if (cy === 12 || cy === 18) { if (cx >= 12 && cx <= 18) return true; }
  if (cx === 12 || cx === 18) { if (cy >= 12 && cy <= 18) return true; }
  // Road corridors to storehouse
  for (const b of state.buildings) {
    if (b.type !== 'storehouse' && b.type !== 'large_storehouse') continue;
    if (cx === b.x && cy >= b.y - 3 && cy <= b.y + 3) return true;
    if (cy === b.y + 1 && cx >= b.x - 3 && cx <= b.x + 3) return true;
  }
  return false;
}

// Find clear grass tiles near the colony center for building (returns multiple candidates)
function findBuildSpots(state: GameState, nearX: number, nearY: number, w: number, h: number, maxSpots: number = 5): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  for (let r = 1; r < 15; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only perimeter
        const x = nearX + dx;
        const y = nearY + dy;
        let fits = true;
        for (let by = 0; by < h && fits; by++) {
          for (let bx = 0; bx < w && fits; bx++) {
            const cx = x + bx;
            const cy = y + by;
            if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) { fits = false; break; }
            if (!state.territory[cy][cx]) { fits = false; break; }
            const tile = state.grid[cy][cx];
            if (tile.terrain !== 'grass' || tile.building !== null) { fits = false; break; }
            if (isReservedTile(state, cx, cy)) { fits = false; break; }
          }
        }
        if (fits) {
          spots.push({ x, y });
          if (spots.length >= maxSpots) return spots;
        }
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
    if (newState.buildings.length > prevCount) return newState; // Placement succeeded
  }
  return state;
}

function tryAssignIdle(state: GameState, buildingType: BuildingType): GameState {
  const idle = idleVillagers(state);
  if (idle.length === 0) return state;
  const building = state.buildings.find(b => b.type === buildingType && b.constructed && b.assignedWorkers.length === 0);
  if (!building) return state;
  return assignVillager(state, idle[0], building.id);
}

function playerAI(state: GameState): GameState {
  const pop = state.villagers.length;
  const food = totalFood(state);
  const day = state.day;
  const centerX = 15;
  const centerY = 15;

  // --- CRITICAL: Rebuild storehouse if destroyed (highest priority) ---
  if (countBuildings(state, 'storehouse') === 0 && countBuildings(state, 'large_storehouse') === 0 && canAfford(state, 'storehouse')) {
    state = tryBuild(state, 'storehouse', centerX, centerY);
  }

  // --- HOUSING: build ahead of demand, cap at 10 tents max ---
  const homes = state.buildings.filter(b => ['tent', 'house', 'manor'].includes(b.type) && b.type !== 'rubble');
  const homeCapacity = homes.reduce((sum, b) => {
    const cap = b.type === 'tent' ? 1 : b.type === 'house' ? 2 : 4;
    return sum + cap;
  }, 0);
  const tentCount = homes.filter(b => b.type === 'tent').length;
  // Build 1 tent ahead of current pop so immigration has housing ready
  const woodReserve = day < 8 ? 8 : 18;
  if (homeCapacity <= pop && tentCount < 10 && canAfford(state, 'tent') && state.resources.wood >= woodReserve) {
    state = tryBuild(state, 'tent', centerX, centerY);
  }

  // --- BUILD infrastructure (all inside perimeter 13-17) ---
  const farmCount = countBuildings(state, 'farm') + countBuildings(state, 'large_farm');
  // Farms — always maintain at least 1
  if (farmCount === 0) {
    state = tryBuild(state, 'farm', 13, 17);
  }
  if (farmCount < 2 && pop >= 3 && day >= 3) {
    state = tryBuild(state, 'farm', 13, 14);
  }
  if (farmCount < 3 && pop >= 6) {
    state = tryBuild(state, 'farm', 13, 16);
  }
  // Resources (placed inside perimeter)
  if (countBuildings(state, 'woodcutter') === 0 && day >= 2) {
    state = tryBuild(state, 'woodcutter', 17, 14);
  }
  if (countBuildings(state, 'quarry') === 0 && day >= 3) {
    state = tryBuild(state, 'quarry', 17, 17);
  }
  // Tanner early — need leather for clothing before winter
  if (day >= 5 && countBuildings(state, 'tanner') === 0) {
    state = tryBuild(state, 'tanner', 17, 13);
  }
  // Second woodcutter — only when pop can afford the extra worker slot
  if (day >= 15 && countBuildings(state, 'woodcutter') < 2 && pop >= 12) {
    state = tryBuild(state, 'woodcutter', 14, 17);
  }
  // Sawmill — PRIORITY, needed for planks (upgrades, windmill, etc.)
  if (day >= 8 && countBuildings(state, 'sawmill') === 0 && canAfford(state, 'sawmill')) {
    state = tryBuild(state, 'sawmill', 16, 17);
  }
  // Research desk — high priority (costs wood:10 stone:5)
  if (day >= 9 && countBuildings(state, 'research_desk') === 0 && canAfford(state, 'research_desk')) {
    state = tryBuild(state, 'research_desk', 14, 14);
  }
  // Mill (wheat→flour) — build before fencing
  if (day >= 10 && countBuildings(state, 'mill') === 0 && state.resources.wheat > 15) {
    state = tryBuild(state, 'mill', 16, 14);
  }
  // Tavern for morale — lower priority than economy buildings
  if (day >= 15 && countBuildings(state, 'tavern') === 0) {
    state = tryBuild(state, 'tavern', 14, 13);
  }
  // Bakery (flour→bread) once mill is constructed
  if (day >= 15 && countBuildings(state, 'bakery') === 0 && countConstructed(state, 'mill') > 0) {
    state = tryBuild(state, 'bakery', 16, 16);
  }
  // Well
  if (day >= 10 && countBuildings(state, 'well') === 0) {
    state = tryBuild(state, 'well', centerX, centerY + 2);
  }
  // Watchtower
  if (day >= 18 && countBuildings(state, 'watchtower') === 0 && canAfford(state, 'watchtower')) {
    state = tryBuild(state, 'watchtower', 13, 13);
  }
  // Weapon production chain: hemp_field → ropemaker → fletcher (bows for guards)
  // Only when population can afford the extra workers (3 workers needed)
  if (day >= 20 && pop >= 12 && countBuildings(state, 'hemp_field') === 0) {
    state = tryBuild(state, 'hemp_field', 14, 16);
  }
  if (day >= 22 && pop >= 12 && countBuildings(state, 'ropemaker') === 0 && countConstructed(state, 'hemp_field') > 0) {
    state = tryBuild(state, 'ropemaker', 16, 13);
  }
  if (day >= 25 && pop >= 12 && countBuildings(state, 'fletcher') === 0 && countConstructed(state, 'ropemaker') > 0) {
    state = tryBuild(state, 'fletcher', 17, 16);
  }

  // --- WORKER ASSIGNMENT: spread workers across buildings ---
  // Keep 1 idle for construction IF there are unconstructed buildings, otherwise assign all
  const hasUnconstructed = state.buildings.some(b => !b.constructed && b.type !== 'rubble');
  const minIdle = hasUnconstructed ? 1 : 0;
  const assignmentOrder: BuildingType[] = ['farm', 'woodcutter', 'quarry', 'tanner', 'sawmill', 'research_desk', 'mill', 'bakery', 'hemp_field', 'ropemaker', 'fletcher', 'large_farm', 'lumber_mill'];
  for (const type of assignmentOrder) {
    for (const b of state.buildings.filter(b => b.type === type && b.constructed && b.assignedWorkers.length === 0)) {
      const idle = idleVillagers(state);
      if (idle.length <= minIdle) break;
      state = assignVillager(state, idle[0], b.id);
    }
  }
  // Second pass: fill farms to 2 workers only when pop is very high (>= 14)
  if (pop >= 14) {
    for (const farm of state.buildings.filter(b => (b.type === 'farm' || b.type === 'large_farm') && b.constructed && b.assignedWorkers.length < BUILDING_TEMPLATES[b.type].maxWorkers)) {
      const idle = idleVillagers(state);
      if (idle.length <= 2) break;
      state = assignVillager(state, idle[0], farm.id);
    }
  }

  // Emergency food response: if storehouse food+wheat is low, reassign non-essential workers to farms
  const storehouseFoodCheck = state.buildings.find(b => (b.type === 'storehouse' || b.type === 'large_storehouse') && b.constructed);
  const shFood = storehouseFoodCheck ? (storehouseFoodCheck.localBuffer.food || 0) + (storehouseFoodCheck.localBuffer.wheat || 0) + (storehouseFoodCheck.localBuffer.bread || 0) : 0;
  if (shFood < pop * 5) {
    // Reassign quarry/woodcutter workers to unstaffed farms
    const unstaffedFarms = state.buildings.filter(b => b.type === 'farm' && b.constructed && b.assignedWorkers.length === 0);
    const nonEssentialTypes = ['quarry', 'woodcutter'];
    for (const farm of unstaffedFarms) {
      for (const nt of nonEssentialTypes) {
        const building = state.buildings.find(b => b.type === nt && b.constructed && b.assignedWorkers.length > 0);
        if (building) {
          const workerId = building.assignedWorkers[0];
          // Unassign from current job
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

  // --- DEFENSE: fence perimeter once economy is established ---
  if (day >= 15 && pop >= 5) {
    const gatePositions = new Set(['12,15', '18,15', '15,12', '15,18']);
    const perimeterSpots: { x: number; y: number }[] = [];
    // Build perimeter evenly: alternate sides for balanced coverage
    // North wall: y=12, x=12-18
    for (let x = 12; x <= 18; x++) perimeterSpots.push({ x, y: 12 });
    // South wall: y=18, x=12-18
    for (let x = 12; x <= 18; x++) perimeterSpots.push({ x, y: 18 });
    // West wall: x=12, y=13-17
    for (let y = 13; y <= 17; y++) if (!gatePositions.has(`12,${y}`)) perimeterSpots.push({ x: 12, y });
    // East wall: x=18, y=13-17
    for (let y = 13; y <= 17; y++) if (!gatePositions.has(`18,${y}`)) perimeterSpots.push({ x: 18, y });

    // Phase 1: Fences (instant-build, cheap wood) for immediate protection
    for (const spot of perimeterSpots) {
      if (gatePositions.has(`${spot.x},${spot.y}`)) continue; // Skip gate positions
      if (spot.y >= state.height || spot.x >= state.width) continue;
      const tile = state.grid[spot.y][spot.x];
      if (tile.terrain !== 'grass' || tile.building || !state.territory[spot.y][spot.x]) continue;
      if (!canAfford(state, 'fence')) continue;
      state = placeBuilding(state, 'fence', spot.x, spot.y);
    }

    // Place gates at designated positions
    for (const key of gatePositions) {
      const [gx, gy] = key.split(',').map(Number);
      if (gy >= state.height || gx >= state.width) continue;
      const tile = state.grid[gy][gx];
      if (!tile.building && tile.terrain === 'grass' && state.territory[gy][gx]) {
        if (canAfford(state, 'gate')) {
          state = placeBuilding(state, 'gate', gx, gy);
        }
      }
    }

    // Guards: always maintain 2 guards once pop >= 5 (need 2 for even level 1 raid with 2 bandits)
    // At low pop (3-4), maintain 1 guard
    const currentGuards = state.villagers.filter(v => v.role === 'guard').length;
    const needGuards = pop >= 5 ? 2 : (pop >= 3 ? 1 : 0);
    if (currentGuards < needGuards) {
      // First try idle villagers
      let idle = state.villagers.filter(v => v.role === 'idle' && v.homeBuildingId);
      for (const v of idle) {
        if (state.villagers.filter(v2 => v2.role === 'guard').length >= needGuards) break;
        state = setGuard(state, v.id);
      }
      // If still not enough guards and pop >= 4, reassign a non-essential worker
      if (state.villagers.filter(v => v.role === 'guard').length < needGuards && pop >= 4) {
        const workers = state.villagers.filter(v =>
          v.role !== 'guard' && v.role !== 'idle' && v.homeBuildingId
        );
        // Prefer reassigning from less critical jobs (quarrier, sawyer)
        const reassignOrder: string[] = ['quarrier', 'woodcutter'];
        for (const role of reassignOrder) {
          const w = workers.find(v => v.role === role);
          if (w && state.villagers.filter(v2 => v2.role === 'guard').length < needGuards) {
            state = setGuard(state, w.id);
          }
        }
      }
    }
  }

  // Set formations: bow guards → back line, melee guards → front line charge
  for (const g of state.villagers.filter(v => v.role === 'guard')) {
    if (g.weapon === 'bow' && (g.guardLine !== 'back' || g.guardMode !== 'patrol')) {
      state = setFormation(state, g.id, 'patrol', 'back');
    } else if (g.weapon !== 'bow' && g.guardMode !== 'charge') {
      state = setFormation(state, g.id, 'charge', 'front');
    }
  }

  // Assign guard to watchtower
  const tower = state.buildings.find(b => b.type === 'watchtower' && b.constructed && b.assignedWorkers.length === 0);
  if (tower) {
    const guards = state.villagers.filter(v => v.role === 'guard' && !v.jobBuildingId);
    if (guards.length > 0) {
      state = assignVillager(state, guards[0].id, tower.id);
    }
  }

  // --- ASSAULT BANDIT CAMPS: send 2 guards together to attack weak camps ---
  const allGuards = state.villagers.filter(v => v.role === 'guard' && v.hp > 0);
  if (allGuards.length >= 2 && state.enemies.length === 0 && state.banditCamps.length > 0) {
    const freeGuards = allGuards.filter(v =>
      v.hp >= v.maxHp && !v.assaultTargetId && !v.jobBuildingId
    );
    // Only assault when 2+ free guards at full HP and camp strength is manageable
    const weakestCamp = [...state.banditCamps].sort((a, b) => a.hp - b.hp)[0];
    const campDmgPerTick = Math.max(1, Math.floor(weakestCamp.strength * 1.5));
    const guardSurvivalTicks = Math.floor(freeGuards[0]?.maxHp / campDmgPerTick) || 0;
    if (freeGuards.length >= 2 && guardSurvivalTicks >= 5) {
      state = assaultCamp(state, freeGuards[0].id, weakestCamp.id);
      state = assaultCamp(state, freeGuards[1].id, weakestCamp.id);
    }
  }

  // --- ECONOMY DEPTH: production chains + building upgrades ---

  // Research — always queue tech if not researching (even before desk is built)
  if (!state.research.current) {
    const techOrder = ['crop_rotation', 'improved_tools', 'fortification', 'basic_cooking', 'masonry', 'advanced_farming', 'civil_engineering', 'military_tactics', 'archery'] as const;
    for (const tech of techOrder) {
      if (!state.research.completed.includes(tech as any) && state.research.current !== tech) {
        state = setResearch(state, tech as any);
        break;
      }
    }
  }

  // Building upgrades — upgrade key buildings when resources permit
  if (day >= 30 && state.resources.planks >= 10) {
    const smallFarm = state.buildings.find(b => b.type === 'farm' && b.constructed);
    if (smallFarm && state.resources.wood >= 10 && state.resources.planks >= 5) {
      state = upgradeBuilding(state, smallFarm.id);
    }
  }
  if (day >= 40 && state.resources.planks >= 15) {
    const saw = state.buildings.find(b => b.type === 'sawmill' && b.constructed);
    if (saw) state = upgradeBuilding(state, saw.id);
  }

  // --- ONGOING: reactive decisions ---
  // Emergency tribute
  if (state.banditUltimatum && state.resources.gold >= state.banditUltimatum.goldDemand) {
    if (state.villagers.filter(v => v.role === 'guard').length < 2) {
      const { payTribute } = require('../simulation.js');
      state = payTribute(state);
    }
  }

  return state;
}

// ================================================================
// SIMULATION SETUP
// ================================================================

// Capture ERROR: lines
const errorLines: string[] = [];
const origLog = console.log;
console.log = function (...args: any[]) {
  const msg = args.join(' ');
  if (msg.startsWith('ERROR:')) errorLines.push(msg);
};

// Setup — small starting colony (like starting a Bellwright game)
let state = createWorld(40, 40, 42);
// Make entire map grass/territory/fog so settlers from any edge can walk in
for (let y = 0; y < 40; y++) {
  for (let x = 0; x < 40; x++) {
    state.fog[y][x] = true;
    state.territory[y][x] = true;
    state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
  }
}
// Modest starting resources (like early Bellwright)
state = { ...state, resources: { ...state.resources, wood: 80, stone: 30, food: 50, gold: 20 } };

// Place initial storehouse and tent
state = placeBuilding(state, 'storehouse', 15, 15);
state = placeBuilding(state, 'tent', 14, 14);

// Pre-construct starting buildings
state = {
  ...state,
  buildings: state.buildings.map(b => ({
    ...b, constructed: true, constructionProgress: b.constructionRequired,
    localBuffer: b.type === 'storehouse' ? { food: 50, wood: 80, stone: 30, gold: 20 } : b.localBuffer,
  })),
  grid: state.grid.map(row => row.map(tile =>
    tile.building
      ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
      : tile
  )),
};

// Start with 3 villagers at the storehouse
const v1 = createVillager(1, 15, 15);
v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
v1.food = 8;
const v2 = createVillager(2, 15, 15);
v2.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
v2.food = 8;
const v3 = createVillager(3, 15, 15);
v3.food = 8; // homeless initially — AI will build housing
state = { ...state, villagers: [v1, v2, v3], nextVillagerId: 4 };

// Player AI makes initial decisions
state = playerAI(state);

// Restore console for report output
console.log = origLog;

// ================================================================
// RUN SIMULATION WITH PLAYER AI
// ================================================================

interface DaySnapshot {
  day: number;
  season: string;
  weather: string;
  villagers: number;
  buildings: number;
  raidLevel: number;
  raidBar: number;
  prosperity: number;
  resources: { wood: number; stone: number; food: number; wheat: number; gold: number };
  events: string[];
  graveyard: number;
  deaths: string[];
  newVillagers: string[];
  sick: number;
  onFire: number;
  activeRaid: boolean;
  enemies: number;
  caravans: number;
  guards: number;
  playerActions: string[];
  storehouseBuf: Record<string, number>;
  villagersHungry: string[];
  disappeared: string[];
}

const snapshots: DaySnapshot[] = [];
let prevVillagerIds = new Set(state.villagers.map(v => v.id));
let prevVillagerNames = new Map(state.villagers.map(v => [v.id, v.name]));
let prevGraveyardLen = 0;
let prevBuildingCount = state.buildings.filter(b => b.type !== 'rubble').length;

// Override console.log again for simulation
console.log = function (...args: any[]) {
  const msg = args.join(' ');
  if (msg.startsWith('ERROR:')) errorLines.push(msg);
};

for (let day = 0; day < 100; day++) {
  const playerActions: string[] = [];

  // Player AI acts at start of each day (suppress expected placement errors)
  const preErrors = errorLines.length;
  const preBuildCount = state.buildings.filter(b => b.type !== 'rubble').length;
  const preGuardCount = state.villagers.filter(v => v.role === 'guard').length;
  state = playerAI(state);
  errorLines.length = preErrors; // Discard playerAI placement failures
  const postBuildCount = state.buildings.filter(b => b.type !== 'rubble').length;
  const postGuardCount = state.villagers.filter(v => v.role === 'guard').length;
  if (postBuildCount > preBuildCount) {
    const newBuildings = state.buildings
      .filter(b => b.type !== 'rubble')
      .slice(-( postBuildCount - preBuildCount))
      .map(b => b.type);
    playerActions.push(`Built: ${newBuildings.join(', ')}`);
  }
  if (postGuardCount > preGuardCount) {
    playerActions.push(`Assigned ${postGuardCount - preGuardCount} guard(s)`);
  }

  // Run one full day of ticks
  for (let t = 0; t < TICKS_PER_DAY; t++) {
    state = tick(state);
  }

  // Detect changes
  const currentIds = new Set(state.villagers.map(v => v.id));
  const newVillagers = state.villagers
    .filter(v => !prevVillagerIds.has(v.id))
    .map(v => `${v.name} (${v.role})`);
  const newDeaths = state.graveyard.slice(prevGraveyardLen).map(g => g.name);
  const newDeathIds = new Set(state.graveyard.slice(prevGraveyardLen).map(g => g.name));
  // Detect silent departures: in prev but not current and not newly dead
  const disappeared: string[] = [];
  for (const [id, name] of prevVillagerNames) {
    if (!currentIds.has(id) && !newDeathIds.has(name)) {
      disappeared.push(name);
    }
  }
  const buildingDelta = state.buildings.filter(b => b.type !== 'rubble').length - prevBuildingCount;

  snapshots.push({
    day: state.day,
    season: state.season,
    weather: state.weather,
    villagers: state.villagers.length,
    buildings: state.buildings.filter(b => b.type !== 'rubble').length,
    raidLevel: state.raidLevel,
    raidBar: Math.round(state.raidBar),
    prosperity: Math.round(state.prosperity),
    resources: {
      wood: state.resources.wood,
      stone: state.resources.stone,
      food: state.resources.food,
      wheat: state.resources.wheat || 0,
      gold: state.resources.gold,
    },
    events: [...state.events],
    graveyard: state.graveyard.length,
    deaths: newDeaths,
    newVillagers,
    sick: state.villagers.filter(v => v.sick).length,
    onFire: state.buildings.filter(b => b.onFire).length,
    activeRaid: state.activeRaid !== null,
    enemies: state.enemies.length,
    caravans: state.caravans.length,
    guards: state.villagers.filter(v => v.role === 'guard').length,
    playerActions,
    storehouseBuf: (() => {
      const sh = state.buildings.find(b => (b.type === 'storehouse' || b.type === 'large_storehouse') && b.constructed);
      if (!sh) return {};
      const buf: Record<string, number> = {};
      for (const [k, v] of Object.entries(sh.localBuffer)) { if (v && v > 0) buf[k] = v; }
      return buf;
    })(),
    villagersHungry: state.villagers.filter(v => v.food <= 2).map(v => `${v.name}(f=${v.food.toFixed(1)},s=${v.state})`),
    disappeared,
    camps: state.banditCamps.length,
  } as any);

  prevVillagerIds = currentIds;
  prevVillagerNames = new Map(state.villagers.map(v => [v.id, v.name]));
  prevGraveyardLen = state.graveyard.length;
  prevBuildingCount = state.buildings.filter(b => b.type !== 'rubble').length;
}

// Restore console
console.log = origLog;

// ================================================================
// PRINT REPORT
// ================================================================
console.log('='.repeat(70));
console.log('  COLONYSIM — 100-DAY SIMULATION WITH PLAYER AI');
console.log('='.repeat(70));
console.log();

for (const s of snapshots) {
  const notable = s.deaths.length > 0 || s.newVillagers.length > 0 || s.events.length > 0
    || s.activeRaid || s.sick > 0 || s.onFire > 0 || s.enemies > 0
    || s.caravans > 0 || s.playerActions.length > 0
    || s.disappeared.length > 0 || s.villagersHungry.length > 0
    || s.day % 10 === 0 || s.day === 99;

  if (!notable) continue;

  console.log(`--- Day ${s.day} | ${s.season} | ${s.weather} ---`);
  console.log(`  Pop: ${s.villagers} (${s.guards} guards) | Buildings: ${s.buildings} | Prosperity: ${s.prosperity}`);
  console.log(`  Resources: wood=${s.resources.wood} stone=${s.resources.stone} food=${s.resources.food} wheat=${s.resources.wheat} gold=${s.resources.gold}`);
  console.log(`  Raid level: ${s.raidLevel} | Raid bar: ${s.raidBar}`);
  const bufStr = Object.entries(s.storehouseBuf).map(([k, v]) => `${k}=${v}`).join(' ');
  if (bufStr) console.log(`  Storehouse buffer: ${bufStr}`);
  if (s.villagersHungry.length > 0) console.log(`  HUNGRY: ${s.villagersHungry.join(', ')}`);

  for (const a of s.playerActions) console.log(`  [PLAYER] ${a}`);
  if (s.activeRaid) console.log(`  ** RAID IN PROGRESS **`);
  if (s.enemies > 0) console.log(`  Enemies present: ${s.enemies}`);
  // @ts-ignore — camp info added dynamically
  if (s.camps > 0) console.log(`  Bandit camps: ${s.camps}`);
  if (s.sick > 0) console.log(`  Sick: ${s.sick}`);
  if (s.onFire > 0) console.log(`  On fire: ${s.onFire} building(s)`);
  if (s.caravans > 0) console.log(`  Trade caravans: ${s.caravans}`);
  if (s.deaths.length > 0) console.log(`  Deaths: ${s.deaths.join(', ')}`);
  if (s.disappeared.length > 0) console.log(`  DISAPPEARED (no death/departure event): ${s.disappeared.join(', ')}`);
  if (s.newVillagers.length > 0) console.log(`  Arrivals: ${s.newVillagers.join(', ')}`);
  for (const e of s.events) console.log(`  Event: ${e}`);

  console.log();
}

// ================================================================
// SUMMARY
// ================================================================
console.log('='.repeat(70));
console.log('  FINAL SUMMARY');
console.log('='.repeat(70));
console.log(`  Days simulated: 100`);
console.log(`  Final population: ${state.villagers.length}`);
console.log(`  Total deaths: ${state.graveyard.length}`);
console.log(`  Peak population: ${Math.max(...snapshots.map(s => s.villagers))}`);
console.log(`  Final raid level: ${state.raidLevel}`);
console.log(`  Final prosperity: ${Math.round(state.prosperity)}`);
console.log(`  Final resources: wood=${state.resources.wood} stone=${state.resources.stone} food=${state.resources.food} wheat=${state.resources.wheat || 0} gold=${state.resources.gold} leather=${state.resources.leather || 0} planks=${state.resources.planks || 0} rope=${state.resources.rope || 0} sword=${state.resources.sword || 0} bow=${state.resources.bow || 0}`);
console.log(`  Bandit camps: ${state.banditCamps.length} active${state.banditCamps.length > 0 ? ' at ' + state.banditCamps.map(c => `(${c.x},${c.y}) HP:${c.hp}/${c.maxHp}`).join(', ') : ''}`);
console.log(`  Research completed: ${state.research.completed.length > 0 ? state.research.completed.join(', ') : 'none'}`);
console.log(`  Research in progress: ${state.research.current || 'none'} (${state.research.progress}/${state.research.current ? 'active' : '-'})`);
console.log(`  Buildings standing: ${state.buildings.filter(b => b.type !== 'rubble').length}`);
console.log(`  Rubble piles: ${state.buildings.filter(b => b.type === 'rubble').length}`);
console.log(`  Errors: ${errorLines.length}`);
if (errorLines.length > 0) {
  console.log(`  First 5 errors:`);
  for (const e of errorLines.slice(0, 5)) console.log(`    ${e}`);
}
console.log();

// Building inventory
const typeCount: Record<string, number> = {};
for (const b of state.buildings) {
  if (b.type === 'rubble') continue;
  typeCount[b.type] = (typeCount[b.type] || 0) + 1;
}
console.log('  Building inventory:');
for (const [type, count] of Object.entries(typeCount).sort()) {
  console.log(`    ${type}: ${count}`);
}
console.log();

// Villager roster
console.log('  Villager roster:');
for (const v of state.villagers) {
  const clothed = v.clothed ? 'clothed' : 'UNCLOTHED';
  const weaponStr = v.weapon !== 'none' ? ` | weapon: ${v.weapon}(${v.weaponDurability})` : '';
  const toolStr = v.tool !== 'none' ? ` | tool: ${v.tool}` : '';
  console.log(`    ${v.name} | HP: ${v.hp}/${v.maxHp} | Role: ${v.role} | Morale: ${v.morale} | Food: ${v.food.toFixed(1)} | ${clothed}${toolStr}${weaponStr}`);
}
console.log();

// Graveyard
if (state.graveyard.length > 0) {
  console.log(`  Graveyard (${state.graveyard.length} total):`);
  for (const g of state.graveyard) {
    console.log(`    ${g.name} — died day ${g.day}`);
  }
}
