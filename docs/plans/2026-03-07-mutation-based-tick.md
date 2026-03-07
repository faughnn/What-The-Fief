# Mutation-Based tick() Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the per-tick deep copy in `tick()` by mutating `GameState` in place, improving performance for both the stress test and the real game.

**Architecture:** Make `TickState` extend `GameState` instead of duplicating its fields. `tick()` mutates the input state directly and returns it. The deep copy block and newState reconstruction are removed entirely. All systems already mutate `TickState` — no system changes needed.

**Tech Stack:** TypeScript, existing simulation architecture.

---

### Task 1: Make TickState extend GameState

**Files:**
- Modify: `src/simulation/helpers.ts:22-82` (TickState interface)

**Step 1: Replace TickState with an extension of GameState**

Change the TickState interface from a standalone copy of all GameState fields to:

```ts
export interface TickState extends GameState {
  // Computed tick fields (set once per tick, read by systems)
  newTick: number;
  newDay: number;
  dayTick: number;
  isNight: boolean;
  isDawn: boolean;
  isNewDay: boolean;
  toolDurBonus: number;
  originalVillagerCount: number;
  buildingMap: Map<string, Building>;
}
```

Remove all the duplicated field declarations that already exist on GameState (villagers, buildings, grid, fog, territory, resources, enemies, animals, etc.).

**Step 2: Run tests to verify the interface change compiles**

Run: `npx tsx src/tests/run-all.ts -q`
Expected: 1792 passed, 0 failed (the interface is structurally compatible)

**Step 3: Commit**

```
refactor: make TickState extend GameState
```

---

### Task 2: Rewrite tick() to mutate in place

**Files:**
- Modify: `src/simulation/index.ts:30-210` (tick function)

**Step 1: Replace the tick() function**

Replace the entire `tick()` function with:

```ts
export function tick(state: GameState): GameState {
  const newTick = state.tick + 1;
  const newDay = Math.floor(newTick / TICKS_PER_DAY);
  const dayTick = newTick % TICKS_PER_DAY;
  const isNight = dayTick < NIGHT_TICKS;
  const isDawn = dayTick === NIGHT_TICKS;
  const isNewDay = dayTick === 0 && newTick > 0;

  // Mutate state in place — cast to TickState to add computed fields
  const ts = state as TickState;
  ts.tick = newTick;
  ts.day = newDay;
  ts.newTick = newTick;
  ts.newDay = newDay;
  ts.dayTick = dayTick;
  ts.isNight = isNight;
  ts.isDawn = isDawn;
  ts.isNewDay = isNewDay;
  ts.toolDurBonus = (hasTech(state.research, 'improved_tools') ? 0.2 : 0)
                  + (hasTech(state.research, 'steel_forging') ? 0.5 : 0);
  ts.originalVillagerCount = state.villagers.length;
  ts.events = [];
  ts.buildingMap = buildBuildingMap(ts.buildings);
  ts.storageCap = computeStorageCap(ts.buildings);

  // Systems (same order as before)
  if (ts.isNewDay) processSeasonAndWeather(ts);
  if (ts.isNewDay) processDailyChecks(ts);
  processVillagerStateMachine(ts);
  processRaidAndCombat(ts);
  processDisease(ts);
  processFire(ts);
  processLightning(ts);
  processExpeditions(ts);
  processAnimals(ts);
  processMerchant(ts);
  processCaravans(ts);
  if (ts.isNewDay) processProsperity(ts);
  processEventsAndQuests(ts);

  // Validate once per day
  if (isNewDay || newTick === 1) {
    const errors = validateState(state);
    for (const err of errors) console.log(err);
  }

  return state;
}
```

Key differences from old code:
- No deep copy block (lines 39-112 deleted)
- No newState reconstruction (lines 155-202 deleted)
- `state` is cast to `TickState` and mutated directly
- Returns the same `state` object

**Step 2: Run all tests**

Run: `npx tsx src/tests/run-all.ts -q`
Expected: 1792 passed, 0 failed

If any tests fail, they likely rely on old state being preserved after tick(). Fix by having the test create a fresh state instead of reusing one.

**Step 3: Run stress test**

Run: `npx tsx src/tests/stress-report.ts -q`
Expected: Same results as before (23 pop, 5 deaths, 0 errors, 10 techs, prosperity 85) but faster.

**Step 4: Commit**

```
perf: mutate GameState in place instead of deep copying per tick
```

---

### Task 3: Fix any broken tests

**Files:**
- Modify: whatever test files fail in Task 2

If tests fail after Task 2, the cause will be one of:
1. Test saves a reference to state before tick() and expects it unchanged — fix by not doing that
2. Test relies on events array accumulating across ticks — fix by collecting events before they reset
3. Type errors from TickState change — fix by updating types

For each failing test:
- Run the specific file to see the failure
- Identify whether it's a state-preservation assumption
- Fix the test to work with mutation

**Step 1: Run failing test file(s) individually for details**

Run: `npx tsx src/tests/test-v2-<name>.ts`

**Step 2: Fix each test**

**Step 3: Run all tests**

Run: `npx tsx src/tests/run-all.ts -q`
Expected: 1792 passed, 0 failed

**Step 4: Commit**

```
test: fix tests for mutation-based tick
```

---

### Task 4: Clean up TickState usage in commands.ts

**Files:**
- Review: `src/simulation/commands.ts`

Commands like `placeBuilding`, `assignVillager`, etc. operate on `GameState` (not `TickState`) and return new `GameState` objects. These are called by the player/playerAI, not during tick(). They should keep their current copy-on-write behavior since they're called infrequently (once per command, not 400K times).

**Step 1: Verify commands still work**

Run: `npx tsx src/tests/run-all.ts -q`
Expected: 1792 passed, 0 failed

No changes expected here — just verification.

---

### Task 5: Measure performance improvement

**Step 1: Time the stress test**

Run: `time npx tsx src/tests/stress-report.ts -q`

Record the time. Compare to the ~19 minute baseline.

**Step 2: Update PROGRESS.md with results**

Note the performance improvement (or lack thereof) in PROGRESS.md.

**Step 3: Commit**

```
docs: update PROGRESS.md with mutation-based tick performance results
```
