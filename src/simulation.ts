// simulation.ts — All game rules. Pure functions: old state in, new state out.

import {
  GameState, BuildingType, Building, Resources, ResourceType, Villager, VillagerRole,
  Tile, BUILDING_TEMPLATES, createVillager, BASE_STORAGE_CAP, STOREHOUSE_BONUS,
  SPOILAGE, FOOD_PRIORITY, ALL_RESOURCES, SkillType, BUILDING_SKILL_MAP,
  skillMultiplier, FoodEaten, ToolTier, TOOL_MULTIPLIER, TOOL_DURABILITY,
  TOOL_RESOURCE, TOOL_EQUIP_PRIORITY, Direction,
  Enemy, ActiveRaid, ENEMY_TEMPLATES, GUARD_COMBAT, EnemyType,
  TechId, TECH_TREE, ResearchState,
} from './world.js';

// --- BFS Pathfinding ---
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
      const newPath = [...current.path, { x: nx, y: ny }];
      if (nx === toX && ny === toY) return newPath;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: newPath });
    }
  }
  return [];
}

// --- Helpers ---
const HOUSE_CAPACITY = 2;
const MAX_COMMUTE = 20;

function getBuildingEntrance(b: Building): { x: number; y: number } {
  return { x: b.x, y: b.y };
}

const ROLE_MAP: Partial<Record<BuildingType, VillagerRole>> = {
  farm: 'farmer', woodcutter: 'woodcutter', quarry: 'quarrier',
  herb_garden: 'herbalist', flax_field: 'flaxer', hemp_field: 'hemper',
  iron_mine: 'miner', sawmill: 'sawyer', smelter: 'smelter',
  mill: 'miller', bakery: 'baker', tanner: 'tanner_worker',
  weaver: 'weaver_worker', ropemaker: 'ropemaker_worker',
  blacksmith: 'blacksmith_worker', toolmaker: 'toolmaker_worker', armorer: 'armorer_worker',
  research_desk: 'researcher',
};

function roleForBuilding(type: BuildingType): VillagerRole {
  return ROLE_MAP[type] || 'idle';
}

