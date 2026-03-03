// simulation.ts — V2 spatial simulation. Pure functions: old state in, new state out.
// 120 ticks = 1 day. Villagers move 1 tile/tick. All interactions require physical presence.

import {
  GameState, BuildingType, Building, Resources, ResourceType, Villager, VillagerRole,
  Tile, BUILDING_TEMPLATES, createVillager, BASE_STORAGE_CAP, STOREHOUSE_BONUS,
  SPOILAGE, FOOD_PRIORITY, ALL_RESOURCES, SkillType, BUILDING_SKILL_MAP,
  skillMultiplier, FoodEaten, ToolTier, TOOL_MULTIPLIER, TOOL_DURABILITY,
  TOOL_RESOURCE, TOOL_EQUIP_PRIORITY, Direction,
  EnemyEntity, ActiveRaid, ENEMY_TEMPLATES, GUARD_COMBAT, EnemyType,
  AnimalEntity, AnimalType, ANIMAL_TEMPLATES, ResourceDrop,
  TechId, TECH_TREE, ResearchState,
  MerchantState, TRADE_PRICES,
  Season, WeatherType, SEASON_NAMES, SEASON_FARM_MULT, SEASON_MORALE,
  WEATHER_MORALE, WEATHER_OUTDOOR_MULT, OUTDOOR_BUILDINGS, HOUSING_INFO,
  TICKS_PER_DAY, NIGHT_TICKS, CARRY_CAPACITY, DEFAULT_BUFFER_CAP,
  STOREHOUSE_BUFFER_CAP, BUILDING_MAX_HP, HOME_DEPARTURE_TICK,
  CONSTRUCTION_TICKS,
} from './world.js';

// --- BFS Pathfinding ---
// Buildings block movement except for the destination tile (workers enter their workplace)
export function findPath(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
): { x: number; y: number }[] {
  if (fromX === toX && fromY === toY) return [];
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [];
  queue.push({ x: fromX, y: fromY, path: [] });
  visited.add(`${fromX},${fromY}`);
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited.has(key)) continue;
      if (grid[ny][nx].terrain === 'water') continue;
      // Buildings block movement — except destination tile, gates, and rubble (passable)
      if (nx !== toX || ny !== toY) {
        const tile = grid[ny][nx];
        if (tile.building && tile.building.type !== 'gate' && tile.building.type !== 'rubble') continue;
      }
      const newPath = [...current.path, { x: nx, y: ny }];
      if (nx === toX && ny === toY) return newPath;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: newPath });
    }
  }
  return [];
}

// --- Enemy pathfinding: walls and fences block ---
export function findPathEnemy(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
): { x: number; y: number }[] {
  if (fromX === toX && fromY === toY) return [];
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [];
  queue.push({ x: fromX, y: fromY, path: [] });
  visited.add(`${fromX},${fromY}`);
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited.has(key)) continue;
      if (grid[ny][nx].terrain === 'water') continue;
      // Enemies can't pass through walls, fences, or gates
      const bld = grid[ny][nx].building;
      if (bld && (bld.type === 'wall' || bld.type === 'fence' || bld.type === 'gate')) continue;
      const newPath = [...current.path, { x: nx, y: ny }];
      if (nx === toX && ny === toY) return newPath;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: newPath });
    }
  }
  return [];
}

// --- Find settlement center (average building position) ---
function findSettlementCenter(buildings: Building[]): { x: number; y: number } {
  if (buildings.length === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const b of buildings) { sx += b.x; sy += b.y; }
  return { x: Math.round(sx / buildings.length), y: Math.round(sy / buildings.length) };
}

// --- Find adjacent wall/building for enemy to attack ---
function findAdjacentTarget(
  x: number, y: number, grid: Tile[][], width: number, height: number, buildings: Building[],
): Building | null {
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  // Priority: walls first, then fences, then other buildings
  for (const prio of ['wall', 'fence', null] as (BuildingType | null)[]) {
    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const tile = grid[ny][nx];
      if (tile.building) {
        if (prio === null || tile.building.type === prio) {
          return buildings.find(b => b.id === tile.building!.id) || null;
        }
      }
    }
  }
  return null;
}

// --- Check if two positions are adjacent (Manhattan distance <= 1) ---
function isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2) <= 1;
}

// --- Helpers ---
const ROLE_MAP: Partial<Record<BuildingType, VillagerRole>> = {
  farm: 'farmer', woodcutter: 'woodcutter', quarry: 'quarrier',
  herb_garden: 'herbalist', flax_field: 'flaxer', hemp_field: 'hemper',
  iron_mine: 'miner', sawmill: 'sawyer', smelter: 'smelter',
  mill: 'miller', bakery: 'baker', tanner: 'tanner_worker',
  weaver: 'weaver_worker', ropemaker: 'ropemaker_worker',
  blacksmith: 'blacksmith_worker', toolmaker: 'toolmaker_worker', armorer: 'armorer_worker',
  research_desk: 'researcher',
  chicken_coop: 'chicken_keeper', livestock_barn: 'rancher', apiary: 'beekeeper',
  hunting_lodge: 'hunter',
};

function roleForBuilding(type: BuildingType): VillagerRole {
  return ROLE_MAP[type] || 'idle';
}

function getBuildingEntrance(b: Building): { x: number; y: number } {
  return { x: b.x, y: b.y };
}

function findHome(buildings: Building[], villagers: Villager[]): string | null {
  for (const b of buildings) {
    const info = HOUSING_INFO[b.type];
    if (!info) continue;
    if (villagers.filter(v => v.homeBuildingId === b.id).length < info.capacity) return b.id;
  }
  return null;
}

function computeStorageCap(buildings: Building[]): number {
  return BASE_STORAGE_CAP + buildings.filter(b => b.type === 'storehouse').length * STOREHOUSE_BONUS;
}

function addResource(resources: Resources, type: ResourceType, amount: number, cap: number): number {
  const space = Math.max(0, cap - resources[type]);
  const added = Math.min(amount, space);
  resources[type] += added;
  return added;
}

function addToBuffer(buffer: Partial<Record<ResourceType, number>>, type: ResourceType, amount: number, cap: number): number {
  const current = bufferTotal(buffer);
  const space = Math.max(0, cap - current);
  const added = Math.min(amount, space);
  buffer[type] = (buffer[type] || 0) + added;
  return added;
}

function bufferTotal(buffer: Partial<Record<ResourceType, number>>): number {
  let total = 0;
  for (const v of Object.values(buffer)) total += (v || 0);
  return total;
}

function hasInputs(resources: Resources, inputs: Partial<Record<ResourceType, number>>): boolean {
  for (const [res, amt] of Object.entries(inputs)) {
    if (resources[res as ResourceType] < (amt as number)) return false;
  }
  return true;
}

function hasBufferInputs(buffer: Partial<Record<ResourceType, number>>, inputs: Partial<Record<ResourceType, number>>): boolean {
  for (const [res, amt] of Object.entries(inputs)) {
    if ((buffer[res as ResourceType] || 0) < (amt as number)) return false;
  }
  return true;
}

function consumeInputs(resources: Resources, inputs: Partial<Record<ResourceType, number>>): void {
  for (const [res, amt] of Object.entries(inputs)) {
    resources[res as ResourceType] -= amt as number;
  }
}

function consumeBufferInputs(buffer: Partial<Record<ResourceType, number>>, inputs: Partial<Record<ResourceType, number>>): void {
  for (const [res, amt] of Object.entries(inputs)) {
    buffer[res as ResourceType] = (buffer[res as ResourceType] || 0) - (amt as number);
    if ((buffer[res as ResourceType] || 0) <= 0) delete buffer[res as ResourceType];
  }
}

// --- Production rate: ticks per 1 unit of output ---
function ticksPerUnit(buildingType: BuildingType): number {
  const template = BUILDING_TEMPLATES[buildingType];
  if (!template.production) return Infinity;
  return Math.max(1, Math.round(80 / template.production.amountPerWorker));
}

// --- Production modifier ---
function productionMultiplier(v: Villager, buildingType: BuildingType, research: ResearchState, season: Season, weather: WeatherType): number {
  let mult = 1.0;
  const skill = BUILDING_SKILL_MAP[buildingType];
  if (skill) mult *= skillMultiplier(v.skills[skill]);
  if (v.traits.includes('strong')) mult *= 1.2;
  if (v.traits.includes('lazy')) mult *= 0.8;
  if (v.morale >= 70) mult *= 1.1;
  else if (v.morale < 30) mult *= 0.8;
  mult *= TOOL_MULTIPLIER[v.tool];
  return mult;
}

// --- Tool Management ---
function autoEquipTool(v: Villager, resources: Resources, durabilityBonus: number = 0): void {
  for (const tier of TOOL_EQUIP_PRIORITY) {
    const res = TOOL_RESOURCE[tier];
    if (resources[res] > 0) {
      resources[res] -= 1;
      v.tool = tier;
      v.toolDurability = Math.floor(TOOL_DURABILITY[tier] * (1 + durabilityBonus));
      return;
    }
  }
  v.tool = 'none';
  v.toolDurability = 0;
}

