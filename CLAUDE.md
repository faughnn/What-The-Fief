# ColonySim — Autonomous Development Instructions

You are autonomously building a 2D top-down colony sim inspired by Bellwright. No human input. Read the design, check progress, build the next thing, verify it works, commit, repeat.

**The simulation must be physically realistic.** Every entity has a real grid position at every tick. All movement is 1 tile per tick. There is no teleportation, no instant actions, no abstract resolution. When a renderer is eventually plugged in, it should just read GameState each tick and draw it — the simulation IS the animation data.

## After Every Compaction or New Session (do this FIRST, then start working immediately)

You are autonomous. Do NOT ask the user what to do — read PROGRESS.md and continue.

1. Read `PROGRESS.md` — it tells you exactly where you left off, what's broken, and what to do next
2. Read ONLY the files listed under "Active Files" in PROGRESS.md — not everything
3. Read the relevant spec if one exists (phase spec, or the v2 spatial spec)
4. **Immediately start working** — pick up where you left off, do NOT re-do completed work, do NOT ask the user for direction
5. If PROGRESS.md says "Not started", check if `package.json` exists:
   - No → run Bootstrap (below)
   - Yes → continue building

The user said "go" — that means work autonomously until done. Every compaction is just a memory reset, not a new conversation. Keep building.

## The Loop

```
EDIT  -> Write/modify TypeScript files
RUN   -> npx tsx src/main.ts [with whatever CLI args exist]
READ  -> Read stdout — look for ERROR: lines first, then check output
FIX   -> If errors or wrong output, diagnose and fix, go to RUN
TEST  -> Run phase tests: npx tsx src/tests/test-<name>.ts
COMMIT-> When it works AND tests pass: git commit, update PROGRESS.md, next feature
```

Run the code after every change. Never assume it works. **Never commit unless all relevant tests pass.**

## Quality Gates

### Invariants (never skip)
The game validates its own state after every tick, printing `ERROR:` lines for violations:
- No negative resources, no out-of-bounds positions, no orphaned assignments
- Population matches villager list, storage within capacity, no overlapping buildings
- **No entity moved more than 1 tile in a single tick** (v2 spatial invariant)
- **No action-at-a-distance** — interactions require adjacency
- Add new invariants as new systems are built
- If `ERROR:` appears in output, fix it before moving on

### Test-Driven Enforcement
Each phase has mandatory tests in `src/tests/`. **Write the tests FIRST, then implement until they pass.** The tests are designed so that abstract/instant/teleporting implementations CANNOT satisfy them. If you find yourself wanting to make a test less strict, you're going in the wrong direction — fix the implementation instead.

### Regression
Before starting each new phase: run ALL existing tests. If any fail, fix before proceeding. After the phase, run all tests again.

### Output Management
- Default stdout: compact summary (resources, population, alerts, errors) — under ~50 lines
- `--view map`, `--view villagers`, etc. for detailed views behind flags
- Maps over 20x20: compact summary omits the grid, shows only stats and errors
- `--view tick` shows one tick's movement/actions for debugging

## Architecture

```
src/main.ts           -> CLI entry point
src/simulation/       -> Game rules (tick phases, movement, combat, production)
src/world/            -> Data types, factory functions, constants
src/render-text.ts    -> Reads GameState, returns string
src/tests/            -> All test files
```

- GameState is the single source of truth
- tick() is deterministic — same state = same result
- No mutation — return new state
- Split files at ~300 lines into subdirectories with index.ts re-exports
- Every entity (villager, enemy, animal) has a real (x,y) grid position that changes by at most 1 per tick

Full design: `docs/plans/2026-03-02-colony-sim-design.md`
V2 spatial spec: `docs/plans/v2-spatial-simulation-spec.md`

## Tick Model

**120 ticks = 1 game day.** Each tick, every entity can move 0 or 1 tile.

```
Ticks   0-29:  Night (villagers sleep in homes)
Tick    30:    Wake, begin daily routine
Ticks  30-119: Day (travel, work, haul, eat, travel home)
```

A villager 20 tiles from work spends 40 ticks commuting (20 each way), leaving ~50 ticks for productive work. A villager next to their workplace gets ~90 work ticks. **Distance matters. Layout matters. This is core gameplay.**

### Tick Phases (every tick, in order)
1. **Movement** — every entity moves 0-1 tiles toward current destination
2. **Actions** — entities at their destination: work, fight, haul, eat, build
3. **Needs** — hunger/morale updates
4. **Spawning** — enemy/animal/immigration checks (daily, on tick 0 of each day)
5. **Day transition** — season/weather changes (on tick 0 of day 0 of new season)
6. **Validation** — invariant checks

## Spatial Rules (HARD REQUIREMENTS — never violate these)

These are not guidelines. They are invariants. Tests enforce every one.