function findHome(buildings: Building[], villagers: Villager[]): string | null {
  for (const b of buildings) {
    if (b.type !== 'house') continue;
    if (villagers.filter(v => v.homeBuildingId === b.id).length < HOUSE_CAPACITY) return b.id;
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

function hasInputs(resources: Resources, inputs: Partial<Record<ResourceType, number>>): boolean {
  for (const [res, amt] of Object.entries(inputs)) {
    if (resources[res as ResourceType] < (amt as number)) return false;
  }
  return true;
}

function consumeInputs(resources: Resources, inputs: Partial<Record<ResourceType, number>>): void {
  for (const [res, amt] of Object.entries(inputs)) {
    resources[res as ResourceType] -= amt as number;
  }
}

// --- State Validation ---
export function validateState(state: GameState): string[] {
  const errors: string[] = [];

  for (const key of ALL_RESOURCES) {
    if (state.resources[key] < 0) errors.push(`ERROR: Negative resource ${key}=${state.resources[key]}`);
    if (state.resources[key] > state.storageCap) errors.push(`ERROR: Resource ${key}=${state.resources[key]} exceeds cap ${state.storageCap}`);
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

// --- Production modifier ---
function productionOutput(v: Villager, buildingType: BuildingType, baseAmount: number): number {
  let mult = 1.0;

  // Skill modifier
  const skill = BUILDING_SKILL_MAP[buildingType];
  if (skill) mult *= skillMultiplier(v.skills[skill]);

  // Trait modifiers
  if (v.traits.includes('strong')) mult *= 1.2;
  if (v.traits.includes('lazy')) mult *= 0.8;

  // Morale modifier
  if (v.morale >= 70) mult *= 1.1;
  else if (v.morale < 30) mult *= 0.8;

  // Tool modifier
  mult *= TOOL_MULTIPLIER[v.tool];

  return Math.max(1, Math.floor(baseAmount * mult));
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

function calculateMorale(v: Villager): number {
  let morale = 50;
  if (v.homeBuildingId) morale += 10;
  switch (v.lastAte) {
    case 'bread': morale += 10; break;
    case 'flour': morale += 5; break;
    case 'wheat': case 'food': break;
    case 'nothing': morale -= 20; break;
  }
  if (v.traits.includes('cheerful')) morale += 10;
  if (v.traits.includes('gloomy')) morale -= 10;
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

// --- Tick ---
export function tick(state: GameState): GameState {
  let villagers = state.villagers.map(v => ({ ...v, skills: { ...v.skills }, traits: [...v.traits] }));
  const resources: Resources = { ...state.resources };
  const buildings = state.buildings.map(b => ({ ...b, assignedWorkers: [...b.assignedWorkers] }));
  const storageCap = computeStorageCap(buildings);
  const fog = state.fog.map(row => [...row]);
  const territory = state.territory.map(row => [...row]);
  const grid = state.grid.map(row => row.map(t => ({ ...t })));
  const research: ResearchState = {
    completed: [...state.research.completed],
    current: state.research.current,
    progress: state.research.progress,
  };

  const toolDurBonus = hasTech(research, 'improved_tools') ? 0.2 : 0;

  // 1. Auto-assign homeless
  for (const v of villagers) {
    if (!v.homeBuildingId) {
      const homeId = findHome(buildings, villagers);
      if (homeId) v.homeBuildingId = homeId;
    }
  }

  // 2. Work — data-driven production with skill/trait/morale modifiers
  let researchKnowledge = 0;
  for (const v of villagers) {
    if (!v.jobBuildingId) continue;
    const job = buildings.find(b => b.id === v.jobBuildingId);
    if (!job) continue;

    const template = BUILDING_TEMPLATES[job.type];

    // Research desk: produce knowledge instead of resources
    if (job.type === 'research_desk') {
      const entrance = getBuildingEntrance(job);
      const pathToWork = findPath(grid, state.width, state.height, v.x, v.y, entrance.x, entrance.y);
      const canReach = (v.x === entrance.x && v.y === entrance.y) || pathToWork.length > 0;
      if (!canReach || pathToWork.length > MAX_COMMUTE) { v.state = 'idle'; continue; }
      v.x = entrance.x;
      v.y = entrance.y;
      v.state = 'working';
      if (v.tool === 'none') autoEquipTool(v, resources, toolDurBonus);
      researchKnowledge += productionOutput(v, job.type, 1);
      degradeTool(v, resources, toolDurBonus);
      gainSkillXp(v, job.type);
      continue;
    }

    if (!template.production) continue;

    const entrance = getBuildingEntrance(job);
    const pathToWork = findPath(grid, state.width, state.height, v.x, v.y, entrance.x, entrance.y);
    const canReach = (v.x === entrance.x && v.y === entrance.y) || pathToWork.length > 0;

    if (!canReach || pathToWork.length > MAX_COMMUTE) { v.state = 'idle'; continue; }

    const prod = template.production;
    if (prod.inputs && !hasInputs(resources, prod.inputs)) { v.state = 'idle'; continue; }

    if (prod.inputs) consumeInputs(resources, prod.inputs);

    v.x = entrance.x;
    v.y = entrance.y;
    v.state = 'working';

    // Auto-equip tool if none equipped
    if (v.tool === 'none') autoEquipTool(v, resources, toolDurBonus);

    const baseAmount = prod.amountPerWorker + techProductionBonus(research, job.type);
    const output = productionOutput(v, job.type, baseAmount);
    addResource(resources, prod.output, output, storageCap);

    // Tool wear
    degradeTool(v, resources, toolDurBonus);

    // Gain XP
    gainSkillXp(v, job.type);
  }

  // 2b. Scouting
  for (const v of villagers) {
    if (v.state !== 'scouting' || !v.scoutDirection) continue;
    const dir = v.scoutDirection;
    const moveX = dir === 'e' ? 5 : dir === 'w' ? -5 : 0;
    const moveY = dir === 's' ? 5 : dir === 'n' ? -5 : 0;
    v.x = Math.max(0, Math.min(state.width - 1, v.x + moveX));
    v.y = Math.max(0, Math.min(state.height - 1, v.y + moveY));
    revealArea(fog, state.width, state.height, v.x, v.y, 5);
    v.scoutTicksLeft -= 1;
    if (v.scoutTicksLeft <= 0 || v.x === 0 || v.y === 0 || v.x === state.width - 1 || v.y === state.height - 1) {
      v.scoutDirection = null;
      v.scoutTicksLeft = 0;
      v.state = 'idle';
      v.role = 'idle';
    }
  }

  // 2c. Research progress
  if (research.current && researchKnowledge > 0) {
    const tech = TECH_TREE[research.current];
    research.progress += researchKnowledge;
    if (research.progress >= tech.cost) {
      research.completed.push(research.current);
      research.current = null;
      research.progress = 0;
    }
  }

  // 3. Eat — food priority: bread > flour > wheat > food
  for (const v of villagers) {
    const isGlutton = v.traits.includes('glutton');
    const isFrugal = v.traits.includes('frugal');
    const meals = isGlutton ? 2 : (isFrugal && state.day % 2 === 0) ? 0 : 1;

    v.lastAte = 'nothing' as FoodEaten;
    for (let m = 0; m < meals; m++) {
      let fed = false;
      for (const { resource, satisfaction } of FOOD_PRIORITY) {
        if (resources[resource] > 0) {
          resources[resource] -= 1;
          v.food = Math.min(10, v.food + satisfaction);
          if (m === 0) v.lastAte = resource as FoodEaten;
          fed = true;
          break;
        }
      }
      if (!fed && m === 0) { v.food -= 1; v.lastAte = 'nothing'; }
    }
    if (meals === 0) {
      // Frugal skipping — still counts as having eaten (just less)
      v.lastAte = 'food';
      v.food = Math.max(0, v.food - 0.5);
    }
  }

  // 4. Calculate morale
  for (const v of villagers) {
    v.morale = calculateMorale(v);
  }

  // 5. Return home
  for (const v of villagers) {
    if (v.homeBuildingId) {
      const home = buildings.find(b => b.id === v.homeBuildingId);
      if (home) {
        const entrance = getBuildingEntrance(home);
        v.x = entrance.x;
        v.y = entrance.y;
        v.state = 'sleeping';
      }
    } else if (v.state !== 'working') {
      v.state = 'idle';
    }
  }

  // 6. Housing check
  for (const v of villagers) {
    v.homeless = v.homeBuildingId ? 0 : v.homeless + 1;
  }

  // 7. Spoilage
  for (const [res, rate] of Object.entries(SPOILAGE)) {
    const key = res as ResourceType;
    const loss = Math.floor(resources[key] * rate);
    resources[key] = Math.max(0, resources[key] - loss);
  }

  // 8. Departure — food<=0 OR homeless>=5 OR morale<=10
  const departing = villagers.filter(v => v.food <= 0 || v.homeless >= 5 || v.morale <= 10);
  for (const d of departing) {
    for (const b of buildings) b.assignedWorkers = b.assignedWorkers.filter(id => id !== d.id);
  }
  villagers = villagers.filter(v => v.food > 0 && v.homeless < 5 && v.morale > 10);

  // 9. Immigration
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

  // 10. Guard equip tools
  for (const v of villagers) {
    if (v.role === 'guard' && v.tool === 'none') autoEquipTool(v, resources, toolDurBonus);
  }

  // 11. Raid check
  let raidBar = state.raidBar;
  let raidLevel = state.raidLevel;
  let activeRaid: ActiveRaid | null = state.activeRaid
    ? { enemies: state.activeRaid.enemies.map(e => ({ ...e })), resolved: state.activeRaid.resolved }
    : null;

  // Prosperity drives raid bar
  let totalRes = 0;
  for (const key of ALL_RESOURCES) totalRes += resources[key];
  const prosperity = totalRes / 50 + buildings.length + villagers.length;
  raidBar += prosperity * 0.5;

  // Trigger raid
  if (raidBar >= 100 && !activeRaid) {
    raidLevel += 1;
    raidBar = 0;
    const enemies: Enemy[] = [];
    const numBandits = raidLevel <= 2 ? raidLevel * 2 + 1 : raidLevel * 2;
    const numWolves = raidLevel >= 3 ? raidLevel : 0;
    for (let i = 0; i < numBandits; i++) {
      const t = ENEMY_TEMPLATES.bandit;
      enemies.push({ type: 'bandit', hp: t.maxHp, attack: t.attack, defense: t.defense });
    }
    for (let i = 0; i < numWolves; i++) {
      const t = ENEMY_TEMPLATES.wolf;
      enemies.push({ type: 'wolf', hp: t.maxHp, attack: t.attack, defense: t.defense });
    }
    activeRaid = { enemies, resolved: false };
  }

  // 12. Combat resolution
  if (activeRaid && !activeRaid.resolved) {
    const guards = villagers.filter(v => v.role === 'guard');
    const enemies = activeRaid.enemies.filter(e => e.hp > 0);

    // Tech bonuses for combat
    const attackBonus = hasTech(research, 'military_tactics') ? 2 : 0;
    const defenseBonus = hasTech(research, 'fortification') ? 1 : 0;

    // Resolve rounds until one side is eliminated (max 10 rounds)
    for (let round = 0; round < 10 && guards.some(g => g.hp > 0) && enemies.some(e => e.hp > 0); round++) {
      // Guards attack
      for (const g of guards) {
        if (g.hp <= 0) continue;
        const stats = GUARD_COMBAT[g.tool];
        const target = enemies.find(e => e.hp > 0);
        if (target) target.hp -= Math.max(1, stats.attack + attackBonus - target.defense);
      }
      // Enemies attack
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const target = guards.find(g => g.hp > 0);
        if (target) {
          const guardDef = GUARD_COMBAT[target.tool].defense + defenseBonus;
          target.hp -= Math.max(1, e.attack - guardDef);
        }
      }
    }

    const guardsAlive = guards.filter(g => g.hp > 0);
    const enemiesAlive = enemies.filter(e => e.hp > 0);

    if (enemiesAlive.length === 0) {
      // Victory
      raidBar = Math.max(0, raidBar - 20);
    } else {
      // Defeat — destroy a random building, steal food
      if (buildings.length > 0) {
        const idx = state.day % buildings.length;
        const destroyed = buildings[idx];
        // Clear building from grid
        for (let dy = 0; dy < destroyed.height; dy++) {
          for (let dx = 0; dx < destroyed.width; dx++) {
            grid[destroyed.y + dy][destroyed.x + dx].building = null;
          }
        }
        buildings.splice(idx, 1);
        // Unassign workers
        for (const v of villagers) {
          if (v.jobBuildingId === destroyed.id) { v.jobBuildingId = null; v.role = 'idle'; }
          if (v.homeBuildingId === destroyed.id) v.homeBuildingId = null;
        }
      }
      // Steal 20% food/wheat
      const foodStolen = Math.floor(resources.food * 0.2);
      const wheatStolen = Math.floor(resources.wheat * 0.2);
      resources.food -= foodStolen;
      resources.wheat -= wheatStolen;
    }

    // Remove dead guards from villagers
    const deadGuardIds = new Set(guards.filter(g => g.hp <= 0).map(g => g.id));
    if (deadGuardIds.size > 0) {
      for (const b of buildings) b.assignedWorkers = b.assignedWorkers.filter(id => !deadGuardIds.has(id));
      villagers = villagers.filter(v => !deadGuardIds.has(v.id));
    }

    activeRaid = { enemies: enemies.filter(e => e.hp > 0), resolved: true };
  }

  // Clear resolved raids
  if (activeRaid?.resolved) activeRaid = null;

  // 13. Guard maxHp recalculation and healing (2 HP/day)
  for (const v of villagers) {
    if (v.role === 'guard') {
      v.maxHp = 10 + Math.floor(v.morale / 10);
    } else {
      v.maxHp = 10;
    }
    if (v.hp < v.maxHp) v.hp = Math.min(v.maxHp, v.hp + 2);
    v.hp = Math.min(v.hp, v.maxHp);
  }

  const newState: GameState = {
    ...state,
    day: state.day + 1, grid, resources, storageCap, buildings, villagers, fog, territory,
    raidBar, raidLevel, activeRaid, research,
    nextVillagerId: villagers.length > state.villagers.length
      ? state.nextVillagerId + 1 : state.nextVillagerId,
  };

  const errors = validateState(newState);
  for (const err of errors) console.log(err);
  return newState;
}

// --- Building Placement ---
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

  const building: Building = { id: `b${state.nextBuildingId}`, type, x, y, width: bw, height: bh, assignedWorkers: [] };
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

// --- Assign Villager ---
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

// --- Set Research ---
export function setResearch(state: GameState, techId: TechId): GameState {
  if (!TECH_TREE[techId]) { console.log(`ERROR: Unknown tech '${techId}'`); return state; }
  if (state.research.completed.includes(techId)) { console.log(`ERROR: Tech '${techId}' already researched`); return state; }
  return {
    ...state,
    research: { ...state.research, current: techId, progress: state.research.current === techId ? state.research.progress : 0 },
  };
}

// --- Set Guard ---
export function setGuard(state: GameState, villagerId: string): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }

  // Remove from current job
  const newBuildings = state.buildings.map(b =>
    b.assignedWorkers.includes(villagerId) ? { ...b, assignedWorkers: b.assignedWorkers.filter(id => id !== villagerId) } : b
  );

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      const maxHp = 10 + Math.floor(v.morale / 10);
      return { ...v, skills: { ...v.skills }, traits: [...v.traits], role: 'guard' as const, jobBuildingId: null, hp: maxHp, maxHp };
    }
    return v;
  });

  return { ...state, buildings: newBuildings, villagers: newVillagers };
}

// --- Send Scout ---
export function sendScout(state: GameState, villagerId: string, direction: Direction): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }
  if (villager.state === 'scouting') { console.log(`ERROR: ${villagerId} is already scouting`); return state; }

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      return {
        ...v, skills: { ...v.skills }, traits: [...v.traits],
        role: 'scout' as const, state: 'scouting' as const,
        jobBuildingId: null, scoutDirection: direction, scoutTicksLeft: 10,
      };
    }
    return v;
  });

  // Remove from any building assignment
  const newBuildings = state.buildings.map(b =>
    b.assignedWorkers.includes(villagerId) ? { ...b, assignedWorkers: b.assignedWorkers.filter(id => id !== villagerId) } : b
  );

  return { ...state, villagers: newVillagers, buildings: newBuildings };
}

// --- Claim Territory ---
export function claimTerritory(state: GameState, x: number, y: number): GameState {
  // Claims a 5x5 area centered on (x,y). Requires town_hall.
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
