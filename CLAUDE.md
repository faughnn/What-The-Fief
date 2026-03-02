# ColonySim — Autonomous Development Instructions

You are autonomously building a 2D top-down colony sim inspired by Bellwright. You work without human input. Read the design, check progress, build the next thing, verify it works, commit, repeat.

## Quick Start (read this every time, especially after compaction)

1. Read `docs/plans/2026-03-02-colony-sim-design.md` for the full game design
2. Read `PROGRESS.md` to see exactly where you left off
3. Pick up from where PROGRESS.md says — do NOT re-do completed work
4. If starting a new phase, write a detailed spec in `docs/plans/phase-N-spec.md` first
5. Build through the feedback loop (below)
6. Commit after each working feature
7. Update PROGRESS.md after each commit — be granular about what's done and what's next

## The Feedback Loop

This is how you build everything:

```
EDIT   -> Write/modify TypeScript files
RUN    -> Execute the game: npx tsx src/main.ts [with whatever args exist]
READ   -> Read the stdout output carefully
CHECK  -> Does the output match expectations? Any errors?
         YES -> commit, update PROGRESS.md, move to next feature
         NO  -> diagnose from the output, fix the code, go to RUN
```

Always verify by running the code. Never assume code works — run it and read the output.

As the CLI gains flags (--ticks, --view, --place, etc.), use them to test specific scenarios. Early on, `npx tsx src/main.ts` with no args is fine.

### Invariant Validation (critical for self-correction)

The game must validate its own state. After every tick, run invariant checks and print any violations as `ERROR:` lines in stdout. Examples:
- No negative resources
- Every villager position is within grid bounds
- Every assigned worker's building exists on the grid
- Population count matches villager list length
- No two buildings on the same tile
- No villager assigned to a building that's already full
- Storage quantities don't exceed capacity
- No villager with negative morale/health/hunger values
- Every villager has a valid home (or is flagged as unhoused)
- Dead/departed villagers are removed from all assignments

Add new invariants as new systems are built. If you see `ERROR:` in output, fix the bug before moving on. This is how you catch logic bugs that aren't obvious from reading the grid.

Build this into the game from Phase 1. Don't skip it. It's the core of the self-correction loop.

### Verification Depth

Running the game once isn't enough for complex systems. As the game grows:
- Test edge cases explicitly (0 food, 0 villagers, full storage, overlapping buildings)
- Run extended simulations (50-100 ticks) to check for drift, overflow, or cascading failures
- When adding a new system, verify it doesn't break existing ones by running a full simulation
- If a system has tricky logic (pathfinding, combat, production chains), write a small test script in `src/tests/` that sets up specific scenarios and asserts expected outcomes

## Tech Stack

- TypeScript, run with `npx tsx` (no build step)
- No frameworks for core game — pure TypeScript
- Dependencies: only `tsx` for running TypeScript directly

## Architecture (do not deviate)

```
src/main.ts        -> Entry point, CLI arg parsing
src/simulation.ts  -> All game rules, pure functions (old state in, new state out)
src/world.ts       -> Pure data types and factory functions, NO logic
src/render-text.ts -> Reads GameState, returns string for stdout
```

Rules:
- GameState is the single source of truth
- tick() is deterministic — same state = same result
- No mutation — pure functions return new state
- Renderers only read state, never modify it
- New systems: add fields to GameState, add sub-steps to tick()

As the codebase grows, split files when they exceed ~300 lines. Use subdirectories that mirror the original module structure:
- `src/world.ts` -> `src/world/index.ts`, `src/world/villager.ts`, `src/world/building.ts`, etc.
- `src/simulation.ts` -> `src/simulation/index.ts`, `src/simulation/pathfinding.ts`, `src/simulation/combat.ts`, etc.

Maintain the same dependency direction. Re-export from index.ts so imports from other modules don't break.

## Phase Specs

Before starting any new phase:
1. Read the one-line descriptions from the design doc
2. Write a detailed spec: `docs/plans/phase-N-spec.md`
3. Include: exact data types, function signatures, expected text output examples, edge cases
4. Then implement against that spec

This is the "just-in-time" design — flesh out details only when you're about to build them.

## Commit Discipline

- Commit after each meaningful, working feature (not after every file edit)
- Commit message format: `phase N: description of what was added/fixed`
- Always run and verify before committing — never commit broken code
- If you realize a commit was wrong, fix forward (new commit), don't amend

## Progress Tracking

PROGRESS.md is your memory across compactions. Keep it updated:
- What phase you're on
- What features within that phase are done
- What you're currently working on (specific enough to resume)
- What's next
- Any known issues or decisions you made

Be specific. After compaction you will lose all conversation context. PROGRESS.md is how you resume.

## Decision Making

- Never ask for human input — make decisions yourself
- When the design doc is ambiguous, make a reasonable choice and document it in the phase spec
- If you discover the architecture needs adjustment, make the change and document why in PROGRESS.md
- If something is genuinely broken and you can't fix it after 3 different approaches (not 3 runs of the same fix — 3 meaningfully different strategies), log it in PROGRESS.md under "Known Issues" with what you tried, and move to the next feature
- Prefer simple solutions over clever ones
- Don't over-engineer — build what's needed for the current phase, not future phases

## Build Phases (from design doc)

1. Foundation — grid, terrain, text renderer, building placement, basic resources, tick system
2. Living Village — villager agents, pathfinding, job assignment, day schedule, needs, growth
3. Economy — multi-resource types, tier 1 buildings, production rates, storage, transport
4. Production Chains — processed materials, tier 2 buildings, chain deps, food quality, spoilage
5. Villager Depth — skills, traits, morale system, job priorities
6. Tools & Equipment — tool tiers, durability, toolless penalty, tier 3 buildings
7. Expansion & Exploration — larger map, fog of war, scouting, territory, town hall
8. Combat & Defense — raids, enemies, guards, squads, combat sim, fortifications
9. Research & Progression — tech tree, research buildings, gated progression
10. Advanced Economy — animals, trade, caravans, multiple settlements, logistics
11. World Systems — day/night, weather, wildlife, housing tiers, roads, decorations
12. Narrative Layer — NPC villages, trust, liberation, quests, renown

## Completion

When all 12 phases are implemented and verified:
1. Update PROGRESS.md to mark the project as complete
2. Run a full simulation (100+ ticks) as a final integration test
3. Log the final state in PROGRESS.md
4. Stop — the project is done

## Bootstrap (first time only)

If `package.json` doesn't exist, the project hasn't been initialized yet:
1. Create `.gitignore` with: node_modules/, dist/, *.js (in src/), .DS_Store
2. Run `npm init -y`
3. Run `npm install -D tsx typescript`
4. Create `tsconfig.json` with strict mode
5. Create the `src/` directory
6. Commit the bootstrap as `bootstrap: initialize project with tsx and typescript`
7. Then start Phase 1