### S1: Maximum 1 Tile Movement Per Tick
An entity at (x,y) can only be at (x±1,y), (x,y±1), or (x,y) next tick. Moving 10 tiles takes ≥10 ticks. The validation function checks this every tick and prints `ERROR:` if violated.

### S2: Physical Presence Required For All Interactions
To work at a building: must be on the building's tile. To attack an enemy: must be adjacent. To pick up resources: must be on the tile. To eat: must be at a building with food. No action at a distance, ever.

### S3: Buildings Have HP
Every building has `hp` and `maxHp`. Enemies damage buildings they're adjacent to. 0 HP = destroyed (becomes rubble). Workers can repair damaged buildings.

### S4: Walls Block Movement
Wall and fence tiles block all pathfinding for enemies. Enemies must path around or attack the wall (dealing damage each tick until breached). Gates allow ally passage, block enemies. This creates chokepoints.

### S5: Local Inventory — No Global Teleportation of Resources
Production buildings have a local output buffer. Workers produce into this buffer. Resources must be physically carried (by the worker or a dedicated hauler) to a storehouse to enter global storage. If the buffer is full, production stops until someone hauls.

### S6: Construction Takes Time
Placing a building creates a construction site (non-functional). A builder must travel to it and work for N ticks. The building only becomes functional when construction completes. Larger buildings take more ticks.

### S7: Enemies Are Physical Grid Agents
Enemies spawn at map edges, have a grid position, and move 1 tile/tick toward the settlement. They are real entities on the map, not abstract stat blocks. They pathfind, they can be blocked by walls, they fight guards at specific locations.

### S8: Guards Patrol and Intercept
Guards walk patrol routes or hold defend positions. When enemies enter detection range (8 tiles), guards break routine and move to intercept. Combat happens where guard meets enemy on the grid, not in the abstract.

## Phases

### Phases 1-12: COMPLETE (v1 abstract simulation)
These built the game systems with abstract/instant resolution. All working. v2 phases now rework the core into a proper spatial simulation.

### Phase 13: Tick Model & Movement Rework
Convert from 1-tick-per-day to 120-ticks-per-day with real step-by-step movement.

**Implementation:**
- Redefine tick as 1/120th of a day
- Add `destination: {x,y} | null` and state machine to Villager
- Movement phase: each villager/entity moves 1 tile toward destination via BFS path
- Day schedule: sleep (ticks 0-29), wake and go to work (tick 30+), work, return home
- Rebalance ALL production/consumption rates for 120-tick days
- Eating requires traveling to a building with food
- Add movement validation invariant: no entity jumps >1 tile

**Mandatory tests (`src/tests/test-movement.ts`) — write these FIRST:**
```
1. Villager at (5,5) with destination (5,15): after 1 tick at (5,6), after 10 ticks at (5,15)
2. Villager 20 tiles away: NOT arrived after 19 ticks, arrived after 20
3. Water blocks path: villager routes around, takes extra ticks proportional to detour
4. No path exists: villager stays put, state=IDLE
5. Commute test: villager 5 tiles from farm produces MORE per day than villager 25 tiles away
6. Full day cycle: track 1 villager for 120 ticks — assert they slept, traveled, worked, traveled home
```

### Phase 14: Local Inventory & Hauling
Production goes to building's local buffer, must be physically carried to storehouse.

**Implementation:**
- Add `localInventory: Record<ResourceType, number>` and `bufferCapacity` to Building
- Production fills local buffer. When full, production pauses.
- Worker self-haul: walk to storehouse, deposit, walk back to workplace
- Hauler role: dedicated villagers that pick up from production buildings and deliver
- Carry capacity: 5-10 items per trip
- Storehouse is where "global" resources live

**Mandatory tests (`src/tests/test-hauling.ts`) — write FIRST:**
```
1. Production goes to building local buffer, NOT global storage
2. Buffer full (capacity 5): production stops at 5, doesn't exceed
3. Self-haul: worker walks to storehouse (verify position each tick), deposits, walks back
4. Round trip time: farm 10 tiles from storehouse → haul takes ≥20 ticks
5. Closer storehouse = more throughput: 5-tile vs 20-tile distance, run 1 day, compare global storage
6. Hauler role: dedicated hauler picks up from farm, delivers to storehouse, returns for more
```

### Phase 15: Construction & Building HP
Buildings take time to build and can be damaged.

**Implementation:**
- `placeBuilding` creates a construction site: `{state: 'construction', progress: 0, requiredTicks: N}`
- Builder role: travels to site, works 1 tick = 1 progress. Building completes when progress = requiredTicks
- Building HP: `{hp: N, maxHp: N}` on every building
- Damage: `building.hp -= damage` per tick from adjacent enemies
- HP 0 = destroyed → rubble tile (passable, clearable)
- Repair: worker at building, 1 HP per tick restored

