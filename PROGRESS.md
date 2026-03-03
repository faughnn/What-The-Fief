# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation — comprehensive Bellwright-like colony sim. 298 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates, guards intercept + patrol, melee, watchtower ranged 5-tile). Construction sites. Building upgrades (tent→house→manor). Local buffer production + physical hauling. Processing buildings. Physical eating. Building repair. Villager death. Rubble/clearing. Wildlife + hunting. Physical storehouse resources. Marketplace trading. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth (linen/leather, 10-day durability, winter cold penalty). Food variety morale bonus. Tavern/recreation (morale boost, cooldown). Fire/disaster system (spread, extinguish, wells). Siege equipment (battering rams, siege towers). Disease system (physical spread, herb healing). Lightning strikes during storms. Bandit ultimatums (pay tribute or face raid). Villager relationships (family bonds, grief, co-location morale bonus). Scout fog reveal (tested). Multi-tile building footprints (tested). Immigration at map edge. Balance proven by tests.
- **What's next**: Church/temple, graveyard, moat/water defenses, trade caravans.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

Very close to complete. All core systems physically grounded with test coverage. Nearly every Bellwright mechanic is implemented and tested.

**Remaining issues (strict pedantry):**
1. ~~Building upgrades~~ **FIXED**
2. ~~Seasonal farming~~ **FIXED**
3. ~~Ranged combat~~ **FIXED** — watchtower
4. ~~Clothing/warmth~~ **FIXED** — linen/leather, durability, winter penalty
5. ~~Food variety~~ **FIXED** — diverse diet +5/+10 morale
6. ~~Fire/disaster system~~ **FIXED** — fire spread, extinguish, wells reduce spread
7. **No trade caravans.** Merchant walks physically, but no NPC settlement trade routes.
8. ~~Tavern/recreation~~ **FIXED** — morale <60 triggers visit, +15 morale, 3-day cooldown
9. ~~Clothing wear-out~~ **FIXED** — 10-day durability
10. ~~Siege equipment~~ **FIXED** — battering rams (5 dmg to walls), siege towers (bypass walls)
11. ~~Well/water system~~ **FIXED** — wells reduce fire spread in 3-tile radius
12. ~~Villager relationships~~ **FIXED** — family bonds, grief (-15 morale), co-location bonus (+10)
13. ~~Advanced events~~ **FIXED** — disease spread, lightning, bandit ultimatums
14. ~~Scout system~~ **FIXED** — 18 tests proving fog reveal, movement, edge stop
15. ~~Multi-tile footprints~~ **FIXED** — 9 tests proving 3x3 town hall, 2x1 sawmill
16. ~~Herb healing~~ **FIXED** — sick villagers travel to storehouse, consume 1 herb
17. **No church/temple.** Bellwright has religious buildings for morale.
18. **No graveyard.** Dead villagers should leave graves.
19. **No moat/water defenses.** Digging moats to slow enemies.

**What IS proven by tests (298 passing):**
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
- ✅ Disease: physical spread between adjacent villagers, herb healing at storehouse
- ✅ Lightning: storm weather causes building fires
- ✅ Bandit ultimatums: countdown, expired = raid surge
- ✅ Family bonds: co-location morale, grief on death, family array deep copy
- ✅ Scouts: fog reveal, 1 tile/tick movement, edge stop, tick expiry
- ✅ Multi-tile footprints: 3x3 town hall, 2x1 sawmill, overlap rejection
- ✅ All combat (melee, patrol, enemy march, wall/gate mechanics)
- ✅ Construction, repair, rubble, processing, eating, tools
- ✅ Wildlife, hunting, marketplace, balance tests

## Active Files
- `src/world.ts` — data types (~880 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/tests/test-v2-*.ts` — 25 test files, 298 tests total

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
- Disease: 10% spread per tick to adjacent. 3 HP/day damage. 5-day duration. Herbs cure instantly.
- Family: co-location +10 morale. Death = 5 days grief (-15 morale). Immigration 20% family bond chance.
- Lightning: 0.5% per tick during storms. Wells immune.
- Bandit ultimatum: countdown in days. Expired = +60 raid bar.
