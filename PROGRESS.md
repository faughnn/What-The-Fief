# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation feature-complete for core systems. All invariants enforced.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, guards intercept, melee per-tick). Construction sites. Local buffer production + physical hauling. Processing buildings consume local inputs. Physical eating. Building repair. Villager death. Wildlife (deer, wolves, boars roam the map). Hunters track and kill animals, drops at death location. 91 tests all passing.
- **What's next**: Guard patrol routes, then comprehensive Bellwright assessment.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Getting very close. Nearly all core invariants are now enforced:

1. **No guard patrol routes.** Guards intercept enemies reactively but have no configurable patrol behavior or routes.
2. **No marketplace/trading requires presence.** Trading is still instant (buy/sell from anywhere).
3. **No gate logic.** Gates should let allies through but block enemies.
4. **Eating is semi-physical.** Villagers travel to storehouse to eat, but food comes from global pool at storehouse. Ideally food should be in storehouse's local buffer.
5. **No rubble/clearing.** Destroyed buildings just vanish; should leave clearable rubble.

**What IS proven by tests (91 passing):**
- ✅ 120 ticks = 1 day
- ✅ Max 1 tile/tick movement (villagers, enemies, animals — all anti-teleportation tested)
- ✅ 15 tiles takes ≥15 ticks
- ✅ Production requires physical presence
- ✅ Production goes to building local buffer
- ✅ Hauling: local buffer → storehouse
- ✅ Water blocks movement
- ✅ Buildings block movement (pathfind around, destination exception)
- ✅ Villagers sleep at night
- ✅ Buildings have HP and local buffers
- ✅ Seasons change every 10 days
- ✅ Enemies move 1 tile/tick toward settlement
- ✅ Walls block enemy pathfinding
- ✅ Enemies attack adjacent buildings
- ✅ Guards intercept enemies
- ✅ Melee combat per-tick damage exchange
- ✅ Dead enemies removed
- ✅ Dead villagers removed (combat death)
- ✅ Enemies attack non-guard villagers
- ✅ Wall destroyed at 0 HP
- ✅ Construction sites, tick-by-tick building
- ✅ Unconstructed buildings don't produce
- ✅ Processing buildings consume local buffer inputs
- ✅ Workers haul inputs from storehouse
- ✅ Physical eating (travel to food source)
- ✅ Workers repair damaged buildings
- ✅ Animals are grid entities with positions
- ✅ Passive animals flee from nearby villagers
- ✅ Hostile animals attack adjacent villagers
- ✅ Hunters track and kill animals
- ✅ Dead animals create resource drops at death location

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants
- `src/world.ts` — data types (~750 lines)
- `src/simulation.ts` — v2 game rules (~1700 lines)
- `src/render-text.ts` — text renderers (~240 lines)
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-v2-core.ts` — 35 tests
- `src/tests/test-v2-combat.ts` — 10 tests
- `src/tests/test-v2-construction.ts` — 11 tests
- `src/tests/test-v2-processing.ts` — 7 tests
- `src/tests/test-v2-eating.ts` — 9 tests
- `src/tests/test-v2-physics.ts` — 9 tests
- `src/tests/test-v2-animals.ts` — 10 tests

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Buildings block pathfinding (destination tile is exception)
- Eating is physical: travel to storehouse, consume food
- Workers repair damaged buildings (1 HP/tick) before producing
- Animals spawn every 3 days, max 10 on map
- Hunters attack animals (3 damage/tick), haul drops to storehouse
- Passive animals flee within 3 tiles, hostile attack within 5 tiles
