# ColonySim — Progress

## Current State
- **Status**: V1 abstract simulation complete. V2 spatial rework starting.
- **What exists**: 12 phases of abstract simulation — villagers teleport, combat is instant math, resources go to a global pool. All v1 tests pass. The data types and templates are reusable. The simulation logic needs rewriting.
- **What's next**: Ask the Bellwright Question, identify the biggest gap, fix it.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

No. Not remotely. Here's what's wrong, in priority order:

1. **Villagers teleport.** They don't walk anywhere. Position is set instantly to workplace/home each tick. There's no step-by-step movement, no commute time, no travel. This is the #1 gap — nothing is spatially real.
2. **1 tick = 1 day.** The entire day resolves in a single tick. There's no sub-day granularity. You can't watch anything happen because everything is instant.
3. **Combat is abstract math.** Enemies are stat blocks, not grid entities. They don't spawn at map edges, don't march, don't attack walls. Raids are a number hitting a threshold and a dice roll.
4. **Resources are global.** Production goes straight to a global pool. No local building buffers, no hauling, no carry capacity. Distance from farm to storehouse is irrelevant.
5. **Buildings have no HP.** They can't be damaged or destroyed by enemies. Construction is instant (pay resources, building appears).
6. **No animals on the map.** Wildlife doesn't exist as grid entities.
7. **Walls don't block anything.** They exist as building types but have no spatial effect on enemy pathfinding.
8. **Guards don't patrol.** They're just a role flag, not entities walking routes and intercepting enemies.

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants, the Bellwright Question
- `src/world.ts` — data types (~560 lines): types, templates, constants
- `src/simulation.ts` — game rules (~740 lines): tick(), actions, validation
- `src/render-text.ts` — text renderers (~230 lines)
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-balance.ts` — v1 balance tests (will be replaced)
- `src/tests/test-combat.ts` — v1 combat tests (will be replaced)

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Keep data layer (world.ts types/templates), rewrite simulation layer
- Tools are bonuses not necessities (none=1.0x baseline)
- Player is god-like overseer, no character on grid
