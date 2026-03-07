// world/terrain.ts — Terrain, season, weather, housing, and decoration constants

import type {
  Season, WeatherType, Terrain, BuildingType, SeasonalEvent,
} from './types.js';

export const SEASON_NAMES: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_FARM_MULT: Record<Season, number> = {
  spring: 1.0, summer: 1.3, autumn: 0.7, winter: 0,
};

export const SEASON_MORALE: Record<Season, number> = {
  spring: 0, summer: 5, autumn: 0, winter: -10,
};

export const WEATHER_MORALE: Record<WeatherType, number> = {
  clear: 0, rain: -5, storm: -10,
};

export const WEATHER_OUTDOOR_MULT: Record<WeatherType, number> = {
  clear: 1.0, rain: 0.8, storm: 0.5,
};

export const SEASONAL_EVENTS: Record<Season, SeasonalEvent> = {
  spring: { name: 'Spring Planting', moraleBonus: 10, message: 'Spring arrives! New growth brings hope to the settlement.' },
  summer: { name: 'Summer Warmth', moraleBonus: 5, message: 'Summer begins — long days and warm weather lift spirits.' },
  autumn: { name: 'Harvest Festival', moraleBonus: 15, foodThreshold: 50, message: 'The harvest festival celebrates the bounty of autumn!' },
  winter: { name: 'Winter\'s Bite', moraleBonus: -5, message: 'Winter descends — the cold bites and supplies dwindle.' },
};

// Terrain movement cost multiplier (1 = normal, 2 = half speed)
export const TERRAIN_MOVE_COST: Record<Terrain, number> = {
  grass: 1, forest: 1, water: Infinity, stone: 1, hill: 2,
};

export const TERRAIN_DEFENSE_BONUS: Record<Terrain, number> = {
  grass: 0, forest: 1, water: 0, stone: 0, hill: 2,
};

// --- Housing ---
export const HOUSING_INFO: Partial<Record<BuildingType, { capacity: number; morale: number }>> = {
  tent: { capacity: 1, morale: 0 },
  cottage: { capacity: 2, morale: 5 },
  house: { capacity: 2, morale: 10 },
  manor: { capacity: 4, morale: 20 },
  inn: { capacity: 4, morale: 15 },
  barracks: { capacity: 4, morale: 5 },
};

export const HOUSING_COMFORT: Partial<Record<BuildingType, number>> = {
  tent: 1,
  cottage: 1,
  house: 2,
  manor: 3,
  inn: 2,
  barracks: 2,
};

export const COMFORT_MORALE: Record<number, number> = { 1: 0, 2: 5, 3: 10 };
export const FURNITURE_COMFORT_PER_UNIT = 1;
export const FURNITURE_COMFORT_CAP = 2;

// --- Decoration ---
export const DECORATION_MORALE: Partial<Record<BuildingType, number>> = {
  garden: 5,
  fountain: 5,
  statue: 10,
};

export const CHURCH_MORALE_RANGE = 5;
export const DECORATION_RANGE = 5;
