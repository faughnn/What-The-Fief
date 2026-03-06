// stress-report.ts — Detailed 100-day simulation with player AI
// Simulates a real Bellwright player making decisions each day.

import {
  createWorld, createVillager, GameState, Building, BuildingType, TechId,
  TICKS_PER_DAY, BUILDING_TEMPLATES, FOOD_PRIORITY, BUILDING_TECH_REQUIREMENTS,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, setPatrol, upgradeBuilding, setResearch, assaultCamp, setFormation, holdFestival, callToArms, standDown, sendExpedition,
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

function hasTech(state: GameState, tech: TechId): boolean {
  return state.research.completed.includes(tech);
}

function canBuildTech(state: GameState, type: BuildingType): boolean {
  const req = BUILDING_TECH_REQUIREMENTS[type];
  return !req || hasTech(state, req);
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
  // Compact perimeter zone: (13,13)-(17,17) edges reserved for walls/fences
  if (cy === 13 || cy === 17) { if (cx >= 13 && cx <= 17) return true; }
  if (cx === 13 || cx === 17) { if (cy >= 13 && cy <= 17) return true; }
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

function tryBuildNearWater(state: GameState, type: BuildingType): GameState {
  if (!canAfford(state, type)) return state;
  // Search territory for grass tiles adjacent to water
  for (let y = 1; y < state.height - 1; y++) {
    for (let x = 1; x < state.width - 1; x++) {
      if (!state.territory[y][x] || !state.fog[y][x]) continue;
      if (state.grid[y][x].terrain !== 'grass' || state.grid[y][x].building) continue;
      // Check if adjacent to water
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      const nearWater = dirs.some(([dx,dy]) => state.grid[y+dy]?.[x+dx]?.terrain === 'water');
      if (!nearWater) continue;
      const prev = state.buildings.length;
      const result = placeBuilding(state, type, x, y);
      if (result.buildings.length > prev) return result;
    }
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
  if (farmCount < 3 && pop >= 8) {
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
  // Second woodcutter — build when wood is consistently low
  if (day >= 10 && countBuildings(state, 'woodcutter') < 2 && pop >= 6 && state.resources.wood < 10) {
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
  // Mill (wheat→flour) — start food quality chain early (requires basic_cooking)
  if (day >= 10 && countBuildings(state, 'mill') === 0 && state.resources.wheat > 15 && canBuildTech(state, 'mill')) {
    state = tryBuild(state, 'mill', 16, 14);
  }
  // Well
  if (day >= 10 && countBuildings(state, 'well') === 0) {
    state = tryBuild(state, 'well', centerX, centerY + 2);
  }
  // Tavern for morale — build early to prevent departures
  if (day >= 10 && countBuildings(state, 'tavern') === 0) {
    state = tryBuild(state, 'tavern', 14, 13);
  }
  // Bakery (flour→bread) — bread gives +10 morale. HIGH PRIORITY after mill.
  if (day >= 12 && countBuildings(state, 'bakery') === 0 && countBuildings(state, 'mill') > 0 && canBuildTech(state, 'bakery')) {
    state = tryBuild(state, 'bakery', 17, 15);
  }
  // Fishing hut — food diversity, must be near water (requires advanced_farming)
  if (day >= 6 && countBuildings(state, 'fishing_hut') === 0 && canBuildTech(state, 'fishing_hut')) {
    state = tryBuildNearWater(state, 'fishing_hut');
  }
  // Forester — renewable wood (requires advanced_farming)
  if (day >= 20 && countBuildings(state, 'forester') === 0 && canBuildTech(state, 'forester') && canAfford(state, 'forester')) {
    state = tryBuild(state, 'forester', 14, 18);
  }
  // Watchtower — build once we can afford it (requires fortification)
  if (day >= 15 && countBuildings(state, 'watchtower') === 0 && canAfford(state, 'watchtower') && canBuildTech(state, 'watchtower')) {
    state = tryBuild(state, 'watchtower', 13, 13);
  }
  // Weapon production chain: hemp_field → ropemaker → fletcher (bows for guards)
  if (day >= 18 && countBuildings(state, 'hemp_field') === 0) {
    state = tryBuild(state, 'hemp_field', 14, 16);
  }
  if (day >= 22 && countBuildings(state, 'ropemaker') === 0 && countBuildings(state, 'hemp_field') > 0) {
    state = tryBuild(state, 'ropemaker', 13, 17);
  }
  if (day >= 25 && countBuildings(state, 'fletcher') === 0 && countBuildings(state, 'ropemaker') > 0 && canBuildTech(state, 'fletcher')) {
    state = tryBuild(state, 'fletcher', 13, 14);
  }
  // Butchery — converts food→meat+leather. Build when we have excess food.
  if (day >= 12 && countBuildings(state, 'butchery') === 0 && food >= 40 && canBuildTech(state, 'butchery') && canAfford(state, 'butchery')) {
    state = tryBuild(state, 'butchery', 12, 15);
  }
  // Drying rack — converts meat→dried_food (longer shelf life)
  if (day >= 18 && countBuildings(state, 'drying_rack') === 0 && countBuildings(state, 'butchery') > 0 && canBuildTech(state, 'drying_rack') && canAfford(state, 'drying_rack')) {
    state = tryBuild(state, 'drying_rack', 12, 14);
  }
  // Compost pile — converts food waste→fertilizer (boosts farm output)
  if (day >= 15 && countBuildings(state, 'compost_pile') === 0 && canBuildTech(state, 'compost_pile') && canAfford(state, 'compost_pile')) {
    state = tryBuild(state, 'compost_pile', 12, 16);
  }
  // Food cellar — halves spoilage rates (build once cooking tech is available)
  if (day >= 15 && countBuildings(state, 'food_cellar') === 0 && canBuildTech(state, 'food_cellar') && canAfford(state, 'food_cellar')) {
    state = tryBuild(state, 'food_cellar', centerX, centerY - 1);
  }
  // Coal burner — needed for charcoal (smelter fuel). Build when metallurgy available.
  if (day >= 20 && countBuildings(state, 'coal_burner') === 0 && canBuildTech(state, 'coal_burner') && canAfford(state, 'coal_burner')) {
    state = tryBuild(state, 'coal_burner', 12, 17);
  }
  // Iron mine + smelter chain — requires metallurgy + charcoal supply
  if (day >= 22 && countBuildings(state, 'iron_mine') === 0 && canBuildTech(state, 'iron_mine') && canAfford(state, 'iron_mine')) {
    state = tryBuild(state, 'iron_mine', 12, 16);
  }
  if (day >= 24 && countBuildings(state, 'smelter') === 0 && countBuildings(state, 'coal_burner') > 0 && canBuildTech(state, 'smelter') && canAfford(state, 'smelter')) {
    state = tryBuild(state, 'smelter', 12, 13);
  }
  // Armor production: leather_workshop (requires master_crafting)
  if (day >= 28 && countBuildings(state, 'leather_workshop') === 0 && countBuildings(state, 'tanner') > 0 && countBuildings(state, 'weaver') > 0 && canBuildTech(state, 'leather_workshop')) {
    state = tryBuild(state, 'leather_workshop', 12, 14);
  }
  // Church for morale (requires trade_routes)
  if (day >= 30 && countBuildings(state, 'church') === 0 && canAfford(state, 'church') && canBuildTech(state, 'church')) {
    state = tryBuild(state, 'church', 14, 15);
  }
  // Decoration buildings (garden, fountain, statue) are available but the player AI
  // doesn't build them — they compete with defense for space/resources.
  // Decorations are tested independently in test-v2-decorations.ts.

  // Worker assignment handled by daily auto-assign in processDailyChecks (has construction reserve).
  // Player AI only does guard assignment and building placement — not worker assignment.

  // --- DEFENSE: fence perimeter once economy is established ---
  // Only build defenses when raids are imminent (raidBar > 60) or have already started
  const raidThreatening = state.raidBar > 60 || state.raidLevel > 0;
  if (raidThreatening && pop >= 5) {
    // Compact perimeter: 5x5 instead of 7x7 (less wood, faster construction)
    const gatePositions = new Set(['13,15', '17,15', '15,13', '15,17']);
    const perimeterSpots: { x: number; y: number }[] = [];
    // North wall: y=13, x=13-17
    for (let x = 13; x <= 17; x++) perimeterSpots.push({ x, y: 13 });
    // South wall: y=17, x=13-17
    for (let x = 13; x <= 17; x++) perimeterSpots.push({ x, y: 17 });
    // West wall: x=13, y=14-16
    for (let y = 14; y <= 16; y++) if (!gatePositions.has(`13,${y}`)) perimeterSpots.push({ x: 13, y });
    // East wall: x=17, y=14-16
    for (let y = 14; y <= 16; y++) if (!gatePositions.has(`17,${y}`)) perimeterSpots.push({ x: 17, y });

    // Only build fences when we have wood to spare
    if (state.resources.wood >= 20) {
      let fencesBuilt = 0;
      for (const spot of perimeterSpots) {
        if (fencesBuilt >= 3) break;
        if (gatePositions.has(`${spot.x},${spot.y}`)) continue;
        if (spot.y >= state.height || spot.x >= state.width) continue;
        const tile = state.grid[spot.y][spot.x];
        if (tile.terrain !== 'grass' || tile.building || !state.territory[spot.y][spot.x]) continue;
        if (!canAfford(state, 'fence')) continue;
        state = placeBuilding(state, 'fence', spot.x, spot.y);
        fencesBuilt++;
      }
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
  }

  // Guards: only assign when raids are active or imminent
  // Delay guard assignment to maximize workers for economy
  if (raidThreatening && pop >= 5) {
    const currentGuards = state.villagers.filter(v => v.role === 'guard').length;
    let needGuards = pop >= 14 ? 3 : (pop >= 8 ? 2 : 1);
    // Scale up if raid level demands more
    if (state.raidLevel >= 4 && pop >= 14) needGuards = Math.max(needGuards, 4);
    else if (state.raidLevel >= 3 && pop >= 12) needGuards = Math.max(needGuards, 3);
    if (currentGuards < needGuards) {
      const idle = state.villagers.filter(v => v.role === 'idle' && v.homeBuildingId);
      for (const v of idle) {
        if (state.villagers.filter(v2 => v2.role === 'guard').length >= needGuards) break;
        state = setGuard(state, v.id);
      }
      // If still not enough, reassign non-essential workers (not farmers/bakers/millers)
      if (state.villagers.filter(v => v.role === 'guard').length < needGuards && pop >= 6) {
        const reassignOrder: string[] = ['quarrier', 'sawyer'];
        for (const role of reassignOrder) {
          const w = state.villagers.find(v =>
            v.role === role && v.role !== 'guard' && v.homeBuildingId
          );
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

  // --- BARRACKS: build once we have military_tactics and guards ---
  if (day >= 25 && countBuildings(state, 'barracks') === 0 && canAfford(state, 'barracks') && canBuildTech(state, 'barracks')) {
    state = tryBuild(state, 'barracks', 12, 14);
  }

  // --- WALL UPGRADES: upgrade fences to walls, walls to reinforced_walls ---
  if (day >= 40 && hasTech(state, 'siege_engineering')) {
    // Upgrade one wall to reinforced per day
    const wall = state.buildings.find(b => b.type === 'wall' && b.constructed);
    if (wall && canAfford(state, 'reinforced_wall')) {
      state = upgradeBuilding(state, wall.id);
    }
  }
  if (day >= 30) {
    // Upgrade one fence to wall per day
    const fence = state.buildings.find(b => b.type === 'fence' && b.constructed);
    if (fence && (state.resources.stone || 0) >= 3) {
      state = upgradeBuilding(state, fence.id);
    }
  }

  // --- ASSAULT BANDIT CAMPS: send guards to attack weak camps ---
  const allGuards = state.villagers.filter(v => v.role === 'guard' && v.hp > 0);
  if (allGuards.length >= 2 && state.enemies.length === 0 && state.banditCamps.length > 0) {
    // Include watchtower guards as available for assault (they'll return after)
    const availableGuards = allGuards.filter(v =>
      v.hp >= v.maxHp && !v.assaultTargetId
    );
    const weakestCamp = [...state.banditCamps].sort((a, b) => a.hp - b.hp)[0];
    const campDmgPerTick = Math.max(1, Math.floor(weakestCamp.strength * 1.5));
    const guardSurvivalTicks = Math.floor(availableGuards[0]?.maxHp / campDmgPerTick) || 0;
    if (availableGuards.length >= 2 && guardSurvivalTicks >= 5) {
      state = assaultCamp(state, availableGuards[0].id, weakestCamp.id);
      state = assaultCamp(state, availableGuards[1].id, weakestCamp.id);
    }
  }

  // --- CALL TO ARMS: mobilize militia when enemies threaten ---
  if (state.enemies.length >= 3 && !state.callToArms) {
    state = callToArms(state);
  } else if (state.enemies.length === 0 && state.callToArms) {
    state = standDown(state);
  }

  // --- ECONOMY DEPTH: production chains + building upgrades ---

  // Research — always queue tech if not researching (even before desk is built)
  if (!state.research.current) {
    const techOrder = ['basic_cooking', 'crop_rotation', 'improved_tools', 'fortification', 'masonry', 'herbalism_lore', 'animal_husbandry', 'advanced_farming', 'archery', 'military_tactics', 'civil_engineering', 'trade_routes', 'metallurgy', 'steel_forging', 'master_crafting', 'architecture'] as const;
    for (const tech of techOrder) {
      if (!state.research.completed.includes(tech as any) && state.research.current !== tech) {
        state = setResearch(state, tech as any);
        break;
      }
    }
  }

  // Building upgrades — upgrade key buildings when resources permit
  // Tent → cottage upgrades early, cottage → house later
  if (day >= 15 && state.resources.wood >= 10) {
    const tent = state.buildings.find(b => b.type === 'tent' && b.constructed);
    if (tent) state = upgradeBuilding(state, tent.id);
  }
  if (day >= 30 && state.resources.wood >= 15 && (state.resources.planks || 0) >= 5) {
    const cottage = state.buildings.find(b => b.type === 'cottage' && b.constructed);
    if (cottage) state = upgradeBuilding(state, cottage.id);
  }
  if (day >= 30 && state.resources.planks >= 10 && canBuildTech(state, 'large_farm')) {
    const smallFarm = state.buildings.find(b => b.type === 'farm' && b.constructed);
    if (smallFarm && state.resources.wood >= 10 && state.resources.planks >= 5) {
      state = upgradeBuilding(state, smallFarm.id);
    }
  }
  if (day >= 40 && state.resources.planks >= 15 && canBuildTech(state, 'lumber_mill')) {
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

  // --- EXPEDITIONS: explore POIs with guards when safe ---
  if (state.enemies.length === 0 && state.expeditions.length === 0 && day >= 30) {
    const unexploredPOIs = state.pointsOfInterest.filter(p => !p.explored && !p.guardEnemies);
    // Only send guards (combat-capable) to safe POIs (no guard enemies)
    const guards = state.villagers.filter(v =>
      v.role === 'guard' && v.hp >= v.maxHp && v.state !== 'on_expedition' && !v.assaultTargetId
    );
    if (unexploredPOIs.length > 0 && guards.length >= 2) {
      const target = unexploredPOIs[0];
      state = sendExpedition(state, [guards[0].id, guards[1].id], target.x, target.y);
    }
  }

  // Festival — hold when tavern exists, morale is sagging, and we can afford it
  const avgMorale = state.villagers.reduce((sum, v) => sum + v.morale, 0) / Math.max(1, state.villagers.length);
  if (avgMorale < 65 && (countConstructed(state, 'tavern') > 0 || countConstructed(state, 'inn') > 0) && state.resources.food >= 30 && state.resources.gold >= 20) {
    const result = holdFestival(state);
    if (result !== state) state = result;
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

// Setup — starting colony on a medium map (60x60)
let state = createWorld(60, 60, 42);
// Make entire map grass/territory/fog so settlers from any edge can walk in
for (let y = 0; y < 60; y++) {
  for (let x = 0; x < 60; x++) {
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
const quiet = process.argv.includes('--quiet') || process.argv.includes('-q');

if (!quiet) {
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
} // end if (!quiet)

// ================================================================
// SUMMARY
// ================================================================
if (quiet) {
  // Quiet mode: one-line summary
  const techCount = state.research.completed.length;
  console.log(`STRESS TEST: ${state.villagers.length} pop, ${state.graveyard.length} deaths, ${errorLines.length} errors, ${techCount} techs, prosperity ${Math.round(state.prosperity)}`);
  if (errorLines.length > 0) {
    for (const e of errorLines.slice(0, 5)) console.log(`  ${e}`);
  }
} else {
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
console.log(`  Construction points remaining: ${state.constructionPoints} (milestones: ${state.constructionPointsMilestones.join(', ') || 'none'})`);
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

// Unconstructed buildings
const unconstructed = state.buildings.filter(b => !b.constructed && b.type !== 'rubble');
if (unconstructed.length > 0) {
  console.log(`  Unconstructed buildings (${unconstructed.length}):`);
  for (const b of unconstructed) {
    console.log(`    ${b.type} at (${b.x},${b.y}) — progress: ${b.constructionProgress}/${b.constructionRequired}`);
  }
} else {
  console.log('  All buildings constructed.');
}
console.log();

// Empty production buildings
const emptyProduction = state.buildings.filter(b => {
  if (!b.constructed || b.type === 'rubble') return false;
  const maxW = BUILDING_TEMPLATES[b.type as BuildingType]?.maxWorkers || 0;
  return maxW > 0 && b.assignedWorkers.length === 0;
});
if (emptyProduction.length > 0) {
  console.log(`  Empty production buildings (${emptyProduction.length}):`);
  for (const b of emptyProduction) {
    console.log(`    ${b.type} at (${b.x},${b.y}) — max workers: ${BUILDING_TEMPLATES[b.type as BuildingType].maxWorkers}`);
  }
}
console.log();

// Graveyard
if (state.graveyard.length > 0) {
  console.log(`  Graveyard (${state.graveyard.length} total):`);
  for (const g of state.graveyard) {
    console.log(`    ${g.name} — died day ${g.day}`);
  }
}
} // end if (!quiet)