**Construction ticks by cost tier:**
- Cheap (≤5 resources total): 30 ticks (¼ day)
- Medium (≤15): 60 ticks (½ day)
- Expensive (≤30): 120 ticks (1 day)
- Major (30+): 240 ticks (2 days)

**Building HP by type:**
- fence: 20, wall: 80, tent: 15, house: 50, manor: 100
- farm/production: 30-40, storehouse: 60, town_hall: 120

**Mandatory tests (`src/tests/test-buildings.ts`) — write FIRST:**
```
1. Place house → state is 'construction', NOT functional (can't house villagers)
2. Builder works 60 ticks → house completes, becomes functional
3. No builder assigned → construction never completes (not auto)
4. Fence (20 HP) takes 5 damage/tick → destroyed after 4 ticks, tile becomes rubble
5. Repair worker restores 1 HP/tick, stops at maxHp
6. Destroyed building removes from buildings list, unassigns workers
```

### Phase 16: Spatial Raids & Enemy Agents
Enemies are real grid entities that spawn, march, attack, and die at specific map locations.

**Implementation:**
- `Enemy` entity with: id, type, x, y, hp, maxHp, attack, defense, state, destination, path
- Enemy states: SPAWNING → MARCHING → ATTACKING_WALL → ATTACKING_BUILDING → FIGHTING → DEAD
- Raid triggers → enemies spawn at random map edge
- Each tick: enemies move 1 tile toward nearest building (BFS pathfind)
- If wall/fence blocks path: stop adjacent, attack it (damage per tick)
- If building reached: attack it (damage per tick to building HP)
- If guard adjacent: engage in combat (both exchange damage per tick)
- Dead enemies removed from map
- Raid ends when all enemies dead or fled

**Mandatory tests (`src/tests/test-spatial-raids.ts`) — write FIRST:**
```
1. Enemies spawn at map edge (x=0 or max or y=0 or max), not in settlement
2. Enemy moves 1 tile/tick toward settlement — verify position each tick
3. Enemy 20 tiles away: NOT at settlement after 15 ticks, arrives by tick 25
4. Wall between enemy and target: enemy stops at wall, wall takes damage each tick
5. Wall with 1-tile gap: ALL enemies path through the gap (verify positions)
6. Guard intercepts: guard between spawn and target, combat happens at guard's position NOT at building
7. Undefended building: enemy arrives, building HP decreases each tick, destroyed at 0
8. Raid over: all enemies dead → raid state cleared, no enemy entities on map
9. Multiple enemies: 5 enemies spawn, all have unique positions, all march independently
```

### Phase 17: Guard Patrols & Defense Structures
Guards actively defend through positioning and patrol routes.

**Implementation:**
- Guard patrol: list of waypoints, guard walks between them in order, loops
- Guard defend mode: hold position, intercept enemies within 8-tile detection range
- When enemy detected: guard breaks routine, pathfinds toward enemy, engages when adjacent
- After combat: return to patrol/defend point
- Gate building: wall tile that allies can pass through, enemies cannot (must attack to breach)
- Watchtower: extends detection range to 15 tiles, provides early warning event

**Mandatory tests (`src/tests/test-guards.ts`) — write FIRST:**
```
1. Guard walks patrol route: verify position moves along waypoints at 1 tile/tick
2. Guard completes patrol loop: returns to first waypoint after reaching last
3. Enemy enters detection range (8 tiles): guard state changes to INTERCEPTING
4. Guard moves toward enemy: verify closing distance each tick
5. Combat begins when adjacent: both take damage each tick
6. Guard wins → returns to patrol route
7. Gate test: ally villager passes through gate tile, enemy cannot (attacks it instead)
8. Watchtower extends detection to 15 tiles: guard detects enemy at 12 tiles with tower, not without
```

### Phase 18: Wildlife & Hunting
Animals as real map entities that roam, flee, and fight.

**Implementation:**
- Animal entity: id, type, x, y, hp, state (ROAMING, FLEEING, ATTACKING, DEAD)
- Types: deer, rabbit (passive — flee from villagers), wolf, boar (hostile — attack villagers in range)
- Roaming: random movement, 1 tile/tick, stay in preferred terrain
- Hostile animals: attack villagers within 3 tiles
- Hunter role: pathfind to nearest animal, kill it (melee combat)
- Dead animal: drops food/leather at death position (must be hauled)
- Animal spawning: edges of map, based on terrain (wolves from forest)

