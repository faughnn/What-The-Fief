// helpers.ts — Shared utility functions for the simulation

import {
  BuildingType, Building, Resources, ResourceType, Villager, VillagerRole,
  Tile, BUILDING_TEMPLATES, BUILDING_SKILL_MAP,
  skillMultiplier, ToolTier, TOOL_MULTIPLIER, TOOL_DURABILITY,
  TOOL_RESOURCE, TOOL_EQUIP_PRIORITY,
  WeaponType, WEAPON_STATS, WEAPON_DURABILITY, WEAPON_RESOURCE, WEAPON_EQUIP_PRIORITY,
  EnemyEntity, ActiveRaid,
  AnimalEntity, ResourceDrop, BanditCamp,
  TechId, ResearchState,
  MerchantState,
  Season, WeatherType, HOUSING_INFO,
  BASE_STORAGE_CAP, STOREHOUSE_BONUS,
  CONSTRUCTION_TICKS,
} from '../world.js';

// --- TickState: mutable working copy of game state during a tick ---
export interface TickState {
  // Dimensions (read-only)
  width: number;
  height: number;
  // Time
  newTick: number;
  newDay: number;
  dayTick: number;
  isNight: boolean;
  isDawn: boolean;
  isNewDay: boolean;
  toolDurBonus: number;
  originalVillagerCount: number;
  // Mutable game state
  villagers: Villager[];
  resources: Resources;
  buildings: Building[];
  grid: Tile[][];
  fog: boolean[][];
  territory: boolean[][];
  enemies: EnemyEntity[];
  animals: AnimalEntity[];
  resourceDrops: ResourceDrop[];
  research: ResearchState;
  events: string[];
  storageCap: number;
  season: Season;
  weather: WeatherType;
  raidBar: number;
  raidLevel: number;
  activeRaid: ActiveRaid | null;
  merchant: MerchantState | null;
  merchantTimer: number;
  prosperity: number;
  renown: number;
  completedQuests: string[];
  banditUltimatum: { goldDemand: number; daysLeft: number } | null;
  graveyard: { name: string; day: number }[];
  npcSettlements: { id: string; name: string; direction: string; specialty: string }[];
  caravans: { id: string; settlementId: string; x: number; y: number; goods: Partial<Record<string, number>>; ticksLeft: number }[];
  banditCamps: BanditCamp[];
  nextCampId: number;
  lastCampSpawnDay: number;
  nextEnemyId: number;
  nextAnimalId: number;
  nextDropId: number;
  nextBuildingId: number;
  nextVillagerId: number;
  constructionPoints: number;
  constructionPointsMilestones: number[];
  supplyRoutes: { id: string; fromBuildingId: string; toBuildingId: string; resourceType: string; active: boolean }[];
  nextRouteId: number;
  lastFestivalDay: number;
  // O(1) lookup maps — built once per tick, used instead of buildings.find/villagers.find
  buildingMap: Map<string, Building>;
}

// --- Build O(1) lookup map from buildings array ---
export function buildBuildingMap(buildings: Building[]): Map<string, Building> {
  const map = new Map<string, Building>();
  for (const b of buildings) map.set(b.id, b);
  return map;
}

// --- Rebuild the building map after mutations (splice/push) ---
export function rebuildBuildingMap(ts: TickState): void {
  ts.buildingMap = buildBuildingMap(ts.buildings);
}

// --- Check if two positions are adjacent (Manhattan distance <= 1) ---
export function isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2) <= 1;
}

export const ROLE_MAP: Partial<Record<BuildingType, VillagerRole>> = {
  farm: 'farmer', woodcutter: 'woodcutter', quarry: 'quarrier',
  herb_garden: 'herbalist', flax_field: 'flaxer', hemp_field: 'hemper',
  iron_mine: 'miner', sawmill: 'sawyer', smelter: 'smelter',
  mill: 'miller', bakery: 'baker', tanner: 'tanner_worker',
  weaver: 'weaver_worker', ropemaker: 'ropemaker_worker',
  blacksmith: 'blacksmith_worker', toolmaker: 'toolmaker_worker', armorer: 'armorer_worker',
  weaponsmith: 'weaponsmith_worker', fletcher: 'fletcher_worker',
  research_desk: 'researcher',
  chicken_coop: 'chicken_keeper', livestock_barn: 'rancher', apiary: 'beekeeper',
  hunting_lodge: 'hunter', foraging_hut: 'forager',
  marketplace: 'trader',
  watchtower: 'guard',
  // T2 upgraded buildings inherit parent roles
  large_farm: 'farmer', deep_quarry: 'quarrier',
  lumber_mill: 'sawyer', advanced_smelter: 'smelter',
  windmill: 'miller', kitchen: 'baker',
};

