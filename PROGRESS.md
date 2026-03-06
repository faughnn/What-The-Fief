# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation. 1008 tests passing (51 test files). 100-day stress test: 20 pop, 5 deaths, 0 errors, 11 techs researched, prosperity 80.
- **What exists**:
  - **Core**: 4000 ticks/day (RimWorld pacing, ~17 min/day at 1x). 1 tile/tick movement. BFS pathfinding. Physical production (local buffers, hauling). Storehouse buffer = global truth. Construction sites.
  - **Building upgrades**: tent→house→manor, farm→large_farm, sawmill→lumber_mill, quarry→deep_quarry, smelter→advanced_smelter, mill→windmill, bakery→kitchen, storehouse→large_storehouse.
  - **Combat**: Spatial combat (enemies march from camps/edges, walls/fences block, guards intercept/patrol, melee, watchtower ranged 5-tile). Siege equipment (battering rams, siege towers).
  - **Weapons**: Sword (atk 6, def 2, melee) and bow (atk 2, range 4, ranged). Guards auto-equip. Weaponsmith + fletcher. Durability degrades per combat tick.
  - **Armor**: Craftable armor items (leather_armor def 2, iron_armor def 4). Leather_workshop (leather+linen→leather_armor). Armorer (ingots+leather→iron_armor). Guards auto-equip best available. Durability degrades in combat. 40 tests.
  - **Guard formations**: Charge (infinite detect), hold (3-tile), patrol (10-tile). Front line (melee) and back line (ranged).
  - **Bandit camps**: Persistent camps spawn at edges every 25 days. Raids originate from camps. Guards can assault/clear for gold+renown. Max 3 active.
  - **Environment**: Wildlife + hunting + self-defense. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth. Fire/disaster + wells. Disease + herb healing. Lightning.
  - **Morale**: Food variety (+5/+10). Tavern/recreation. Church (+10 nearby). Family bonds/grief. Decoration buildings (garden/fountain/statue). Festivals (+20 for 3 days).
  - **Economy**: NPC settlements + trade caravans. Marketplace trading. Tool tiers with durability. Skill leveling. 3-tier research tree (20 techs). 7 building upgrade tiers.
  - **Villager management**: Idle auto-assignment (breadth-first). Idle task priorities: haul → build → clear → repair. Starting aptitudes (1-2 skills at 10-30). Skill-aware auto-assign. Per-villager job preferences (setPreferredJob).
  - **Logistics**: Outpost building (remote mini-storehouse, buffer 100). Player-directed supply routes (hauler role, physical transport between storehouses/outposts). 39 supply route tests.
  - **Progression**: Construction points (prosperity-gated building count). Bandit ultimatums. Scout fog reveal. Immigration at map edge. Graveyard.
  - **Festivals**: holdFestival costs 20 food + 10 gold, requires tavern, 10-day cooldown. +20 morale for 3 days. Player AI triggers when avg morale < 65. 19 tests.
  - **NPC Villages & Trust**: 4 NPC villages on maps >= 30x30. Trust system (stranger → associate → friend → protector → leader). Trust gained by killing enemies/wildlife near villages. Liberation at protector rank spawns brigands; clearing them liberates village (+30 renown). 45 tests.
  - **Roads**: road building (1 stone, instant, no construction points). Doubles villager movement speed on road tiles. Passable for all entities. 21 tests.
  - **Inn**: upgraded tavern (2x2, houses 4, +15 morale). Tavern → inn upgrade path. Works for festivals and morale visits. 16 tests.
  - **Liberated village integration**: Liberated villages send more frequent caravans (every 5 days vs 10) with more goods (15 vs 8). recruitFromVillage command (10 renown cost, requires housing). Ongoing renown stream (+2 per liberated village every 10 days). +5 prosperity per liberated village. 11 tests.
  - **Job priorities**: Per-villager job priority system (1-9 scale, 0=disabled). setJobPriority command. Auto-assign Pass -1 assigns villagers to their highest-priority building first. Disabled jobs block assignment. Coexists with preferredJob. 23 tests (6 new + 17 existing).
  - **Fishing**: fishing_hut building (1x1, must be placed on grass adjacent to water). Produces fish (food type, satisfaction 1.5). Fisher role. Outdoor building (weather affected). Farming skill. Water adjacency enforced in placeBuilding. Player AI builds near rivers. 19 tests.
  - **Tech-gated buildings**: BUILDING_TECH_REQUIREMENTS gates advanced buildings behind research. Can't build smelter without metallurgy, can't build large_farm without crop_rotation, etc. placeBuilding enforces tech requirements. 50 tests.
  - **Enemy variety**: bandit_archer (7 HP, 2 atk, 0 def, range 3) and bandit_brute (18 HP, 5 atk, 3 def). Archers shoot at range without retaliation. Brutes are tanky melee. Raid composition scales with camp strength: archers at strength 3+, brutes at strength 5+. 22 tests.
  - **Call to Arms**: callToArms/standDown commands. Workers become militia (2 atk, 0 def). Guards unaffected. Militia fight and move toward enemies. Auto-stand-down when enemies cleared. Previous roles restored. Idempotent. 21 tests.
  - **Quest/objective system**: 12 milestone quests (QUEST_DEFINITIONS) auto-complete and award renown+gold. Data-driven with conditions checked daily. Covers population, buildings, research, combat, food, guards, liberation. No double-awarding. 68 tests.
