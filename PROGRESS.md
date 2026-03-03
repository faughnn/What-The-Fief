# ColonySim — Progress

## Current State
- **Phase**: COMPLETE — All 12 phases + balance pass done
- **Status**: All systems working, all tests passing (3/3 balance, 6/6 combat, 0 validation errors)
- **Next step**: Project is complete per CLAUDE.md completion criteria

## Balance Changes Applied
1. **Tool multiplier rebalanced**: none 0.5→1.0 (no penalty), basic 1.0→1.3, sturdy 1.25→1.6, iron 1.5→2.0
2. **Blacksmith accessible early**: uses wood+stone (not iron ingots), cost 8w+5s (was 15w+10s)
3. **Guards buffed**: none {3,2}, basic {4,3}, sturdy {5,4}, iron {7,5} + base HP 15 (was 10)
4. **Raid timing fixed**: 20-day grace period, 0.2x accumulation rate (was 0.5x), level+1 bandits (was level*2+1)
5. **Winter less harsh**: farm mult 0.3→0.5
6. **Spoilage reduced**: food 5%→2%, wheat 2%→1%

## Active Files (re-read these after compaction)
- `src/world.ts` — data types (~560 lines): all types, templates, constants
- `src/simulation.ts` — game rules (~740 lines): tick(), all actions, validation
- `src/render-text.ts` — text renderers (~230 lines): 8 view modes
- `src/main.ts` — CLI entry point (~80 lines)
- `src/tests/test-balance.ts` — balance test scenarios (3 scenarios, all passing)
- `src/tests/test-combat.ts` — combat unit tests (6 tests, all passing)

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
- [x] Balance Pass — all 3 scenarios passing, realistic early game

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
- Tools are bonuses, not necessities (none=1.0x baseline)
- Blacksmith uses wood+stone for basic tools (realistic: wooden/stone implements)
- Guards get +5 base HP for combat role
- 20-day grace period before raids start