function degradeTool(v: Villager, resources: Resources, durabilityBonus: number = 0): void {
  if (v.tool === 'none') return;
  v.toolDurability -= 1;
  if (v.toolDurability <= 0) {
    autoEquipTool(v, resources, durabilityBonus);
  }
}

function gainSkillXp(v: Villager, buildingType: BuildingType): void {
  const skill = BUILDING_SKILL_MAP[buildingType];
  if (!skill) return;
  let xpGain = 1;
  if (v.traits.includes('fast_learner')) xpGain = Math.ceil(xpGain * 1.5);
  if (skill === 'crafting' && v.traits.includes('skilled_crafter')) xpGain = Math.ceil(xpGain * 1.5);
  v.skills[skill] = Math.min(100, v.skills[skill] + xpGain);
}

function calculateMorale(v: Villager, housingMorale: number, season: Season, weather: WeatherType): number {
  let morale = 50;
  morale += housingMorale;
  switch (v.lastAte) {
    case 'bread': morale += 10; break;
    case 'flour': morale += 5; break;
    case 'wheat': case 'food': break;
    case 'nothing': morale -= 20; break;
  }
  if (v.traits.includes('cheerful')) morale += 10;
  if (v.traits.includes('gloomy')) morale -= 10;
  morale += SEASON_MORALE[season];
  morale += WEATHER_MORALE[weather];
  return Math.max(0, Math.min(100, morale));
}

// --- Tech helpers ---
function hasTech(research: ResearchState, tech: TechId): boolean {
  return research.completed.includes(tech);
}

function techProductionBonus(research: ResearchState, buildingType: BuildingType): number {
  let bonus = 0;
  if (buildingType === 'farm' && hasTech(research, 'crop_rotation')) bonus += 1;
  if (buildingType === 'quarry' && hasTech(research, 'masonry')) bonus += 1;
  if (buildingType === 'herb_garden' && hasTech(research, 'herbalism_lore')) bonus += 1;
  if (buildingType === 'smelter' && hasTech(research, 'metallurgy')) bonus += 1;
  return bonus;
}

// --- Fog helpers ---
function revealArea(fog: boolean[][], width: number, height: number, cx: number, cy: number, radius: number): void {
  for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++) {
      fog[y][x] = true;
    }
  }
}

// --- Movement: move villager 1 step along their path ---
function moveOneStep(v: Villager): boolean {
  if (v.pathIndex >= v.path.length) return false;
  const next = v.path[v.pathIndex];
  v.x = next.x;
  v.y = next.y;
  v.pathIndex++;
  return true;
}

function atDestination(v: Villager): boolean {
  return v.pathIndex >= v.path.length;
}

function planPath(v: Villager, grid: Tile[][], width: number, height: number, toX: number, toY: number): void {
  if (v.x === toX && v.y === toY) {
    v.path = [];
    v.pathIndex = 0;
    return;
  }
  v.path = findPath(grid, width, height, v.x, v.y, toX, toY);
  v.pathIndex = 0;
}

// --- Find nearest storehouse ---
function findNearestStorehouse(buildings: Building[], grid: Tile[][], width: number, height: number, x: number, y: number): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    if (b.type !== 'storehouse') continue;
    const entrance = getBuildingEntrance(b);
    const dist = Math.abs(entrance.x - x) + Math.abs(entrance.y - y);
    if (dist < bestDist) { bestDist = dist; best = b; }
  }
  return best;
}

// --- State Validation ---
export function validateState(state: GameState): string[] {
  const errors: string[] = [];

  for (const key of ALL_RESOURCES) {
    if (state.resources[key] < 0) errors.push(`ERROR: Negative resource ${key}=${state.resources[key]}`);
    if (key !== 'gold' && state.resources[key] > state.storageCap) errors.push(`ERROR: Resource ${key}=${state.resources[key]} exceeds cap ${state.storageCap}`);
  }

  if (state.grid.length !== state.height) errors.push(`ERROR: Grid height mismatch`);
  for (let y = 0; y < state.grid.length; y++) {
    if (state.grid[y].length !== state.width) errors.push(`ERROR: Grid row ${y} width mismatch`);
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
      errors.push(`ERROR: Villager ${v.id} out of bounds`);
    }
    if (v.jobBuildingId && !state.buildings.find(b => b.id === v.jobBuildingId)) {
      errors.push(`ERROR: Villager ${v.id} orphaned job ${v.jobBuildingId}`);
    }
    if (v.homeBuildingId && !state.buildings.find(b => b.id === v.homeBuildingId)) {
      errors.push(`ERROR: Villager ${v.id} orphaned home ${v.homeBuildingId}`);
    }
  }

  return errors;
}

