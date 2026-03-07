// world.ts — Barrel re-export. All types, constants, and factories are in src/world/.

export * from './world/types.js';
export * from './world/terrain.js';
export * from './world/resources.js';
export * from './world/buildings.js';
export * from './world/equipment.js';
export * from './world/combat.js';
export * from './world/research.js';
export * from './world/villagers.js';
export * from './world/game-state.js';

// Re-export timing constants (originally re-exported here)
export { TICKS_PER_DAY, NIGHT_TICKS, HOME_DEPARTURE_TICK, DAYS_PER_SEASON, DAYS_PER_YEAR, RESEARCH_TICKS_PER_POINT, CONSTRUCTION_TICKS, FIRE_DAMAGE_PER_TICK, FIRE_SPREAD_CHANCE, DISEASE_SPREAD_CHANCE, LIGHTNING_STRIKE_CHANCE, INPUT_PICKUP_MULTIPLIER, PRODUCTION_BASE_TICKS, RENDER_TICKS_PER_SEC } from './timing.js';
