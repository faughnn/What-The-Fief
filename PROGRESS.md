# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation substantially complete. All core invariants enforced.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, guards intercept, melee per-tick). Construction sites. Local buffer production + physical hauling. Processing buildings consume local inputs. Physical eating (travel to food source). Building repair. Villager death. 81 tests all passing.
- **What's next**: Animals, guard patrol routes, then comprehensive Bellwright assessment.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

No, but much closer. The spatial foundation is nearly complete:

1. **No animals on the map.** Wildlife (deer, wolves, boars) doesn't exist as grid entities. Hunters can't track/kill them. No resource drops at death location.
2. **No guard patrol routes.** Guards intercept enemies reactively but have no configurable patrol behavior.
3. **No marketplace/trading requires presence.** Trading is still instant (buy/sell from anywhere).
4. **No gate logic.** Gates should let allies through but block enemies.
5. **No fog of war exploration.** Map starts revealed in tests; scout reveal works but fog isn't fully integrated.

**What IS proven by tests (81 passing):**
- ✅ 120 ticks = 1 day (tick model)
- ✅ Villagers move max 1 tile per tick (no teleportation)
- ✅ 15 tiles takes ≥15 ticks to traverse
- ✅ Production requires physical presence at workplace
- ✅ Production goes to building local buffer, not global
- ✅ Hauling moves resources from building to storehouse
- ✅ Water blocks movement / pathfinding around obstacles
- ✅ Buildings block movement (pathfind around)
- ✅ Workers can enter their workplace (destination exception)
- ✅ Villagers sleep at night
- ✅ Buildings have HP and local buffers
- ✅ Seasons change every 10 days
- ✅ Enemies move 1 tile/tick toward settlement (no teleportation)
- ✅ Walls block enemy pathfinding
- ✅ Enemies attack adjacent buildings (walls take damage)
- ✅ Guards intercept enemies
- ✅ Melee combat: adjacent entities exchange damage per tick
- ✅ Dead enemies removed from map
- ✅ Dead villagers removed from map (combat death)
- ✅ Wall destroyed at 0 HP
- ✅ Buildings start as construction sites
- ✅ Workers build construction sites tick-by-tick (requires physical presence)
- ✅ Unconstructed buildings don't produce
- ✅ Completed buildings become functional
- ✅ Processing buildings consume inputs from local buffer (not global)
- ✅ Workers haul inputs from storehouse to processing building
- ✅ Eating requires physical travel to food source (no instant feeding)
- ✅ Hungry villagers prioritize eating over work
- ✅ Well-fed villagers skip eating, go to work
- ✅ Workers repair damaged buildings (1 HP/tick)
- ✅ Repair completes before production resumes
- ✅ Enemies attack adjacent non-guard villagers

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants, the Bellwright Question
- `src/world.ts` — data types (~700 lines)
- `src/simulation.ts` — v2 game rules (~1400 lines)
- `src/render-text.ts` — text renderers (~240 lines)
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-v2-core.ts` — 35 tests
- `src/tests/test-v2-combat.ts` — 10 tests
- `src/tests/test-v2-construction.ts` — 11 tests
- `src/tests/test-v2-processing.ts` — 7 tests
- `src/tests/test-v2-eating.ts` — 9 tests
- `src/tests/test-v2-physics.ts` — 9 tests

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Keep data layer (world.ts types/templates), rewrite simulation layer
- Tools are bonuses not necessities (none=1.0x baseline)
- Player is god-like overseer, no character on grid
- Production → local buffer → haul to storehouse → global resources
- Processing buildings: inputs hauled from storehouse → local buffer → consumed → output hauled
- Buildings block pathfinding (destination tile is exception for workers)
- Eating is physical: travel to storehouse, consume food from global resources there
- Villagers die at 0 HP (removed from map)
- Workers repair damaged buildings before producing (1 HP/tick)