// ================================================================
// TICK — V2 spatial simulation
// ================================================================
export function tick(state: GameState): GameState {
  const newTick = state.tick + 1;
  const newDay = Math.floor(newTick / TICKS_PER_DAY);
  const dayTick = newTick % TICKS_PER_DAY;
  const isNight = dayTick < NIGHT_TICKS;
  const isDawn = dayTick === NIGHT_TICKS;
  const isNewDay = dayTick === 0 && newTick > 0;

  // Deep copy mutable state
  let villagers = state.villagers.map(v => ({
    ...v,
    skills: { ...v.skills },
    traits: [...v.traits],
    path: [...v.path],
    carrying: { ...v.carrying },
  }));
  const resources: Resources = { ...state.resources };
  const buildings = state.buildings.map(b => ({
    ...b,
    assignedWorkers: [...b.assignedWorkers],
    localBuffer: { ...b.localBuffer },
  }));
  const storageCap = computeStorageCap(buildings);
  const fog = state.fog.map(row => [...row]);
  const territory = state.territory.map(row => [...row]);
  const grid = state.grid.map(row => row.map(t => ({ ...t })));
  const research: ResearchState = {
    completed: [...state.research.completed],
    current: state.research.current,
    progress: state.research.progress,
  };
  const enemies = state.enemies.map(e => ({ ...e }));
  let animals = state.animals.map(a => ({ ...a }));
  let resourceDrops = state.resourceDrops.map(d => ({ ...d, resources: { ...d.resources } }));
  let nextAnimalId = state.nextAnimalId;
  let nextDropId = state.nextDropId;
  let nextBuildingId = state.nextBuildingId;
  const events: string[] = [];

  const toolDurBonus = hasTech(research, 'improved_tools') ? 0.2 : 0;

  // Season & weather (changes on new day boundaries)
  let season = state.season;
  let weather = state.weather;
  if (isNewDay) {
    season = SEASON_NAMES[Math.floor((newDay % 40) / 10)];
    const weatherRng = ((newDay * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
    const weatherThresholds: Record<Season, [number, number]> = {
      spring: [0.6, 0.9], summer: [0.7, 0.9], autumn: [0.4, 0.8], winter: [0.5, 0.8],
    };
    const [clearThresh, rainThresh] = weatherThresholds[season];
    weather = weatherRng < clearThresh ? 'clear' : weatherRng < rainThresh ? 'rain' : 'storm';
  }

  // ==============================================
  // DAILY CHECKS (on tick 0 of each new day)
  // ==============================================
  if (isNewDay) {
    // Auto-assign homeless
    for (const v of villagers) {
      if (!v.homeBuildingId) {
        const homeId = findHome(buildings, villagers);
        if (homeId) v.homeBuildingId = homeId;
      }
    }

    // Hunger decay — villagers get hungrier each day (eating is now physical)
    for (const v of villagers) {
      const isGlutton = v.traits.includes('glutton');
      const isFrugal = v.traits.includes('frugal');
      const decay = isGlutton ? 2 : (isFrugal ? 0.5 : 1);
      v.food = Math.max(0, v.food - decay);
      v.lastAte = 'nothing' as FoodEaten;
    }

    // Calculate morale
    for (const v of villagers) {
      let housingMorale = 0;
      if (v.homeBuildingId) {
        const home = buildings.find(b => b.id === v.homeBuildingId);
        if (home) housingMorale = HOUSING_INFO[home.type]?.morale ?? 0;
      }
      v.morale = calculateMorale(v, housingMorale, season, weather);
    }

    // Housing check
    for (const v of villagers) {
      v.homeless = v.homeBuildingId ? 0 : v.homeless + 1;
    }

    // Spoilage
    for (const [res, rate] of Object.entries(SPOILAGE)) {
      const key = res as ResourceType;
      const loss = Math.floor(resources[key] * (rate as number));
      resources[key] = Math.max(0, resources[key] - loss);
    }

    // Departure — food<=0 OR homeless>=5 OR morale<=10
    const departing = villagers.filter(v => v.food <= 0 || v.homeless >= 5 || v.morale <= 10);
    for (const d of departing) {
      for (const b of buildings) b.assignedWorkers = b.assignedWorkers.filter(id => id !== d.id);
    }
    villagers = villagers.filter(v => v.food > 0 && v.homeless < 5 && v.morale > 10);

    // Immigration
    let totalEdible = 0;
    for (const { resource } of FOOD_PRIORITY) totalEdible += resources[resource];
    if (totalEdible > villagers.length * 3) {
      const emptyHome = findHome(buildings, villagers);
      if (emptyHome) {
        const home = buildings.find(b => b.id === emptyHome)!;
        const entrance = getBuildingEntrance(home);
        const newV = createVillager(state.nextVillagerId, entrance.x, entrance.y);
        newV.homeBuildingId = emptyHome;
        newV.state = 'sleeping';
        villagers.push(newV);
      }
    }

    // Guard equip tools
    for (const v of villagers) {
      if (v.role === 'guard' && v.tool === 'none') autoEquipTool(v, resources, toolDurBonus);
    }

    // HP regen (2 HP per day)
    for (const v of villagers) {
      if (v.role === 'guard') {
        v.maxHp = 15 + Math.floor(v.morale / 10);
      } else {
        v.maxHp = 10;
      }
      if (v.hp < v.maxHp) v.hp = Math.min(v.maxHp, v.hp + 2);
      v.hp = Math.min(v.hp, v.maxHp);
    }
  }

  // ==============================================
  // PER-TICK PROCESSING: Villager state machine
  // ==============================================
  for (const v of villagers) {
    // Guards handled in combat section
    if (v.role === 'guard') continue;

    // Scout movement: 1 tile per tick in the scout direction
    if (v.role === 'scout' && v.state === 'scouting' && v.scoutDirection) {
      const dir = v.scoutDirection;
      const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0;
      const dy = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
      const nx = Math.max(0, Math.min(state.width - 1, v.x + dx));
      const ny = Math.max(0, Math.min(state.height - 1, v.y + dy));
      // Check passability
      if (grid[ny][nx].terrain !== 'water') {
        v.x = nx;
        v.y = ny;
      }
      revealArea(fog, state.width, state.height, v.x, v.y, 5);
      v.scoutTicksLeft -= 1;
      if (v.scoutTicksLeft <= 0 || v.x === 0 || v.y === 0 || v.x === state.width - 1 || v.y === state.height - 1) {
        v.scoutDirection = null;
        v.scoutTicksLeft = 0;
        v.state = 'idle';
        v.role = 'idle';
      }
      continue;
    }

    // NIGHT: everyone sleeps
    if (isNight) {
      if (v.state !== 'sleeping') {
        // Try to get home
        if (v.homeBuildingId) {
          const home = buildings.find(b => b.id === v.homeBuildingId);
          if (home) {
            const entrance = getBuildingEntrance(home);
            v.x = entrance.x;
            v.y = entrance.y;
          }
        }
        v.state = 'sleeping';
        v.path = [];
        v.pathIndex = 0;
      }
      continue;
    }

    // DAWN: wake up — eat first if hungry, then go to work
    if (isDawn) {
      // Hungry villagers eat before work (food <= 5)
      if (v.food <= 5) {
        if (startEating(v, buildings, resources, grid, state.width, state.height)) {
          continue;
        }
        // No food available — go to work anyway (will starve)
      }

      if (v.jobBuildingId) {
        const job = buildings.find(b => b.id === v.jobBuildingId);
        if (job) {
          const entrance = getBuildingEntrance(job);
          planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
          if (job.constructed) {
            v.state = 'traveling_to_work';
            v.workProgress = 0;
            if (v.tool === 'none') autoEquipTool(v, resources, toolDurBonus);
          } else {
            v.state = 'traveling_to_build';
          }
        } else {
          v.state = 'idle';
        }
      } else {
        // No job — check if any unconstructed buildings need a builder
        const site = buildings.find(b => !b.constructed && b.assignedWorkers.length === 0);
        if (site) {
          const entrance = getBuildingEntrance(site);
          planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
          v.state = 'traveling_to_build';
          v.jobBuildingId = site.id;
        } else {
          v.state = 'idle';
        }
      }
      continue;
    }

    // DAYTIME STATE MACHINE
    switch (v.state) {
      case 'sleeping': {
        // Shouldn't be sleeping during day — wake up
        if (v.jobBuildingId) {
          const job = buildings.find(b => b.id === v.jobBuildingId);
          if (job) {
            const entrance = getBuildingEntrance(job);
            planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
            v.state = job.constructed ? 'traveling_to_work' : 'traveling_to_build';
          } else {
            v.state = 'idle';
          }
        } else {
          v.state = 'idle';
        }
        break;
      }

      case 'traveling_to_work': {
        if (atDestination(v)) {
          // Arrived at workplace — deposit any carried inputs into building's local buffer
          if (v.carryTotal > 0 && v.jobBuildingId) {
            const job = buildings.find(b => b.id === v.jobBuildingId);
            if (job) {
              for (const [res, amt] of Object.entries(v.carrying)) {
                if (amt && amt > 0) {
                  addToBuffer(job.localBuffer, res as ResourceType, amt, job.bufferCapacity);
                }
              }
              v.carrying = {};
              v.carryTotal = 0;
            }
          }
          v.state = 'working';
          v.workProgress = 0;
        } else {
          moveOneStep(v);
          // Check if we should head home instead
          if (dayTick >= HOME_DEPARTURE_TICK) {
            startGoingHome(v, buildings, grid, state.width, state.height);
          }
        }
        break;
      }

      case 'working': {
        if (!v.jobBuildingId) { v.state = 'idle'; break; }
        const job = buildings.find(b => b.id === v.jobBuildingId);
        if (!job) { v.state = 'idle'; break; }

        // Repair: if building is damaged, repair 1 HP/tick before producing
        if (job.hp < job.maxHp) {
          job.hp = Math.min(job.maxHp, job.hp + 1);
          break; // spent this tick repairing
        }

        // Hunger interrupt — very hungry workers stop to eat
        if (v.food <= 2) {
          if (startEating(v, buildings, resources, grid, state.width, state.height)) break;
        }

        const template = BUILDING_TEMPLATES[job.type];
        if (!template.production) {
          // Non-production building (research desk handled here)
          if (job.type === 'research_desk' && research.current) {
            v.workProgress++;
            const tpu = ticksPerUnit(job.type) || 80;
            if (v.workProgress >= tpu) {
              research.progress += 1;
              const tech = TECH_TREE[research.current];
              if (research.progress >= tech.cost) {
                research.completed.push(research.current);
                research.current = null;
                research.progress = 0;
              }
              v.workProgress = 0;
            }
            gainSkillXp(v, job.type);
          }
          break;
        }

        // Check if buffer is full
        if (bufferTotal(job.localBuffer) >= job.bufferCapacity) {
          // Buffer full — start hauling
          startHauling(v, job, buildings, grid, state.width, state.height);
          break;
        }

        // Work: accumulate progress
        v.workProgress++;
        const tpu = ticksPerUnit(job.type);

        // Apply production multiplier to reduce ticks needed
        const mult = productionMultiplier(v, job.type, research, season, weather);
        const effectiveTpu = Math.max(1, Math.round(tpu / mult));

        if (v.workProgress >= effectiveTpu) {
          const prod = template.production;
          if (prod.inputs) {
            // Processing building: needs inputs in building's local buffer
            if (hasBufferInputs(job.localBuffer, prod.inputs)) {
              consumeBufferInputs(job.localBuffer, prod.inputs);
              const bonus = techProductionBonus(research, job.type);
              addToBuffer(job.localBuffer, prod.output, 1 + bonus, job.bufferCapacity);
            } else {
              // No inputs in local buffer — go pick them up from storehouse
              startPickupInputs(v, job, buildings, resources, grid, state.width, state.height);
              break;
            }
          } else {
            // Primary production: no inputs needed
            const bonus = techProductionBonus(research, job.type);
            let amount = 1 + bonus;
            // Season/weather multipliers for outdoor buildings
            if (OUTDOOR_BUILDINGS.includes(job.type)) {
              const isFarm = ['farm', 'flax_field', 'hemp_field', 'chicken_coop'].includes(job.type);
              if (isFarm) amount = Math.max(1, Math.floor(amount * SEASON_FARM_MULT[season]));
              amount = Math.max(1, Math.floor(amount * WEATHER_OUTDOOR_MULT[weather]));
            }
            addToBuffer(job.localBuffer, prod.output, amount, job.bufferCapacity);
          }
          v.workProgress = 0;

          // Tool wear & skill XP
          degradeTool(v, resources, toolDurBonus);
          gainSkillXp(v, job.type);
        }

        // Check if should start hauling (buffer has output items and enough to carry)
        const outputCount = template.production?.inputs
          ? bufferOutputTotal(job.localBuffer, job.type)
          : bufferTotal(job.localBuffer);
        if (outputCount >= CARRY_CAPACITY) {
          startHauling(v, job, buildings, grid, state.width, state.height);
        }

        // Check if should head home
        if (dayTick >= HOME_DEPARTURE_TICK) {
          // Pick up whatever output is in the buffer before leaving
          if (outputCount > 0) {
            startHauling(v, job, buildings, grid, state.width, state.height);
          } else {
            startGoingHome(v, buildings, grid, state.width, state.height);
          }
        }
        break;
      }

      case 'traveling_to_storage': {
        if (atDestination(v)) {
          if (v.haulingToWork) {
            // Picking up inputs from storehouse for processing building
            if (v.jobBuildingId) {
              const job = buildings.find(b => b.id === v.jobBuildingId);
              if (job) {
                const template = BUILDING_TEMPLATES[job.type];
                if (template.production?.inputs) {
                  // Pick up needed inputs from global resources
                  for (const [res, amt] of Object.entries(template.production.inputs)) {
                    const needed = amt as number;
                    const available = Math.min(needed * 3, resources[res as ResourceType]); // pick up a few batches
                    const canCarry = Math.min(available, CARRY_CAPACITY - v.carryTotal);
                    if (canCarry > 0) {
                      resources[res as ResourceType] -= canCarry;
                      v.carrying[res as ResourceType] = (v.carrying[res as ResourceType] || 0) + canCarry;
                      v.carryTotal += canCarry;
                    }
                  }
                }
                // Head back to workplace
                const entrance = getBuildingEntrance(job);
                planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
                v.state = 'traveling_to_work';
                v.haulingToWork = false;
              } else {
                v.state = 'idle';
                v.haulingToWork = false;
              }
            } else {
              v.state = 'idle';
              v.haulingToWork = false;
            }
          } else {
            // Dropping off: deposit carried resources into global storage
            for (const [res, amt] of Object.entries(v.carrying)) {
              if (amt && amt > 0) {
                addResource(resources, res as ResourceType, amt, storageCap);
              }
            }
            v.carrying = {};
            v.carryTotal = 0;

            // Should we go back to work or head home?
            if (dayTick >= HOME_DEPARTURE_TICK) {
              startGoingHome(v, buildings, grid, state.width, state.height);
            } else if (v.jobBuildingId) {
              const job = buildings.find(b => b.id === v.jobBuildingId);
              if (job) {
                const entrance = getBuildingEntrance(job);
                planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
                v.state = 'traveling_to_work';
              } else {
                v.state = 'idle';
              }
            } else {
              v.state = 'idle';
            }
          }
        } else {
          moveOneStep(v);
        }
        break;
      }

      case 'traveling_home': {
        if (atDestination(v)) {
          v.state = 'sleeping';
        } else {
          moveOneStep(v);
        }
        break;
      }

      case 'traveling_to_build': {
        if (atDestination(v)) {
          v.state = 'constructing';
        } else {
          moveOneStep(v);
          if (dayTick >= HOME_DEPARTURE_TICK) {
            startGoingHome(v, buildings, grid, state.width, state.height);
          }
        }
        break;
      }

      case 'constructing': {
        if (!v.jobBuildingId) { v.state = 'idle'; break; }
        const job = buildings.find(b => b.id === v.jobBuildingId);
        if (!job) { v.state = 'idle'; break; }
        if (job.constructed) {
          // Building finished — switch to production
          v.state = 'working';
          v.workProgress = 0;
          break;
        }
        // Build: increment construction progress
        job.constructionProgress++;
        if (job.constructionProgress >= job.constructionRequired) {
          if (job.type === 'rubble') {
            // Rubble cleared — remove it entirely
            const ridx = buildings.findIndex(b => b.id === job.id);
            if (ridx >= 0) buildings.splice(ridx, 1);
            if (job.y < state.height && job.x < state.width) {
              grid[job.y][job.x].building = null;
            }
            v.jobBuildingId = null;
            v.role = 'idle';
            v.state = 'idle';
          } else {
            job.constructed = true;
            // Switch to production on next tick
            v.state = 'working';
            v.workProgress = 0;
          }
        }
        // Head home when needed
        if (dayTick >= HOME_DEPARTURE_TICK) {
          startGoingHome(v, buildings, grid, state.width, state.height);
        }
        break;
      }

      case 'traveling_to_eat': {
        if (atDestination(v)) {
          v.state = 'eating';
        } else {
          moveOneStep(v);
          if (dayTick >= HOME_DEPARTURE_TICK) {
            startGoingHome(v, buildings, grid, state.width, state.height);
          }
        }
        break;
      }

      case 'eating': {
        // At a storehouse — consume food from global resources
        let fed = false;
        for (const { resource, satisfaction } of FOOD_PRIORITY) {
          if (resources[resource] > 0) {
            resources[resource] -= 1;
            v.food = Math.min(10, v.food + satisfaction);
            v.lastAte = resource as FoodEaten;
            fed = true;
            break;
          }
        }
        if (!fed) {
          v.food = Math.max(0, v.food - 0.5);
          v.lastAte = 'nothing' as FoodEaten;
        }

        // Done eating — resume work or go home
        if (dayTick >= HOME_DEPARTURE_TICK) {
          startGoingHome(v, buildings, grid, state.width, state.height);
        } else if (v.jobBuildingId) {
          const job = buildings.find(b => b.id === v.jobBuildingId);
          if (job) {
            const entrance = getBuildingEntrance(job);
            planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
            v.state = job.constructed ? 'traveling_to_work' : 'traveling_to_build';
          } else {
            v.state = 'idle';
          }
        } else {
          v.state = 'idle';
        }
        break;
      }

      case 'idle': {
        // Idle villagers check if hungry, otherwise do nothing
        if (v.food <= 3) {
          startEating(v, buildings, resources, grid, state.width, state.height);
        }
        if (dayTick >= HOME_DEPARTURE_TICK && v.homeBuildingId) {
          startGoingHome(v, buildings, grid, state.width, state.height);
        }
        break;
      }
    }
  }

  // Force late-stayers home near end of day
  if (dayTick >= TICKS_PER_DAY - 5 && !isNight) {
    for (const v of villagers) {
      if (v.state !== 'sleeping' && v.state !== 'traveling_home' && v.state !== 'scouting') {
        // Drop any carrying into global storage (convenience)
        for (const [res, amt] of Object.entries(v.carrying)) {
          if (amt && amt > 0) addResource(resources, res as ResourceType, amt, storageCap);
        }
        v.carrying = {};
        v.carryTotal = 0;
        startGoingHome(v, buildings, grid, state.width, state.height);
      }
    }
  }

  // ==============================================
  // RAID CHECK (daily, spawn enemies at map edge)
  // ==============================================
  let raidBar = state.raidBar;
  let raidLevel = state.raidLevel;
  let activeRaid = state.activeRaid
    ? { enemies: state.activeRaid.enemies.map(e => ({ ...e })), resolved: state.activeRaid.resolved }
    : null;
  let nextEnemyId = state.nextEnemyId;

  if (isNewDay && newDay > 20) {
    let totalRes = 0;
    for (const key of ALL_RESOURCES) totalRes += resources[key];
    const raidProsperity = totalRes / 50 + buildings.length + villagers.length;
    raidBar += raidProsperity * 0.2;
  }

  // Trigger raid — spawn enemies at map edge
  if (raidBar >= 100 && enemies.length === 0 && isNewDay) {
    raidLevel += 1;
    raidBar = 0;
    const numBandits = raidLevel + 1;
    const numWolves = raidLevel >= 4 ? raidLevel - 2 : 0;
    // Spawn at random edge based on day
    const edgeSide = newDay % 4; // 0=north, 1=south, 2=west, 3=east
    for (let i = 0; i < numBandits + numWolves; i++) {
      const type: EnemyType = i < numBandits ? 'bandit' : 'wolf';
      const t = ENEMY_TEMPLATES[type];
      let ex: number, ey: number;
      switch (edgeSide) {
        case 0: ex = Math.min(state.width - 1, (i * 3) % state.width); ey = 0; break;
        case 1: ex = Math.min(state.width - 1, (i * 3) % state.width); ey = state.height - 1; break;
        case 2: ex = 0; ey = Math.min(state.height - 1, (i * 3) % state.height); break;
        default: ex = state.width - 1; ey = Math.min(state.height - 1, (i * 3) % state.height); break;
      }
      enemies.push({
        id: `e${nextEnemyId}`, type, x: ex, y: ey,
        hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
      });
      nextEnemyId++;
    }
    events.push(`A raid of ${numBandits} bandits${numWolves > 0 ? ` and ${numWolves} wolves` : ''} attacks from the ${['north', 'south', 'west', 'east'][edgeSide]}!`);
  }

  // ==============================================
  // SPATIAL COMBAT (per-tick)
  // ==============================================
  const nextBldIdRef = { value: nextBuildingId };

  // Enemy movement: 1 tile/tick toward settlement
  const center = findSettlementCenter(buildings);
  for (const e of enemies) {
    if (e.hp <= 0) continue;

    // Check if adjacent to a guard — if so, fight instead of moving
    const adjacentGuard = villagers.find(v =>
      v.role === 'guard' && v.hp > 0 && isAdjacent(e.x, e.y, v.x, v.y)
    );
    if (adjacentGuard) continue; // will fight below

    // Check if adjacent to a wall/building — attack it
    const adjTarget = findAdjacentTarget(e.x, e.y, grid, state.width, state.height, buildings);
    if (adjTarget && (adjTarget.type === 'wall' || adjTarget.type === 'fence')) {
      // Attack the wall/fence
      adjTarget.hp -= Math.max(1, e.attack);
      if (adjTarget.hp <= 0) {
        // Destroy the building
        destroyBuilding(adjTarget, buildings, grid, villagers, state.width, state.height, nextBldIdRef);
      }
      continue;
    }

    // Move toward settlement center
    const path = findPathEnemy(grid, state.width, state.height, e.x, e.y, center.x, center.y);
    if (path.length > 0) {
      e.x = path[0].x;
      e.y = path[0].y;
    } else {
      // Can't reach center — try to attack nearest adjacent building
      if (adjTarget) {
        adjTarget.hp -= Math.max(1, e.attack);
        if (adjTarget.hp <= 0) {
          destroyBuilding(adjTarget, buildings, grid, villagers, state.width, state.height, nextBldIdRef);
        }
      }
    }
  }

  // Guard AI: detect enemies, move to intercept, fight adjacent
  const attackBonus = hasTech(research, 'military_tactics') ? 2 : 0;
  const defenseBonus = hasTech(research, 'fortification') ? 1 : 0;
  const GUARD_DETECT_RANGE = 10;

  for (const v of villagers) {
    if (v.role !== 'guard' || v.hp <= 0) continue;

    // Find nearest enemy
    let nearestEnemy: EnemyEntity | null = null;
    let nearestDist = Infinity;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dist = Math.abs(e.x - v.x) + Math.abs(e.y - v.y);
      if (dist < nearestDist) { nearestDist = dist; nearestEnemy = e; }
    }

    // No enemies or too far — patrol
    if (!nearestEnemy || nearestDist > GUARD_DETECT_RANGE) {
      if (v.patrolRoute.length > 0 && !isNight) {
        const waypoint = v.patrolRoute[v.patrolIndex % v.patrolRoute.length];
        if (v.x === waypoint.x && v.y === waypoint.y) {
          // Reached waypoint — advance to next
          v.patrolIndex = (v.patrolIndex + 1) % v.patrolRoute.length;
        } else {
          // Move toward current waypoint (1 tile/tick)
          const patrolPath = findPath(grid, state.width, state.height, v.x, v.y, waypoint.x, waypoint.y);
          if (patrolPath.length > 0) {
            v.x = patrolPath[0].x;
            v.y = patrolPath[0].y;
          }
        }
      }
      continue;
    }

    // If adjacent — fight
    if (isAdjacent(v.x, v.y, nearestEnemy.x, nearestEnemy.y)) {
      const stats = GUARD_COMBAT[v.tool];
      // Guard attacks enemy
      nearestEnemy.hp -= Math.max(1, stats.attack + attackBonus - nearestEnemy.defense);
      // Enemy attacks guard
      const guardDef = stats.defense + defenseBonus;
      v.hp -= Math.max(1, nearestEnemy.attack - guardDef);
      continue;
    }

    // Move toward enemy (1 tile/tick)
    const guardPath = findPath(grid, state.width, state.height, v.x, v.y, nearestEnemy.x, nearestEnemy.y);
    if (guardPath.length > 0) {
      v.x = guardPath[0].x;
      v.y = guardPath[0].y;
    }
  }

  // Enemies attack adjacent non-guard villagers (after guards/walls/buildings)
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    // Already fighting a guard? Skip
    const fightingGuard = villagers.some(v =>
      v.role === 'guard' && v.hp > 0 && isAdjacent(e.x, e.y, v.x, v.y)
    );
    if (fightingGuard) continue;
    // Attack adjacent non-guard villager
    const adjacentVillager = villagers.find(v =>
      v.role !== 'guard' && v.hp > 0 && isAdjacent(e.x, e.y, v.x, v.y)
    );
    if (adjacentVillager) {
      adjacentVillager.hp -= Math.max(1, e.attack);
    }
  }

  // Remove dead enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) enemies.splice(i, 1);
  }

  // Remove dead villagers (guards and non-guards)
  const deadVillagerIds = new Set(villagers.filter(v => v.hp <= 0).map(v => v.id));
  if (deadVillagerIds.size > 0) {
    for (const b of buildings) b.assignedWorkers = b.assignedWorkers.filter(id => !deadVillagerIds.has(id));
    villagers = villagers.filter(v => !deadVillagerIds.has(v.id));
  }

  // If all enemies cleared, reduce raid bar
  if (state.enemies.length > 0 && enemies.length === 0) {
    raidBar = Math.max(0, raidBar - 20);
  }
  nextBuildingId = nextBldIdRef.value;

  // Convert any 0-hp buildings to rubble (handles externally-damaged buildings)
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (b.hp <= 0 && b.type !== 'rubble') {
      // Unassign workers/residents
      for (const v of villagers) {
        if (v.jobBuildingId === b.id) { v.jobBuildingId = null; v.role = 'idle'; v.state = 'idle'; }
        if (v.homeBuildingId === b.id) v.homeBuildingId = null;
      }
      buildings.splice(i, 1);
      for (let dy = 0; dy < b.height; dy++) {
        for (let dx = 0; dx < b.width; dx++) {
          const gy = b.y + dy;
          const gx = b.x + dx;
          if (gy < state.height && gx < state.width) {
            const rubble: Building = {
              id: `b${nextBuildingId++}`,
              type: 'rubble', x: gx, y: gy, width: 1, height: 1,
              assignedWorkers: [],
              hp: 1, maxHp: 1,
              constructed: false,
              constructionProgress: 0,
              constructionRequired: CONSTRUCTION_TICKS['rubble'] || 30,
              localBuffer: {}, bufferCapacity: 0,
            };
            buildings.push(rubble);
            grid[gy][gx].building = rubble;
          }
        }
      }
    }
  }

  // ==============================================
  // WILDLIFE (per-tick: movement, behavior, spawning)
  // ==============================================

  // Animal spawning — periodically add animals to the map
  if (isNewDay && newDay % 3 === 0 && animals.length < 10) {
    const animalTypes: AnimalType[] = ['deer', 'rabbit', 'wild_wolf', 'wild_boar'];
    const rngAnimal = ((newDay * 48271 + 1) & 0x7fffffff) % animalTypes.length;
    const type = animalTypes[rngAnimal];
    const template = ANIMAL_TEMPLATES[type];
    // Spawn at map edge
    const edge = ((newDay * 16807) & 0x7fffffff) % 4;
    let ax = 0, ay = 0;
    switch (edge) {
      case 0: ax = ((newDay * 7 + 3) % state.width); ay = 0; break;
      case 1: ax = ((newDay * 7 + 3) % state.width); ay = state.height - 1; break;
      case 2: ax = 0; ay = ((newDay * 7 + 3) % state.height); break;
      default: ax = state.width - 1; ay = ((newDay * 7 + 3) % state.height); break;
    }
    if (grid[ay][ax].terrain !== 'water') {
      animals.push({
        id: `a${nextAnimalId}`, type, x: ax, y: ay,
        hp: template.maxHp, maxHp: template.maxHp,
        attack: template.attack, behavior: template.behavior,
      });
      nextAnimalId++;
    }
  }

  // Animal movement per tick
  for (const a of animals) {
    if (a.hp <= 0) continue;

    if (a.behavior === 'passive') {
      // Passive: random roam, flee from nearby entities (within 3 tiles)
      let fleeX = 0, fleeY = 0;
      let fleeing = false;
      for (const v of villagers) {
        const dist = Math.abs(v.x - a.x) + Math.abs(v.y - a.y);
        if (dist <= 3) {
          fleeX += (a.x - v.x);
          fleeY += (a.y - v.y);
          fleeing = true;
        }
      }
      if (fleeing) {
        // Move away from the threat
        const dx = fleeX > 0 ? 1 : fleeX < 0 ? -1 : 0;
        const dy = dx === 0 ? (fleeY > 0 ? 1 : fleeY < 0 ? -1 : 0) : 0;
        const nx = Math.max(0, Math.min(state.width - 1, a.x + dx));
        const ny = Math.max(0, Math.min(state.height - 1, a.y + dy));
        if (grid[ny][nx].terrain !== 'water' && !grid[ny][nx].building) {
          a.x = nx; a.y = ny;
        }
      } else if (newTick % 3 === 0) {
        // Occasional random movement
        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        const dir = dirs[(newTick + a.x * 7 + a.y * 13) % 4];
        const nx = Math.max(0, Math.min(state.width - 1, a.x + dir.dx));
        const ny = Math.max(0, Math.min(state.height - 1, a.y + dir.dy));
        if (grid[ny][nx].terrain !== 'water' && !grid[ny][nx].building) {
          a.x = nx; a.y = ny;
        }
      }
    } else {
      // Hostile: move toward nearby villagers (within 5 tiles), attack if adjacent
      let target: Villager | null = null;
      let targetDist = Infinity;
      for (const v of villagers) {
        const dist = Math.abs(v.x - a.x) + Math.abs(v.y - a.y);
        if (dist <= 5 && dist < targetDist) { target = v; targetDist = dist; }
      }
      if (target) {
        if (isAdjacent(a.x, a.y, target.x, target.y)) {
          // Attack
          target.hp -= Math.max(1, a.attack);
        } else {
          // Move toward target (1 tile/tick)
          const dx = target.x > a.x ? 1 : target.x < a.x ? -1 : 0;
          const dy = dx === 0 ? (target.y > a.y ? 1 : target.y < a.y ? -1 : 0) : 0;
          const nx = Math.max(0, Math.min(state.width - 1, a.x + dx));
          const ny = Math.max(0, Math.min(state.height - 1, a.y + dy));
          if (grid[ny][nx].terrain !== 'water' && !grid[ny][nx].building) {
            a.x = nx; a.y = ny;
          }
        }
      } else if (newTick % 5 === 0) {
        // Random roam when no target
        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        const dir = dirs[(newTick + a.x * 11 + a.y * 17) % 4];
        const nx = Math.max(0, Math.min(state.width - 1, a.x + dir.dx));
        const ny = Math.max(0, Math.min(state.height - 1, a.y + dir.dy));
        if (grid[ny][nx].terrain !== 'water' && !grid[ny][nx].building) {
          a.x = nx; a.y = ny;
        }
      }
    }
  }

  // Hunter AI: hunters track and kill animals
  for (const v of villagers) {
    if (v.role !== 'hunter' || v.hp <= 0) continue;
    if (v.state === 'sleeping') continue;

    // Find nearest animal
    let nearestAnimal: AnimalEntity | null = null;
    let nearestDist = Infinity;
    for (const a of animals) {
      if (a.hp <= 0) continue;
      const dist = Math.abs(a.x - v.x) + Math.abs(a.y - v.y);
      if (dist < nearestDist) { nearestAnimal = a; nearestDist = dist; }
    }

    if (!nearestAnimal) continue;

    if (v.state === 'hunting') {
      if (isAdjacent(v.x, v.y, nearestAnimal.x, nearestAnimal.y)) {
        // Attack the animal
        nearestAnimal.hp -= 3; // hunter attack
        if (nearestAnimal.attack > 0) {
          v.hp -= Math.max(1, nearestAnimal.attack - 1); // animal fights back
        }
      } else {
        // Move toward animal
        const dx = nearestAnimal.x > v.x ? 1 : nearestAnimal.x < v.x ? -1 : 0;
        const dy = dx === 0 ? (nearestAnimal.y > v.y ? 1 : nearestAnimal.y < v.y ? -1 : 0) : 0;
        const nx = Math.max(0, Math.min(state.width - 1, v.x + dx));
        const ny = Math.max(0, Math.min(state.height - 1, v.y + dy));
        if (grid[ny][nx].terrain !== 'water') {
          v.x = nx; v.y = ny;
        }
      }
      continue; // skip normal state machine
    }

    // If at work and animals exist, start hunting
    if (v.state === 'working' && nearestDist <= 20) {
      v.state = 'hunting';
      continue;
    }

    // Hauling drop: pick up resource drop and carry to storehouse
    if (v.state === 'hauling_drop') {
      if (atDestination(v)) {
        // At storehouse — deposit carried resources
        for (const [res, amt] of Object.entries(v.carrying)) {
          if (amt && amt > 0) addResource(resources, res as ResourceType, amt, storageCap);
        }
        v.carrying = {};
        v.carryTotal = 0;
        // Go back to work or hunt
        v.state = 'working';
        if (v.jobBuildingId) {
          const job = buildings.find(b => b.id === v.jobBuildingId);
          if (job) {
            const entrance = getBuildingEntrance(job);
            planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
            v.state = 'traveling_to_work';
          }
        }
      } else {
        moveOneStep(v);
      }
      continue;
    }
  }

  // Remove dead animals, create resource drops
  for (let i = animals.length - 1; i >= 0; i--) {
    if (animals[i].hp <= 0) {
      const dead = animals[i];
      const template = ANIMAL_TEMPLATES[dead.type];
      if (template.drops && Object.keys(template.drops).length > 0) {
        resourceDrops.push({
          id: `d${nextDropId}`, x: dead.x, y: dead.y,
          resources: { ...template.drops },
        });
        nextDropId++;
      }
      animals.splice(i, 1);
    }
  }

  // Hunters pick up resource drops when adjacent
  for (const v of villagers) {
    if (v.role !== 'hunter' || v.hp <= 0) continue;
    if (v.state !== 'hunting' && v.state !== 'working') continue;

    for (let i = resourceDrops.length - 1; i >= 0; i--) {
      const drop = resourceDrops[i];
      if (isAdjacent(v.x, v.y, drop.x, drop.y) || (v.x === drop.x && v.y === drop.y)) {
        // Pick up resources
        for (const [res, amt] of Object.entries(drop.resources)) {
          if (amt && amt > 0) {
            const canCarry = Math.min(amt, CARRY_CAPACITY - v.carryTotal);
            if (canCarry > 0) {
              v.carrying[res as ResourceType] = (v.carrying[res as ResourceType] || 0) + canCarry;
              v.carryTotal += canCarry;
            }
          }
        }
        resourceDrops.splice(i, 1);

        // Head to storehouse to deposit
        const storehouse = findNearestStorehouse(buildings, grid, state.width, state.height, v.x, v.y);
        if (storehouse) {
          const entrance = getBuildingEntrance(storehouse);
          planPath(v, grid, state.width, state.height, entrance.x, entrance.y);
          v.state = 'hauling_drop';
        }
        break; // only pick up one drop per tick
      }
    }
  }

  // Remove dead villagers (from animal attacks)
  const deadFromAnimals = new Set(villagers.filter(v => v.hp <= 0).map(v => v.id));
  if (deadFromAnimals.size > 0) {
    for (const b of buildings) b.assignedWorkers = b.assignedWorkers.filter(id => !deadFromAnimals.has(id));
    villagers = villagers.filter(v => !deadFromAnimals.has(v.id));
  }

  // ==============================================
  // MERCHANT (daily check)
  // ==============================================
  let merchant: MerchantState | null = state.merchant ? { ...state.merchant } : null;
  let merchantTimer = state.merchantTimer;
  if (isNewDay) {
    const hasMarketplace = buildings.some(b => b.type === 'marketplace');
    if (merchant) {
      merchant.ticksLeft -= 1;
      if (merchant.ticksLeft <= 0) merchant = null;
    }
    if (!merchant && hasMarketplace) {
      merchantTimer -= 1;
      if (merchantTimer <= 0) {
        merchant = { ticksLeft: 3 };
        merchantTimer = 15;
      }
    }
  }

  // ==============================================
  // PROSPERITY (daily)
  // ==============================================
  let prosperity = state.prosperity;
  if (isNewDay) {
    prosperity = 0;
    if (villagers.length > 0) {
      const avgFood = villagers.reduce((s, v) => s + v.food, 0) / villagers.length;
      if (avgFood > 3) prosperity += 10;
      if (villagers.every(v => v.homeBuildingId !== null)) prosperity += 10;
      const avgMorale = villagers.reduce((s, v) => s + v.morale, 0) / villagers.length;
      if (avgMorale > 60) prosperity += 10;
      const foodTypes = ['bread', 'wheat', 'food'] as const;
      for (const ft of foodTypes) { if (resources[ft] > 0) prosperity += 5; }
      const uniqueBuildings = new Set(buildings.map(b => b.type));
      prosperity += Math.min(30, uniqueBuildings.size * 5);
      if (villagers.some(v => v.role === 'guard')) prosperity += 10;
      if (research.completed.length > 0) prosperity += 10;
    }
    prosperity = Math.min(100, prosperity);
  }

  // ==============================================
  // EVENTS & RENOWN (daily)
  // ==============================================
  let renown = state.renown;
  let nextVId = state.nextVillagerId;
  if (villagers.length > state.villagers.length) {
    nextVId = Math.max(nextVId, state.nextVillagerId + (villagers.length - state.villagers.length));
  }

  if (isNewDay) {
    if (prosperity > 70) renown += 1;

    const eventRng = ((newDay * 2654435761 + 374761393) & 0x7fffffff) / 0x7fffffff;
    if (eventRng < 0.10 && villagers.length > 0) {
      const eventSeed = ((newDay * 6364136 + 1442695) & 0x7fffffff) / 0x7fffffff;

      if (eventSeed < 0.15) {
        resources.gold += 5;
        const bonusRes: ResourceType[] = ['wood', 'stone', 'food'];
        const pick = bonusRes[newDay % bonusRes.length];
        addResource(resources, pick, 3, storageCap);
        events.push(`A wandering trader passed through, leaving 5 gold and 3 ${pick}.`);
        renown += 1;
      } else if (eventSeed < 0.25 && (season === 'spring' || season === 'summer')) {
        addResource(resources, 'wheat', 5, storageCap);
        events.push('A bountiful harvest! +5 wheat.');
      } else if (eventSeed < 0.40) {
        raidBar = Math.min(100, raidBar + 15);
        events.push('Bandits spotted near the settlement! Raid threat increased.');
      } else if (eventSeed < 0.50) {
        const home = findHome(buildings, villagers);
        if (home) {
          const homeB = buildings.find(b => b.id === home)!;
          const entrance = getBuildingEntrance(homeB);
          const newV = createVillager(nextVId, entrance.x, entrance.y);
          newV.homeBuildingId = home;
          newV.state = 'sleeping';
          villagers.push(newV);
          nextVId++;
          events.push(`A lost traveler named ${newV.name} joined the colony!`);
        }
      } else if (eventSeed < 0.55) {
        for (const v of villagers) v.food = Math.max(0, v.food - 2);
        events.push('A mild plague swept through the colony. All villagers lost food.');
      } else if (eventSeed < 0.65) {
        for (const v of villagers) v.morale = Math.min(100, v.morale + 10);
        events.push('The villagers held a festival! Morale boosted.');
        renown += 1;
      } else if (eventSeed < 0.75) {
        const edgeX = Math.min(state.width - 1, Math.max(0, 5 + (newDay % (state.width - 10))));
        const edgeY = Math.min(state.height - 1, Math.max(0, 5 + (newDay % (state.height - 10))));
        revealArea(fog, state.width, state.height, edgeX, edgeY, 2);
        events.push(`Scouts discovered new territory near (${edgeX},${edgeY}).`);
      } else if (eventSeed < 0.85 && season === 'summer') {
        events.push('A dry spell threatens the crops.');
      } else if (eventSeed < 0.90) {
        prosperity = Math.min(100, prosperity + 3);
        events.push('A traveling priest blessed the settlement. +3 prosperity.');
      } else {
        const target = villagers[newDay % villagers.length];
        target.hp = Math.max(1, target.hp - 3);
        events.push(`A wolf attacked ${target.name}! (-3 HP)`);
      }
    }
  }

  // Quest checks (daily)
  const completedQuests = [...state.completedQuests];
  if (isNewDay) {
    if (!completedQuests.includes('first_steps') && villagers.length >= 5 && buildings.length >= 3) {
      completedQuests.push('first_steps');
      renown += 10;
      resources.gold += 20;
      events.push('Quest complete: "First Steps" — 5 villagers, 3 buildings. +10 renown, +20 gold.');
    }
    if (!completedQuests.includes('prosperous') && prosperity >= 70) {
      completedQuests.push('prosperous');
      renown += 20;
      resources.gold += 50;
      events.push('Quest complete: "Prosperous" — Settlement thriving! +20 renown, +50 gold.');
    }
  }

  const newState: GameState = {
    ...state,
    tick: newTick,
    day: newDay,
    grid, resources, storageCap, buildings, villagers,
    enemies, animals, resourceDrops, fog, territory,
    raidBar, raidLevel, activeRaid, research,
    merchant, merchantTimer, prosperity, season, weather,
    renown, events, completedQuests,
    nextVillagerId: nextVId,
    nextEnemyId, nextAnimalId, nextDropId, nextBuildingId,
  };

  const errors = validateState(newState);
  for (const err of errors) console.log(err);
  return newState;
}

