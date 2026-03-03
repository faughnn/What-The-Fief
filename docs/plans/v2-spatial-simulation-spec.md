# V2: Spatial Simulation Rework — Specification

## Overview

The current implementation (v1) uses abstract/instant resolution for movement, combat, and production. V2 reworks the core into a genuine spatial simulation where every entity has a real grid position at every tick, all movement is physical and gradual, and all interactions happen at specific locations on the map.

The goal: when a renderer is plugged in, it just reads GameState each tick and draws it. No interpolation hacks needed — the simulation IS the animation.

## Tick Model

- **120 ticks = 1 game day** (1 tick ≈ 12 minutes game-time)
- **1 tile/tick** maximum movement speed for all entities (villagers, enemies, animals)
- **All positions are real** — every entity has an (x,y) grid coordinate at every tick
- **No teleportation** — moving 15 tiles takes 15 ticks minimum

### Day Schedule (120 ticks)

```
Ticks   0-29:  Night / sleeping (villagers in homes, no work)
Tick    30:    Wake up, leave home
Ticks  30-119: Daytime (travel, work, eat, haul, return home)
```

Villagers manage their own time budget. A villager 20 tiles from work spends 20 ticks commuting each way = 40 ticks of travel, leaving only ~50 ticks of productive work. A villager living next to their workplace gets ~90 ticks of work. **Distance matters.**

### Tick Phases (each tick)

```
1. Movement    — all entities move 0-1 tiles toward their destination
2. Actions     — entities at their destination perform work/combat/hauling
3. Needs       — hunger ticks down, needs checked (eating happens at food source)
4. Spawning    — enemy/animal spawning checks
5. Validation  — invariant checks
```

## Entity State Machines

### Villager States

```
SLEEPING → TRAVELING_TO_WORK → WORKING → TRAVELING_TO_STORAGE → DROPPING_OFF
    ↑                                                               |
    |          TRAVELING_HOME ← EATING ← TRAVELING_TO_FOOD ←-------+
    +---------------------------+

Also: FLEEING (during raids), IDLE (no assignment), BUILDING (construction)
```

Every state has a grid position. Transitions happen based on:
- Arrival at destination (position matches target)
- Time budget (ticks remaining in day)
- Needs thresholds (hunger too high → go eat)

### Enemy States

```
SPAWNING → MARCHING → ATTACKING_WALL → BREACHING → ATTACKING_BUILDING → LOOTING
                          |
                    FIGHTING_GUARD (when intercepted)
```

Enemies are real grid agents. They spawn at map edges, pathfind toward the settlement, and physically walk there. They attack the first obstacle in their path (wall, fence, guard, building).

### Animal States

```
ROAMING → FLEEING (if threatened)
       → ATTACKING (if hostile: wolves, boars)
       → DEAD (if killed by hunter/guard)
```

## Spatial Rules (HARD REQUIREMENTS)

These rules cannot be shortcut. Tests enforce them.

### R1: No Teleportation
An entity at (x1,y1) can only be at (x1±1, y1), (x1, y1±1), or (x1,y1) next tick. No exceptions. Moving 10 tiles takes ≥10 ticks.

### R2: Physical Presence Required
To interact with anything (work at a building, attack an enemy, pick up resources, eat food), the entity must be **adjacent to or on** the target tile. No action at a distance.

### R3: Buildings Have HP
Every building has `hp` and `maxHp`. Buildings take damage from enemies and fire. At 0 HP, the building is destroyed. Buildings can be repaired by workers.

| Building Type | HP |
|---|---|
| fence | 20 |
| wall | 80 |
| tent | 15 |
| house | 50 |
| manor | 100 |
| farm | 30 |
| storehouse | 60 |
| Production buildings | 40 |
| town_hall | 120 |

