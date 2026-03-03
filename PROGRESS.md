# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation nearly complete. All core invariants enforced. 115 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates block enemies/let allies through, guards intercept + patrol routes, melee per-tick). Construction sites. Local buffer production + physical hauling to storehouse buffers. Processing buildings consume local inputs (hauled from storehouse buffer). Physical eating from storehouse buffer. Building repair. Villager death. Rubble/clearing. Wildlife. Hunters. Physical storehouse resources.
- **What's next**: Marketplace/trading requires physical presence.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Very close. The remaining gap is trading:

1. **No marketplace/trading requires presence.** Trading is still instant (buy/sell from anywhere). Should require a marketplace building, merchants physically visit, villagers carry goods to/from marketplace.

**What IS proven by tests (115 passing):**
- ✅ 120 ticks = 1 day
- ✅ Max 1 tile/tick movement (villagers, enemies, animals — all anti-teleportation tested)
- ✅ 15 tiles takes ≥15 ticks
- ✅ Production requires physical presence
- ✅ Production goes to building local buffer
- ✅ Hauling: local buffer → storehouse local buffer (physical)
- ✅ Water blocks movement
- ✅ Buildings block movement (pathfind around, destination exception)
- ✅ Villagers sleep at night
- ✅ Buildings have HP and local buffers
- ✅ Seasons change every 10 days
- ✅ Enemies move 1 tile/tick toward settlement
- ✅ Walls block enemy pathfinding
- ✅ Gates block enemies, let allies through
- ✅ Enemies attack adjacent buildings
- ✅ Guards intercept enemies
- ✅ Guards follow patrol routes (waypoints), break for enemies
- ✅ Melee combat per-tick damage exchange
- ✅ Dead enemies removed
- ✅ Dead villagers removed (combat death)
- ✅ Enemies attack non-guard villagers
- ✅ Wall destroyed at 0 HP → rubble
- ✅ Destroyed buildings leave clearable rubble
- ✅ Rubble is passable, blocks new construction, workers clear it
- ✅ Construction sites, tick-by-tick building
- ✅ Unconstructed buildings don't produce
- ✅ Processing buildings consume local buffer inputs
- ✅ Workers haul inputs from storehouse buffer (physical)
- ✅ Physical eating from storehouse local buffer
- ✅ Empty storehouse means no food available
- ✅ Workers repair damaged buildings
- ✅ Animals are grid entities with positions
- ✅ Passive animals flee from nearby villagers
- ✅ Hostile animals attack adjacent villagers
- ✅ Hunters track and kill animals
- ✅ Dead animals create resource drops at death location
- ✅ Resources exist at physical locations (storehouse buffers)

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants
- `src/world.ts` — data types (~800 lines)
- `src/simulation.ts` — v2 game rules (~1900 lines)
- `src/render-text.ts` — text renderers (~240 lines)
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-v2-core.ts` — 35 tests
- `src/tests/test-v2-combat.ts` — 10 tests
- `src/tests/test-v2-construction.ts` — 11 tests
- `src/tests/test-v2-processing.ts` — 7 tests
- `src/tests/test-v2-eating.ts` — 9 tests
- `src/tests/test-v2-physics.ts` — 9 tests
- `src/tests/test-v2-animals.ts` — 10 tests
- `src/tests/test-v2-gates-patrol.ts` — 6 tests
- `src/tests/test-v2-rubble.ts` — 10 tests
- `src/tests/test-v2-storehouse.ts` — 8 tests

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Buildings block pathfinding (destination tile is exception)
- Gates passable for allies, block enemies
- Resources physically stored in storehouse local buffers
- Eating consumes from storehouse local buffer (not global pool)
- Input pickup from storehouse local buffer (not global pool)
- Hauling deposits into storehouse local buffer
- Workers repair damaged buildings (1 HP/tick) before producing
- Destroyed buildings → rubble (passable, clearable, blocks construction)
- Guard patrol: follow waypoints, break patrol for enemy detection
- Animals spawn every 3 days, max 10 on map
- Hunters attack animals (3 damage/tick), haul drops to storehouse
- Passive animals flee within 3 tiles, hostile attack within 5 tiles
