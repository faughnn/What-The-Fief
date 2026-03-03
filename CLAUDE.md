# ColonySim — Autonomous Development Instructions

You are building a 2D top-down colony sim that plays like Bellwright. Work autonomously. Read PROGRESS.md, identify the biggest gap between what exists and what Bellwright is, fix it, test it, commit, repeat.

## The Vision

A physically simulated medieval colony. The player is a god-like overseer — no character on the grid. You place buildings, assign jobs, set patrol routes, and watch your villagers live their lives. Every entity has a grid position every tick. Every movement is step-by-step. Every interaction requires physical presence. The simulation IS the animation data — when a renderer is plugged in, it just reads GameState and draws.

## Session Start (do this FIRST every time)

1. `export PATH="/c/Program Files/nodejs:$PATH"`
2. Read `PROGRESS.md` — it tells you where you left off
3. Read ONLY the files listed under "Active Files"
4. Start working immediately — don't ask, don't re-do completed work

## The Loop

```
OBSERVE  -> Run the game, look at what happens
EVALUATE -> Ask the Bellwright Question (see below)
DESIGN   -> Pick the biggest gap, design the fix
TEST     -> Write tests FIRST that enforce physical behavior
BUILD    -> Implement until ALL tests pass (new and existing)
COMMIT   -> git commit, update PROGRESS.md with Bellwright Question answer
REPEAT
```

Run after every change. Never assume it works. Never commit with failing tests.

## The Bellwright Question

**After every commit, write this answer in PROGRESS.md:**

> "Is this a complete 2D Bellwright? Be extremely strict and pedantic. If not, what specific things need to be added or improved? List them in priority order."

Be brutally honest. If villagers teleport — no. If combat is abstract math — no. If resources appear instantly in storage — no. If enemies don't physically march toward your walls — no.

**Every "yes" claim must have a passing test that proves it.** "Villagers walk step-by-step" needs a test verifying position each tick. "Walls block enemies" needs a test proving enemies can't pass through. No test = not proven = no.

**Balance must also be proven by tests.** The game must be neither trivially easy nor impossibly hard:
- Well-laid-out colony survives long-term; poorly-laid-out one struggles
- Raids are survivable with preparation, punishing without
- Winter is harsh but possible with stored food
- Distance and layout measurably affect productivity
- Each claim needs a test that proves it with numbers

The highest priority gap drives what you build next.

## Simulation Invariants

These are physics laws. They cannot be violated. Every tick, the validation function checks all of them and prints `ERROR:` if any are broken. Fix errors before doing anything else.

### Time
- **120 ticks = 1 game day**
- Ticks 0-29: night. Ticks 30-119: day.
- Daily checks (immigration, raids, spoilage, weather) happen on tick 0 of each day
- Seasonal changes happen every 10 game days

### Movement
- **No entity moves more than 1 tile per tick.** This is the most important rule.
- Moving 15 tiles takes ≥15 ticks. No exceptions.
- Water tiles block movement. Entities pathfind around.
- Wall/fence tiles block enemy movement. Allies can pass through gates.
- Every entity has a real (x,y) grid position at every single tick.

### Presence
- **All interactions require physical adjacency or co-location.**
- To work at a building: must be on the building's tile.
- To attack an enemy: must be adjacent (within 1 tile).
- To pick up resources: must be on the tile they're on.
- To eat: must be at a building that has food.
- To build: must be at the construction site.
- To trade: must be at the marketplace.
- No action at a distance. Ever.

### Resources
- **Resources exist at physical locations, not in a global pool.**
- Production output goes into the building's local buffer.
- Local buffers have limited capacity. Full buffer = production stops.
- Resources must be physically carried to a storehouse to be "stored."
- Carry capacity is limited (5-10 items per trip).
- A storehouse IS the "global storage" — it's just a building with a big buffer.

### Buildings
- **Buildings are physical grid objects with HP.**
- Placing a building creates a construction site (non-functional).
- A worker must travel there and work for N ticks to complete it.
- Every building has HP. Enemies damage adjacent buildings.
- 0 HP = destroyed → rubble tile (passable, clearable).
- Workers can repair damaged buildings (1 HP per work tick).
- Buildings block movement on their tiles (except for assigned workers entering).

### Combat
- **Enemies are real grid agents.** They spawn at map edges with real positions.
- Enemies move 1 tile/tick toward the settlement. You watch them coming.
- Enemies attack the first obstacle: wall → fence → building → villager.
- Walls/fences take damage per tick from adjacent enemies. Breached at 0 HP.
- Guards detect enemies within range, break routine, pathfind to intercept.
- Melee combat: adjacent entities exchange damage each tick.
- Dead entities are removed from the map.

