# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation — complete Bellwright colony sim. 317 tests passing. 100-day stress test with player AI: colony survives to day 100 with 10 pop, 8 deaths, 0 errors. Survives raids up to level 8.
- **What exists**: 120 ticks/day. All movement 1 tile/tick. Buildings block pathfinding. Spatial combat (enemies march, walls block, gates, guards intercept + patrol, melee, watchtower ranged 5-tile). Construction sites. Building upgrades (tent→house→manor). Local buffer production + physical hauling. Processing buildings (sawmill, mill, bakery, tanner, weaver, smelter, ropemaker). Physical eating from storehouse. Building repair. Villager death + graveyard. Rubble/clearing. Wildlife + hunting + self-defense. Physical storehouse resources. Marketplace trading. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth (linen/leather, 10-day durability, winter cold penalty). Food variety morale bonus. Tavern/recreation (morale boost, cooldown). Fire/disaster (spread, extinguish, wells). Siege equipment (battering rams, siege towers). Disease system (physical spread, herb healing). Lightning strikes during storms. Bandit ultimatums (pay tribute or face raid). Villager relationships (family bonds, grief, co-location morale). Church (area morale boost). Graveyard (death records). NPC settlements + trade caravans. Scout fog reveal. Multi-tile building footprints. Immigration at map edge. Physical resource pipeline (storehouse buffer = source of truth for global resources). Fences passable by allies, block enemies. Guard dawn eating + mid-day hunger interrupt. Villager self-defense vs hostile wildlife. Guards intercept hostile animals. Balance proven by tests. 100-day stress test with player AI survives with 10 villagers, 0 errors.
- **What's next**: Text renderer.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

**Yes**, with the caveat that it's a text-based simulation (no renderer yet). Every core Bellwright system is physically grounded and tested:

- Physical movement (1 tile/tick max, pathfinding, water/wall blocking)
- Physical resource production (presence required, local buffers, hauling)
- Physical resource pipeline (storehouse buffer is source of truth, global synced on deposit)
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
- Wildlife self-defense (villagers fight back, guards intercept hostile animals)
- Fences as Bellwright-style barriers (allies pass, enemies blocked)

**Minor items NOT implemented (not core Bellwright):**
- No moat/water defenses (Bellwright-adjacent, not core)
- No multiple-floor buildings (Bellwright doesn't have this either)
- No text renderer (planned separate module)

**What IS proven by tests (317 passing, including 100-day stress test):**
- ✅ 120 ticks = 1 day, max 1 tile/tick movement
- ✅ Production requires physical presence, goes to local buffer
- ✅ Hauling: local buffer → storehouse (physical), only adds to global what deposits
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
- ✅ Wildlife, hunting, self-defense, marketplace, balance tests
- ✅ Fences passable by allies, block enemies (Bellwright fence behavior)
- ✅ Guards eat at dawn + mid-day hunger interrupt for working villagers
- ✅ Storehouse buffer sync: global resources = storehouse buffer contents
- ✅ Proper death recording: combat, animal attacks, cold damage all go to graveyard
- ✅ 100-day stress test: player AI builds colony, 10 villagers survive, 8 deaths, 0 errors

## Active Files
- `src/world.ts` — data types (~900 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/tests/test-v2-*.ts` — 28 test files, 317 tests total
- `src/tests/stress-report.ts` — 100-day simulation with player AI

## Key Decisions
- Grid: grid[y][x]. 120 ticks/day. 1 tile/tick max.
- Resources in storehouse local buffers. Global resources = sum of storehouse buffers only. Eating from storehouse buffer.
- Storehouse buffer cap: 2000 per storehouse. Global per-resource cap: 150 per storehouse.
- Building costs deduct from both global AND storehouse buffer.
- Hauling deposits only add to global what actually fits in storehouse buffer.
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
- Graveyard: records name and day of death. Dead from combat, animal attacks, cold damage all recorded.
- Caravans: NPC settlements send caravans that walk 1 tile/tick to marketplace, deposit goods, leave after timer.
- Raids milestone-gated: require pop >= 6 and buildings >= 8 before triggering.
- Immigration checks storehouse food (not global) to gate new settlers.
- Fences: allies pass through (like gates), enemies blocked. Matches Bellwright fence behavior.
- Wildlife self-defense: villagers deal 1 dmg back, guards deal 3. Guards also actively fight hostile animals within 5 tiles.