// --- Helper: destroy a building ---
function destroyBuilding(
  building: Building, buildings: Building[], grid: Tile[][],
  villagers: Villager[], width: number, height: number,
  nextBuildingIdRef: { value: number },
): void {
  // Unassign workers/residents
  for (const v of villagers) {
    if (v.jobBuildingId === building.id) { v.jobBuildingId = null; v.role = 'idle'; v.state = 'idle'; }
    if (v.homeBuildingId === building.id) v.homeBuildingId = null;
  }
  // Remove original building from array
  const idx = buildings.findIndex(b => b.id === building.id);
  if (idx >= 0) buildings.splice(idx, 1);
  // Create rubble at each tile the building occupied
  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const gy = building.y + dy;
      const gx = building.x + dx;
      if (gy < height && gx < width) {
        const rubble: Building = {
          id: `b${nextBuildingIdRef.value++}`,
          type: 'rubble', x: gx, y: gy, width: 1, height: 1,
          assignedWorkers: [],
          hp: 1, maxHp: 1,
          constructed: false,
          constructionProgress: 0,
          constructionRequired: CONSTRUCTION_TICKS['rubble'] || 30,
          localBuffer: {}, bufferCapacity: 0,
        };
        buildings.push(rubble);
        grid[gy][gx].building = rubble;
      }
    }
  }
}

