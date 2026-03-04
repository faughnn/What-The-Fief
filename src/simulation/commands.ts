// commands.ts — Player commands (assign, guard, patrol, scout, research, trade)

import {
  GameState, BuildingType, Building, Resources, ResourceType,
  Villager, VillagerRole, Direction, Tile, SupplyRoute,
  BUILDING_TEMPLATES, TRADE_PRICES, UPGRADE_PATHS,
  BUILDING_MAX_HP, CONSTRUCTION_TICKS,
  TechId, TECH_TREE, MerchantState,
  GuardMode, GuardLine,
} from '../world.js';
import { roleForBuilding, bufferTotal, findNearestStorehouse, isStorehouse, deductFromBuffer } from './helpers.js';

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

export function buyResource(state: GameState, resource: ResourceType, amount: number): GameState {
  if (!state.merchant) { console.log('ERROR: No merchant present'); return state; }
  // Merchant must be at the marketplace
  const marketplace = state.buildings.find(b => b.type === 'marketplace' && b.constructed);
  if (!marketplace) { console.log('ERROR: No constructed marketplace'); return state; }
  const mpEntrance = { x: marketplace.x, y: marketplace.y };
  if (state.merchant.x !== mpEntrance.x || state.merchant.y !== mpEntrance.y) {
    console.log('ERROR: Merchant not at marketplace yet'); return state;
  }
  const price = TRADE_PRICES[resource];
  if (!price) { console.log(`ERROR: Cannot trade ${resource}`); return state; }
  const totalCost = price.buy * amount;
  if (state.resources.gold < totalCost) {
    console.log(`ERROR: Need ${totalCost} gold, have ${state.resources.gold}`); return state;
  }
  const newResources = { ...state.resources };
  newResources.gold -= totalCost;
  // Deposit bought goods into marketplace local buffer
  const newBuildings = state.buildings.map(b => {
    if (b.id === marketplace.id) {
      const newBuffer = { ...b.localBuffer };
      const added = Math.min(amount, Math.max(0, b.bufferCapacity - bufferTotal(newBuffer)));
      newBuffer[resource] = (newBuffer[resource] || 0) + added;
      if (added < amount) console.log(`Warning: Marketplace buffer full, only bought ${added} ${resource}`);
      return { ...b, localBuffer: newBuffer };
    }
    return b;
  });
  return { ...state, resources: newResources, buildings: newBuildings };
}

export function sellResource(state: GameState, resource: ResourceType, amount: number): GameState {
  if (!state.merchant) { console.log('ERROR: No merchant present'); return state; }
  // Merchant must be at the marketplace
  const marketplace = state.buildings.find(b => b.type === 'marketplace' && b.constructed);
  if (!marketplace) { console.log('ERROR: No constructed marketplace'); return state; }
  const mpEntrance = { x: marketplace.x, y: marketplace.y };
  if (state.merchant.x !== mpEntrance.x || state.merchant.y !== mpEntrance.y) {
    console.log('ERROR: Merchant not at marketplace yet'); return state;
  }
  const price = TRADE_PRICES[resource];
  if (!price) { console.log(`ERROR: Cannot trade ${resource}`); return state; }
  // Sell from marketplace local buffer (goods must be physically present)
  const mpBuffer = marketplace.localBuffer[resource] || 0;
  if (mpBuffer < amount) {
    console.log(`ERROR: Marketplace has ${mpBuffer} ${resource}, need ${amount}`); return state;
  }
  const newResources = { ...state.resources };
  newResources[resource] = Math.max(0, newResources[resource] - amount);
  newResources.gold += price.sell * amount;
  // Remove from marketplace buffer
  const newBuildings = state.buildings.map(b => {
    if (b.id === marketplace.id) {
      const newBuffer = { ...b.localBuffer };
      deductFromBuffer(newBuffer, resource, amount);
      return { ...b, localBuffer: newBuffer };
    }
    return b;
  });
  return { ...state, resources: newResources, buildings: newBuildings };
}

export function setResearch(state: GameState, techId: TechId): GameState {
  if (!TECH_TREE[techId]) { console.log(`ERROR: Unknown tech '${techId}'`); return state; }
  if (state.research.completed.includes(techId)) { console.log(`ERROR: Tech '${techId}' already researched`); return state; }
  // Check prerequisites
  const tech = TECH_TREE[techId];
  for (const prereq of tech.prerequisites) {
    if (!state.research.completed.includes(prereq)) {
      console.log(`ERROR: Tech '${techId}' requires '${prereq}' first`);
      return state;
    }
  }
  return {
    ...state,
    research: { ...state.research, current: techId, progress: state.research.current === techId ? state.research.progress : 0 },
  };
}

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