### R4: Walls Block Movement
Enemies cannot walk through wall/fence tiles. They must pathfind around OR attack the wall to destroy it (dealing damage each tick they're adjacent). This creates chokepoints — a walled settlement with one gap forces all enemies through that gap.

### R5: Local Inventory
Production buildings have a **local output buffer** (capacity ~10-20 items). Workers produce into this buffer, NOT directly into global storage. Resources must be physically hauled from the building to a storehouse by a hauler or the worker themselves.

### R6: Line of Sight
Enemies are only visible if within revealed fog AND within 10 tiles of a villager or watchtower. This creates tension — you might not see a raid approaching from an unguarded direction.

### R7: Physical Eating
Villagers eat at buildings that have food (storehouses, tavern, home if stocked). They must travel there. A starving villager far from food has a real problem.

### R8: Construction Takes Time
Building placement creates a **construction site**. Workers assigned to it travel there and work for N ticks to complete it. Larger/more expensive buildings take more ticks. Buildings are non-functional until complete.

| Building Cost Tier | Construction Ticks |
|---|---|
| Cheap (≤5 wood) | 30 (¼ day) |
| Medium (≤15 total) | 60 (½ day) |
| Expensive (≤30 total) | 120 (1 day) |
| Major (30+) | 240 (2 days) |

## Combat System

### Enemy Raids
1. Raid triggers (raid bar ≥ 100)
2. Enemies spawn at a random map edge, visible if scouted
3. Enemies pathfind toward nearest building, walking 1 tile/tick
4. If they hit a wall/fence: attack it (deal damage each tick until breached or dead)
5. If they reach a building: attack it (deal damage each tick)
6. If they encounter a guard: engage in melee combat

### Melee Combat
Combat happens when a guard and enemy are adjacent (within 1 tile):
- Each combatant attacks once per tick
- Damage = max(1, attack - target.defense)
- Combat continues until one side is dead or flees
- Guards actively move to intercept enemies (pathfind toward nearest enemy)

### Guard Behavior
- Guards have a **patrol route** (list of waypoints) or **defend point**
- They walk their route at 1 tile/tick
- When an enemy enters detection range (8 tiles), guards break patrol and intercept
- After combat, guards resume patrol (or return to defend point)
- Multiple guards can engage the same enemy

### Walls & Chokepoints
- Walls block all entity movement (ally and enemy)
- Gates are wall tiles that allow ally passage but block enemies
- Enemies attacking a wall deal their attack damage to wall HP each tick
- A wall section at 0 HP becomes rubble (passable terrain)
- Placing walls strategically forces enemies through defended gaps

## Resource Hauling

### Local Production
Every production building has a **local buffer**:
```
building.localInventory: Partial<Record<ResourceType, number>>
building.bufferCapacity: number  // typically 10-20
```

Workers produce into this buffer. When it's full, production stops until items are hauled away.

### Hauling
- Workers can self-haul: after producing, walk to nearest storehouse, deposit, walk back
- Dedicated hauler role: villagers assigned as haulers pick up from production buildings and deliver to storehouses
- Haulers carry a limited amount per trip (carry capacity: 5-10 items)
- Round trip time = 2 × distance + load/unload (2 ticks)

### Implications
- Building a storehouse near production buildings speeds up the economy
- A farm 30 tiles from the storehouse means 60+ ticks per haul trip — massive inefficiency
- Layout and logistics become core gameplay

## New Phases

### Phase 13: Tick Model & Movement Rework
**Goal**: Convert from 1-tick-per-day to 120-ticks-per-day with real movement.

- Redefine tick as 1/120th of a day
- Villager movement: 1 tile/tick along BFS path
- Villager state machine: sleeping → traveling → working → traveling → sleeping
- Day/night cycle: ticks 0-29 night, 30-119 day
- Work produces per-tick (not per-day) — rebalance all production rates
- Eating happens when hunger threshold reached, villager travels to food source
- All existing tests updated for new tick model
- **Key constraint**: no entity moves more than 1 tile per tick

### Phase 14: Local Inventory & Hauling
**Goal**: Production goes to local building buffer, must be physically hauled to storage.

- Add localInventory and bufferCapacity to Building
- Production fills local buffer, stops when full
- Workers self-haul when buffer full (walk to storehouse, deposit, walk back)
- Hauler role: dedicated delivery villagers
- Storehouse is where global resources actually live
- Rebalance storage caps and production rates for new system
- Layout now matters — distance between buildings affects throughput

### Phase 15: Construction & Building HP
**Goal**: Buildings take time to construct and can be damaged.

- Building placement creates construction site (non-functional)
- Builders travel to site and work for N ticks to complete
- Buildings have HP, take damage from enemies
- Buildings at 0 HP are destroyed (leave rubble)
- Repair action: workers can restore building HP
- Rubble can be cleared to free the tile

### Phase 16: Enemy Agents & Spatial Raids
**Goal**: Enemies are real grid entities that move and fight spatially.

- Enemy entity type with position, state machine, pathfinding
- Enemies spawn at map edges when raid triggers
- Enemies walk toward settlement at 1 tile/tick
- Enemies attack walls/fences blocking their path (damage per tick)
- Enemies attack buildings when adjacent (damage per tick)
- Buildings destroyed when HP reaches 0
- Guards intercept: pathfind toward nearest enemy, engage in melee
- Combat is per-tick: adjacent combatants exchange blows each tick
- Raid ends when all enemies dead or all buildings destroyed

### Phase 17: Guard Patrols & Defense
**Goal**: Guards actively defend the settlement through positioning.

- Guard patrol routes (list of waypoints, walk between them)
- Guard defend mode (hold position, intercept enemies in range)
- Detection range: guards detect enemies within 8 tiles
- Guards break patrol to intercept detected enemies
- Multiple guards can engage one enemy
- Gate building: allows allies through walls, blocks enemies
- Watchtower building: extends enemy detection range to 15 tiles

### Phase 18: Wildlife & Hunting
**Goal**: Animals as real map entities.

- Animal types: deer, rabbit (passive), wolf, boar (hostile)
- Animals roam the map (random movement, 1 tile/tick)
- Hostile animals attack villagers in range
- Hunter role: villagers assigned as hunters track and kill animals
- Killed animals drop food/leather at their position (must be hauled)
- Animal spawning at map edges based on terrain (wolves from forest, etc.)

## Mandatory Test Specifications

Every test below MUST pass. These are designed so that abstract/instant implementations CANNOT satisfy them.

### Movement Tests (`src/tests/test-movement.ts`)

```
TEST: "Villager moves 1 tile per tick"
  - Place villager at (5,5), set destination to (5,15)
  - Run 1 tick
  - Assert villager is at (5,6) — exactly 1 tile moved
  - Run 9 more ticks
  - Assert villager is at (5,15) — arrived after 10 ticks

TEST: "No teleportation — 20 tiles takes ≥20 ticks"
  - Place villager at (0,0), destination (20,0) on clear path
  - Run 19 ticks
  - Assert villager is NOT at (20,0)
  - Run 1 more tick
  - Assert villager IS at (20,0)

TEST: "Water blocks path — villager routes around"
  - Create map with water barrier, only passable route is +10 tiles longer
  - Set destination on other side
  - Assert arrival takes ≥10 extra ticks vs straight line

TEST: "Unreachable destination — villager stays idle"
  - Surround destination with water, no path exists
  - Run 50 ticks
  - Assert villager hasn't moved, state is IDLE

TEST: "Commute eats into work time"
  - Villager A lives 5 tiles from farm, Villager B lives 25 tiles from farm
  - Run 120 ticks (1 day)
  - Assert A produced more resources than B (more work ticks available)
```

### Local Inventory & Hauling Tests (`src/tests/test-hauling.ts`)

```
TEST: "Production goes to local buffer, not global storage"
  - Assign worker to farm, run enough ticks for 1 unit produced
  - Assert farm.localInventory.wheat > 0
  - Assert global resources.wheat unchanged

TEST: "Buffer full stops production"
  - Set farm bufferCapacity to 5
  - Run until 5 wheat produced
  - Run 30 more ticks
  - Assert farm.localInventory.wheat === 5 (not more)

TEST: "Self-haul moves resources to storehouse"
  - Farm 10 tiles from storehouse, buffer fills up
  - Worker leaves farm, walks to storehouse, deposits
  - Assert storehouse global resources increased
  - Assert farm.localInventory decreased
  - Assert round trip took ≥20 ticks (10 each way)

TEST: "Closer storehouse = faster throughput"
  - Scenario A: farm 5 tiles from storehouse
  - Scenario B: farm 20 tiles from storehouse
  - Run both for 1 day (120 ticks)
  - Assert scenario A has more wheat in global storage
```

### Building HP & Construction Tests (`src/tests/test-buildings.ts`)

```
TEST: "Construction takes time"
  - Place a house (medium cost)
  - Assert building exists but state === 'construction'
  - Assert building is non-functional (cannot house villagers)
  - Assign builder, run 60 ticks
  - Assert building state === 'complete', now functional

TEST: "Building takes damage and is destroyed"
  - Place a fence (20 HP)
  - Deal 5 damage per tick for 4 ticks
  - Assert fence HP === 0, fence is destroyed/rubble
  - Assert tile is now passable

TEST: "Repair restores HP"
  - Damage a house to 10 HP
  - Assign repair worker, run ticks
  - Assert HP increases over time back toward maxHp
```

### Spatial Raid Tests (`src/tests/test-spatial-raids.ts`)

```
TEST: "Enemies spawn at map edge and walk toward settlement"
  - Trigger raid on 40x40 map, settlement at center
  - Assert enemies appear at map edge (x=0 or x=39 or y=0 or y=39)
  - Run 1 tick
  - Assert enemies moved 1 tile closer to settlement
  - Run 19 ticks
  - Assert enemies are now 20 tiles from their spawn point

TEST: "Enemies take N ticks to reach center"
  - 40x40 map, enemies spawn at edge, settlement at (20,20)
  - Enemies should take ~20 ticks to arrive
  - Assert at tick 15: enemies have NOT reached settlement
  - Assert at tick 25: enemies HAVE reached settlement

TEST: "Walls block enemy movement"
  - Build a solid wall line between enemy spawn and settlement
  - Enemies pathfind and find no gap
  - Assert enemies stop at wall and attack it
  - Assert wall takes damage each tick

TEST: "Wall chokepoint funnels enemies"
  - Build walls with single 1-tile gap
  - Spawn 5 enemies
  - Assert all enemies path through the gap (all pass through same tile)

TEST: "Guard intercepts enemy before it reaches building"
  - Place guard between enemy spawn and target building
  - Enemy walks toward building, passes near guard
  - Assert guard breaks patrol and engages enemy
  - Assert combat happens at guard's interception point, NOT at the building

TEST: "Undefended building takes damage"
  - No guards, enemy reaches a farm
  - Assert farm HP decreases each tick enemy is adjacent
  - Assert farm is destroyed after HP reaches 0

TEST: "Raid ends when all enemies killed"
  - Spawn 3 enemies, place 2 well-equipped guards
  - Run until all enemies HP <= 0
  - Assert raid state cleared
  - Assert no enemy entities remain on map
```

### Guard Patrol Tests (`src/tests/test-guards.ts`)

```
TEST: "Guard walks patrol route"
  - Set patrol waypoints: (5,5) → (15,5) → (15,15) → (5,15)
  - Run ticks, verify guard moves 1 tile/tick along route
  - Assert guard visits each waypoint in order

TEST: "Guard detects and intercepts enemy"
  - Guard at (10,10), enemy enters detection range at (10,18)
  - Assert guard changes state to intercepting
  - Assert guard moves toward enemy
  - Assert combat begins when adjacent

TEST: "Guard resumes patrol after combat"
  - Guard on patrol, enemy appears, guard intercepts and kills
  - Assert guard returns to patrol route after enemy dead
```

### Wildlife Tests (`src/tests/test-wildlife.ts`)

```
TEST: "Animals move on the grid"
  - Spawn deer at (10,10)
  - Run 10 ticks
  - Assert deer position changed (roaming behavior)
  - Assert deer moved at most 1 tile per tick

TEST: "Hostile animals attack nearby villagers"
  - Spawn wolf at (10,10), villager at (10,12)
  - Run ticks until wolf is adjacent to villager
  - Assert wolf attacks villager (villager takes damage)

TEST: "Hunter kills animal and drops resources at location"
  - Assign hunter, spawn deer nearby
  - Hunter walks to deer, kills it
  - Assert food/leather appears at deer's death position
  - Assert resources must be hauled to storage (not instant)
```

### Integration / Balance Tests (`src/tests/test-spatial-balance.ts`)

```
TEST: "Basic colony survives 10 days (1200 ticks)"
  - 3 villagers, 2 houses near farm near storehouse
  - Compact layout (short commutes)
  - Assert survival, population ≥ 2 at end

TEST: "Spread-out colony is less efficient than compact one"
  - Same buildings/workers, but 30 tiles apart vs 5 tiles apart
  - Run 10 days
  - Assert compact colony has more stored resources

TEST: "Walled colony survives raid that destroys unwalled colony"
  - Same colony, one with walls + gate + guard, one without
  - Trigger identical raid
  - Assert walled colony survives, unwalled loses buildings

TEST: "Full day cycle is observable"
  - Track one villager for 120 ticks
  - Assert they: woke up, traveled to work, worked, hauled resources,
    traveled to eat, ate, traveled home, went to sleep
  - Assert all transitions happened at specific ticks with specific positions
```

## Rebalancing Notes

Converting from 1 tick/day to 120 ticks/day changes every number in the game:

- Production: was 3 wheat/worker/tick → now ~0.1 wheat/worker/tick (or 1 wheat per 10 work ticks)
- Food consumption: was 1/tick/villager → now 1 per 120 ticks (eat once per day)
- Spoilage: was 5%/tick → now per-day check or tiny per-tick rate
- Raid bar: accumulates per-day, not per-tick
- Tool durability: degrades per work action, not per tick
- Skill XP: gained per work action
- Immigration/departure: checked once per day (every 120 ticks), not every tick

The key principle: **game-day outcomes should be similar to v1**, just spread across 120 ticks with real spatial behavior. A farm that produced 3 wheat/day should still produce ~3 wheat/day, it just takes 120 ticks to do it with the worker physically present and hauling.
