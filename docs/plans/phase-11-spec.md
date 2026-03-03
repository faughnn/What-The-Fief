# Phase 11 — World Systems

## Goal
Add seasons, weather, housing tiers, and environmental effects.

## Seasons
- 4 seasons: spring, summer, autumn, winter
- Each season lasts 10 ticks (40 ticks = 1 year)
- Season = `Math.floor((day % 40) / 10)` → 0=spring, 1=summer, 2=autumn, 3=winter

### Season Effects
| Season | Farming | Morale | Notes |
|--------|---------|--------|-------|
| spring | 1.0x | +0 | Normal |
| summer | 1.3x | +5 | Bonus harvest |
| autumn | 1.0x | +0 | Normal |
| winter | 0.3x | -10 | Harsh, minimal farming |

- Farming multiplier applies to all farm/flax_field/hemp_field/chicken_coop output
- Morale modifier applies to all villagers each tick

## Weather
- `weather: WeatherType` in GameState
- Each tick: random weather roll (seeded from day)
- Types: clear, rain, storm
- Probabilities vary by season:
  - spring: 60% clear, 30% rain, 10% storm
  - summer: 70% clear, 20% rain, 10% storm
  - autumn: 40% clear, 40% rain, 20% storm
  - winter: 50% clear, 30% rain, 20% storm

### Weather Effects
| Weather | Morale | Production | Other |
|---------|--------|------------|-------|
| clear | +0 | 1.0x | — |
| rain | -5 | 0.8x outdoor | Outdoor: farm, quarry, woodcutter, herb_garden, flax_field, hemp_field |
| storm | -10 | 0.5x outdoor | Outdoor buildings produce at half |

Indoor buildings (sawmill, smelter, mill, bakery, etc.) unaffected by weather.

## Housing Tiers
Replace single house type with tiers:
| Type | Cost | Capacity | Morale | mapChar |
|------|------|----------|--------|---------|
| tent | wood=3 | 1 | +0 | t |
| cottage | wood=10 | 2 | +10 | H |
| manor | wood=25 stone=15 planks=10 | 4 | +20 | U |

- `house` BuildingType replaced with `tent`, `cottage`, `manor`
- Old `house` type aliased to `cottage` for backwards compatibility
- Housing morale bonus comes from building type (replaces flat +10)

## New State Fields
```ts
season: 'spring' | 'summer' | 'autumn' | 'winter';
weather: 'clear' | 'rain' | 'storm';
```

## Outdoor Buildings
These buildings are affected by weather:
farm, woodcutter, quarry, herb_garden, flax_field, hemp_field, chicken_coop, apiary, livestock_barn

## CLI
- Season and weather shown in summary view
- No new CLI commands needed (automatic systems)