export function payTribute(state: GameState): GameState {
  if (!state.banditUltimatum) { console.log('ERROR: No active bandit ultimatum'); return state; }
  const cost = state.banditUltimatum.goldDemand;
  if (state.resources.gold < cost) {
    console.log(`ERROR: Need ${cost} gold for tribute, have ${state.resources.gold}`); return state;
  }
  return {
    ...state,
    resources: { ...state.resources, gold: state.resources.gold - cost },
    banditUltimatum: null,
  };
}

export function setFormation(state: GameState, villagerId: string, mode: GuardMode, line: GuardLine): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }
  if (villager.role !== 'guard') { console.log(`ERROR: ${villagerId} is not a guard`); return state; }

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      return { ...v, skills: { ...v.skills }, traits: [...v.traits], guardMode: mode, guardLine: line };
    }
    return v;
  });

  return { ...state, villagers: newVillagers };
}

export function assaultCamp(state: GameState, villagerId: string, campId: string): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }
  if (villager.role !== 'guard') { console.log(`ERROR: ${villagerId} is not a guard`); return state; }
  const camp = state.banditCamps.find(c => c.id === campId);
  if (!camp) { console.log(`ERROR: Camp ${campId} not found`); return state; }

  const newVillagers = state.villagers.map(v => {
    if (v.id === villagerId) {
      return { ...v, skills: { ...v.skills }, traits: [...v.traits], assaultTargetId: campId, state: 'assaulting_camp' as const };
    }
    return v;
  });

  return { ...state, villagers: newVillagers };
}

export function setPreferredJob(state: GameState, villagerId: string, jobType: BuildingType | null): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }
  if (jobType !== null && !BUILDING_TEMPLATES[jobType]) {
    console.log(`ERROR: Unknown building type '${jobType}'`); return state;
  }
  if (jobType !== null && BUILDING_TEMPLATES[jobType].maxWorkers === 0) {
    console.log(`ERROR: ${jobType} has no worker slots`); return state;
  }

  const newVillagers = state.villagers.map(v =>
    v.id === villagerId ? { ...v, skills: { ...v.skills }, traits: [...v.traits], preferredJob: jobType } : v
  );
  return { ...state, villagers: newVillagers };
}

export function upgradeBuilding(state: GameState, buildingId: string): GameState {
  const building = state.buildings.find(b => b.id === buildingId);
  if (!building) { console.log(`ERROR: Building ${buildingId} not found`); return state; }

  const path = UPGRADE_PATHS[building.type];
  if (!path) { console.log(`ERROR: No upgrade path for ${building.type}`); return state; }

  const toTemplate = BUILDING_TEMPLATES[path.to];

  // Check resources
  const newResources: Resources = { ...state.resources };
  const nearestSH = findNearestStorehouse(state.buildings, state.grid, state.width, state.height, building.x, building.y);
  const newBuildings0 = state.buildings.map(b => ({ ...b, localBuffer: { ...b.localBuffer } }));
  const shForCost = nearestSH ? newBuildings0.find(b => b.id === nearestSH.id) : null;

  for (const [res, amount] of Object.entries(path.cost)) {
    const key = res as keyof Resources;
    const cost = amount as number;
    if (newResources[key] < cost) {
      console.log(`ERROR: Cannot upgrade ${building.type} — need ${cost} ${res}, have ${newResources[key]}`); return state;
    }
  }

  // Check expanded footprint for size-changing upgrades
  const newW = toTemplate.width;
  const newH = toTemplate.height;
  if (newW > building.width || newH > building.height) {
    for (let dy = 0; dy < newH; dy++) {
      for (let dx = 0; dx < newW; dx++) {
        const tx = building.x + dx;
        const ty = building.y + dy;
        if (tx >= state.width || ty >= state.height) {
          console.log(`ERROR: Upgrade to ${path.to} goes out of bounds at (${tx},${ty})`); return state;
        }
        // Skip tiles already owned by this building
        if (dx < building.width && dy < building.height) continue;
        const tile = state.grid[ty][tx];
        if (tile.building) {
          console.log(`ERROR: Cannot upgrade to ${path.to} — tile (${tx},${ty}) occupied`); return state;
        }
        if (!state.fog[ty][tx] || !state.territory[ty][tx]) {
          console.log(`ERROR: Cannot upgrade to ${path.to} — tile (${tx},${ty}) not revealed/territory`); return state;
        }
      }
    }
  }

  // Deduct resources
  for (const [res, amount] of Object.entries(path.cost)) {
    const key = res as keyof Resources;
    const cost = amount as number;
    newResources[key] -= cost;
    if (shForCost) {
      deductFromBuffer(shForCost.localBuffer, key as ResourceType, cost);
    }
  }

  // Upgrade the building in-place
  const maxHp = BUILDING_MAX_HP[path.to] || 50;
  const constructionReq = CONSTRUCTION_TICKS[path.to] || 60;

  const upgraded: Building = {
    ...building,
    type: path.to,
    width: newW,
    height: newH,
    hp: maxHp,
    maxHp,
    constructed: false,
    constructionProgress: 0,
    constructionRequired: constructionReq,
    localBuffer: {},
    bufferCapacity: building.bufferCapacity,
  };

  // Update buildings array
  const newBuildings = newBuildings0.map(b => b.id === buildingId ? upgraded : b);

  // Update grid — clear old tiles, claim new tiles
  const newGrid: Tile[][] = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      // Clear old building footprint
      if (tile.building && tile.building.id === buildingId) {
        return { ...tile, building: null };
      }
      return tile;
    })
  );
  // Claim new footprint
  for (let dy = 0; dy < newH; dy++) {
    for (let dx = 0; dx < newW; dx++) {
      newGrid[building.y + dy][building.x + dx] = {
        ...newGrid[building.y + dy][building.x + dx],
        building: upgraded,
      };
    }
  }

  return { ...state, grid: newGrid, resources: newResources, buildings: newBuildings };
}

