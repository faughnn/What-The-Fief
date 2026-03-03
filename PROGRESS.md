# ColonySim — Progress

## Current State
- **Phase**: BALANCE — All 12 phases implemented, now tuning balance
- **Status**: All systems working (zero validation errors), but colonies die too fast
- **Working on**: Balance pass — see CLAUDE.md "Design Philosophy & Balance"
- **Next step**: Run `npx tsx src/tests/test-balance.ts`, fix failures using realistic solutions

## Balance Problems (0/3 scenarios passing)
1. **Raids too early** — raid bar fills in ~20 ticks, no time to build defenses
2. **No early tools** — jump from nothing (0.5x) to iron chain is too steep; need wood/stone tool tiers
3. **Unarmed guards useless** — attack=1 vs bandit defense=1 = guaranteed loss
4. **Winter + spoilage** — 0.3x farming + 5% food spoilage = starvation
5. **Production too low** — 0.5x no-tool penalty makes early economy non-viable

## Active Files (re-read these after compaction)
- `src/world.ts` — data types (~560 lines): all types, templates, constants
- `src/simulation.ts` — game rules (~740 lines): tick(), all actions, validation
- `src/render-text.ts` — text renderers (~230 lines): 8 view modes
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-balance.ts` — balance test scenarios (3 scenarios, all failing)
- `src/tests/test-combat.ts` — combat unit tests (6 tests, all passing)
- `CLAUDE.md` — has "Design Philosophy & Balance" section with principles

## File Manifest
- `src/world.ts` — types, templates, constants, factories
- `src/simulation.ts` — tick(), placeBuilding(), assignVillager(), setGuard(), sendScout(), claimTerritory(), setResearch(), buyResource(), sellResource()
- `src/render-text.ts` — renderMap/Summary/Villagers/Economy/Combat/Research/Events/All
- `src/main.ts` — CLI (--ticks, --view, --place, --assign, --scout, --claim, --guard, --research, --buy, --sell, --width, --height, --seed)
- `src/tests/test-balance.ts` — balance scenario tests
- `src/tests/test-combat.ts` — combat unit tests

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
- [ ] Balance Pass — tune numbers, add early tool tiers, fix raid timing

## Key Decisions
- Grid convention: grid[y][x]
- Atomic day cycle (travel resolved instantly within tick)
- Node.js PATH: `export PATH="/c/Program Files/nodejs:$PATH"`
- River with ford crossings every 4 rows
- Food priority: bread > flour > wheat > food
- Production multipliers: skill * trait * morale * tool (multiplicative)
- Combat resolves same tick as triggered
- Events seeded from day number for determinism
- Gold exempt from storage cap