// --- Helper: count only output resources in buffer (for processing buildings) ---
function bufferOutputTotal(buffer: Partial<Record<ResourceType, number>>, buildingType: BuildingType): number {
  const template = BUILDING_TEMPLATES[buildingType];
  const inputKeys = template.production?.inputs ? new Set(Object.keys(template.production.inputs)) : new Set<string>();
  let total = 0;
  for (const [res, amt] of Object.entries(buffer)) {
    if (!inputKeys.has(res)) total += (amt || 0);
  }
  return total;
}

// --- Helper: start hauling from workplace to storage ---
function startHauling(v: Villager, job: Building, buildings: Building[], grid: Tile[][], width: number, height: number): void {
  // Pick up resources from building buffer — for processing buildings, only haul outputs
  const template = BUILDING_TEMPLATES[job.type];
  const inputKeys = template.production?.inputs ? new Set(Object.keys(template.production.inputs)) : new Set<string>();
  let carried = 0;
  v.carrying = {};
  for (const [res, amt] of Object.entries(job.localBuffer)) {
    if (!amt || amt <= 0) continue;
    if (inputKeys.has(res)) continue; // Don't haul inputs away from processing buildings
    const toCarry = Math.min(amt, CARRY_CAPACITY - carried);
    if (toCarry <= 0) break;
    v.carrying[res as ResourceType] = toCarry;
    job.localBuffer[res as ResourceType] = amt - toCarry;
    if ((job.localBuffer[res as ResourceType] || 0) <= 0) delete job.localBuffer[res as ResourceType];
    carried += toCarry;
  }
  v.carryTotal = carried;

  // Find nearest storehouse
  const storehouse = findNearestStorehouse(buildings, grid, width, height, v.x, v.y);
  if (storehouse) {
    const entrance = getBuildingEntrance(storehouse);
    planPath(v, grid, width, height, entrance.x, entrance.y);
    v.state = 'traveling_to_storage';
  } else {
    // No storehouse — deposit at current location into global resources
    // (fallback: resources go to global pool directly)
    v.state = 'working';
  }
}

