# ColonySim — Progress

## Current State
- **Phase**: 9 — Research & Progression (not started)
- **Working on**: Need to write Phase 9 spec and implement
- **Next step**: Write phase-9-spec.md, then implement research/tech tree

## Active Files (re-read these after compaction)
- `src/world.ts` — data types (~468 lines): Terrain, Tile, Building, Resources, Villager, Enemy, GameState, all templates
- `src/simulation.ts` — game rules (~620 lines): tick(), placeBuilding(), assignVillager(), setGuard(), sendScout(), claimTerritory(), validateState()
- `src/render-text.ts` — text renderers (~170 lines): renderMap(), renderSummary(), renderVillagers(), renderEconomy(), renderCombat(), renderAll()
- `src/main.ts` — CLI entry point: --ticks, --view, --place, --assign, --scout, --claim, --guard, --width, --height, --seed
- `docs/plans/phase-8-spec.md` — Phase 8 spec (completed)

## File Manifest (all source files)
- `src/world.ts` — types + createWorld factory + all constants/templates
- `src/simulation.ts` — game rules (tick, placeBuilding, assignVillager, setGuard, sendScout, claimTerritory, validateState)
- `src/render-text.ts` — text renderers (6 views: map, summary, villagers, economy, combat, all)
- `src/main.ts` — CLI
- `src/tests/test-combat.ts` — Phase 8 combat tests (6 tests)

## Phase Checklist
- [x] Phase 1: Foundation
- [x] Phase 2: Living Village
- [x] Phase 3: Economy
- [x] Phase 4: Production Chains
- [x] Phase 5: Villager Depth
- [x] Phase 6: Tools & Equipment
- [x] Phase 7: Expansion & Exploration
- [x] Phase 8: Combat & Defense
- [ ] Phase 9: Research & Progression
- [ ] Phase 10: Advanced Economy
- [ ] Phase 11: World Systems
- [ ] Phase 12: Narrative Layer

## Phase 8 Summary
- Raid bar system: fills based on prosperity (totalRes/50 + buildings + villagers) * 0.5/tick
- Raid triggers at 100, spawns enemies based on raidLevel (bandits + wolves at level 3+)
- Guard role via --guard CLI, guards auto-equip tools from storage
- Combat: stats-based rounds (max 10), guards attack first, then enemies
- Victory: enemies eliminated, raidBar reduced by 20
- Defeat: random building destroyed (cleared from grid), 20% food/wheat stolen
- Guard HP = 10 + morale/10, heals 2 HP/day
- Wall/fence buildings added (no gameplay effect yet, just placeable)
- Dead guards removed from villager list after combat

## Key Decisions
- Seeded RNG for deterministic terrain generation
- Grid is grid[y][x] convention
- Buildings stamped onto tiles (each tile references its building)
- Atomic day cycle: villagers teleport to work/home within one tick
- Node.js installed via winget to C:\Program Files\nodejs — must add to PATH in bash: `export PATH="/c/Program Files/nodejs:$PATH"`
- River with ford crossings every 4 rows (y % 4 === 0)
- Food priority: bread(2x) > flour(1.5x) > wheat(1x) > food(1x)
- Spoilage: food 5%/tick, wheat 2%/tick, flour 1%/tick
- Production multipliers: skill * trait * morale * tool (multiplicative)
- Fog of war: 10x10 revealed at start, scouts reveal 10x10/tick
- Territory: 5x5 claimed at start, expandable with town_hall + resources
- Combat resolves same tick as triggered (instant resolution)

## Known Issues
(none)