// --- Supply Route Commands ---

export function createSupplyRoute(
  state: GameState,
  villagerId: string,
  fromBuildingId: string,
  toBuildingId: string,
  resourceType: ResourceType | 'any' = 'any',
): GameState {
  const villager = state.villagers.find(v => v.id === villagerId);
  if (!villager) { console.log(`ERROR: Villager ${villagerId} not found`); return state; }
  if (villager.role !== 'idle') {
    console.log(`ERROR: Villager ${villagerId} must be idle to assign as hauler (current role: ${villager.role})`);
    return state;
  }

  const fromBuilding = state.buildings.find(b => b.id === fromBuildingId);
  if (!fromBuilding) { console.log(`ERROR: Source building ${fromBuildingId} not found`); return state; }
  if (!isStorehouse(fromBuilding.type)) {
    console.log(`ERROR: Source must be a storehouse/outpost (got ${fromBuilding.type})`); return state;
  }

  const toBuilding = state.buildings.find(b => b.id === toBuildingId);
  if (!toBuilding) { console.log(`ERROR: Destination building ${toBuildingId} not found`); return state; }
  if (!isStorehouse(toBuilding.type)) {
    console.log(`ERROR: Destination must be a storehouse/outpost (got ${toBuilding.type})`); return state;
  }

  if (fromBuildingId === toBuildingId) {
    console.log(`ERROR: Source and destination must be different buildings`); return state;
  }

  const routeId = `route${state.nextRouteId}`;
  const route: SupplyRoute = {
    id: routeId,
    fromBuildingId,
    toBuildingId,
    resourceType,
    active: true,
  };

  const newVillagers = state.villagers.map(v =>
    v.id === villagerId
      ? { ...v, skills: { ...v.skills }, traits: [...v.traits], path: [...v.path],
          carrying: { ...v.carrying }, patrolRoute: [...v.patrolRoute],
          recentMeals: [...v.recentMeals], family: [...v.family],
          role: 'hauler' as const, supplyRouteId: routeId, state: 'supply_traveling_to_source' as const,
          jobBuildingId: null }
      : v
  );

  return {
    ...state,
    villagers: newVillagers,
    supplyRoutes: [...state.supplyRoutes, route],
    nextRouteId: state.nextRouteId + 1,
  };
}

export function cancelSupplyRoute(state: GameState, routeId: string): GameState {
  const route = state.supplyRoutes.find(r => r.id === routeId);
  if (!route) { console.log(`ERROR: Supply route ${routeId} not found`); return state; }

  const newVillagers = state.villagers.map(v => {
    if (v.supplyRouteId === routeId) {
      return {
        ...v, skills: { ...v.skills }, traits: [...v.traits], path: [...v.path],
        carrying: { ...v.carrying }, patrolRoute: [...v.patrolRoute],
        recentMeals: [...v.recentMeals], family: [...v.family],
        role: 'idle' as const, supplyRouteId: null, state: 'idle' as const,
        jobBuildingId: null,
      };
    }
    return v;
  });

  return {
    ...state,
    villagers: newVillagers,
    supplyRoutes: state.supplyRoutes.filter(r => r.id !== routeId),
  };
}
