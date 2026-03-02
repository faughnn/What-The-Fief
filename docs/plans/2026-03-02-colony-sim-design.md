# 2D Bellwright — Design Document

## Vision

A 2D top-down colony sim inspired by Bellwright. You're an omniscient overseer managing a medieval village. Villagers are autonomous agents that move on a grid, work jobs, eat, sleep, and have individual traits. You place buildings, assign jobs, manage resources, research technology, expand territory, and defend against raids. No player character — you direct, the villagers act.

The game is built iteratively through an autonomous LLM development loop: Claude Code edits code, runs it, reads the output, identifies problems, fixes them, and moves on.

## Core Pillars

1. **Living villagers** — individuals that walk around, have skills, morale, needs, and make the colony feel alive
2. **Production chains** — interconnected multi-step economy (ore -> ingot -> tools -> efficiency)
3. **Growth & expansion** — start small, scout outward, discover resources, expand territory
4. **Threat & defense** — raids escalate, guards patrol, squads defend, walls channel enemies
5. **Progression** — three-tier research tree unlocks buildings, equipment, and systems over time

## The LLM Feedback Loop

### Mechanism

```
1. EDIT    — Claude Code writes/modifies a .ts file
2. RUN     — Claude Code executes `npx tsx src/main.ts`
3. OBSERVE — Claude Code reads stdout (ASCII grid + stats)
4. DECIDE  — Claude either identifies a problem and goes to step 1,
              or confirms success and stops
```

### Observation Format

Primary feedback is text-based via stdout. Multiple views available:

```
=== Colony State [day 5] ===

  0 1 2 3 4 5 6 7 8 9
0 . . . . . ~ ~ . . .
1 . . H . . ~ ~ . . .
2 . . . F F . . . . .
3 . . . F F . . . . .
4 . . . . . . . . . .

Buildings: house(2,1) farm(3-4,2-3)
Resources: wood=10 food=24 stone=5
Population: 3/5 (2 idle, 1 farming)
Errors: none
```

Villager detail view:

```
Villagers:
  Edric (woodcutter) pos=(4,3) -> woodcutter_hut(7,2) [walking, 3 steps left]
  Mara (farmer) pos=(5,5) -> farm(5,6) [working, 2hrs left]
  Aldric (idle) pos=(2,1) -> house(2,1) [sleeping]
```

Additional views: economy summary, research status, alerts.

### Secondary Feedback

When Chrome browser automation is available, Claude can optionally screenshot an HTML Canvas renderer for visual spot-checks. This is never required for the core loop.

### Success Criteria

Claude autonomously builds the full core game through iterative edit-observe cycles. High-level direction from the user, Claude handles implementation, testing, and debugging.

## Architecture

Four modules, strict dependency direction:

```
main.ts -> simulation.ts -> world.ts
                |
           render-text.ts
```

### world.ts — Pure Data

The game state and nothing else. No logic, no mutation methods.

- `GameState`: master object containing everything below
- `Grid`: 2D array of `Tile` (terrain type, optional building, resource deposits)
- `Villager`: id, name, position, destination, path, role, job assignment, skills map, traits, morale, needs (food, sleep), equipment, combat stats, unhoused counter
- `Building`: type, position, size, assigned workers, inventory, durability, construction progress
- `Resource`: type, quantity (stored globally and per-building)
- `Research`: unlocked techs, current research, progress
- `Squad`: id, members, orders, patrol route
- `RaidState`: raid bar progress, active raid info, raid level
- `MapFog`: revealed/unrevealed tiles, claimed territory
- Factory functions to create initial worlds from config/seed

### simulation.ts — All Game Rules

Pure functions: old state in, new state out. Deterministic.

`tick(state): GameState` — one full day cycle:
1. Wake — villagers leave houses
2. Pathfind — calculate routes to assigned buildings
3. Travel — move villagers along paths (partial if day runs out)
4. Work — produce resources, consume inputs, gain skill XP
5. Eat — consume food from storage, food quality affects morale
6. Rest — return home, sleep
7. Morale update — recalculate from housing, food, weather, events
8. Growth/decline — immigration if prosperous, departure if miserable
9. Raid check — advance raid bar, trigger raid if full
10. Combat resolve — if raid active, simulate guard vs enemy encounters
11. Spoilage — food degrades, tools lose durability
12. Research progress — advance current research

Action functions:
- `placeBuilding(state, type, x, y): GameState`
- `assignVillager(state, villagerId, buildingId): GameState`
- `setResearch(state, techId): GameState`
- `sendScout(state, villagerId, direction): GameState`
- `formSquad(state, villagerIds, orders): GameState`

### render-text.ts — Text Renderer

Reads `GameState`, returns a string. Multiple views:
- Map view — ASCII grid with terrain, buildings, villager positions
- Villager roster — each villager's status, position, current action, morale
- Economy summary — resources, production rates, consumption rates, net per day
- Research status — current tech, progress, unlocked techs
- Alerts — raid warnings, starving villagers, broken tools, homeless villagers

### main.ts — Entry Point and CLI

- `--ticks N` — run N days
- `--view map|villagers|economy|research|alerts|all`
- `--place building x,y`
- `--assign villagerId buildingId`
- `--research techId`
- `--scout villagerId direction`

### Architectural Rules