// --- Helper: start picking up inputs from storehouse for a processing building ---
function startPickupInputs(v: Villager, job: Building, buildings: Building[], resources: Resources, grid: Tile[][], width: number, height: number): void {
  const storehouse = findNearestStorehouse(buildings, grid, width, height, v.x, v.y);
  if (storehouse) {
    const entrance = getBuildingEntrance(storehouse);
    planPath(v, grid, width, height, entrance.x, entrance.y);
    v.state = 'traveling_to_storage';
    v.haulingToWork = true;
  } else {
    // No storehouse — can't get inputs, stay idle
    v.state = 'idle';
  }
}

// --- Helper: start traveling to eat (nearest storehouse with food) ---
function startEating(v: Villager, buildings: Building[], resources: Resources, grid: Tile[][], width: number, height: number): boolean {
  const storehouse = findNearestStorehouse(buildings, grid, width, height, v.x, v.y);
  if (storehouse) {
    // Check if any food exists in global storage
    let hasFood = false;
    for (const { resource } of FOOD_PRIORITY) {
      if (resources[resource] > 0) { hasFood = true; break; }
    }
    if (hasFood) {
      const entrance = getBuildingEntrance(storehouse);
      planPath(v, grid, width, height, entrance.x, entrance.y);
      v.state = 'traveling_to_eat';
      return true;
    }
  }
  return false;
}

