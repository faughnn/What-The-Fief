# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation with building upgrades. 166 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates block enemies/let allies through, guards intercept + patrol routes, melee per-tick). Construction sites. Local buffer production + physical hauling to storehouse buffers. Processing buildings consume local inputs (hauled from storehouse buffer). Physical eating from storehouse buffer. Building repair. Villager death. Rubble/clearing. Wildlife (deer, wolves, boars). Hunters track and kill animals. Physical storehouse resources. Physical marketplace trading (merchants walk to marketplace, buy/sell from marketplace buffer, trader hauls goods to storehouse). Building costs deduct from nearest storehouse. Spoilage on storehouse buffers. Hunter drops to storehouse buffer. Immigration at map edge. Building upgrades (tent→house→manor) with physical construction + size expansion. Balance proven by tests.
- **What's next**: Remaining Bellwright gaps — content depth, villager needs.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Almost. All major systems are physically grounded:

**Remaining issues (strict pedantry):**
1. ~~Building placement costs deduct from global pool.~~ **FIXED** — deducts from nearest storehouse buffer.
2. ~~Spoilage operates on global pool.~~ **FIXED** — operates on storehouse buffers.
3. ~~No marketplace worker hauling.~~ **FIXED** — trader role hauls marketplace buffer → storehouse.
4. ~~No immigration physical presence.~~ **FIXED** — immigrants spawn at map edge.
5. ~~Hunter drop hauling goes to global pool.~~ **FIXED** — deposits into storehouse buffer.
6. ~~No tool crafting or equipping mechanics.~~ Tools work: blacksmith→basic_tools, toolmaker→sturdy_tools. Auto-equip from global pool.
7. ~~No multi-tile building footprints in pathfinding.~~ Multi-tile buildings correctly block all tiles via placeBuilding.
8. ~~No building upgrade system.~~ **FIXED** — tent→house→manor upgrade chain with physical construction, size expansion, resource costs, home preservation.
9. **No villager housing assignment beyond auto-assign.** Bellwright has explicit player-driven housing management.
10. **No fire/disaster system.**
11. **No diplomacy/trade routes.**
12. ~~Tool equipping from global pool.~~ **FIXED** — autoEquipTool now deducts from storehouse buffer.
13. ~~No balanced early game progression test.~~ **FIXED** — bootstrap test: 50w/20s/30f → viable colony in 20 days.
14. **No crop/field rotation or seasonal planting.** Bellwright farms have seasonal cycles.
15. **No villager rest/recreation needs.** Bellwright villagers need downtime.
16. **No multiple storehouse routing.** Villagers always go to nearest, no player-controlled logistics.

**What IS proven by tests (166 passing):**
- ✅ 120 ticks = 1 day
- ✅ Max 1 tile/tick movement (villagers, enemies, animals, merchants — all anti-teleportation tested)
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
- ✅ Merchants are grid entities, walk to marketplace
- ✅ Trading requires merchant physically at marketplace
- ✅ Buying deposits into marketplace buffer
- ✅ Selling takes from marketplace buffer
- ✅ Marketplace trader hauls goods from marketplace buffer to storehouse (physical)
- ✅ Marketplace trader anti-teleportation (1 tile/tick max)
- ✅ Well-laid colony survives 30 days (3/3 villagers)
- ✅ Poorly-laid colony struggles (doesn't grow)
- ✅ Distance measurably affects productivity (tight > distant wheat)
- ✅ Guarded colony survives raids (3/4 survive raid level 1)
- ✅ Undefended colony gets wiped out by raids (2→0)
- ✅ Winter survivable with stored food
- ✅ Tool equipping consumes from storehouse buffer (physical)
- ✅ Early game bootstrap viable (50w/20s/30f → 2 farmers + 1 woodcutter)
- ✅ Building upgrade: tent→house (same footprint, resource cost, construction site)
- ✅ Building upgrade: house→manor (size expansion 1x1→2x2, grid tiles claimed)
- ✅ Upgrade deducts resources from nearest storehouse
- ✅ Upgrade fails without resources
- ✅ Upgrade blocked by occupied tiles (size expansion)
- ✅ Upgrade preserves home assignments (same building ID)
- ✅ Upgraded building gets new HP/maxHP
- ✅ No upgrade path returns error (farm has no upgrade)
- ✅ Upgrade creates construction site requiring worker

## Active Files
- `CLAUDE.md` — autonomous instructions, invariants
- `src/world.ts` — data types (~820 lines)
- `src/simulation.ts` — re-export shim for simulation/
- `src/simulation/index.ts` — tick() orchestration + re-exports
- `src/simulation/helpers.ts` — TickState interface + shared utilities
- `src/simulation/movement.ts` — pathfinding + step-by-step movement
- `src/simulation/validation.ts` — state invariant checks
- `src/simulation/daily.ts` — season, weather, immigration, morale, spoilage, merchant, prosperity, events
- `src/simulation/villagers.ts` — villager state machine
- `src/simulation/combat.ts` — raids, enemy movement, guard AI, melee
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
- Merchants are grid entities with position, walk to marketplace
- Trading requires merchant at marketplace, operates on marketplace buffer
- Workers repair damaged buildings (1 HP/tick) before producing
- Destroyed buildings → rubble (passable, clearable, blocks construction)
- Guard patrol: follow waypoints, break patrol for enemy detection
- Animals spawn every 3 days, max 10 on map
- Hunters attack animals (3 damage/tick), haul drops to storehouse
- Passive animals flee within 3 tiles, hostile attack within 5 tiles
- Marketplace trader role: hauls goods from marketplace buffer to storehouse
- Building upgrades: tent→house (cost: 7 wood), house→manor (cost: 15w/15s/10p). Same-size is in-place; size-change checks expanded footprint.