- `GameState` is the single source of truth — everything is derivable from it
- `tick()` is deterministic — same state = same result, always
- No mutation — pure functions return new state
- Renderers only read state, never modify it
- New systems added by extending `GameState` and adding sub-steps to `tick()`

## Game Systems — Full Outline

### Phase 1 — Foundation
- Grid & terrain: 2D tile map with grass, forest, water, stone
- Text renderer: ASCII grid with coordinates, multiple view modes
- Building placement: place structures with validation (terrain, adjacency, resources)
- Basic resources: wood, stone, food as raw quantities
- Tick system: deterministic day cycle, CLI-driven

### Phase 2 — Living Village
- Villager agents: individual entities with position, name, home
- Movement & pathfinding: A* or similar, villagers walk to work and back
- Job assignment: assign villagers to buildings, they travel there and work
- Day schedule: wake -> travel -> work -> eat -> travel home -> sleep
- Basic needs: food consumption, housing requirement
- Growth/decline: immigration when prosperous, departure when miserable

### Phase 3 — Economy
- Multi-resource types: wood, stone, iron ore, wheat, herbs, flax, hemp
- Tier 1 buildings: farm, woodcutter, quarry, house, storehouse
- Production rates: workers produce per day based on building type
- Storage system: global + per-building inventory, storage caps
- Resource transport: delivery workers carry goods between buildings and storage

### Phase 4 — Production Chains
- Processed materials: planks, ingots, flour, bread, leather, linen, rope
- Tier 2 buildings: sawmill, mill, bakery, smelter, tanner, weaver, mine
- Chain dependencies: buildings consume inputs and produce outputs
- Food quality: raw wheat < flour < bread, better food = morale bonus
- Food spoilage: food degrades over time, compost pile recycles it

### Phase 5 — Villager Depth
- Skills: farming, mining, crafting, woodcutting, etc. (0-100, improve with use)
- Skill effect on output: higher skill = faster/more production
- Traits: inherent bonuses/penalties per villager (strong, lazy, skilled crafter, etc.)
- Morale system: affected by food quality, housing tier, weather, overwork, tavern
- Morale effects: high = work bonus, low = work penalty, very low = villager leaves
- Job priority system: per-villager priority 1-9 per job type, specialists vs generalists

### Phase 6 — Tools & Equipment
- Tool tiers: basic -> sturdy -> iron, better tools unlock resources and boost efficiency
- Tool durability: tools degrade with use, replaced from storage
- Toolless penalty: villagers without tools work at 50%
- Tier 3 buildings: blacksmith, toolmaker
- Equipment for guards: weapons and armor affect combat stats

### Phase 7 — Expansion & Exploration
- Larger map: 50x50+ with fog of war
- Scouting: assign villager as scout, reveals 10x10 area per day
- Territory claiming: can only build in claimed territory
- Resource discovery: iron deposits, fertile soil, herb patches hidden in fog
- Town Hall: unlocks expansion mechanics
- Fast travel points: signposts between settlements

### Phase 8 — Combat & Defense
- Raid system: raid bar fills based on prosperity/expansion, triggers enemy waves
- Enemy types: bandits (tiers), wolves, boars
- Guard role: villagers assigned as guards patrol and fight
- Squad formation: group guards into squads with orders (patrol, defend, hold)
- Combat simulation: stats-based resolution (attack, defense, HP, equipment)
- Fortifications: walls and fences as buildable structures, create chokepoints
- Raid escalation: higher raid levels bring tougher enemies

### Phase 9 — Research & Progression
- Three-tier research: research desk -> advanced desk -> workshop
- Tech tree: unlocks buildings, equipment tiers, new systems
- Research cost: requires time + resources + assigned researcher
- Gated progression: can't build tier 2 buildings without researching them

### Phase 10 — Advanced Economy
- Animal husbandry: chicken coop, livestock barn, apiary, breeding, feeding
- Trade: merchants at NPC villages, buy/sell goods
- Caravan routes: assign caravaneers, define trade routes between settlements
- Multiple settlements: outposts with their own buildings and workers
- Internal logistics: delivery system moves goods between buildings and settlements
- Prosperity system: village development driven by meeting needs

### Phase 11 — World Systems
- Day/night cycle: affects villager schedules and visibility
- Weather: rain (morale penalty), seasons affect farming
- Wildlife: deer, rabbits, wolves, boars as map entities, huntable/dangerous
- Housing tiers: tent -> cabin -> cottage -> house -> manor, better housing = morale
- Decorations & roads: roads speed movement, decorations boost morale

### Phase 12 — Narrative Layer
- NPC villages: pre-existing settlements on the map with trust system
- Trust ranks: earn trust through helping, gates recruitment quality
- Village liberation: fight occupiers, build belfry, defend, unlock prosperity
- Quest system: village quests that unlock unique buildings and villagers
- Renown: reputation earned through deeds, spent on recruitment and expansion

## What's Excluded

- Player character (no avatar in the world)
- Directional melee combat (combat is simulated, not action-based)
- Multiplayer/co-op
- Modding support
- Controller support

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js via tsx (no build step)
- **Primary feedback**: stdout text rendering
- **Secondary feedback**: HTML Canvas renderer + Chrome screenshots (added later)
- **No frameworks** for core game — pure TypeScript, no dependencies beyond tsx