export function roleForBuilding(type: BuildingType): VillagerRole {
  return ROLE_MAP[type] || 'idle';
}

export function getBuildingEntrance(b: Building): { x: number; y: number } {
  return { x: b.x, y: b.y };
}

export function findHome(buildings: Building[], villagers: Villager[]): string | null {
  for (const b of buildings) {
    const info = HOUSING_INFO[b.type];
    if (!info) continue;
    if (villagers.filter(v => v.homeBuildingId === b.id).length < info.capacity) return b.id;
  }
  return null;
}

export function computeStorageCap(buildings: Building[]): number {
  let cap = BASE_STORAGE_CAP;
  for (const b of buildings) {
    if (b.type === 'storehouse') cap += STOREHOUSE_BONUS;
    if (b.type === 'large_storehouse') cap += STOREHOUSE_BONUS * 2;
    if (b.type === 'outpost') cap += Math.floor(STOREHOUSE_BONUS / 2);
  }
  return cap;
}

export function addResource(resources: Resources, type: ResourceType, amount: number, cap: number): number {
  const space = Math.max(0, cap - resources[type]);
  const added = Math.min(amount, space);
  resources[type] += added;
  return added;
}

export function addToBuffer(buffer: Partial<Record<ResourceType, number>>, type: ResourceType, amount: number, cap: number): number {
  const current = bufferTotal(buffer);
  const space = Math.max(0, cap - current);
  const added = Math.min(amount, space);
  buffer[type] = (buffer[type] || 0) + added;
  return added;
}

export function bufferTotal(buffer: Partial<Record<ResourceType, number>>): number {
  let total = 0;
  for (const v of Object.values(buffer)) total += (v || 0);
  return total;
}

export function hasInputs(resources: Resources, inputs: Partial<Record<ResourceType, number>>): boolean {
  for (const [res, amt] of Object.entries(inputs)) {
    if (resources[res as ResourceType] < (amt as number)) return false;
  }
  return true;
}

export function hasBufferInputs(buffer: Partial<Record<ResourceType, number>>, inputs: Partial<Record<ResourceType, number>>): boolean {
  for (const [res, amt] of Object.entries(inputs)) {
    if ((buffer[res as ResourceType] || 0) < (amt as number)) return false;
  }
  return true;
}

export function consumeInputs(resources: Resources, inputs: Partial<Record<ResourceType, number>>): void {
  for (const [res, amt] of Object.entries(inputs)) {
    resources[res as ResourceType] -= amt as number;
  }
}

export function consumeBufferInputs(buffer: Partial<Record<ResourceType, number>>, inputs: Partial<Record<ResourceType, number>>): void {
  for (const [res, amt] of Object.entries(inputs)) {
    buffer[res as ResourceType] = (buffer[res as ResourceType] || 0) - (amt as number);
    if ((buffer[res as ResourceType] || 0) <= 0) delete buffer[res as ResourceType];
  }
}

export function deductFromBuffer(buffer: Partial<Record<ResourceType, number>>, res: ResourceType, amount: number): void {
  buffer[res] = (buffer[res] || 0) - amount;
  if ((buffer[res] || 0) <= 0) delete buffer[res];
}

// Deduct from both a storehouse's local buffer AND the global resource pool in one call.
// Eliminates the paired pattern of deductFromBuffer + ts.resources[res] -= N.
export function deductFromStorehouseAndGlobal(
  buffer: Partial<Record<ResourceType, number>>,
  resources: Resources,
  res: ResourceType,
  amount: number,
): void {
  deductFromBuffer(buffer, res, amount);
  resources[res] = Math.max(0, resources[res] - amount);
}

export function ticksPerUnit(buildingType: BuildingType): number {
  const template = BUILDING_TEMPLATES[buildingType];
  if (!template.production) return Infinity;
  return Math.max(1, Math.round(25 / template.production.amountPerWorker));
}

