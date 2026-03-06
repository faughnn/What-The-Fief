// timing.ts — Single source of truth for all time-related constants.
// Tweak values here to adjust game pacing globally.
// All tick-based constants derive from TICKS_PER_DAY so changing it rescales everything.

import type { BuildingType } from './world.js';

// === CORE TIMING ===
// At 4 ticks/sec with TICKS_PER_DAY=4000, one day = ~17 minutes (matching RimWorld at 1x).
export const TICKS_PER_DAY = 4000;
export const RENDER_TICKS_PER_SEC = 4;

// === DAY STRUCTURE ===
// Night is the first 40% of the day (~10h night out of 24h, matching RimWorld)
export const NIGHT_FRACTION = 0.40;
export const NIGHT_TICKS = Math.round(TICKS_PER_DAY * NIGHT_FRACTION);
export const HOME_DEPARTURE_FRACTION = 0.79;
export const HOME_DEPARTURE_TICK = Math.round(TICKS_PER_DAY * HOME_DEPARTURE_FRACTION);

// === SEASONS ===
export const DAYS_PER_SEASON = 15;
export const SEASONS_PER_YEAR = 4;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR;  // 60

// === PRODUCTION ===
// ticksPerUnit = PRODUCTION_BASE_TICKS / amountPerWorker
export const PRODUCTION_BASE_TICKS = 800;

// === RESEARCH ===
export const RESEARCH_TICKS_PER_POINT = Math.round(TICKS_PER_DAY * 0.25);

// === CONSTRUCTION ===
// Base values are the original design at 120 ticks/day. Automatically scaled up.
const CONSTRUCTION_SCALE = Math.round(TICKS_PER_DAY / 120);

const CONSTRUCTION_TICKS_BASE: Record<string, number> = {
  tent: 30, cottage: 50, house: 90, manor: 180,
  farm: 60, woodcutter: 45, quarry: 90, storehouse: 90,
  herb_garden: 40, flax_field: 40, hemp_field: 40, iron_mine: 120,
  sawmill: 75, smelter: 100, mill: 60, bakery: 60,
  tanner: 60, weaver: 60, ropemaker: 50,
  blacksmith: 80, toolmaker: 100, armorer: 120, coal_burner: 60, carpenter: 70,
  town_hall: 240, wall: 20, fence: 10,
  research_desk: 60, chicken_coop: 45, livestock_barn: 75,
  apiary: 35, marketplace: 120, hunting_lodge: 50, foraging_hut: 40, fishing_hut: 45, gate: 15,
  watchtower: 90,
  tavern: 60,
  well: 40, water_collector: 20,
  butchery: 50, compost_pile: 30, drying_rack: 25, food_cellar: 60,
  church: 120,
  graveyard: 30,
  rubble: 30,
  large_farm: 120, lumber_mill: 100, deep_quarry: 120,
  advanced_smelter: 150, windmill: 100, kitchen: 90,
  large_storehouse: 120,
  weaponsmith: 90, fletcher: 60, leather_workshop: 80,
  garden: 30, fountain: 40, statue: 50,
  outpost: 60, road: 1,
  inn: 120,
  reinforced_wall: 100,
  barracks: 100,
  training_ground: 60,
  spike_trap: 15,
  forester: 50,
  apothecary: 60,
  library: 90,
};

export const CONSTRUCTION_TICKS: Record<BuildingType, number> = Object.fromEntries(
  Object.entries(CONSTRUCTION_TICKS_BASE).map(([k, v]) => [k, v * CONSTRUCTION_SCALE])
) as Record<BuildingType, number>;

// === PER-TICK RATES ===
// Scale inversely with TICKS_PER_DAY so per-day effect stays constant.
const TICK_RATE_SCALE = 120 / TICKS_PER_DAY;

export const FIRE_DAMAGE_PER_TICK = 2 * TICK_RATE_SCALE;
export const FIRE_SPREAD_CHANCE = 0.05 * TICK_RATE_SCALE;
export const DISEASE_SPREAD_CHANCE = 0.10 * TICK_RATE_SCALE;

// Lightning: original 0.5% per tick at 120 ticks/day
export const LIGHTNING_STRIKE_CHANCE = 0.005 * TICK_RATE_SCALE;

// === MISC ===
export const INPUT_PICKUP_MULTIPLIER = 3;