### Villagers
- **Villagers are autonomous agents with real daily routines.**
- They have a state machine: SLEEPING → TRAVELING → WORKING → HAULING → EATING → TRAVELING_HOME
- They pathfind (BFS/A*) to destinations and walk there step by step.
- They produce resources at their workplace (if physically present).
- They haul resources from workplace to storehouse (walking there and back).
- They travel to a food source to eat when hungry.
- They return home to sleep at night.
- Distance from home to work affects how many ticks they can actually work.
- They have skills, traits, morale, hunger, HP.
- **Idle task priorities:** When a villager has no assigned job (or their workplace is destroyed), they autonomously pick tasks in priority order: haul resources from full buffers → build unconstructed buildings → clear rubble → repair damaged buildings → idle. This mirrors Bellwright's priority system — villagers are productive even without explicit player commands.

### Animals
- **Wildlife are real grid entities.**
- Passive animals (deer, rabbits) roam and flee from nearby entities.
- Hostile animals (wolves, boars) attack entities in range.
- Hunters track and kill animals. Drops appear at the death location.
- Drops must be hauled to storage like any other resource.

### Overseer (Player)
- **The player has no physical presence on the grid.**
- The player issues commands: place buildings, assign villagers, set patrol routes, queue research.
- Villagers carry out commands autonomously — the player cannot micromanage movement.
- The player sees the world through the text renderer (map, villager status, economy, alerts).

## V1 → V2 Transition

Phases 1-12 built an abstract simulation where villagers teleport, combat is instant math, and resources go straight to a global pool. The data types and templates (`world.ts`) are reusable. The simulation logic (`simulation.ts`) must be rewritten — it assumes 1 tick = 1 day and every system uses instant resolution. Incrementally patching won't work because every rate, timer, and check is calibrated for the wrong tick model. **Keep the data layer. Rewrite the simulation layer.** Existing v1 tests should be replaced as each system is rebuilt.

## Tests

Tests must be **physically unfakeable** — abstract implementations must fail them.

Good: verify positions each tick, check local buffers not global, measure travel time, confirm adjacency during combat.
Bad: "colony has 50 wheat after 100 ticks" (doesn't verify where/how), "guard defeats enemy" (doesn't verify where).

Write in `src/tests/`. Run ALL before committing.

## Architecture

- GameState is the single source of truth. tick() is deterministic, no mutation.
- Split files at ~300 lines into subdirectories with index.ts re-exports.
- TypeScript, `npx tsx`, no frameworks, only dependency is `tsx`.

## Design Tiebreaker

When unsure: **"How does Bellwright do this?"** When realism and Bellwright conflict, prefer Bellwright. When neither helps, prefer the more physically grounded option. Document decisions in PROGRESS.md.

## Workflow

**Commits:** After each working feature. Never commit broken code.

**PROGRESS.md** after every commit: what you built, test status, Bellwright Question answer, what's next, active files.

**Stuck?** 3 different approaches failed → log in PROGRESS.md, move to next gap.

## Completion

There is no checklist. The game is done when the Bellwright Question honestly answers "Yes" with zero caveats.

Not "mostly yes." Not "yes, except for combat." Not "yes, if you ignore the resource system." Not "functionally yes." The answer must be an unqualified, 100%, nothing-left-to-build **yes** — and every single claim in that answer must have a passing test backing it up. If even one system is abstract, instant, or faked, the answer is **no**.

Run all tests, run a long simulation, verify zero `ERROR:` lines, ask the Bellwright Question one final time with maximum pedantry. If there is any gap at all, keep building.

### Stress / Balance Testing

The long simulation stress test must include a **player AI** — a function that examines game state each day and issues commands like a real player would. Bellwright is not a hands-off simulation; the player constantly builds, assigns, and adapts. Testing without player input is testing a scenario that never happens in real gameplay.

The player AI should make reasonable decisions:
- Build farms when food is low, expand housing when population grows
- Build walls and assign guards as raid threat increases
- Build a tanner/weaver before winter for clothing
- Rebuild destroyed buildings, reassign displaced workers
- React to events (disease → build well, raids → fortify)

The stress test proves: **given reasonable player decisions, does the colony thrive over 100 days?** This validates both the simulation systems AND the balance — if a competent player can't keep a colony alive, the game is broken.
