// Commands store — wraps simulation exports to mutate gameState store
import { get } from 'svelte/store';
import { gameState } from './gameState';
import {
  placeBuilding as simPlaceBuilding,
  claimTerritory as simClaimTerritory,
  assignVillager as simAssignVillager,
  setGuard as simSetGuard,
  setPatrol as simSetPatrol,
  setFormation as simSetFormation,
  sendScout as simSendScout,
  setResearch as simSetResearch,
  upgradeBuilding as simUpgradeBuilding,
  buyResource as simBuyResource,
  sellResource as simSellResource,
  callToArms as simCallToArms,
  standDown as simStandDown,
  assaultCamp as simAssaultCamp,
  holdFestival as simHoldFestival,
  liberateVillage as simLiberateVillage,
  recruitFromVillage as simRecruitFromVillage,
  setPreferredJob as simSetPreferredJob,
  setJobPriority as simSetJobPriority,
  createSupplyRoute as simCreateSupplyRoute,
  cancelSupplyRoute as simCancelSupplyRoute,
  sendExpedition as simSendExpedition,
  recallExpedition as simRecallExpedition,
  payTribute as simPayTribute,
} from '../../simulation/index.js';
import type { BuildingType, ResourceType, GuardMode, GuardLine, Direction } from '../../world.js';

function updateState(fn: (gs: any) => any): boolean {
  const gs = get(gameState);
  if (!gs) return false;
  const result = fn(gs);
  if (result === gs) return false;
  gameState.set(result);
  return true;
}

// Building
export function placeBuildingCmd(type: BuildingType, x: number, y: number): boolean {
  return updateState(gs => simPlaceBuilding(gs, type, x, y));
}

export function claimTerritoryCmd(x: number, y: number): boolean {
  return updateState(gs => simClaimTerritory(gs, x, y));
}

export function upgradeBuildingCmd(buildingId: string): boolean {
  return updateState(gs => simUpgradeBuilding(gs, buildingId));
}

// Villager management
export function assignVillagerCmd(villagerId: string, buildingId: string): boolean {
  return updateState(gs => simAssignVillager(gs, villagerId, buildingId));
}

export function setGuardCmd(villagerId: string): boolean {
  return updateState(gs => simSetGuard(gs, villagerId));
}

export function setPatrolCmd(villagerId: string, route: { x: number; y: number }[]): boolean {
  return updateState(gs => simSetPatrol(gs, villagerId, route));
}

export function setFormationCmd(villagerId: string, mode: GuardMode, line: GuardLine): boolean {
  return updateState(gs => simSetFormation(gs, villagerId, mode, line));
}

export function sendScoutCmd(villagerId: string, direction: Direction): boolean {
  return updateState(gs => simSendScout(gs, villagerId, direction));
}

export function setPreferredJobCmd(villagerId: string, jobType: BuildingType | null): boolean {
  return updateState(gs => simSetPreferredJob(gs, villagerId, jobType));
}

export function setJobPriorityCmd(villagerId: string, buildingType: BuildingType, priority: number): boolean {
  return updateState(gs => simSetJobPriority(gs, villagerId, buildingType, priority));
}

// Research
export function setResearchCmd(techId: string): boolean {
  return updateState(gs => simSetResearch(gs, techId));
}

// Trade
export function buyResourceCmd(resource: ResourceType, amount: number): boolean {
  return updateState(gs => simBuyResource(gs, resource, amount));
}

export function sellResourceCmd(resource: ResourceType, amount: number): boolean {
  return updateState(gs => simSellResource(gs, resource, amount));
}

// Military
export function callToArmsCmd(): boolean {
  return updateState(gs => simCallToArms(gs));
}

export function standDownCmd(): boolean {
  return updateState(gs => simStandDown(gs));
}

export function assaultCampCmd(campId: string): boolean {
  return updateState(gs => simAssaultCamp(gs, campId));
}

// Social
export function holdFestivalCmd(): boolean {
  return updateState(gs => simHoldFestival(gs));
}

// Diplomacy
export function liberateVillageCmd(villageId: string): boolean {
  return updateState(gs => simLiberateVillage(gs, villageId));
}

export function recruitFromVillageCmd(villageId: string): boolean {
  return updateState(gs => simRecruitFromVillage(gs, villageId));
}

export function payTributeCmd(): boolean {
  return updateState(gs => simPayTribute(gs));
}

// Supply routes
export function createSupplyRouteCmd(villagerId: string, fromId: string, toId: string, resourceType: ResourceType): boolean {
  return updateState(gs => simCreateSupplyRoute(gs, villagerId, fromId, toId, resourceType));
}

export function cancelSupplyRouteCmd(routeId: string): boolean {
  return updateState(gs => simCancelSupplyRoute(gs, routeId));
}

// Expeditions
export function sendExpeditionCmd(villagerIds: string[], targetX: number, targetY: number): boolean {
  return updateState(gs => simSendExpedition(gs, villagerIds, targetX, targetY));
}

export function recallExpeditionCmd(expeditionId: string): boolean {
  return updateState(gs => simRecallExpedition(gs, expeditionId));
}
