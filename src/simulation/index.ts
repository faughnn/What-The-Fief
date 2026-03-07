// simulation/index.ts — tick() orchestration and re-exports
// V2 spatial simulation. Mutates GameState in place for performance.
// TICKS_PER_DAY ticks = 1 day. Villagers move 1 tile/tick. All interactions require physical presence.

import {
  GameState,
  TICKS_PER_DAY, NIGHT_TICKS,
} from '../world.js';
import { TickState, computeStorageCap, hasTech, buildBuildingMap } from './helpers.js';
import { validateState } from './validation.js';
import { processDailyChecks, checkVictory } from './daily.js';
import { processDisease } from './disease.js';
import { processSeasonAndWeather, processLightning } from './weather.js';
import { processCaravans, processMerchant, processProsperity, processEventsAndQuests } from './trade.js';
import { processVillagerStateMachine } from './villagers.js';
import { processRaidAndCombat } from './combat.js';
import { processAnimals } from './animals.js';
import { processFire } from './buildings.js';
import { processExpeditions } from './expeditions.js';
import { processDynamicQuests } from './dynamic-quests.js';

// Re-export public API
export { findPath, findPathEnemy } from './movement.js';
export { validateState } from './validation.js';
export { placeBuilding, claimTerritory, processFire } from './buildings.js';
export { assignVillager, buyResource, sellResource, setResearch, setGuard, setPatrol, setFormation, sendScout, upgradeBuilding, payTribute, assaultCamp, setPreferredJob, createSupplyRoute, cancelSupplyRoute, holdFestival, liberateVillage, recruitFromVillage, setJobPriority, callToArms, standDown, sendExpedition, recallExpedition, demolishBuilding } from './commands.js';
export { acceptSupplyQuest, getActiveTradeMultiplier } from './dynamic-quests.js';

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

  // Mutate state in place — cast to TickState to add computed fields
  const ts = state as TickState;
  ts.tick = newTick;
  ts.day = newDay;
  ts.newTick = newTick;
  ts.newDay = newDay;
  ts.dayTick = dayTick;
  ts.isNight = isNight;
  ts.isDawn = isDawn;
  ts.isNewDay = isNewDay;
  ts.toolDurBonus = (hasTech(state.research, 'improved_tools') ? 0.2 : 0)
                  + (hasTech(state.research, 'steel_forging') ? 0.5 : 0);
  ts.originalVillagerCount = state.villagers.length;
  ts.events = [];
  ts.buildingMap = buildBuildingMap(ts.buildings);
  ts.storageCap = computeStorageCap(ts.buildings);

  // Season & weather (on new day)
  if (ts.isNewDay) processSeasonAndWeather(ts);

  // Daily checks (on new day)
  if (ts.isNewDay) { processDailyChecks(ts); checkVictory(ts); }

  // Villager state machine (per-tick)
  processVillagerStateMachine(ts);

  // Raid & combat (per-tick)
  processRaidAndCombat(ts);

  // Disease spreading (per-tick)
  processDisease(ts);

  // Fire (per-tick)
  processFire(ts);

  // Lightning (per-tick, storms only)
  processLightning(ts);

  // Expeditions (per-tick, after combat so members can fight)
  processExpeditions(ts);

  // Wildlife (per-tick)
  processAnimals(ts);

  // Merchant (daily spawn + per-tick movement)
  processMerchant(ts);

  // Trade caravans (per-tick movement)
  processCaravans(ts);

  // Prosperity (daily)
  if (ts.isNewDay) processProsperity(ts);

  // Events & quests (daily)
  processEventsAndQuests(ts);

  // Dynamic event quests (daily)
  processDynamicQuests(ts);

  // Validate once per day
  if (isNewDay || newTick === 1) {
    const errors = validateState(state);
    for (const err of errors) console.log(err);
  }

  return state;
}
