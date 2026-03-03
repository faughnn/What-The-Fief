# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation with all major systems. 239 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates, guards intercept + patrol, melee, watchtower ranged 5-tile). Construction sites. Building upgrades (tent→house→manor). Local buffer production + physical hauling. Processing buildings. Physical eating. Building repair. Villager death. Rubble/clearing. Wildlife + hunting. Physical storehouse resources. Marketplace trading. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth (linen/leather, 10-day durability, winter cold penalty). Food variety morale bonus. Tavern/recreation (morale boost, cooldown). Fire/disaster system (spread, extinguish, wells). Siege equipment (battering rams, siege towers). Immigration at map edge. Balance proven by tests.
- **What's next**: Diplomacy/trade routes, villager relationships, advanced events.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Very close. All core systems physically grounded with test coverage. Food, clothing, combat, seasons, upgrades, marketplace all working.

**Remaining issues (strict pedantry):**
1. ~~Building upgrades~~ **FIXED**
2. ~~Seasonal farming~~ **FIXED**
3. ~~Ranged combat~~ **FIXED** — watchtower
4. ~~Clothing/warmth~~ **FIXED** — linen/leather, durability, winter penalty
5. ~~Food variety~~ **FIXED** — diverse diet +5/+10 morale
6. ~~Fire/disaster system~~ **FIXED** — fire spread, extinguish, wells reduce spread
7. **No diplomacy/trade routes.** Inter-settlement trade caravans.
8. ~~Tavern/recreation~~ **FIXED** — morale <60 triggers visit, +15 morale, 3-day cooldown
9. ~~Clothing wear-out~~ **FIXED** — 10-day durability
10. ~~Siege equipment~~ **FIXED** — battering rams (5 dmg to walls), siege towers (bypass walls)
11. ~~Well/water system~~ **FIXED** — wells reduce fire spread in 3-tile radius
12. **No villager relationships.** Bellwright has families, friendships.
13. **No advanced events.** Plagues, droughts, bandit demands.
14. **No scout system proving exploration.** Scouts exist but need test coverage for fog reveal.
15. **No multi-tile building footprints tested.** Town hall is 2x2 but tests don't verify footprint blocking.

**What IS proven by tests (239 passing):**
- ✅ 120 ticks = 1 day, max 1 tile/tick movement
- ✅ Production requires physical presence, goes to local buffer
- ✅ Hauling: local buffer → storehouse (physical)
- ✅ Water/buildings block movement, gates selective
- ✅ Seasonal farming (winter=0, summer bonus, resumes in spring)
- ✅ Watchtower ranged attack (≤5 tiles, guard stays at tower)
- ✅ Building upgrades (tent→house→manor, size expansion, cost/HP)
- ✅ Clothing: auto-equip, durability (10 days), winter penalty
- ✅ Food variety morale bonus (2 types +5, 3+ types +10)
- ✅ Tavern/recreation: morale visit, cooldown, morale boost
- ✅ Fire: spread to adjacent, extinguish by villager, well reduces spread
- ✅ Siege: battering ram (5 dmg walls), siege tower (bypass walls), raid spawning
- ✅ All combat (melee, patrol, enemy march, wall/gate mechanics)
- ✅ Construction, repair, rubble, processing, eating, tools
- ✅ Wildlife, hunting, marketplace, balance tests

## Active Files
- `src/world.ts` — data types (~850 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/tests/test-v2-*.ts` — 20 test files, 239 tests total

## Key Decisions
- Grid: grid[y][x]. 120 ticks/day. 1 tile/tick max.
- Resources in storehouse local buffers. Eating from storehouse.
- Seasonal farming: winter=0, autumn=0.7, summer=1.3.
- Watchtower: guards stay at tower, shoot at 5-tile range (2 dmg/tick).
- Building upgrades: tent→house→manor. Same-size in-place; size-change checks footprint.
- Clothing: auto-equip linen/leather from storehouse. 10-day durability. Winter unclothed: -15 morale, -1 HP/day.
- Food variety: track last 5 meals, 2 unique types +5 morale, 3+ types +10 morale.
- Tavern: morale < 60 triggers visit, +15 morale boost, 3-day cooldown.
- Fire: 2 HP/tick damage, 5% spread to adjacent, villager extinguishes, well blocks spread within 3 tiles.
- Siege: battering ram deals 5 fixed damage to walls/gates. Siege tower uses ally pathfinding to bypass walls. Raid level 3+ spawns rams, level 5+ spawns towers.