export function productionMultiplier(v: Villager, buildingType: BuildingType, research: ResearchState, season: Season, weather: WeatherType): number {
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

export function autoEquipTool(v: Villager, resources: Resources, durabilityBonus: number = 0, buildings?: Building[]): void {
  for (const tier of TOOL_EQUIP_PRIORITY) {
    const res = TOOL_RESOURCE[tier];
    if (resources[res] > 0) {
      resources[res] -= 1;
      // Also deduct from nearest storehouse buffer (physical)
      if (buildings) {
        const sh = findStorehouseWithResource(buildings, res);
        if (sh) deductFromBuffer(sh.localBuffer, res, 1);
      }
      v.tool = tier;
      v.toolDurability = Math.floor(TOOL_DURABILITY[tier] * (1 + durabilityBonus));
      return;
    }
  }
  v.tool = 'none';
  v.toolDurability = 0;
}

export function degradeTool(v: Villager, resources: Resources, durabilityBonus: number = 0, buildings?: Building[]): void {
  if (v.tool === 'none') return;
  v.toolDurability -= 1;
  if (v.toolDurability <= 0) {
    autoEquipTool(v, resources, durabilityBonus, buildings);
  }
}

export function autoEquipWeapon(v: Villager, resources: Resources, buildings?: Building[]): void {
  for (const wtype of WEAPON_EQUIP_PRIORITY) {
    const res = WEAPON_RESOURCE[wtype];
    if (resources[res] > 0) {
      resources[res] -= 1;
      if (buildings) {
        const sh = findStorehouseWithResource(buildings, res);
        if (sh) deductFromBuffer(sh.localBuffer, res, 1);
      }
      v.weapon = wtype;
      v.weaponDurability = WEAPON_DURABILITY[wtype];
      return;
    }
  }
  v.weapon = 'none';
  v.weaponDurability = 0;
}

export function degradeWeapon(v: Villager, resources: Resources, buildings?: Building[]): void {
  if (v.weapon === 'none') return;
  v.weaponDurability -= 1;
  if (v.weaponDurability <= 0) {
    autoEquipWeapon(v, resources, buildings);
  }
}

export function gainSkillXp(v: Villager, buildingType: BuildingType): void {
  const skill = BUILDING_SKILL_MAP[buildingType];
  if (!skill) return;
  let xpGain = 1;
  if (v.traits.includes('fast_learner')) xpGain = Math.ceil(xpGain * 1.5);
  if (skill === 'crafting' && v.traits.includes('skilled_crafter')) xpGain = Math.ceil(xpGain * 1.5);
  v.skills[skill] = Math.min(100, v.skills[skill] + xpGain);
}

export function hasTech(research: ResearchState, tech: TechId): boolean {
  return research.completed.includes(tech);
}

export function techProductionBonus(research: ResearchState, buildingType: BuildingType): number {
  let bonus = 0;
  if ((buildingType === 'farm' || buildingType === 'large_farm') && hasTech(research, 'crop_rotation')) bonus += 1;
  if ((buildingType === 'farm' || buildingType === 'large_farm') && hasTech(research, 'advanced_farming')) bonus += 1;
  if ((buildingType === 'quarry' || buildingType === 'deep_quarry') && hasTech(research, 'masonry')) bonus += 1;
  if (buildingType === 'herb_garden' && hasTech(research, 'herbalism_lore')) bonus += 1;
  if ((buildingType === 'smelter' || buildingType === 'advanced_smelter') && hasTech(research, 'metallurgy')) bonus += 1;
  if ((buildingType === 'bakery' || buildingType === 'kitchen') && hasTech(research, 'basic_cooking')) bonus += 1;
  // Master crafting: +1 to ALL production buildings
  if (hasTech(research, 'master_crafting')) bonus += 1;
  return bonus;
}

export function revealArea(fog: boolean[][], width: number, height: number, cx: number, cy: number, radius: number): void {
  for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++) {
      fog[y][x] = true;
    }
  }
}

export function isStorehouse(type: BuildingType): boolean {
  return type === 'storehouse' || type === 'large_storehouse' || type === 'outpost';
}

export function findStorehouseAt(buildings: Building[], x: number, y: number): Building | null {
  for (const b of buildings) {
    if (!isStorehouse(b.type) || !b.constructed) continue;
    if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) return b;
  }
  return null;
}

export function findNearestBuilding(
  buildings: Building[], x: number, y: number,
  predicate: (b: Building) => boolean,
): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    if (!predicate(b)) continue;
    const entrance = getBuildingEntrance(b);
    const dist = Math.abs(entrance.x - x) + Math.abs(entrance.y - y);
    if (dist < bestDist) { bestDist = dist; best = b; }
  }
  return best;
}

export function findStorehouseWithResource(buildings: Building[], res: ResourceType): Building | null {
  for (const b of buildings) {
    if (isStorehouse(b.type) && b.constructed && (b.localBuffer[res] || 0) > 0) return b;
  }
  return null;
}

export function findNearestStorehouse(buildings: Building[], grid: Tile[][], width: number, height: number, x: number, y: number): Building | null {
  return findNearestBuilding(buildings, x, y, b => isStorehouse(b.type));
}

export function destroyBuildingAndCreateRubble(
  building: Building,
  buildings: Building[],
  grid: Tile[][],
  villagers: { id: string; jobBuildingId: string | null; homeBuildingId: string | null; role: string; state: string }[],
  width: number, height: number,
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
          onFire: false,
        };
        buildings.push(rubble);
        grid[gy][gx] = { ...grid[gy][gx], building: rubble };
      }
    }
  }
}
