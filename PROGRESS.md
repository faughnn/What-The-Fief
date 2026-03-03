# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation with combat, construction, and processing input hauling.
- **What exists**: 120 ticks/day. Villagers walk 1 tile/tick with BFS pathfinding. Production → local buffer → haul to storehouse. Processing buildings (mill, bakery, etc.) consume inputs from local buffer; workers haul inputs from storehouse. Spatial combat: enemies march 1 tile/tick, attack walls/buildings, guards intercept. Construction: buildings start as sites, workers build tick-by-tick. Full day/night cycle with state machine. 63 tests all passing.
- **What's next**: Apply Bellwright Question, identify remaining gaps, build next priority.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

No. Significant progress — spatial foundation is solid, but gaps remain:

1. **No animals on the map.** Wildlife doesn't exist as grid entities. Deer, wolves, boars should roam. Hunters should track and kill them. Drops at death location, hauled to storage.
2. **Eating doesn't require physical travel.** Food is consumed from global pool at dawn, not by villagers physically traveling to a food source.
3. **Buildings don't block movement.** Buildings occupy grid tiles but pathfinding doesn't treat them as obstacles (except walls for enemies).
4. **No guard patrol routes.** Guards intercept enemies reactively but have no patrol behavior or configurable routes.
5. **No building repair.** Buildings take damage from enemies but workers can't repair them.
6. **No villager death from combat.** Villagers have HP but aren't removed on death.
7. **Eating teleports food.** The invariant says "To eat: must be at a building that has food." Currently food is consumed globally.

**What IS proven by tests (63 passing):**
- ✅ 120 ticks = 1 day (tick model)
- ✅ Villagers move max 1 tile per tick (no teleportation)
- ✅ 15 tiles takes ≥15 ticks to traverse
- ✅ Production requires physical presence at workplace
- ✅ Production goes to building local buffer, not global
- ✅ Hauling moves resources from building to storehouse
- ✅ Water blocks movement / pathfinding around obstacles
- ✅ Villagers sleep at night
- ✅ Buildings have HP and local buffers
- ✅ Seasons change every 10 days
- ✅ Enemies move 1 tile/tick toward settlement (no teleportation)
- ✅ Walls block enemy pathfinding
- ✅ Enemies attack adjacent buildings (walls take damage)
- ✅ Guards intercept enemies
- ✅ Melee combat: adjacent entities exchange damage per tick
- ✅ Dead enemies removed from map
- ✅ Wall destroyed at 0 HP
- ✅ Buildings start as construction sites
- ✅ Workers build construction sites tick-by-tick (requires physical presence)
- ✅ Unconstructed buildings don't produce
- ✅ Completed buildings become functional
- ✅ Processing buildings consume inputs from local buffer (not global)
- ✅ Workers haul inputs from storehouse to processing building
- ✅ Processing input hauling requires physical travel

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants, the Bellwright Question
- `src/world.ts` — data types (~700 lines): types, templates, constants, v2 fields
- `src/simulation.ts` — v2 game rules (~1350 lines): tick(), actions, validation
- `src/render-text.ts` — text renderers (~240 lines)
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-v2-core.ts` — v2 core tests (35 tests)
- `src/tests/test-v2-combat.ts` — v2 combat tests (10 tests)
- `src/tests/test-v2-construction.ts` — v2 construction tests (11 tests)
- `src/tests/test-v2-processing.ts` — v2 processing input hauling tests (7 tests)

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Keep data layer (world.ts types/templates), rewrite simulation layer
- Tools are bonuses not necessities (none=1.0x baseline)
- Player is god-like overseer, no character on grid
- Production → local buffer → haul to storehouse → global resources
- Processing buildings: inputs hauled from storehouse → local buffer → consumed → output to local buffer → hauled to storehouse
- Hauling from processing buildings only carries outputs, preserves inputs in local buffer
- Tents/fences are instant construction for early game viability
