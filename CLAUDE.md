# ColonySim — Autonomous Development Instructions

You are autonomously building a 2D top-down colony sim inspired by Bellwright. No human input. Read the design, check progress, build the next thing, verify it works, commit, repeat.

## After Every Compaction (do this first)

1. Read `PROGRESS.md` — it tells you exactly where you left off and what files to re-read
2. Read ONLY the files listed under "Active Files" in PROGRESS.md — not everything
3. Read the current phase spec (`docs/plans/phase-N-spec.md`) if one exists
4. Pick up where you left off — do NOT re-do completed work
5. If PROGRESS.md says "Not started", check if `package.json` exists:
   - No → run Bootstrap (below)
   - Yes → continue building

## The Loop

```
EDIT  -> Write/modify TypeScript files
RUN   -> npx tsx src/main.ts [with whatever CLI args exist]
READ  -> Read stdout — look for ERROR: lines first, then check output
FIX   -> If errors or wrong output, diagnose and fix, go to RUN
COMMIT-> When it works: git commit, update PROGRESS.md, next feature
```

Run the code after every change. Never assume it works.

## Quality Gates

### Invariants (build from Phase 1, never skip)
The game validates its own state after every tick, printing `ERROR:` lines for violations:
- No negative resources, no out-of-bounds positions, no orphaned assignments
- Population matches villager list, storage within capacity, no overlapping buildings
- Add new invariants as new systems are built
- If `ERROR:` appears in output, fix it before moving on

### Regression
Before starting each new phase: run a baseline scenario, save to `docs/baselines/phase-N-pre.txt`. After the phase, re-run it. Systems you didn't touch should produce the same results.

### Verification
- Test edge cases (0 food, full storage, 100 ticks, etc.)
- For complex systems (pathfinding, combat), write test scripts in `src/tests/`

### Output Management
- Default stdout: compact summary (resources, population, alerts, errors) — under ~50 lines
- `--view map`, `--view villagers`, etc. for detailed views behind flags
- Maps over 20x20: compact summary omits the grid, shows only stats and errors

## Architecture

```
src/main.ts        -> CLI entry point
src/simulation.ts  -> Game rules. Pure functions: old state in, new state out
src/world.ts       -> Data types and factory functions. NO logic
src/render-text.ts -> Reads GameState, returns string
```

- GameState is the single source of truth
- tick() is deterministic — same state = same result
- No mutation — return new state
- Split files at ~300 lines into subdirectories (src/world/*.ts, src/simulation/*.ts)
- Re-export from index.ts to keep imports stable

Full design: `docs/plans/2026-03-02-colony-sim-design.md`

## Workflow

**Phase starts:** Read design doc phase outline → write detailed spec to `docs/plans/phase-N-spec.md` (types, function signatures, expected output, edge cases) → implement against it

**Commits:** After each working feature. Format: `phase N: description`. Never commit broken code. Fix forward, don't amend.

**Progress:** Update PROGRESS.md after every commit. Be specific — it's your only memory after compaction.

**Decisions:** Make them yourself. Document ambiguous choices in the phase spec. If stuck after 3 meaningfully different approaches, log in PROGRESS.md "Known Issues" with what you tried, move on.

**File splitting:** At ~300 lines, split into subdirectory with index.ts re-exports.

## Tech Stack

- TypeScript, run with `npx tsx` (no build step)
- No frameworks — pure TypeScript
- Only dependency: `tsx`

## Bootstrap (first time only)

If `package.json` doesn't exist:
1. Create `.gitignore` (node_modules/, dist/, *.js in src/, .DS_Store)
2. `npm init -y`
3. `npm install -D tsx typescript`
4. Create `tsconfig.json` with strict mode
5. Create `src/` directory
6. Commit as `bootstrap: initialize project with tsx and typescript`
7. Start Phase 1

## Completion

When all 12 phases are done:
1. Run a full simulation (100+ ticks) as integration test
2. Update PROGRESS.md to mark complete
3. Stop
