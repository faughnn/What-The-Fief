# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation with upgrades, seasons, watchtower, clothing + durability. 194 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates, guards intercept + patrol, melee, watchtower ranged 5-tile). Construction sites. Building upgrades (tent→house→manor). Local buffer production + physical hauling. Processing buildings. Physical eating. Building repair. Villager death. Rubble/clearing. Wildlife + hunting. Physical storehouse resources. Marketplace trading. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth (linen/leather from storehouse, winter cold penalty, 10-day durability). Immigration at map edge. Balance proven by tests.
- **What's next**: Food variety morale bonus.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Getting very close. All major systems physically grounded. Clothing now wears out after 10 days and auto-re-equips.

**Remaining issues (strict pedantry):**
1. ~~Building upgrades~~ **FIXED**
2. ~~Seasonal farming~~ **FIXED**
3. ~~Ranged combat~~ **FIXED** — watchtower
4. ~~Clothing/warmth~~ **FIXED** — linen/leather auto-equip, winter penalty
5. **No food variety morale bonus.** Bellwright rewards diverse diets.
6. **No fire/disaster system.**
7. **No diplomacy/trade routes between settlements.**
8. **No villager rest/recreation needs.**
9. ~~Clothing wear-out~~ **FIXED** — 10-day durability, auto-re-equip
10. **No siege equipment.** Bellwright has battering rams, siege towers.

**What IS proven by tests (194 passing):**
- ✅ 120 ticks = 1 day, max 1 tile/tick movement
- ✅ Production requires physical presence, goes to local buffer
- ✅ Hauling: local buffer → storehouse (physical)
- ✅ Water/buildings block movement, gates selective
- ✅ Seasonal farming (winter=0, summer bonus, resumes in spring)
- ✅ Watchtower ranged attack (≤5 tiles, guard stays at tower)
- ✅ Building upgrades (tent→house→manor, size expansion, cost/HP)
- ✅ Clothing auto-equip from storehouse (linen/leather)
- ✅ Unclothed winter penalty (-15 morale, -1 HP/day)
- ✅ Clothing durability (10 days, wear-out, auto-re-equip)
- ✅ All combat (melee, patrol, enemy march, wall/gate mechanics)
- ✅ Construction, repair, rubble, processing, eating, tools
- ✅ Wildlife, hunting, marketplace, balance tests

## Active Files
- `src/world.ts` — data types (~840 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/tests/test-v2-*.ts` — 16 test files, 194 tests total

## Key Decisions
- Grid: grid[y][x]. 120 ticks/day. 1 tile/tick max.
- Resources in storehouse local buffers. Eating from storehouse.
- Seasonal farming: winter=0, autumn=0.7, summer=1.3.
- Watchtower: guards stay at tower, shoot at 5-tile range (2 dmg/tick).
- Building upgrades: tent→house→manor. Same-size in-place; size-change checks footprint.
- Clothing: auto-equip linen/leather from storehouse. 10-day durability. Winter unclothed: -15 morale, -1 HP/day.
