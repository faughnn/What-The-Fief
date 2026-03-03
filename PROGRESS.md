# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation — comprehensive Bellwright colony sim. 313 tests passing.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates, guards intercept + patrol, melee, watchtower ranged 5-tile). Construction sites. Building upgrades (tent→house→manor). Local buffer production + physical hauling. Processing buildings (sawmill, mill, bakery, tanner, weaver, smelter, ropemaker). Physical eating from storehouse. Building repair. Villager death + graveyard. Rubble/clearing. Wildlife + hunting. Physical storehouse resources. Marketplace trading. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth (linen/leather, 10-day durability, winter cold penalty). Food variety morale bonus. Tavern/recreation (morale boost, cooldown). Fire/disaster (spread, extinguish, wells). Siege equipment (battering rams, siege towers). Disease system (physical spread, herb healing). Lightning strikes during storms. Bandit ultimatums (pay tribute or face raid). Villager relationships (family bonds, grief, co-location morale). Church (area morale boost). Graveyard (death records). NPC settlements + trade caravans. Scout fog reveal. Multi-tile building footprints. Immigration at map edge. Balance proven by tests.
- **What's next**: Final polish and long-simulation stress test.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

**Yes**, with the caveat that it's a text-based simulation (no renderer yet). Every core Bellwright system is physically grounded and tested:

- Physical movement (1 tile/tick max, pathfinding, water/wall blocking)
- Physical resource production (presence required, local buffers, hauling)
- Physical combat (enemies march from edges, walls block, guards intercept, siege equipment)
- Physical eating (travel to storehouse, consume from buffer)
- Physical healing (sick villagers travel to storehouse for herbs)
- Physical trade (merchant walks to marketplace, caravans walk from NPC settlements)
- Physical scouting (scout walks in direction, reveals fog)
- Physical construction (worker travels to site, builds tick-by-tick)
- Autonomous villager AI (state machine: sleep→eat→work→haul→home)
- Seasonal farming, weather effects, clothing system
- Family relationships, grief, church morale, tavern recreation
- Fire/disaster with spread, lightning, wells
- Siege equipment with battering rams and siege towers
- Disease that spreads physically between adjacent villagers
- Bandit ultimatums with tribute payment
- Death records in graveyard

**Minor items NOT implemented (not core Bellwright):**
- No moat/water defenses (Bellwright-adjacent, not core)
- No multiple-floor buildings (Bellwright doesn't have this either)
- No text renderer (planned separate module)

**What IS proven by tests (313 passing):**
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
- ✅ Family bonds: co-location morale, grief on death
- ✅ Church: nearby homes +10 morale
- ✅ Graveyard: dead villagers recorded with name and day
- ✅ Trade caravans: NPC settlements, physical walk, goods deposit
- ✅ Scouts: fog reveal, 1 tile/tick movement, edge stop, tick expiry
- ✅ Multi-tile footprints: 3x3 town hall, 2x1 sawmill, overlap rejection
- ✅ All combat (melee, patrol, enemy march, wall/gate mechanics)
- ✅ Construction, repair, rubble, processing, eating, tools
- ✅ Wildlife, hunting, marketplace, balance tests

## Active Files
- `src/world.ts` — data types (~900 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/tests/test-v2-*.ts` — 27 test files, 313 tests total

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
- Siege: battering ram deals 5 fixed damage to walls/gates. Siege tower uses ally pathfinding to bypass walls.
- Disease: 10% spread per tick to adjacent. 3 HP/day damage. 5-day duration. Herbs cure instantly.
- Family: co-location +10 morale. Death = 5 days grief (-15 morale). Immigration 20% family bond chance.
- Church: constructed church within 5 tiles of home = +10 morale.
- Graveyard: records name and day of death. Dead from combat and daily checks both recorded.
- Caravans: NPC settlements send caravans that walk 1 tile/tick to marketplace, deposit goods, leave after timer.
