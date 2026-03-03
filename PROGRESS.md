# ColonySim — Progress

## Current State
- **Phase**: 13 — Tick Model & Movement Rework
- **Status**: Not started
- **Working on**: Converting from 1-tick-per-day to 120-ticks-per-day with real step-by-step movement
- **Next step (do this immediately, don't ask)**:
  1. `export PATH="/c/Program Files/nodejs:$PATH"` (required every session)
  2. Read `CLAUDE.md` Phase 13 section and `docs/plans/v2-spatial-simulation-spec.md`
  3. Read `src/world.ts` and `src/simulation.ts` (the files being reworked)
  4. Write tests FIRST: `src/tests/test-movement.ts` (6 tests from CLAUDE.md spec)
  5. Implement the tick model rework until all movement tests pass
  6. Run ALL existing tests too (test-balance.ts, test-combat.ts) — they will need updating for 120-tick model
  7. Commit when all tests pass, update this file, move to Phase 14

## V2 Spatial Rework Overview
Phases 1-12 built an abstract simulation (teleporting villagers, instant combat, global resources).
Phases 13-19 rework the core into a genuine spatial simulation where:
- 120 ticks = 1 game day
- All entities move 1 tile/tick maximum (no teleportation)
- All interactions require physical adjacency
- Resources are local (hauled from buildings to storage)
- Enemies are real grid agents that march and attack
- Buildings have HP and can be damaged/destroyed
- Guards patrol and intercept enemies spatially

See `CLAUDE.md` for full phase specs and mandatory test requirements.
See `docs/plans/v2-spatial-simulation-spec.md` for detailed spatial spec.

## Active Files (re-read these after compaction)
- `CLAUDE.md` — has Phase 13-19 specs with mandatory test requirements
- `docs/plans/v2-spatial-simulation-spec.md` — detailed spatial simulation spec
- `src/world.ts` — data types (~560 lines): needs Villager state machine, destination, tick counter
- `src/simulation.ts` — game rules (~740 lines): tick() needs complete rework for 120-tick model
- `src/render-text.ts` — text renderers (~230 lines): needs tick-level view mode
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-balance.ts` — v1 balance tests (will need updating for v2)
- `src/tests/test-combat.ts` — v1 combat tests (will need updating for v2)

## File Manifest
- `src/world.ts` — types, templates, constants, factories
- `src/simulation.ts` — tick(), placeBuilding(), assignVillager(), setGuard(), sendScout(), claimTerritory(), setResearch(), buyResource(), sellResource()
- `src/render-text.ts` — renderMap/Summary/Villagers/Economy/Combat/Research/Events/All
- `src/main.ts` — CLI (--ticks, --view, --place, --assign, --scout, --claim, --guard, --research, --buy, --sell, --width, --height, --seed)
- `src/tests/test-balance.ts` — v1 balance scenario tests
- `src/tests/test-combat.ts` — v1 combat unit tests

## Phase Checklist
- [x] Phase 1: Foundation — grid, terrain, buildings, resources, validation
- [x] Phase 2: Living Village — villagers, pathfinding, housing, jobs, atomic day cycle
- [x] Phase 3: Economy — 8 resource types, data-driven production, storage
- [x] Phase 4: Production Chains — processed resources, inputs/outputs, food priority, spoilage
- [x] Phase 5: Villager Depth — skills (6 types), traits (8 types), morale, XP
- [x] Phase 6: Tools & Equipment — tool tiers (none/basic/sturdy/iron), durability, auto-equip
- [x] Phase 7: Expansion — fog of war, territory, scouting, deposits, town_hall
- [x] Phase 8: Combat — raid bar, enemy waves, guard role, stats-based combat
- [x] Phase 9: Research — tech tree (8 techs), researcher role, production/combat bonuses
- [x] Phase 10: Advanced Economy — animal husbandry, gold, trade, prosperity, marketplace
- [x] Phase 11: World Systems — seasons (4), weather (3 types), housing tiers (tent/house/manor)
- [x] Phase 12: Narrative — events (10 types), renown, 3 milestone quests
- [x] Balance Pass — all 3 v1 scenarios passing
- [ ] Phase 13: Tick Model & Movement — 120 ticks/day, 1-tile/tick movement, villager state machine
- [ ] Phase 14: Local Inventory & Hauling — building buffers, physical resource transport
- [ ] Phase 15: Construction & Building HP — build time, damage, repair, destruction
- [ ] Phase 16: Spatial Raids — enemy grid agents, marching, wall attacks, positional combat
- [ ] Phase 17: Guard Patrols — patrol routes, detection range, interception, gates, watchtowers
- [ ] Phase 18: Wildlife & Hunting — animal entities, roaming, fleeing, hunting, drops
- [ ] Phase 19: Spatial Balance Pass — rebalance everything for 120-tick spatial model

## Key Decisions
- Grid convention: grid[y][x]
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- River with ford crossings every 4 rows
- Food priority: bread > flour > wheat > food
- Production multipliers: skill * trait * morale * tool (multiplicative)
- Events seeded from day number for determinism
- Gold exempt from storage cap
- Tools are bonuses, not necessities (none=1.0x baseline)
- Blacksmith uses wood+stone for basic tools (realistic: wooden/stone implements)
- Guards get +5 base HP for combat role
- 120 ticks = 1 game day (v2)
- 1 tile/tick maximum movement speed (v2)
- Simulation tick rate decoupled from render frame rate (v2)
