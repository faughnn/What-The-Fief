// stress-report.ts — Detailed 100-day simulation with player AI
// Simulates a real Bellwright player making decisions each day.

import {
  createWorld, createVillager, GameState, Building, BuildingType,
  TICKS_PER_DAY, BUILDING_TEMPLATES, FOOD_PRIORITY,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, setPatrol,
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

// Find a clear grass tile near the colony center for building
function findBuildSpot(state: GameState, nearX: number, nearY: number, w: number, h: number): { x: number; y: number } | null {
  for (let r = 1; r < 15; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only perimeter
        const x = nearX + dx;
        const y = nearY + dy;
        // Check all tiles the building would occupy
        let fits = true;
        for (let by = 0; by < h && fits; by++) {
          for (let bx = 0; bx < w && fits; bx++) {
            const cx = x + bx;
            const cy = y + by;
            if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) { fits = false; break; }
            if (!state.territory[cy][cx]) { fits = false; break; }
            const tile = state.grid[cy][cx];
            if (tile.terrain !== 'grass' || tile.building !== null) { fits = false; break; }
          }
        }
        if (fits) return { x, y };
      }
    }
  }
  return null;
}

function tryBuild(state: GameState, type: BuildingType, centerX: number, centerY: number): GameState {
  if (!canAfford(state, type)) return state;
  const template = BUILDING_TEMPLATES[type];
  const spot = findBuildSpot(state, centerX, centerY, template.width, template.height);
  if (!spot) return state;
  return placeBuilding(state, type, spot.x, spot.y);
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

  // --- HOUSING: always ensure capacity (need headroom for immigration + guards) ---
  const homes = state.buildings.filter(b => ['tent', 'house', 'manor'].includes(b.type) && b.type !== 'rubble');
  const homeCapacity = homes.reduce((sum, b) => {
    const cap = b.type === 'tent' ? 1 : b.type === 'house' ? 2 : 4;
    return sum + cap;
  }, 0);
  // Build 1 tent if capacity is tight (at most 1 per day to avoid wood drain)
  if (homeCapacity <= pop + 1 && canAfford(state, 'tent')) {
    state = tryBuild(state, 'tent', centerX, centerY);
  }

  // --- FOOD FIRST: build farms early and assign farmers ---
  if (countBuildings(state, 'farm') === 0) {
    state = tryBuild(state, 'farm', centerX - 3, centerY);
  }
  // Build second farm early if pop > 3
  if (countBuildings(state, 'farm') < 2 && pop >= 3 && day >= 3) {
    state = tryBuild(state, 'farm', centerX - 5, centerY);
  }
  // Third farm when pop exceeds 6
  if (countBuildings(state, 'farm') < 3 && pop >= 6) {
    state = tryBuild(state, 'farm', centerX - 3, centerY + 3);
  }

  // Assign farmers FIRST — assign to ALL farms with empty slots
  for (const farm of state.buildings.filter(b => b.type === 'farm' && b.constructed)) {
    const template = BUILDING_TEMPLATES['farm'];
    while (farm.assignedWorkers.length < template.maxWorkers) {
      const idle = idleVillagers(state);
      if (idle.length === 0) break;
      state = assignVillager(state, idle[0], farm.id);
      // Re-find farm in updated state
      const updatedFarm = state.buildings.find(b => b.id === farm.id);
      if (!updatedFarm || updatedFarm.assignedWorkers.length >= template.maxWorkers) break;
    }
  }

  // --- RESOURCES: woodcutter and quarry ---
  if (countBuildings(state, 'woodcutter') === 0 && day >= 2) {
    state = tryBuild(state, 'woodcutter', centerX + 3, centerY);
  }
  if (countBuildings(state, 'quarry') === 0 && day >= 4) {
    state = tryBuild(state, 'quarry', centerX + 3, centerY + 3);
  }
  // Assign to resource buildings
  for (const type of ['woodcutter', 'quarry'] as BuildingType[]) {
    state = tryAssignIdle(state, type);
  }

  // --- DEFENSE: walls and guards (day 8+) ---
  if (day >= 8) {
    const wallCount = countBuildings(state, 'wall') + countBuildings(state, 'gate');
    if (wallCount < 8 && state.resources.stone >= 10) {
      const wallSpots = [
        { x: 11, y: 11 }, { x: 12, y: 11 }, { x: 13, y: 11 }, { x: 14, y: 11 },
        { x: 15, y: 11 }, { x: 16, y: 11 }, { x: 17, y: 11 }, { x: 18, y: 11 },
      ];
      for (const spot of wallSpots) {
        if (spot.y < state.height && spot.x < state.width) {
          const tile = state.grid[spot.y][spot.x];
          if (tile.terrain === 'grass' && !tile.building && state.territory[spot.y][spot.x]) {
            if (canAfford(state, 'wall')) {
              state = placeBuilding(state, 'wall', spot.x, spot.y);
            }
          }
        }
      }
    }
    if (countBuildings(state, 'gate') === 0 && canAfford(state, 'gate')) {
      const gateSpot = { x: 19, y: 11 };
      if (gateSpot.y < state.height && gateSpot.x < state.width) {
        const tile = state.grid[gateSpot.y][gateSpot.x];
        if (tile.terrain === 'grass' && !tile.building && state.territory[gateSpot.y][gateSpot.x]) {
          state = placeBuilding(state, 'gate', gateSpot.x, gateSpot.y);
        }
      }
    }

    // Always maintain at least 1 guard when pop >= 4 (only if they have homes)
    const guardCount = state.villagers.filter(v => v.role === 'guard').length;
    const needGuards = pop >= 7 ? 2 : (pop >= 4 ? 1 : 0);
    while (state.villagers.filter(v => v.role === 'guard').length < needGuards) {
      // Only assign guard if they have a home (otherwise they'll leave in 5 days)
      const idle = state.villagers.filter(v => v.role === 'idle' && v.homeBuildingId);
      if (idle.length === 0) break;
      state = setGuard(state, idle[0].id);
    }
  }

  // --- CLOTHING: tanner (day 12+) ---
  if (day >= 12) {
    if (countBuildings(state, 'tanner') === 0) {
      state = tryBuild(state, 'tanner', centerX - 3, centerY + 3);
    }
    state = tryAssignIdle(state, 'tanner');
  }

  // --- WELL: fire protection (day 15+) ---
  if (day >= 15 && countBuildings(state, 'well') === 0) {
    state = tryBuild(state, 'well', centerX, centerY + 2);
  }

  // --- EXPANSION (day 20+): sawmill, more production ---
  if (day >= 20) {
    if (countBuildings(state, 'sawmill') === 0 && state.resources.wood > 20) {
      state = tryBuild(state, 'sawmill', centerX + 5, centerY);
    }
    state = tryAssignIdle(state, 'sawmill');
  }

  // --- WATCHTOWER (day 30+) ---
  if (day >= 30 && countBuildings(state, 'watchtower') === 0 && canAfford(state, 'watchtower')) {
    state = tryBuild(state, 'watchtower', centerX, centerY - 3);
  }
  // Assign guard to watchtower
  const tower = state.buildings.find(b => b.type === 'watchtower' && b.constructed && b.assignedWorkers.length === 0);
  if (tower) {
    const guards = state.villagers.filter(v => v.role === 'guard' && !v.jobBuildingId);
    if (guards.length > 0) {
      state = assignVillager(state, guards[0].id, tower.id);
    }
  }

  // --- ONGOING: reactive decisions ---
  if (homeCapacity <= pop) {
    state = tryBuild(state, 'tent', centerX, centerY);
  }
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
for (let y = 10; y < 30; y++) {
  for (let x = 10; x < 30; x++) {
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
    localBuffer: b.type === 'storehouse' ? { food: 50 } : b.localBuffer,
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
  resources: { wood: number; stone: number; food: number; gold: number };
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
}

const snapshots: DaySnapshot[] = [];
let prevVillagerIds = new Set(state.villagers.map(v => v.id));
let prevGraveyardLen = 0;
let prevBuildingCount = state.buildings.filter(b => b.type !== 'rubble').length;

// Override console.log again for simulation
console.log = function (...args: any[]) {
  const msg = args.join(' ');
  if (msg.startsWith('ERROR:')) errorLines.push(msg);
};

for (let day = 0; day < 100; day++) {
  const playerActions: string[] = [];

  // Player AI acts at start of each day
  const preBuildCount = state.buildings.filter(b => b.type !== 'rubble').length;
  const preGuardCount = state.villagers.filter(v => v.role === 'guard').length;
  state = playerAI(state);
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
  });

  prevVillagerIds = currentIds;
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
    || s.day % 10 === 0 || s.day === 99;

  if (!notable) continue;

  console.log(`--- Day ${s.day} | ${s.season} | ${s.weather} ---`);
  console.log(`  Pop: ${s.villagers} (${s.guards} guards) | Buildings: ${s.buildings} | Prosperity: ${s.prosperity}`);
  console.log(`  Resources: wood=${s.resources.wood} stone=${s.resources.stone} food=${s.resources.food} gold=${s.resources.gold}`);
  console.log(`  Raid level: ${s.raidLevel} | Raid bar: ${s.raidBar}`);

  for (const a of s.playerActions) console.log(`  [PLAYER] ${a}`);
  if (s.activeRaid) console.log(`  ** RAID IN PROGRESS **`);
  if (s.enemies > 0) console.log(`  Enemies present: ${s.enemies}`);
  if (s.sick > 0) console.log(`  Sick: ${s.sick}`);
  if (s.onFire > 0) console.log(`  On fire: ${s.onFire} building(s)`);
  if (s.caravans > 0) console.log(`  Trade caravans: ${s.caravans}`);
  if (s.deaths.length > 0) console.log(`  Deaths: ${s.deaths.join(', ')}`);
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
console.log(`  Final resources: wood=${state.resources.wood} stone=${state.resources.stone} food=${state.resources.food} gold=${state.resources.gold}`);
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
  console.log(`    ${v.name} | HP: ${v.hp}/${v.maxHp} | Role: ${v.role} | Morale: ${v.morale} | Food: ${v.food.toFixed(1)} | ${clothed}`);
}
console.log();

// Graveyard
if (state.graveyard.length > 0) {
  console.log(`  Graveyard (${state.graveyard.length} total):`);
  for (const g of state.graveyard) {
    console.log(`    ${g.name} — died day ${g.day}`);
  }
}