- **What's next**: See gap analysis below.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

**No.** The physical foundation, economy depth, combat systems, persistent threats, and worker management are strong. The 100-day stress test proves a competent player AI can grow to 14 population with 9 techs researched and prosperity 85. But several core Bellwright systems are still missing.

### What IS working (proven by 919 tests + 100-day stress test):
- ✅ 4000 ticks/day (RimWorld pacing), 1 tile/tick max, BFS pathfinding
- ✅ Physical production: presence required, local buffers, hauling to storehouse
- ✅ Processing buildings: miller fetches wheat from storehouse, produces flour at mill
- ✅ Storehouse buffer = source of truth for global resources
- ✅ Construction sites: worker travels, builds tick-by-tick
- ✅ Spatial combat: enemies march from camps/edges, walls block, guards intercept
- ✅ Weapon variety: sword (melee, atk 6) and bow (ranged 4 tiles, atk 2)
- ✅ Weaponsmith + fletcher buildings produce weapons from resource chains
- ✅ Guards auto-equip weapons (sword preferred). Bow guards shoot at range without retaliation
- ✅ Watchtower + bow = 4 damage/tick (2 base + 2 bow bonus)
- ✅ Weapon durability degrades per combat tick, auto-re-equip when broken
- ✅ **Guard formations: charge/hold/patrol modes, front/back line positioning**
- ✅ **Charge mode: infinite detect range, aggressively pursues all enemies**
- ✅ **Hold mode: 3-tile detect, stays at position, only fights adjacent enemies**
- ✅ **Back line: bow guards stay at range, don't close to melee. Fight when cornered**
- ✅ **Front line: melee guards close to engage enemies directly**
- ✅ **Bandit camps: spawn at map edges every 25 days, HP scales with raid level, max 3 active**
- ✅ **Raids originate FROM camp positions (not random edges)**
- ✅ **Guards can assault camps: pathfind to camp, attack HP, camp fights back**
- ✅ **Clearing a camp: +30 gold, +10 renown, assault orders auto-cleared**
- ✅ **Fallback edge-spawn raids when no camps exist**
- ✅ Siege equipment: battering rams (5 dmg), siege towers (bypass walls)
- ✅ Wildlife: passive/hostile, hunting, self-defense, guard interception
- ✅ Seasonal farming (winter=0, summer=1.3x), weather effects
- ✅ Clothing with durability, winter cold penalty
- ✅ Food variety morale (2 types +5, 3+ types +10)
- ✅ Tavern recreation, church morale, family bonds, grief
- ✅ Fire spread + extinguish, disease spread + herb cure, lightning
- ✅ Bandit ultimatums, NPC settlements, trade caravans (auto-spawn)
- ✅ Multi-tile footprints, building upgrades (8 upgrade paths)
- ✅ Tool tiers (basic/sturdy/iron) with durability + steel_forging bonus
- ✅ Skill leveling per building type (0-100)
- ✅ 3-tier research tree: 20 techs (T1 basic, T2 intermediate, T3 advanced)
- ✅ 7 production building tiers (farm→large_farm, sawmill→lumber_mill, etc.)
- ✅ Research desk produces knowledge points (30 ticks/point)
- ✅ Proper death recording (combat, animals, cold → graveyard)
- ✅ **Renown-gated recruitment**: first 4 settlers free, then 5 renown per recruit
- ✅ **Animal husbandry**: chicken_coop (eggs), livestock_barn (meat/leather), apiary (honey)
- ✅ **Foraging hut**: auto-harvests berries/mushrooms/herbs in radius (26 tests)
- ✅ **Wildlife safety**: no hostile spawns before day 10, villagers flee threats, better self-defense
- ✅ **Easier raid balance**: camps spawn day 25, raid interval 25, slower raidBar
- ✅ **Idle villager auto-assignment**: breadth-first (1 worker per building, then fill to max). Construction reserve. 23 tests.
- ✅ **Idle task priorities**: haul full buffers → build unconstructed → clear rubble → repair. Matches Bellwright priority system.
- ✅ **Processing worker job fix**: workers don't lose their assignment when inputs unavailable
- ✅ **Villager starting aptitudes**: 1-2 random skills at 10-30, deterministic per ID. Skill-aware auto-assign. 91 tests.
- ✅ **Per-villager job priorities**: setPreferredJob command. Auto-assign Pass 0 fills preferred villagers first. 14 tests.
- ✅ **Decoration buildings**: garden (+5 morale), fountain (+5 morale + fire prevention), statue (+10 morale). Proximity-based, same type doesn't stack. 21 tests.
- ✅ **Outpost building**: remote mini-storehouse (buffer 100, cap +25). Any terrain. Enables distributed resource extraction. 19 tests.
- ✅ **Construction points**: prosperity-gated building count. 20 initial + 2/immigrant + milestone bonuses. Rubble exempt. 26 tests.
- ✅ **Player-directed supply routes**: createSupplyRoute, cancelSupplyRoute, hauler role, physical transport between storehouses/outposts. 39 tests.
- ✅ **Festivals**: holdFestival command, tavern+food+gold cost, +20 morale for 3 days, 10-day cooldown. Player AI triggers when avg morale < 65. 19 tests.
- ✅ **NPC villages + trust system**: 4 villages on large maps, trust progression (stranger→associate→friend→protector→leader), trust from killing enemies/wildlife near villages, liberation combat (spawn brigands, defeat to liberate), renown reward. 45 tests.
- ✅ **Roads**: 1 stone cost, instant construction, no construction point cost. Doubles movement speed (2 path steps per moveOneStep call). Passable for all entities. 21 tests.
- ✅ **Inn**: tavern → inn upgrade. 2x2, houses 4 villagers, +15 morale. Festivals and morale visits work with inn (no tavern needed). 16 tests.
- ✅ **Liberated village integration**: Enhanced caravans (5-day interval, 15 goods), recruitment (10 renown), renown stream (+2/village/10 days), prosperity boost (+5/village). 11 tests.
- ✅ **Job priorities**: setJobPriority(villagerId, buildingType, priority) with 0-9 scale. Priority 0 disables, 1=highest. Auto-assign respects priorities before default order. Works alongside setPreferredJob. 23 tests.
- ✅ **Fishing**: fishing_hut (1x1, grass adjacent to water). Fish resource (satisfaction 1.5). Fisher role. Outdoor, farming skill. Water adjacency enforced in placeBuilding. 19 tests.
- ✅ **Physical armor crafting**: leather_workshop (leather+linen→leather_armor, def 2) and armorer (ingots+leather→iron_armor, def 4). Guards auto-equip best crafted armor from storehouse. Durability degrades in combat (30/50). 40 tests.
- ✅ **Timing overhaul**: All pacing in src/timing.ts. TICKS_PER_DAY=4000, 15-day seasons, 60-day year, 40% night. Renderer at 4 ticks/sec = ~17 min days (RimWorld pacing). Per-tick rates auto-scale.
- ✅ **Map**: 200x200 default. 20x20 starting territory. Territory expansion via town hall.
- ✅ **Tech-gated buildings**: BUILDING_TECH_REQUIREMENTS gates 12 building types behind research. placeBuilding enforces requirements. 50 tests.
- ✅ **Enemy variety**: bandit_archer (ranged, 7 HP, range 3), bandit_brute (tanky, 18 HP, 3 def). Archers shoot at range. Raid composition scales: archers at camp str 3+, brutes at str 5+. Forces diverse defense strategies. 22 tests.
- ✅ **Call to Arms**: callToArms/standDown commands mobilize workers as militia (2 atk, 0 def). Guards unaffected. Militia move toward and fight enemies. Auto-stand-down when enemies cleared. Previous roles restored. 21 tests.
- ✅ 100-day stress test: player AI grows to 21 pop, 11 techs, prosperity 80, all clothed, 0 errors

