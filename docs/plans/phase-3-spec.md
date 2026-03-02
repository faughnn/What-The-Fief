# Phase 3 — Economy

## Goal
Expand resources to include iron ore, wheat, herbs, flax, hemp. Add Tier 1 buildings with specialized production. Add storage system with global + per-building inventory and storage caps. Add delivery workers for resource transport.

## New Resource Types
```ts
interface Resources {
  wood: number;
  stone: number;
  food: number;
  iron_ore: number;
  wheat: number;
  herbs: number;
  flax: number;
  hemp: number;
}
```

## Storage System
- Global storage capacity: base 100 per resource, +50 per storehouse
- Per-building inventory: buildings hold their own inputs/outputs (capacity 20)
- When a building produces, output goes to building inventory
- Delivery workers move goods from buildings to global storage and vice versa

## New Buildings

| Building | Size | Terrain | Cost | Workers | Produces | Consumes |
|----------|------|---------|------|---------|----------|----------|
| farm | 2x2 | grass | 5 wood | 2 | 3 wheat/worker | — |
| woodcutter | 1x1 | grass/forest | 5 wood | 1 | 2 wood/worker | — |
| quarry | 2x2 | stone/grass | 10 wood | 2 | 2 stone/worker | — |
| house | 1x1 | grass | 10 wood | 0 | — | — |
| storehouse | 2x1 | grass | 15 wood, 5 stone | 0 | — | — |
| herb_garden | 1x1 | grass | 3 wood | 1 | 2 herbs/worker | — |
| flax_field | 2x1 | grass | 4 wood | 1 | 2 flax/worker | — |
| hemp_field | 2x1 | grass | 4 wood | 1 | 2 hemp/worker | — |
| iron_mine | 1x1 | stone | 15 wood, 5 stone | 2 | 1 iron_ore/worker | — |

Note: Farm now produces wheat instead of generic food. Food = wheat for now (cooking comes in Phase 4).

## Delivery System
- New role: 'hauler'
- Haulers pick up from buildings with output and deliver to global storage
- If a building needs input, haulers bring it from global storage
- Each hauler can carry 10 units per trip
- Without haulers, building inventory eventually fills and production stalls

## Changes to Existing Systems
- Farm produces wheat instead of food; wheat counts as food for eating
- Resources expanded with new types (all start at 0 except wood/stone/food)
- Storage caps enforced: production stops if storage full
- Building templates updated with maxWorkers and production info

## Invariant Updates
- No resource exceeds storage capacity
- Building inventory within capacity
- No orphaned hauler routes

## CLI additions
- `--view economy` — shows production rates, storage capacity, net per day