**Mandatory tests (`src/tests/test-wildlife.ts`) — write FIRST:**
```
1. Animal moves: deer at (10,10), run 10 ticks, position changed, never moved >1 tile/tick
2. Passive animal flees: villager approaches deer within 5 tiles, deer moves away
3. Hostile animal attacks: wolf at (10,10), villager at (10,12), wolf moves toward and attacks
4. Hunter kills animal: hunter walks to deer, combat, deer dies at specific position
5. Dead animal drops resources AT death position, not in global storage
6. Resources must be hauled from death position to storehouse
```

### Phase 19: Spatial Balance Pass
Rebalance everything for the 120-tick-per-day spatial model.

**Mandatory tests (`src/tests/test-spatial-balance.ts`) — write FIRST:**
```
1. Compact colony (short commutes) survives 10 days (1200 ticks) with pop ≥ 2
2. Spread-out colony (30-tile commutes) produces LESS than compact (5-tile commutes) in 10 days
3. Walled colony with guard survives raid that destroys identical unwalled colony
4. Full day cycle observable: 1 villager tracked for 120 ticks shows sleep→travel→work→haul→eat→travel→sleep
5. Economy functional: 1 farmer feeding 3 villagers, food stockpile stable over 5 days
6. Winter survival: colony with stored food survives winter season (harsh but possible)
7. Tool progression: colony with blacksmith + tools produces more than colony without
```

## Rebalancing Guide (v1 → v2)

When converting from 1-tick-per-day to 120-ticks-per-day, game-day outcomes should stay similar:

| System | v1 (per tick = per day) | v2 (per 120 ticks = per day) |
|---|---|---|
| Production | 3 wheat/worker/tick | 1 wheat per ~10 work ticks (≈3/day if 30 work ticks) |
| Food consumption | 1 food/villager/tick | 1 food/villager/day (eat once, at food source) |
| Spoilage | 2% wheat/tick | 2% wheat/day (check on tick 0) |
| Raid bar | accumulates per tick | accumulates per day (check on tick 0) |
| Tool durability | -1 per tick worked | -1 per ~10 work ticks |
| Skill XP | +1 per tick worked | +1 per ~30 work ticks |
| Immigration | checked every tick | checked on tick 0 of each day |

**Key principle**: a farm that produced ~3 wheat/day in v1 should still produce ~3 wheat/day in v2, but the worker must physically be there, and the wheat sits at the farm until hauled.

## Design Philosophy & Balance

This is a **Bellwright-inspired** colony sim. When making design decisions or fixing balance, follow these principles in order:

### 1. Realism First
Prefer solutions grounded in how medieval/pre-industrial settlements actually worked:
- Tool progression should mirror real materials: **wood → stone/flint → copper/bronze → iron → steel**
- Food production should follow real agriculture: seasons matter, crops take time
- Construction should use real materials and make sense physically
- Combat should reflect reality: walls channel enemies, numbers and equipment matter
- Economy should follow supply chains that make intuitive sense
- **Distance and logistics matter** — a farm far from storage is less efficient

### 2. Reference Bellwright
When unsure, ask "how does Bellwright handle this?"
- Villagers are autonomous agents walking around the world
- Enemies march toward your settlement, you watch them coming
- Walls and fences channel attackers through defended chokepoints
- Guards patrol and intercept, combat happens at specific map locations
- Resources are carried physically, logistics layout matters
- Construction takes time, workers build on-site

### 3. Unrealistic Only as Last Resort
If realistic solutions don't fix a balance problem after 3 attempts, then consider gamey/unrealistic fixes. Document why the realistic approach failed.

## Workflow

**Phase starts:** Read the phase description above → write tests FIRST to `src/tests/test-<name>.ts` → implement until all tests pass → commit

**Test-first is mandatory.** Write the tests from the specifications above before writing any implementation code. The tests enforce spatial behavior — if you can pass them with an abstract/teleporting implementation, the tests are wrong.

**Commits:** After each working feature. Format: `phase N: description`. Never commit broken code. Never commit with failing tests.

**Progress:** Update PROGRESS.md after every commit. Be specific — it's your only memory after compaction.

**Decisions:** Make them yourself. Document ambiguous choices in PROGRESS.md. If stuck after 3 meaningfully different approaches, log "Known Issues" with what you tried, move on.

**File splitting:** At ~300 lines, split into subdirectory with index.ts re-exports.

## Tech Stack

- TypeScript, run with `npx tsx` (no build step)
- No frameworks — pure TypeScript
- Only dependency: `tsx`

## Completion

When all phases through 19 are done:
1. Run ALL test files: `npx tsx src/tests/test-movement.ts`, `test-hauling.ts`, `test-buildings.ts`, `test-spatial-raids.ts`, `test-guards.ts`, `test-wildlife.ts`, `test-spatial-balance.ts`
2. ALL tests must pass — zero failures
3. Run a full simulation (10+ game days = 1200+ ticks) with `--view summary` — zero `ERROR:` lines
4. Update PROGRESS.md to mark complete
5. Stop
