# ColonySim — Progress

## Current State
- **Status**: V2 core spatial simulation implemented. Tick model, movement, local buffers, hauling all working.
- **What exists**: 120 ticks/day tick model. Villagers walk 1 tile/tick with BFS pathfinding. Production goes into building local buffers. Villagers haul from workplace to storehouse. Full day/night cycle with state machine (sleeping → traveling_to_work → working → traveling_to_storage → traveling_home → sleeping). Buildings have HP and local buffers. 36 v2 tests all passing.
- **What's next**: Apply Bellwright Question, identify remaining gaps, build next priority.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

No. Major progress on the spatial foundation, but still far from complete:

1. **Combat is still abstract math.** Enemies are stat blocks resolved instantly on raid day, not grid entities that march toward walls. Guards don't physically intercept. No spatial combat.
2. **Walls don't block enemies.** Wall/fence tiles exist but have no pathfinding effect on enemies.
3. **Buildings don't require construction.** placeBuilding creates fully constructed buildings instantly. No construction sites, no workers building them tick by tick.
4. **No animals on the map.** Wildlife doesn't exist as grid entities.
5. **Guards don't patrol.** They're a role flag but have no spatial behavior, patrol routes, or interception logic.
6. **Processing buildings use global inputs.** Mill/bakery/etc consume from global resources instead of requiring inputs to be hauled to the building's local buffer.
7. **No building damage from enemies.** Buildings have HP but nothing damages them spatially.
8. **Scouts still teleport.** Scout movement uses the old 5-tile-per-tick model instead of 1 tile/tick.

**What IS proven by tests (36 passing):**
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

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants, the Bellwright Question
- `src/world.ts` — data types (~680 lines): types, templates, constants, v2 fields
- `src/simulation.ts` — v2 game rules (~620 lines): tick(), actions, validation
- `src/render-text.ts` — text renderers (~240 lines)
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-v2-core.ts` — v2 core tests (36 tests, all passing)

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Keep data layer (world.ts types/templates), rewrite simulation layer
- Tools are bonuses not necessities (none=1.0x baseline)
- Player is god-like overseer, no character on grid
- Production → local buffer → haul to storehouse → global resources
- Buildings start constructed (construction sites deferred to next commit)
- Processing buildings use global inputs for now (local input hauling deferred)
- Combat stays abstract for now (spatial combat is next major priority)