// --- Helper: start going home ---
function startGoingHome(v: Villager, buildings: Building[], grid: Tile[][], width: number, height: number): void {
  if (v.homeBuildingId) {
    const home = buildings.find(b => b.id === v.homeBuildingId);
    if (home) {
      const entrance = getBuildingEntrance(home);
      planPath(v, grid, width, height, entrance.x, entrance.y);
      v.state = 'traveling_home';
      return;
    }
  }
  // No home — just stay put
  v.state = 'idle';
}

// ================================================================
// BUILDING PLACEMENT
// ================================================================
export function placeBuilding(state: GameState, type: BuildingType, x: number, y: number): GameState {
  const template = BUILDING_TEMPLATES[type];
  if (!template) { console.log(`ERROR: Unknown building type '${type}'`); return state; }
  const { width: bw, height: bh } = template;

  if (x < 0 || y < 0 || x + bw > state.width || y + bh > state.height) {
    console.log(`ERROR: Building ${type} at (${x},${y}) out of bounds`); return state;
  }

  for (let dy = 0; dy < bh; dy++) {
    for (let dx = 0; dx < bw; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      const tile = state.grid[ty][tx];
      if (!state.fog[ty][tx]) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) not revealed`); return state;
      }
      if (!state.territory[ty][tx]) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) not in territory`); return state;
      }
      if (!template.allowedTerrain.includes(tile.terrain)) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) is ${tile.terrain}`); return state;
      }
      if (tile.building) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) occupied`); return state;
      }
    }
  }

  const costReduction = hasTech(state.research, 'civil_engineering') ? 0.25 : 0;
  const newResources: Resources = { ...state.resources };
  for (const [res, amount] of Object.entries(template.cost)) {
    const key = res as keyof Resources;
    const cost = Math.max(1, Math.floor((amount as number) * (1 - costReduction)));
    if (newResources[key] < cost) {
      console.log(`ERROR: Cannot place ${type} — need ${cost} ${res}, have ${newResources[key]}`); return state;
    }
    newResources[key] -= cost;
  }

  const maxHp = BUILDING_MAX_HP[type] || 50;
  const bufCap = type === 'storehouse' ? STOREHOUSE_BUFFER_CAP : DEFAULT_BUFFER_CAP;

  const constructionReq = CONSTRUCTION_TICKS[type] || 60;
  // Small/simple structures (tent, fence) are instant for early game viability
  const isInstant = type === 'tent' || type === 'fence';

  const building: Building = {
    id: `b${state.nextBuildingId}`, type, x, y, width: bw, height: bh,
    assignedWorkers: [],
    hp: maxHp, maxHp,
    constructed: isInstant,
    constructionProgress: isInstant ? constructionReq : 0,
    constructionRequired: constructionReq,
    localBuffer: {}, bufferCapacity: bufCap,
  };

  const newGrid: Tile[][] = state.grid.map((row, gy) =>
    row.map((tile, gx) => (gx >= x && gx < x + bw && gy >= y && gy < y + bh) ? { ...tile, building } : tile)
  );

  return {
    ...state, grid: newGrid, resources: newResources,
    buildings: [...state.buildings, building],
    nextBuildingId: state.nextBuildingId + 1,
    storageCap: computeStorageCap([...state.buildings, building]),
  };
}

