# ColonySim — Progress

## Current State
- **Status**: V2 spatial simulation. 400 tests passing (32 test files). 100-day stress test: 9 pop, 7 deaths, 0 errors, 9 techs researched, 2 bandit camps active, formations in use.
- **What exists**: 120 ticks/day. 1 tile/tick movement. BFS pathfinding. Physical production (local buffers, hauling). Storehouse buffer = global truth. Construction sites. Building upgrades (tent→house→manor, farm→large_farm, sawmill→lumber_mill, quarry→deep_quarry, smelter→advanced_smelter, mill→windmill, bakery→kitchen, storehouse→large_storehouse). Spatial combat (enemies march from camps/edges, walls/fences block, guards intercept/patrol, melee, watchtower ranged 5-tile). Weapon variety: sword (atk 6, def 2, melee) and bow (atk 2, range 4, ranged). Guards auto-equip from storehouse. Weaponsmith (ingots+planks→sword), fletcher (wood+rope→bow). Bow guards shoot at 4-tile range without watchtower. Watchtower+bow = bonus damage. Weapon durability degrades per combat tick. **Guard formations: charge (infinite detect range), hold (3-tile, stays put), patrol (10-tile default). Front line (closes to melee), back line (stays at range with bow).** **Bandit camps: persistent camps spawn at map edges every 25 days, raids originate FROM camps, guards can assault/clear camps for gold+renown rewards. Camps scale with raid level, max 3 active. lastCampSpawnDay prevents instant respawn.** Siege equipment (battering rams, siege towers). Wildlife + hunting + self-defense. Seasonal farming (winter=0, summer=1.3x). Clothing/warmth. Food variety morale. Tavern/recreation. Fire/disaster (spread, extinguish, wells). Disease (physical spread, herb healing). Lightning. Bandit ultimatums. Family bonds/grief. Church morale. Graveyard. NPC settlements + trade caravans (auto-spawn with trade_routes tech). Scout fog reveal. Multi-tile footprints. Immigration at map edge. Marketplace trading. Tool tiers with durability (steel_forging bonus). Skill leveling. 3-tier research tree (20 techs). 7 production building upgrade tiers. isStorehouse abstraction.
- **What's next**: See gap analysis below.

## The Bellwright Question

**Is this a complete 2D Bellwright? Be extremely strict and pedantic.**

**No.** The physical foundation, economy depth, combat systems, and persistent threats are strong — spatial movement, production chains, weapon variety, guard formations, bandit camps, resource pipelines, research progression, and building upgrades all work. But several core Bellwright systems are still missing.

### What IS working (proven by 400 tests + 100-day stress test):
- ✅ 120 ticks/day, 1 tile/tick max, BFS pathfinding
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
- ✅ 100-day stress test: player AI uses formations, assaults camps smartly, 0 errors

### GAPS — What Bellwright has that this sim doesn't:

**Priority 1 — Core progression loop:**
1. **No multi-settlement / village liberation.** Bellwright's core loop is: discover village → build trust → liberate → defend → connect via trade routes. ColonySim has one settlement.
2. **No Trust/Renown recruitment.** Bellwright recruits via earned Renown, gated by Trust with villages. ColonySim has automatic immigration based on food.
3. **No outposts.** Bellwright has player-built resource extraction outposts connected via caravan supply chains.

**Priority 2 — Economy polish:**
4. **No profession system.** Bellwright has profession-gated research and production. ColonySim assigns roles by building type with no profession prerequisites.
5. **Animal husbandry defined but unverified.** chicken_coop, livestock_barn, apiary exist but simulation behavior unverified by tests.
6. **No foraging system.** Bellwright has foraging camps that auto-harvest berries/mushrooms/stone in radius.

**Priority 3 — Quality of life:**
7. **No per-villager job priorities.** Bellwright has granular 1-9 priority system per villager.
8. **No construction points.** Bellwright gates building count via prosperity-earned construction points.
9. **No decoration/morale buildings beyond tavern+church.**
10. **No player-directed caravan routes.**

### Honest priority order for closing gaps:
1. Profession system (gate research/production by villager profession)
2. Animal husbandry verification (test chicken_coop, livestock_barn, apiary)
3. Foraging system (foraging camps auto-harvest in radius)
4. Multi-settlement basics (outposts, supply routes)
5. Recruitment via renown/trust
6. Per-villager job priorities
7. Village liberation loop

## Active Files
- `src/world.ts` — data types (~1050 lines)
- `src/simulation/` — tick orchestration, villagers, combat, daily, animals, buildings, commands, movement, validation, helpers
- `src/tests/test-v2-*.ts` — 32 test files, 400 tests total
- `src/tests/stress-report.ts` — 100-day simulation with player AI

## Key Decisions
- Grid: grid[y][x]. 120 ticks/day. 1 tile/tick max.
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
- Research: 30 ticks per knowledge point. 3-tier tech tree with prerequisites.
- Tool durability bonuses: improved_tools +20%, steel_forging +50%.
- Weapons: sword (atk 6, def 2, dur 40) and bow (atk 2, range 4, dur 30). Separate from tools. Guards auto-equip best available. Weaponsmith: ingots+planks→sword. Fletcher: wood+rope→bow.
- Bandit camps: spawn at map edges after day 15, every 25 days (lastCampSpawnDay tracked). HP = 30 + raidLevel*10. Max 3 camps. Raids every 15 days from camps. Guards can assault (pathfind + attack HP). Camp fights back (strength*1.5 dmg). Clearing: +30 gold, +10 renown.
- Guard formations: GuardMode (charge/hold/patrol) controls detect range and pursuit behavior. GuardLine (front/back) controls engagement distance. Back-line bow guards shoot at range, don't close. Hold guards stay put, only fight adjacent. Charge guards pursue at any distance.
