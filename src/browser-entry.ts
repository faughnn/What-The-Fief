// browser-entry.ts — Entry point for esbuild browser bundle
// Re-exports everything the renderer needs from simulation and world.

export { createWorld, BUILDING_TEMPLATES, TECH_TREE, ALL_TECHS, TRADE_PRICES, UPGRADE_PATHS, TICKS_PER_DAY, NIGHT_TICKS, DAYS_PER_SEASON, DAYS_PER_YEAR, ALL_RESOURCES, BUILDING_MAX_HP, CONSTRUCTION_TICKS, HOUSING_INFO, RENDER_TICKS_PER_SEC } from './world.js';
export type { GameState, Building, Villager, BuildingType, ResourceType, TechId, Season, WeatherType, Tile, Resources, EnemyEntity, AnimalEntity, ResourceDrop, TechDefinition, BuildingTemplate, SupplyRoute } from './world.js';

export { tick, placeBuilding, claimTerritory, assignVillager, buyResource, sellResource, setResearch, setGuard, setPatrol, setFormation, sendScout, upgradeBuilding, payTribute, setPreferredJob, createSupplyRoute, cancelSupplyRoute } from './simulation/index.js';
