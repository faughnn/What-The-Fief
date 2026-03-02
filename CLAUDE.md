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
RUN    -> Execute: npx tsx src/main.ts --ticks N --view all
READ   -> Read the stdout output carefully
CHECK  -> Does the output match expectations? Any errors?
         YES -> commit, update PROGRESS.md, move to next feature
         NO  -> diagnose from the output, fix the code, go to RUN
```

Always verify by running the code. Never assume code works — run it and read the output.

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

As the codebase grows, you may split modules into subdirectories (e.g., src/simulation/pathfinding.ts) but maintain the same dependency direction. world.ts types can split into src/world/*.ts, etc.

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
- If something is genuinely broken and you can't fix it after 3 attempts, log it in PROGRESS.md under "Known Issues" and move to the next feature
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

## Bootstrap (first time only)

If `package.json` doesn't exist, the project hasn't been initialized yet:
1. Run `npm init -y`
2. Run `npm install -D tsx typescript`
3. Create `tsconfig.json` with strict mode
4. Create the `src/` directory
5. Then start Phase 1
