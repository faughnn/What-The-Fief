// Commands store — wraps simulation exports to mutate gameState store
import { get } from 'svelte/store';
import { gameState } from './gameState';
import {
  placeBuilding, claimTerritory, assignVillager, setGuard, setPatrol,
  setFormation, sendScout, setResearch, upgradeBuilding,
  buyResource, sellResource, callToArms, standDown, assaultCamp,
  holdFestival, liberateVillage, recruitFromVillage, setPreferredJob,
  setJobPriority, createSupplyRoute, cancelSupplyRoute,
  sendExpedition, recallExpedition, payTribute,
} from '../../simulation/index.js';
import type { GameState } from '../../world.js';

function cmd<A extends unknown[]>(simFn: (gs: GameState, ...args: A) => GameState): (...args: A) => boolean {
  return (...args) => {
    const gs = get(gameState);
    if (!gs) return false;
    const result = simFn(gs, ...args);
    if (result === gs) return false;
    gameState.set(result);
    return true;
  };
}

// Building
export const placeBuildingCmd = cmd(placeBuilding);
export const claimTerritoryCmd = cmd(claimTerritory);
export const upgradeBuildingCmd = cmd(upgradeBuilding);

// Villager management
export const assignVillagerCmd = cmd(assignVillager);
export const setGuardCmd = cmd(setGuard);
export const setPatrolCmd = cmd(setPatrol);
export const setFormationCmd = cmd(setFormation);
export const sendScoutCmd = cmd(sendScout);
export const setPreferredJobCmd = cmd(setPreferredJob);
export const setJobPriorityCmd = cmd(setJobPriority);

// Research
export const setResearchCmd = cmd(setResearch);

// Trade
export const buyResourceCmd = cmd(buyResource);
export const sellResourceCmd = cmd(sellResource);

// Military
export const callToArmsCmd = cmd(callToArms);
export const standDownCmd = cmd(standDown);
export const assaultCampCmd = cmd(assaultCamp);

// Social
export const holdFestivalCmd = cmd(holdFestival);

// Diplomacy
export const liberateVillageCmd = cmd(liberateVillage);
export const recruitFromVillageCmd = cmd(recruitFromVillage);
export const payTributeCmd = cmd(payTribute);

// Supply routes
export const createSupplyRouteCmd = cmd(createSupplyRoute);
export const cancelSupplyRouteCmd = cmd(cancelSupplyRoute);

// Expeditions
export const sendExpeditionCmd = cmd(sendExpedition);
export const recallExpeditionCmd = cmd(recallExpedition);