// ================================================================
// ASSIGN VILLAGER
// ================================================================
export function assignVillager(state: GameState, villagerId: string, buildingId: string): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }

  const building = state.buildings.find(b => b.id === buildingId);
  if (!building) { console.log(`ERROR: Building ${buildingId} not found`); return state; }

  const template = BUILDING_TEMPLATES[building.type];
  if (template.maxWorkers === 0) {
    console.log(`ERROR: ${buildingId} (${building.type}) has no worker slots`); return state;
  }
  if (building.assignedWorkers.length >= template.maxWorkers) {
    console.log(`ERROR: ${buildingId} is full`); return state;
  }

  const newBuildings = state.buildings.map(b =>
    b.assignedWorkers.includes(villagerId) ? { ...b, assignedWorkers: b.assignedWorkers.filter(id => id !== villagerId) } : b
  );
  const idx = newBuildings.findIndex(b => b.id === buildingId);
  newBuildings[idx] = { ...newBuildings[idx], assignedWorkers: [...newBuildings[idx].assignedWorkers, villagerId] };

  const newVillagers = state.villagers.map(v =>
    v.id === villagerId ? { ...v, jobBuildingId: buildingId, role: roleForBuilding(building.type) } : v
  );

  return { ...state, buildings: newBuildings, villagers: newVillagers };
}

// ================================================================
// TRADE
// ================================================================
export function buyResource(state: GameState, resource: ResourceType, amount: number): GameState {
  if (!state.merchant) { console.log('ERROR: No merchant present'); return state; }
  const price = TRADE_PRICES[resource];
  if (!price) { console.log(`ERROR: Cannot trade ${resource}`); return state; }
  const totalCost = price.buy * amount;
  if (state.resources.gold < totalCost) {
    console.log(`ERROR: Need ${totalCost} gold, have ${state.resources.gold}`); return state;
  }
  const newResources = { ...state.resources };
  newResources.gold -= totalCost;
  const added = Math.min(amount, Math.max(0, state.storageCap - newResources[resource]));
  newResources[resource] += added;
  if (added < amount) console.log(`Warning: Storage full, only bought ${added} ${resource}`);
  return { ...state, resources: newResources };
}

export function sellResource(state: GameState, resource: ResourceType, amount: number): GameState {
  if (!state.merchant) { console.log('ERROR: No merchant present'); return state; }
  const price = TRADE_PRICES[resource];
  if (!price) { console.log(`ERROR: Cannot trade ${resource}`); return state; }
  if (state.resources[resource] < amount) {
    console.log(`ERROR: Have ${state.resources[resource]} ${resource}, need ${amount}`); return state;
  }
  const newResources = { ...state.resources };
  newResources[resource] -= amount;
  newResources.gold += price.sell * amount;
  return { ...state, resources: newResources };
}

// ================================================================
// RESEARCH
// ================================================================
export function setResearch(state: GameState, techId: TechId): GameState {
  if (!TECH_TREE[techId]) { console.log(`ERROR: Unknown tech '${techId}'`); return state; }
  if (state.research.completed.includes(techId)) { console.log(`ERROR: Tech '${techId}' already researched`); return state; }
  return {
    ...state,
    research: { ...state.research, current: techId, progress: state.research.current === techId ? state.research.progress : 0 },
  };
}

// ================================================================
// GUARD
// ================================================================
export function setGuard(state: GameState, villagerId: string): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }

  const newBuildings = state.buildings.map(b =>
    b.assignedWorkers.includes(villagerId) ? { ...b, assignedWorkers: b.assignedWorkers.filter(id => id !== villagerId) } : b
  );

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      const maxHp = 15 + Math.floor(v.morale / 10);
      return { ...v, skills: { ...v.skills }, traits: [...v.traits], role: 'guard' as const, jobBuildingId: null, hp: maxHp, maxHp };
    }
    return v;
  });

  return { ...state, buildings: newBuildings, villagers: newVillagers };
}

export function setPatrol(state: GameState, villagerId: string, waypoints: { x: number; y: number }[]): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }
  if (villager.role !== 'guard') { console.log(`ERROR: ${villagerId} is not a guard`); return state; }

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      return { ...v, skills: { ...v.skills }, traits: [...v.traits], patrolRoute: [...waypoints], patrolIndex: 0 };
    }
    return v;
  });

  return { ...state, villagers: newVillagers };
}

// ================================================================
// SCOUT
// ================================================================
export function sendScout(state: GameState, villagerId: string, direction: Direction): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }
  if (villager.state === 'scouting') { console.log(`ERROR: ${villagerId} is already scouting`); return state; }

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      return {
        ...v, skills: { ...v.skills }, traits: [...v.traits],
        role: 'scout' as const, state: 'scouting' as const,
        jobBuildingId: null, scoutDirection: direction, scoutTicksLeft: 50,
      };
    }
    return v;
  });

  const newBuildings = state.buildings.map(b =>
    b.assignedWorkers.includes(villagerId) ? { ...b, assignedWorkers: b.assignedWorkers.filter(id => id !== villagerId) } : b
  );

  return { ...state, villagers: newVillagers, buildings: newBuildings };
}

// ================================================================
// CLAIM TERRITORY
// ================================================================
export function claimTerritory(state: GameState, x: number, y: number): GameState {
  if (!state.buildings.some(b => b.type === 'town_hall')) {
    console.log('ERROR: Need town_hall to claim territory'); return state;
  }

  const cost = { wood: 5, stone: 2 };
  if (state.resources.wood < cost.wood || state.resources.stone < cost.stone) {
    console.log(`ERROR: Need ${cost.wood} wood, ${cost.stone} stone to claim territory`); return state;
  }

  const newResources = { ...state.resources };
  newResources.wood -= cost.wood;
  newResources.stone -= cost.stone;

  const newTerritory = state.territory.map(row => [...row]);
  for (let ty = Math.max(0, y - 2); ty <= Math.min(state.height - 1, y + 2); ty++) {
    for (let tx = Math.max(0, x - 2); tx <= Math.min(state.width - 1, x + 2); tx++) {
      if (state.fog[ty][tx]) newTerritory[ty][tx] = true;
    }
  }

  return { ...state, territory: newTerritory, resources: newResources };
}
