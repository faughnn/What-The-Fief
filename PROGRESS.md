# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation. 1867 tests passing (96 test files). 100-day stress test: 16 pop, 12 deaths, 0 errors, 11 techs researched, prosperity 90.
- **What exists**:
  - **Core**: 4000 ticks/day (RimWorld pacing, ~17 min/day at 1x). 1 tile/tick movement. BFS pathfinding. Physical production (local buffers, hauling). Storehouse buffer = global truth. Construction sites.
  - **Building upgrades**: tent→cottage→house→manor, farm→large_farm, sawmill→lumber_mill, quarry→deep_quarry, smelter→advanced_smelter, mill→windmill, bakery→kitchen, storehouse→large_storehouse, watchtower→guard_tower, woodcutter→logging_camp.
  - **Combat**: Spatial combat (enemies march from camps/edges, walls/fences block, guards intercept/patrol, melee, watchtower ranged 5-tile). Siege equipment (battering rams, siege towers).
  - **Weapons**: Sword (atk 6, def 2, melee) and bow (atk 2, range 4, ranged). Guards auto-equip. Weaponsmith + fletcher. Durability degrades per combat tick.
  - **Armor**: Craftable armor items (leather_armor def 2, iron_armor def 4). Leather_workshop (leather+linen→leather_armor). Armorer (ingots+leather→iron_armor). Guards auto-equip best available. Durability degrades in combat. 40 tests.
  - **Guard formations**: Charge (infinite detect), hold (3-tile), patrol (10-tile). Front line (melee) and back line (ranged).
  - **Combat traits**: brave (+2 atk), coward (-2 atk), resilient (+2 def), nimble (+1 atk +1 def). Applied to all combat (guard, militia, expedition, camp assault). 6 tests.
  - **Combat skill leveling**: Guards/militia gain combat XP from fighting. +1 atk per 25 skill, +1 def per 50 skill. Fast learner boosts XP gain. 15 tests.
  - **Wall upgrades**: fence → wall → reinforced_wall. Reinforced wall (200 HP, requires siege_engineering + ingots). All defensive structures get siege_engineering +50% HP bonus. 13 tests.
  - **Storm movement penalty**: Storms halve villager travel speed (skip movement on odd ticks). Rain has no penalty. 3 tests.
  - **24/7 guard patrol**: Guards now patrol at all hours (removed night patrol restriction).
  - **Barracks**: Military housing (2x2, houses 4, +5 morale, comfort 2). Guards housed in barracks gain 2x combat XP. Requires military_tactics. 14 tests.
  - **Training ground**: Military building (2x1, holds 2 guards). Guards gain 2 combat XP daily. Fast learner bonus. Assigning villagers makes them guards. Requires fortification. 7 tests.
  - **Spike trap**: Passive defense (1x1, 10 HP). Enemies stepping on trap take 5 damage/tick, trap loses 2 HP per trigger. Destroyed after enough uses. Passable by all entities. Requires fortification + 3 wood + 1 ingot. 17 tests.
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
  - **Forester**: Renewable wood production (1x1, 2 workers, 1 wood/worker vs woodcutter's 2). Requires advanced_farming. Outdoor, uses woodcutting skill. 17 tests.
  - **Dynamic market pricing**: Supply/demand adjusts trade prices ±30%. Surplus (>50) lowers prices, scarcity (<10) raises them. getDynamicPrice() replaces static TRADE_PRICES in buy/sell. 16 tests.
  - **Hill terrain**: New terrain type (5% map coverage). Hills slow movement 50% for both allies and enemies. Guards on hills get +2 defense, forest gives +1. Watchtowers and defensive structures can be placed on hills. 15 tests.
  - **Tech-gated buildings**: BUILDING_TECH_REQUIREMENTS gates advanced buildings behind research. Can't build smelter without metallurgy, can't build large_farm without crop_rotation, etc. placeBuilding enforces tech requirements. 50 tests.
  - **Enemy variety**: bandit_archer (7 HP, 2 atk, 0 def, range 3) and bandit_brute (18 HP, 5 atk, 3 def). Archers shoot at range without retaliation. Brutes are tanky melee. Raid composition scales with camp strength: archers at strength 3+, brutes at strength 5+. 22 tests.
  - **Call to Arms**: callToArms/standDown commands. Workers become militia (2 atk, 0 def). Guards unaffected. Militia fight and move toward enemies. Auto-stand-down when enemies cleared. Previous roles restored. Idempotent. 21 tests.
  - **Quest/objective system**: 12 milestone quests (QUEST_DEFINITIONS) auto-complete and award renown+gold. Data-driven with conditions checked daily. Covers population, buildings, research, combat, food, guards, liberation. No double-awarding. 68 tests.
  - **Charcoal chain**: Coal burner (wood → charcoal). Smelter now requires charcoal + iron_ore → ingots. Deepens production chain, creates wood resource competition. 28 tests.
  - **Housing comfort**: HOUSING_COMFORT values (tent=1, house=2, manor=3). Carpenter building (planks → furniture). Furniture boosts comfort. Comfort morale: level 2 = +5, level 3+ = +10. 20 tests.
  - **Enemy loot drops**: Bandits drop gold, brutes drop 3 gold, wolves drop leather, boars drop food. Data-driven ENEMY_LOOT table. Loot goes to storehouse. 27 tests.
  - **Foraging lodge**: Upgraded foraging_hut (2 workers, 3 food/worker). Upgrade path from foraging_hut. 18 tests.
  - **Smoking rack**: meat + charcoal → smoked_food (satisfaction 2.2, spoilage 0.003). Alternative food preservation. 26 tests.
  - **Villager aging**: Ages 18-45 at start, +1/year (60 days). Elders (60+) have 50% production penalty. Old age death starts at 65, chance increases with age. 14 tests.
  - **Weapon rack**: Passive storage for weapons/armor. Guards within 5 tiles auto-equip from rack buffer. 18 tests.
  - **Mint**: Converts ingots → gold (1:2). Sustainable gold income for recruitment/festivals. Requires trade_routes. 17 tests.
  - **18 milestone quests**: 12 original + 6 new (camp_cleared, food_empire, explorer, elder_village, tech_master, fortress).
  - **Bandit warlord**: Boss enemy at camp strength 8+ (30 HP, 7 atk, 5 def). Drops 10 gold + sword. 14 tests.
  - **Town hall maintenance aura**: Buildings within 10 tiles of town hall don't decay. Incentivizes compact layout. 4 tests.
  - **Mint**: ingots → gold (1:2 ratio). Sustainable gold for recruitment/festivals. Requires trade_routes. 17 tests.
  - **Stonemason**: stone → stone_blocks (1x1, 1 worker, 3 stone → 2 blocks). Requires masonry. Mining skill. Tradeable. 25 tests.
  - **Trapper's Camp**: passive food production with leather byproduct (1x1, 1 worker, outdoor). Requires animal_husbandry. Herbalism skill. 29 tests.
  - **Primary production byproduct**: byproduct support extended to primary (no-input) buildings, not just processing.
  - **Stone blocks integration**: reinforced_wall, church, fountain, statue require stone_blocks. Manor and large_storehouse upgrades require stone_blocks. Creates meaningful progression: quarry → stone → stonemason → stone_blocks → advanced buildings.
  - **Village Hall**: town_hall → village_hall upgrade. Extended maintenance aura (15 tiles vs 10). +50% research speed (stacks with library). +5 construction points. Requires architecture + stone_blocks. 18 tests.
  - **Crop variety**: barley_field (2x2, barley, satisfaction 0.8) and vegetable_garden (1x1, vegetables, satisfaction 1.3). Both outdoor, farming skill, require crop_rotation. Seasonal (no winter). 10 food types total for variety bonus. 58 tests.
  - **Brewery**: barley → ale processing (1x1, cooking skill, requires basic_cooking). Ale is a luxury — not food. Tavern visits consume ale for +5 extra morale. Creates meaningful crop choice: barley for brewing vs wheat for bread.
  - **Demolish building**: demolishBuilding command. Removes building, creates rubble, unassigns workers/residents, 50% material refund, local buffer salvaged. Critical buildings (town_hall, storehouse) protected. 17 tests.
  - **River dock**: Placed adjacent to water, enables pathfinding across adjacent water tiles. Requires civil_engineering. 18 tests.
  - **Dynamic event quests**: 5 quest types (defend, supply, hunt, rescue, trade). Spawn every 10-15 days after day 20. Max 2 active, no duplicate types. Defend warns 3 days then spawns scaled raid (requires guards). Supply: NPC village requests resources (acceptSupplyQuest command). Hunt: elite beast (25 HP, 5 atk, 2 def) at map edge. Rescue: villager reaches traveler for free recruit. Trade: 50% better prices for 3 days. Expiry cleanup. 34 tests.
  - **Guard tower**: watchtower → guard_tower upgrade. Range 7 (vs 5), damage 3 (vs 2), 120 HP. Requires architecture. 33 tests for both upgrades.
  - **Logging camp**: woodcutter → logging_camp upgrade. 2 workers (vs 1), same production rate. Requires advanced_farming.
- **What's next**: See gap analysis below.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

**No, but very close.** The physical foundation, economy depth, combat systems, persistent threats, dynamic quests, and worker management are strong. The 100-day stress test proves a competent player AI can grow to 20 population with 10 techs researched and prosperity 95. All previously identified gaps are closed. Remaining gaps are polish-level.

### What IS working (proven by 1849 tests + 100-day stress test):
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
- ✅ **Charcoal chain**: Coal burner (wood → charcoal). Smelter/advanced_smelter require charcoal as fuel. wood → charcoal + iron_ore → ingots.
- ✅ **Carpenter + furniture**: carpenter (planks → furniture). Furniture boosts housing comfort.
- ✅ **Housing comfort**: tent=1, house=2, manor=3. Comfort morale: +0/+5/+10. Furniture adds +1 comfort.
- ✅ **Enemy loot drops**: bandits→gold, brutes→3 gold, wolves→leather, boars→food. Deposited to storehouse.
- ✅ **Data-driven quests**: 12 milestone quests auto-complete with renown+gold rewards.
- ✅ **Cottage housing tier**: tent→cottage→house→manor (4-tier housing). Cottage costs 3 wood to upgrade from tent. 19 tests.
- ✅ **Villager skill caps**: Each villager has deterministic per-skill max potential (40-100). Generated via seeded RNG from villager ID. Skills cannot exceed caps. Varied caps encourage specialization. 8 tests.
- ✅ **Villager friendships**: Coworkers track shared work days. After 10 days at same building, become friends (max 2). +3 morale per living friend. Symmetric. 9 tests.
- ✅ **Expanded traits (24 total)**: 17 original + defender (+1 atk, +2 def), fierce (+3 atk, -1 def), swordsman (+3 melee atk), prodigy (+50% XP), dullard (-30% XP), nomad (immune storm/hill penalties), scholar (+50% research speed). 39 tests.
- ✅ **Apothecary building**: herbs→bandages crafting. Healer role (herbalism skill). Bandages provide +2 HP/day regen and speed disease recovery. Requires medicine tech. 18 tests.
- ✅ **Night danger**: All enemies get +2 attack during night ticks. Makes nighttime raids significantly more dangerous. Encourages wall building and guard patrols. 10 tests.
- ✅ **Library**: Passive building (no workers). +50% research speed when constructed. Requires civil_engineering. 10 tests.
- ✅ **Expedition/exploration**: sendExpedition sends squads to explore map. POIs (ruins, resource_cache, animal_den, abandoned_camp, herb_grove) generated outside territory. Squads walk 1 tile/tick, reveal fog, discover POIs, fight guards, collect rewards. recallExpedition. Skip sleep. 65 tests.
- ✅ **Water resource**: well (produces water, fire prevention), water_collector (passive). Kitchen requires flour+water→bread. 20 tests.
- ✅ **Food processing chain**: butchery (food→meat+leather byproduct, 2.5 satisfaction), compost_pile (food→fertilizer), drying_rack (food→dried_food, 4x slower spoilage). ProductionRule.byproduct support. 31 tests.
- ✅ **Seasonal events**: Auto-trigger on season transitions. Spring planting (+10 morale), summer warmth (+5), autumn harvest festival (+15 with food≥50), winter's bite (-5). 16 tests.
- ✅ **Fertilizer farm boost**: compost pile → fertilizer → farm +50% output. Consumes 1 fertilizer per production cycle. 3 tests.
- ✅ **Building repair priority**: urgent repair (< 50% HP) before construction. Normal repair (50-100%) after rubble clearing. 3 tests.
- ✅ **Dynamic event quests**: 5 types (defend, supply, hunt, rescue, trade). Spawn every 10-15 days after day 20. Max 2 active, no duplicate types. Defend warns 3 days ahead (requires guards). Supply: NPC village requests resources. Hunt: elite beast at map edge. Rescue: free villager. Trade: better prices. 34 tests.
- ✅ **River dock**: placed adjacent to water, enables pathfinding across adjacent water tiles. Requires civil_engineering. Passable for villagers. 18 tests.
- ✅ 100-day stress test: 60x60 map, player AI grows to 20 pop, 15 deaths, 10 techs, prosperity 95, 0 errors. Builds food processing chain (butchery, compost, drying rack), crop variety (barley field, vegetable garden, brewery). Sends safe expeditions. Accepts supply quests when resources plentiful.

### GAPS — What Bellwright has that this sim doesn't:

**Priority 1 — Gameplay Depth:**
1. ~~No expedition/exploration system.~~ ✅ Done — sendExpedition, POIs, squad movement, fog reveal, combat, rewards, recallExpedition. 65 tests.
2. ~~No villager needs beyond food.~~ Research shows Bellwright does NOT have thirst. Water is a crafting resource. Food system could be deeper (raw vs cooked, food spoilage, food cellar).
3. ~~Limited crafting variety.~~ ✅ Done — butchery (meat+leather), compost pile (fertilizer), drying rack (dried_food). Water resource chain added.
4. ~~No seasonal events.~~ ✅ Done — SEASONAL_EVENTS auto-trigger on transitions. Spring +10, summer +5, autumn harvest fest +15 (needs food≥50), winter -5.

**Priority 2 — Polish:**
5. ~~Raid event messages don't mention enemy composition.~~ ✅ Done.
6. ~~Stress test player AI doesn't use callToArms.~~ ✅ Done.
7. ~~No building repair priority.~~ ✅ Done — Urgent repair (< 50% HP) now priority 2 (after hauling, before construction). Normal repair stays priority 5.
8. ~~Stress test player AI doesn't send expeditions.~~ ✅ Done — builds butchery/compost/drying_rack, sends guards on safe expeditions.

### Honest priority order for closing gaps:
1. ~~Fertilizer farm boost~~ ✅ Done
2. ~~Building repair priority~~ ✅ Done
3. ~~Stress test player AI~~ ✅ Done — food processing, expeditions, 60x60 map
4. ~~Food cellar building~~ ✅ Done — halves all spoilage rates when constructed. Requires basic_cooking. 5 tests.
5. ~~Villager trait effects~~ ✅ Done — brave (+2 atk), coward (-2 atk), resilient (+2 def), nimble (+1 atk +1 def). Applied to guard, militia, expedition, and camp assault combat. 6 tests.
6. ~~Building maintenance/decay~~ ✅ Done — 1 HP per 5 days. Walls/fences/gates/roads exempt. Never below 1 HP. 6 tests.
7. ~~Stockpile/wall progression~~ ✅ Done — fence → wall → reinforced_wall upgrade path. 200 HP reinforced walls require siege_engineering.
8. Death event messages ✅ Done — cause of death: combat, disease, assault, cold
9. ~~Combat skill leveling~~ ✅ Done — guards/militia gain combat XP, +1 atk/25 skill, +1 def/50 skill. 15 tests.
10. ~~Storm movement penalty~~ ✅ Done — storms halve villager travel speed. 3 tests.

### Remaining gaps:
11. ~~Guard night patrol~~ ✅ Fixed — guards now patrol 24/7
12. ~~More housing variety~~ ✅ Cottage added — tent→cottage→house→manor (4-tier housing). 19 tests.
13. ~~Forester building~~ ✅ Done — forester (1 wood/worker, renewable, requires advanced_farming). 17 tests.
14. ~~Barracks/staging ground~~ ✅ Done — barracks (military housing, 2x combat XP) + training ground (passive combat XP)
15. ~~Trap building~~ ✅ Done — spike_trap (5 dmg/tick to enemies, 2 HP loss per trigger, requires fortification). 17 tests.
16. ~~Market pricing variance~~ ✅ Done — getDynamicPrice with ±30% supply/demand modifier. 16 tests.
17. ~~Villager relationships beyond family~~ ✅ Done — skill caps (40-100 per skill, deterministic per ID) + friendships (coworker bonding, +3 morale). 17 tests.
18. ~~Terrain variety~~ ✅ Done — hill terrain (50% movement penalty, +2 defense, defensive structures allowed). Forest +1 defense. 15 tests.
19. ~~Expanded traits~~ ✅ Done — 17 total traits (12 original + 5 new: stalwart, marksman, neurotic, porter, tough). Bellwright-inspired combat, production, hauling, and HP effects. 24 tests.
20. ~~Apothecary/healer~~ ✅ Done — apothecary building (herbs→bandages), healer role, +2 HP/day regen with bandages, faster disease recovery. 18 tests.
21. ~~Night danger~~ ✅ Done — enemies get +2 attack at night. Makes nighttime raids more dangerous. 10 tests.

### New gaps identified:
22. ~~Building tier progression~~ ✅ Partially done — foraging_hut→foraging_lodge upgrade (2 workers, 3 food/worker). 18 tests.
23. ~~Library building~~ ✅ Done — passive +50% research speed boost. Requires civil_engineering. 10 tests.
24. ~~Weapon rack~~ ✅ Done — passive storage building, guards within 5 tiles auto-equip from rack buffer. 18 tests.
25. ~~Smoking rack~~ ✅ Done — meat + charcoal → smoked_food (satisfaction 2.2, spoilage 0.003). 26 tests.
26. ~~More quest variety (defend, escort, trade missions)~~ ✅ Done — 5 dynamic quest types (defend, supply, hunt, rescue, trade). Time-limited, reward-giving. 34 tests.
27. ~~Villager aging~~ ✅ Done — age 18-45 start, +1/year, elder penalty at 60, old age death at 65+. 14 tests.
28. ~~Foraging lodge~~ ✅ Done — upgraded foraging_hut (2 workers, 3 food/worker). 18 tests.
29. ~~Mint building~~ ✅ Done — ingots → gold, sustainable income. 17 tests.
30. ~~Bandit warlord~~ ✅ Done — boss enemy (30 HP, 7 atk, 5 def) at camp strength 8+. Drops 10 gold + sword. 14 tests.
31. ~~Town hall maintenance~~ ✅ Done — buildings within 10 tiles of town hall don't decay. 4 tests.
32. ~~Trapper's camp~~ ✅ Done — passive food + leather byproduct. Outdoor, herbalism skill. 29 tests.
33. ~~Stonemason building~~ ✅ Done — stone → stone_blocks processing. Mining skill. 25 tests.
34. ~~River dock (water transport)~~ ✅ Done — river_dock building enables water crossing via pathfinding. 18 tests.
35. ~~More building upgrade paths~~ ✅ Done — watchtower→guard_tower, woodcutter→logging_camp. 33 tests.
36. ~~Village Hall~~ ✅ Done — town_hall → village_hall. Extended aura, research boost, +5 CP. 18 tests.
37. ~~Stone blocks integration~~ ✅ Done — advanced buildings require stone_blocks. 13 tests.

### Remaining polish-level gaps (newly identified):
38. Travel sign building (waypoint markers for faster navigation)
39. ~~More trait variety~~ ✅ Done — 24 total traits (7 new: defender, fierce, nomad, prodigy, dullard, scholar, swordsman). 15 tests.
40. ~~Endgame victory condition~~ ✅ Done — all villages liberated + all techs + prosperity 100 + pop 15. 12 tests.
41. Save/load game state
42. Better death/combat balance (15 deaths in 100 days is high)
43. Building destruction events (fire, siege damage) need more dramatic impact
44. ~~More diverse raid events~~ ✅ Done — night raids (30% chance), multi-wave sieges (str 6+), reclamation parties after liberation. 11 tests.

## Active Files
- `src/world.ts` — data types (~1110 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/timing.ts` — single source of truth for all pacing constants
- `src/tests/test-v2-*.ts` — 95 test files, 1849 tests total
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
