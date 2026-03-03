# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation with upgrades, seasonal farming, watchtower combat. 185 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates block enemies/let allies through, guards intercept + patrol routes, melee per-tick, watchtower ranged attacks at 5-tile range). Construction sites. Building upgrades (tent→house→manor). Local buffer production + physical hauling to storehouse buffers. Processing buildings consume local inputs (hauled from storehouse buffer). Physical eating from storehouse buffer. Building repair. Villager death. Rubble/clearing. Wildlife (deer, wolves, boars). Hunters track and kill animals. Physical storehouse resources. Physical marketplace trading (merchants walk to marketplace, buy/sell from marketplace buffer, trader hauls goods to storehouse). Building costs deduct from nearest storehouse. Spoilage on storehouse buffers. Seasonal farming (no production in winter, summer bonus). Immigration at map edge. Balance proven by tests.
- **What's next**: Remaining Bellwright gaps — villager clothing/warmth, food variety, deeper content.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Getting close. All major systems are physically grounded. Key additions this session: building upgrades, seasonal farming, watchtower ranged combat.

**Remaining issues (strict pedantry):**
1. ~~Building placement costs deduct from global pool.~~ **FIXED**
2. ~~Spoilage operates on global pool.~~ **FIXED**
3. ~~No marketplace worker hauling.~~ **FIXED**
4. ~~No immigration physical presence.~~ **FIXED**
5. ~~Hunter drop hauling goes to global pool.~~ **FIXED**
6. ~~No tool crafting or equipping mechanics.~~ **FIXED**
7. ~~No multi-tile building footprints in pathfinding.~~ **FIXED**
8. ~~No building upgrade system.~~ **FIXED** — tent→house→manor chain.
9. ~~No seasonal farming.~~ **FIXED** — winter=0 production, summer=1.3x bonus, autumn=0.7x.
10. ~~No ranged combat.~~ **FIXED** — watchtower building, guards shoot at 5-tile range.
11. **No villager clothing/warmth system.** Bellwright has cold/warmth mechanics.
12. **No food variety morale bonus.** Bellwright rewards diverse diets.
13. **No fire/disaster system.**
14. **No diplomacy/trade routes between settlements.**
15. **No villager rest/recreation needs.**

**What IS proven by tests (185 passing):**
- ✅ 120 ticks = 1 day
- ✅ Max 1 tile/tick movement (all entities)
- ✅ Production requires physical presence
- ✅ Production goes to building local buffer
- ✅ Hauling: local buffer → storehouse local buffer (physical)
- ✅ Water/buildings block movement
- ✅ Villagers sleep at night
- ✅ Seasons change every 10 days
- ✅ Farms produce nothing in winter (multiplier 0)
- ✅ Farms produce bonus in summer (1.3x)
- ✅ Farm resumes production after winter
- ✅ Woodcutter still produces in winter
- ✅ Spatial enemy movement, wall blocking, gate mechanics
- ✅ Guards intercept, patrol, melee combat
- ✅ Watchtower guard shoots enemies at range (≤5 tiles)
- ✅ Watchtower guard stays at tower (doesn't chase)
- ✅ No shooting beyond watchtower range
- ✅ Guard without tower has no ranged attack
- ✅ Watchtower guard kills enemy at range
- ✅ Building upgrades: tent→house→manor (costs, size expansion, construction, HP)
- ✅ Upgrade preserves home assignments
- ✅ Upgrade blocked by occupied tiles / insufficient resources
- ✅ Construction sites, tick-by-tick building
- ✅ Processing buildings consume local buffer inputs
- ✅ Physical eating from storehouse local buffer
- ✅ Workers repair damaged buildings
- ✅ Wildlife, hunting, resource drops
- ✅ Marketplace trading with physical merchants
- ✅ Balance: colony survival, raids, winter, distance productivity
- ✅ Tool equipping from storehouse buffer
- ✅ Early game bootstrap viable

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants
- `src/world.ts` — data types (~830 lines)
- `src/simulation.ts` — re-export shim for simulation/
- `src/simulation/index.ts` — tick() orchestration + re-exports
- `src/simulation/helpers.ts` — TickState interface + shared utilities
- `src/simulation/movement.ts` — pathfinding + step-by-step movement
- `src/simulation/validation.ts` — state invariant checks
- `src/simulation/daily.ts` — season, weather, immigration, morale, spoilage, merchant, prosperity, events
- `src/simulation/villagers.ts` — villager state machine
- `src/simulation/combat.ts` — raids, enemy movement, guard AI, melee + watchtower ranged
- `src/simulation/animals.ts` — wildlife, hunting, resource drops
- `src/simulation/buildings.ts` — placement, territory claiming
- `src/simulation/commands.ts` — player commands + building upgrades
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
- `src/tests/test-v2-storehouse.ts` — 10 tests
- `src/tests/test-v2-balance.ts` — 15 tests
- `src/tests/test-v2-marketplace.ts` — 13 tests
- `src/tests/test-v2-upgrades.ts` — 21 tests
- `src/tests/test-v2-seasons.ts` — 7 tests
- `src/tests/test-v2-watchtower.ts` — 5 tests

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Buildings block pathfinding (destination tile is exception)
- Gates passable for allies, block enemies
- Resources physically stored in storehouse local buffers
- Eating consumes from storehouse local buffer (not global pool)
- Merchants are grid entities with position, walk to marketplace
- Workers repair damaged buildings (1 HP/tick) before producing
- Destroyed buildings → rubble (passable, clearable, blocks construction)
- Guard patrol: follow waypoints, break patrol for enemy detection
- Animals spawn every 3 days, max 10 on map
- Marketplace trader role: hauls goods from marketplace buffer to storehouse
- Building upgrades: tent→house→manor. Same-size in-place; size-change checks expanded footprint.
- Seasonal farming: winter=0 (no production), autumn=0.7, summer=1.3. Production skip when multiplier is 0.
- Watchtower: guards assigned to watchtower stay there, shoot enemies within 5 tiles (2 damage/tick, no retaliation).
