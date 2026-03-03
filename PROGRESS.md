# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation with all major systems. 212 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates, guards intercept + patrol, melee, watchtower ranged 5-tile). Construction sites. Building upgrades (tent→house→manor). Local buffer production + physical hauling. Processing buildings. Physical eating. Building repair. Villager death. Rubble/clearing. Wildlife + hunting. Physical storehouse resources. Marketplace trading. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth (linen/leather, 10-day durability, winter cold penalty). Food variety morale bonus. Immigration at map edge. Balance proven by tests.
- **What's next**: Rest/recreation, fire/disaster, siege equipment.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Very close. All core systems physically grounded with test coverage. Food, clothing, combat, seasons, upgrades, marketplace all working.

**Remaining issues (strict pedantry):**
1. ~~Building upgrades~~ **FIXED**
2. ~~Seasonal farming~~ **FIXED**
3. ~~Ranged combat~~ **FIXED** — watchtower
4. ~~Clothing/warmth~~ **FIXED** — linen/leather, durability, winter penalty
5. ~~Food variety~~ **FIXED** — diverse diet +5/+10 morale
6. **No fire/disaster system.** Random fires, building damage events.
7. **No diplomacy/trade routes.** Inter-settlement trade caravans.
8. **No tavern/recreation.** Bellwright has rest buildings for morale.
9. ~~Clothing wear-out~~ **FIXED** — 10-day durability
10. **No siege equipment.** Battering rams, siege towers.
11. **No well/water system.** Bellwright has water wells for fire/drinking.

**What IS proven by tests (212 passing):**
- ✅ 120 ticks = 1 day, max 1 tile/tick movement
- ✅ Production requires physical presence, goes to local buffer
- ✅ Hauling: local buffer → storehouse (physical)
- ✅ Water/buildings block movement, gates selective
- ✅ Seasonal farming (winter=0, summer bonus, resumes in spring)
- ✅ Watchtower ranged attack (≤5 tiles, guard stays at tower)
- ✅ Building upgrades (tent→house→manor, size expansion, cost/HP)
- ✅ Clothing: auto-equip, durability (10 days), winter penalty
- ✅ Food variety morale bonus (2 types +5, 3+ types +10)
- ✅ All combat (melee, patrol, enemy march, wall/gate mechanics)
- ✅ Construction, repair, rubble, processing, eating, tools
- ✅ Wildlife, hunting, marketplace, balance tests

## Active Files
- `src/world.ts` — data types (~850 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/tests/test-v2-*.ts` — 17 test files, 212 tests total

## Key Decisions
- Grid: grid[y][x]. 120 ticks/day. 1 tile/tick max.
- Resources in storehouse local buffers. Eating from storehouse.
- Seasonal farming: winter=0, autumn=0.7, summer=1.3.
- Watchtower: guards stay at tower, shoot at 5-tile range (2 dmg/tick).
- Building upgrades: tent→house→manor. Same-size in-place; size-change checks footprint.
- Clothing: auto-equip linen/leather from storehouse. 10-day durability. Winter unclothed: -15 morale, -1 HP/day.
- Food variety: track last 5 meals, 2 unique types +5 morale, 3+ types +10 morale.
