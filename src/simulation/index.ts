// simulation/index.ts — tick() orchestration and re-exports
// V2 spatial simulation. Pure functions: old state in, new state out.
// TICKS_PER_DAY ticks = 1 day. Villagers move 1 tile/tick. All interactions require physical presence.

import {
  GameState,
  TICKS_PER_DAY, NIGHT_TICKS,
} from '../world.js';
import { TickState, computeStorageCap, hasTech, buildBuildingMap } from './helpers.js';
import { validateState } from './validation.js';
import { processDailyChecks } from './daily.js';
import { processDisease } from './disease.js';
import { processSeasonAndWeather, processLightning } from './weather.js';
import { processCaravans, processMerchant, processProsperity, processEventsAndQuests } from './trade.js';
import { processVillagerStateMachine } from './villagers.js';
import { processRaidAndCombat } from './combat.js';
import { processAnimals } from './animals.js';
import { processFire } from './buildings.js';

// Re-export public API
export { findPath, findPathEnemy } from './movement.js';
export { validateState } from './validation.js';
export { placeBuilding, claimTerritory, processFire } from './buildings.js';
export { assignVillager, buyResource, sellResource, setResearch, setGuard, setPatrol, setFormation, sendScout, upgradeBuilding, payTribute, assaultCamp, setPreferredJob, createSupplyRoute, cancelSupplyRoute, holdFestival, liberateVillage, recruitFromVillage, setJobPriority, callToArms, standDown } from './commands.js';

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

  // Deep copy mutable state into TickState
  const ts: TickState = {
    width: state.width,
    height: state.height,
    newTick, newDay, dayTick, isNight, isDawn, isNewDay,
    toolDurBonus: (hasTech(state.research, 'improved_tools') ? 0.2 : 0) + (hasTech(state.research, 'steel_forging') ? 0.5 : 0),
    originalVillagerCount: state.villagers.length,
    villagers: state.villagers.map(v => ({
      ...v,
      skills: { ...v.skills },
      traits: [...v.traits],
      path: [...v.path],
      carrying: { ...v.carrying },
      jobPriorities: { ...v.jobPriorities },
      patrolRoute: [...v.patrolRoute],
      recentMeals: [...v.recentMeals],
      family: [...v.family],
    })),
    resources: { ...state.resources },
    buildings: state.buildings.map(b => ({
      ...b,
      assignedWorkers: [...b.assignedWorkers],
      localBuffer: { ...b.localBuffer },
    })),
    storageCap: 0,
    fog: state.fog.map(row => [...row]),
    territory: state.territory.map(row => [...row]),
    grid: state.grid.map(row => row.map(t => ({ ...t }))),
    research: {
      completed: [...state.research.completed],
      current: state.research.current,
      progress: state.research.progress,
    },
    enemies: state.enemies.map(e => ({ ...e })),
    animals: state.animals.map(a => ({ ...a })),
    resourceDrops: state.resourceDrops.map(d => ({ ...d, resources: { ...d.resources } })),
    nextAnimalId: state.nextAnimalId,
    nextDropId: state.nextDropId,
    nextBuildingId: state.nextBuildingId,
    events: [],
    season: state.season,
    weather: state.weather,
    raidBar: state.raidBar,
    raidLevel: state.raidLevel,
    activeRaid: state.activeRaid
      ? { enemies: state.activeRaid.enemies.map(e => ({ ...e })), resolved: state.activeRaid.resolved }
      : null,
    nextEnemyId: state.nextEnemyId,
    merchant: state.merchant ? { ...state.merchant } : null,
    merchantTimer: state.merchantTimer,
    prosperity: state.prosperity,
    renown: state.renown,
    completedQuests: [...state.completedQuests],
    banditUltimatum: state.banditUltimatum ? { ...state.banditUltimatum } : null,
    graveyard: state.graveyard.map(g => ({ ...g })),
    npcSettlements: state.npcSettlements.map(s => ({ ...s })),
    caravans: state.caravans.map(c => ({ ...c, goods: { ...c.goods } })),
    banditCamps: state.banditCamps.map(c => ({ ...c })),
    nextCampId: state.nextCampId,
    lastCampSpawnDay: state.lastCampSpawnDay,
    nextVillagerId: state.nextVillagerId,
    constructionPoints: state.constructionPoints,
    constructionPointsMilestones: [...state.constructionPointsMilestones],
    supplyRoutes: state.supplyRoutes.map(r => ({ ...r })),
    nextRouteId: state.nextRouteId,
    lastFestivalDay: state.lastFestivalDay,
    callToArms: state.callToArms,
    buildingMap: new Map(),
  };
  ts.buildingMap = buildBuildingMap(ts.buildings);
  ts.storageCap = computeStorageCap(ts.buildings);

  // Season & weather (on new day)
  if (ts.isNewDay) processSeasonAndWeather(ts);

  // Daily checks (on new day)
  if (ts.isNewDay) processDailyChecks(ts);

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

  const newState: GameState = {
    ...state,
    tick: newTick,
    day: newDay,
    grid: ts.grid,
    resources: ts.resources,
    storageCap: ts.storageCap,
    buildings: ts.buildings,
    villagers: ts.villagers,
    enemies: ts.enemies,
    animals: ts.animals,
    resourceDrops: ts.resourceDrops,
    fog: ts.fog,
    territory: ts.territory,
    raidBar: ts.raidBar,
    raidLevel: ts.raidLevel,
    activeRaid: ts.activeRaid,
    research: ts.research,
    merchant: ts.merchant,
    merchantTimer: ts.merchantTimer,
    prosperity: ts.prosperity,
    season: ts.season,
    weather: ts.weather,
    renown: ts.renown,
    events: ts.events,
    completedQuests: ts.completedQuests,
    banditUltimatum: ts.banditUltimatum,
    graveyard: ts.graveyard,
    npcSettlements: ts.npcSettlements,
    caravans: ts.caravans,
    banditCamps: ts.banditCamps,
    nextCampId: ts.nextCampId,
    lastCampSpawnDay: ts.lastCampSpawnDay,
    nextVillagerId: ts.nextVillagerId,
    nextEnemyId: ts.nextEnemyId,
    nextAnimalId: ts.nextAnimalId,
    nextDropId: ts.nextDropId,
    nextBuildingId: ts.nextBuildingId,
    constructionPoints: ts.constructionPoints,
    constructionPointsMilestones: ts.constructionPointsMilestones,
    supplyRoutes: ts.supplyRoutes,
    nextRouteId: ts.nextRouteId,
    lastFestivalDay: ts.lastFestivalDay,
    callToArms: ts.callToArms,
  };

  const errors = validateState(newState);
  for (const err of errors) console.log(err);
  return newState;
}