### GAPS — What Bellwright has that this sim doesn't:

**Priority 1 — Gameplay Depth:**
1. **Limited production chain depth.** Missing charcoal/kiln (fuel processing), stonemason, carpenter, distillery. Bellwright has deeper multi-step chains.
2. **No villager rest quality / comfort.** Bellwright tracks housing comfort beyond just morale bonus. Manor vs tent should have stronger gameplay impact.
3. **No enemy loot drops.** Bellwright enemies drop equipment/resources when killed.
4. **No expedition/exploration system.** Bellwright has player-led expeditions to explore map, find resources, encounter events.

**Priority 2 — Polish:**
5. **Raid event messages don't mention enemy composition.** When archers/brutes appear, the event should list them.
6. **Stress test player AI doesn't use callToArms.** Should mobilize militia during raids.

### Honest priority order for closing gaps:
1. Deeper production chains (charcoal, stonemason, carpenter)
2. Housing comfort system
3. Enemy loot drops
4. Expedition system

## Active Files
- `src/world.ts` — data types (~1110 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/timing.ts` — single source of truth for all pacing constants
- `src/tests/test-v2-*.ts` — 51 test files, 1008 tests total
- `src/tests/stress-report.ts` — 100-day simulation with player AI

## Key Decisions
- Grid: grid[y][x]. 4000 ticks/day (src/timing.ts). 1 tile/tick max. 200x200 default map. 20x20 starting territory.
- Resources in storehouse local buffers. Global resources = sum of storehouse buffers only. Eating from storehouse buffer.
- Storehouse buffer cap: 2000 per storehouse. Global per-resource cap: 150 per storehouse.
- Building costs deduct from both global AND storehouse buffer.
- Hauling deposits only add to global what actually fits in storehouse buffer.
- Seasonal farming: winter=0, autumn=0.7, summer=1.3.
- Watchtower: guards stay at tower, shoot at 5-tile range (2 dmg/tick). Bow bonus: +2 dmg.
- Building upgrades: 8 paths. Same-size in-place; size-change checks footprint.
- isStorehouse() helper abstracts 'storehouse' | 'large_storehouse' everywhere.
- Clothing: auto-equip linen/leather from storehouse. 10-day durability. Winter unclothed: -15 morale, -1 HP/day.
- Food variety: track last 5 meals, 2 unique types +5 morale, 3+ types +10 morale.
- Tavern: morale < 60 triggers visit, +15 morale boost, 3-day cooldown.
- Fire: 2 HP/tick damage, 5% spread to adjacent, villager extinguishes, well blocks spread within 3 tiles.
- Siege: battering ram deals 5 fixed damage to walls/gates. Siege tower uses ally pathfinding to bypass walls.
- Disease: 10% spread per tick to adjacent. 3 HP/day damage. 5-day duration. Herbs cure instantly.
- Family: co-location +10 morale. Death = 5 days grief (-15 morale). Immigration 20% family bond chance.
- Church: constructed church within 5 tiles of home = +10 morale.
- Graveyard: records name and day of death. Dead from combat, animal attacks, cold damage all recorded.
- Caravans: NPC settlements auto-send caravans (trade_routes tech reduces interval, increases goods).
- Raids milestone-gated: require pop >= 6 and buildings >= 8 before triggering.
- Immigration checks storehouse food (not global) to gate new settlers.
- Fences: allies pass through, enemies blocked.
- Wildlife self-defense: villagers deal 1 dmg back, guards deal 3. Guards actively fight hostile animals within 5 tiles.
- Research: TICKS_PER_DAY*0.25 ticks per knowledge point. 3-tier tech tree with prerequisites.
- Tool durability bonuses: improved_tools +20%, steel_forging +50%.
- Weapons: sword (atk 6, def 2, dur 40) and bow (atk 2, range 4, dur 30). Separate from tools. Guards auto-equip best available. Weaponsmith: ingots+planks→sword. Fletcher: wood+rope→bow.
- Armor: leather_armor (def 2, dur 30) and iron_armor (def 4, dur 50). Crafted resources consumed on equip. Leather_workshop: leather+linen→leather_armor. Armorer: ingots+leather→iron_armor. Guards auto-equip best from storehouse. Durability degrades each combat tick.
- Bandit camps: spawn at map edges after day 25, every 30 days (lastCampSpawnDay tracked). HP = 30 + raidLevel*10. Max 3 camps. Raids every 25 days from camps. Guards can assault (pathfind + attack HP). Camp fights back (strength*1.5 dmg). Clearing: +30 gold, +10 renown.
- Recruitment: first 4 settlers free, then 5 renown per recruit. Quests grant renown (first_steps, prosper, fortify, research).
- Wildlife: hostile animals (wolves, boars) gated behind day 10 or having guards. Non-combat villagers flee within 3 tiles. Self-defense: guard 4, hunter 3, worker 2.
- Guard formations: GuardMode (charge/hold/patrol) controls detect range and pursuit behavior. GuardLine (front/back) controls engagement distance. Back-line bow guards shoot at range, don't close. Hold guards stay put, only fight adjacent. Charge guards pursue at any distance.
- Auto-assign: breadth-first (1 per building first, then fill to max capacity). Haul threshold: only idle-haul when buffer >= CARRY_CAPACITY. Processing workers don't go idle when inputs unavailable (prevents job corruption).
- Construction points: 20 initial, 1 per building (rubble free), +2 per immigrant, milestones at prosperity 50/65/80/90 grant 5/5/10/10 points. Total possible: 20 + immigrants*2 + 30 from milestones.
- Supply routes: createSupplyRoute(villagerId, fromId, toId, resourceType). Villager becomes hauler with supply_traveling_to_source/dest states. Loads CARRY_CAPACITY from source buffer, walks to dest, deposits. cancelSupplyRoute releases hauler. Source/dest must be storehouse/outpost.
- Festivals: holdFestival costs 20 food + 10 gold from storehouse. Requires constructed tavern or inn. 10-day cooldown. Morale boost +20 for 3 days (FESTIVAL_DURATION). Tracked via lastFestivalDay in GameState.
- Inn: upgraded tavern (2x2, wood:20 stone:15 planks:10 rope:5). Houses 4 villagers with +15 morale. Tavern → inn upgrade. Works for festivals and morale visits (tryVisitTavern checks both 'tavern' and 'inn').
- NPC villages: 4 villages on maps >= 30x30 at edges (Thornfield/N, Millhaven/E, Ironhollow/S, Greenwater/W). Trust: stranger(0) → associate(100) → friend(500) → protector(1200) → leader(liberated). Trust +15 per bandit kill, +5 per hostile animal kill within 10 tiles. Liberation at protector rank spawns 4 brigands; clearing them → liberated + leader rank + 30 renown.
- Roads: building type 'road', costs 1 stone, instant construction, no construction point cost, FREE_CONSTRUCTION. Passable for allies and enemies. moveOneStep takes 2 path steps when landing on road tile (double speed). Grid parameter added to moveOneStep (optional, backward compatible).
- Liberated village integration: liberated villages send caravans every 5 days (vs 10 base) with 15 goods (vs 8 base). recruitFromVillage(villageId) costs 10 renown, requires housing, spawns villager at village edge. +2 renown per liberated village every 10 days. +5 prosperity per liberated village. Each settlement checks caravan interval independently.
- Job priorities: setJobPriority(villagerId, buildingType, priority). Scale 0-9 where 0=disabled, 1=highest, 9=lowest. Auto-assign Pass -1 iterates villagers with explicit priorities, assigns to their highest-priority available building. Disabled jobs block assignment in assignOneIdle. Coexists with preferredJob (Pass 0). Villager.jobPriorities: Partial<Record<BuildingType, number>>.
- Enemy variety: bandit_archer (7 HP, 2 atk, 0 def, range 3) shoots at targets within range without moving closer. bandit_brute (18 HP, 5 atk, 3 def) is tanky melee. EnemyEntity has `range` field (0=melee). Raid composition: pickRaidEnemyType() uses camp strength — archers at ARCHER_RAID_THRESHOLD(3), brutes at BRUTE_RAID_THRESHOLD(5). Index-based: every 3rd enemy becomes archer, every 5th becomes brute (index 0 always regular bandit). Both camp and fallback raids use same logic.
