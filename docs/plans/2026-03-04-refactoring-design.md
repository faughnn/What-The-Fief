# Extract Duplicated Patterns — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ~150 lines of duplicated code across 6 simulation files by extracting 5 shared helpers. Pure refactoring — zero behavior changes.

**Architecture:** Data-oriented systems. All game logic lives in `src/simulation/` as pure functions mutating `TickState`. Shared helpers live in `helpers.ts`. Tests run via `npx tsx src/tests/test-v2-*.ts` (each file exits 1 on failure).

**Tech Stack:** TypeScript, tsx, no frameworks

**Test command:** `export PATH="/c/Program Files/nodejs:$PATH" && for f in src/tests/test-v2-*.ts; do npx tsx "$f" || exit 1; done`

**Stress test:** `export PATH="/c/Program Files/nodejs:$PATH" && npx tsx src/tests/test-v2-stress.ts`

---

### Task 1: Extract `deductFromBuffer` helper

**Files:**
- Modify: `src/simulation/helpers.ts` (add function after `consumeBufferInputs` ~line 169)
- Modify: `src/simulation/helpers.ts` (update `autoEquipTool` and `autoEquipWeapon`)
- Modify: `src/simulation/villagers.ts` (4 call sites)
- Modify: `src/simulation/daily.ts` (1 call site)
- Modify: `src/simulation/buildings.ts` (1 call site)
- Modify: `src/simulation/commands.ts` (2 call sites)

**Step 1: Add the helper function to `helpers.ts`**

Add after `consumeBufferInputs` (~line 169):

```typescript
export function deductFromBuffer(buffer: Partial<Record<ResourceType, number>>, res: ResourceType, amount: number): void {
  buffer[res] = (buffer[res] || 0) - amount;
  if ((buffer[res] || 0) <= 0) delete buffer[res];
}
```

**Step 2: Replace all call sites in `helpers.ts`**

In `autoEquipTool` (lines 198-199), replace:
```typescript
b.localBuffer[res] = (b.localBuffer[res] || 0) - 1;
if ((b.localBuffer[res] || 0) <= 0) delete b.localBuffer[res];
```
with:
```typescript
deductFromBuffer(b.localBuffer, res, 1);
```

In `autoEquipWeapon` (lines 229-230), same replacement.

**Step 3: Replace call sites in `villagers.ts`**

Add `deductFromBuffer` to the import from `./helpers.js`.

Replace these 4 instances of the pattern:
- Line 71-72 (startHauling — deduct from job buffer)
- Line 612-613 (traveling_to_storage — pickup inputs from storehouse)
- Line 714-715 (relaxing — tavern food consumption)
- Line 744-745 (healing — herb consumption)

Each follows the pattern:
```typescript
// OLD
someBuffer[res as ResourceType] = (someBuffer[res as ResourceType] || 0) - amount;
if ((someBuffer[res as ResourceType] || 0) <= 0) delete someBuffer[res as ResourceType];
// NEW
deductFromBuffer(someBuffer, res as ResourceType, amount);
```

Special cases in villagers.ts:
- Line 71-72: `job.localBuffer[res as ResourceType] = amt - toCarry;` then delete check → `deductFromBuffer(job.localBuffer, res as ResourceType, toCarry);` BUT note this line sets to `amt - toCarry`, not `(current || 0) - toCarry`. Since `amt` IS the current value (from the `Object.entries` loop), this is equivalent.
- Line 282-283 (guard eating): `eatSH!.localBuffer[resource] = bufAmt - 1;` then delete → `deductFromBuffer(eatSH!.localBuffer, resource, 1);`
- Line 842-843 (villager eating): same pattern as guard eating
- Line 916-917 (supply_loading any): same pattern

**Step 4: Replace call sites in `daily.ts`**

Add `deductFromBuffer` to the import from `./helpers.js`.

Line 105-106:
```typescript
// OLD
b.localBuffer[mat] = (b.localBuffer[mat] || 0) - 1;
if ((b.localBuffer[mat] || 0) <= 0) delete b.localBuffer[mat];
// NEW
deductFromBuffer(b.localBuffer, mat, 1);
```

**Step 5: Replace call sites in `buildings.ts`**

Add `deductFromBuffer` to the import from `./helpers.js`.

Lines 96-98 in placeBuilding:
```typescript
// OLD
shForCost.localBuffer[key as ResourceType] = Math.max(0, bufAmt - cost);
if ((shForCost.localBuffer[key as ResourceType] || 0) <= 0) delete shForCost.localBuffer[key as ResourceType];
// NEW
deductFromBuffer(shForCost.localBuffer, key as ResourceType, cost);
```

**Step 6: Replace call sites in `commands.ts`**

Add `deductFromBuffer` to the import from `./helpers.js`.

Line 95-96 in sellResource:
```typescript
// OLD
newBuffer[resource] = (newBuffer[resource] || 0) - amount;
if ((newBuffer[resource] || 0) <= 0) delete newBuffer[resource];
// NEW
deductFromBuffer(newBuffer, resource, amount);
```

Lines 293-294 in upgradeBuilding:
```typescript
// OLD
shForCost.localBuffer[key as ResourceType] = Math.max(0, bufAmt - cost);
if ((shForCost.localBuffer[key as ResourceType] || 0) <= 0) delete shForCost.localBuffer[key as ResourceType];
// NEW
deductFromBuffer(shForCost.localBuffer, key as ResourceType, cost);
```

**Step 7: Run all tests**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && for f in src/tests/test-v2-*.ts; do npx tsx "$f" || exit 1; done
```

Expected: All tests pass with zero behavior change.

**Step 8: Commit**

```bash
git add src/simulation/helpers.ts src/simulation/villagers.ts src/simulation/daily.ts src/simulation/buildings.ts src/simulation/commands.ts
git commit -m "refactor: extract deductFromBuffer helper to eliminate buffer deduction duplication"
```

---

### Task 2: Extract `findNearestBuilding` generic helper

**Files:**
- Modify: `src/simulation/helpers.ts` (add generic function, refactor `findNearestStorehouse`)
- Modify: `src/simulation/villagers.ts` (update `startPickupInputs` and `startEating`)

**Step 1: Add the generic helper to `helpers.ts`**

Add before `findNearestStorehouse` (~line 298):

```typescript
export function findNearestBuilding(
  buildings: Building[], x: number, y: number,
  predicate: (b: Building) => boolean,
): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    if (!predicate(b)) continue;
    const entrance = getBuildingEntrance(b);
    const dist = Math.abs(entrance.x - x) + Math.abs(entrance.y - y);
    if (dist < bestDist) { bestDist = dist; best = b; }
  }
  return best;
}
```

**Step 2: Refactor `findNearestStorehouse` to use it**

```typescript
export function findNearestStorehouse(buildings: Building[], grid: Tile[][], width: number, height: number, x: number, y: number): Building | null {
  return findNearestBuilding(buildings, x, y, b => isStorehouse(b.type));
}
```

Note: `grid`, `width`, `height` params are unused in the current implementation — they're kept for API compatibility. They can be removed in a future cleanup.

**Step 3: Update `startPickupInputs` in `villagers.ts`**

Add `findNearestBuilding` to imports from `./helpers.js`.

Replace lines 94-106:
```typescript
// OLD
let bestSH: Building | null = null;
let bestDist = Infinity;
for (const b of buildings) {
  if (!isStorehouse(b.type) || !b.constructed) continue;
  let hasInput = false;
  for (const res of inputTypes) {
    if ((b.localBuffer[res as ResourceType] || 0) > 0) { hasInput = true; break; }
  }
  if (!hasInput) continue;
  const entrance = getBuildingEntrance(b);
  const dist = Math.abs(entrance.x - v.x) + Math.abs(entrance.y - v.y);
  if (dist < bestDist) { bestDist = dist; bestSH = b; }
}
// NEW
const bestSH = findNearestBuilding(buildings, v.x, v.y, b => {
  if (!isStorehouse(b.type) || !b.constructed) return false;
  return inputTypes.some(res => (b.localBuffer[res as ResourceType] || 0) > 0);
});
```

**Step 4: Update `startEating` in `villagers.ts`**

Replace lines 121-134:
```typescript
// OLD
let bestSH: Building | null = null;
let bestDist = Infinity;
for (const b of buildings) {
  if (!isStorehouse(b.type) || !b.constructed) continue;
  let hasFood = false;
  for (const { resource } of FOOD_PRIORITY) {
    if ((b.localBuffer[resource] || 0) > 0) { hasFood = true; break; }
  }
  if (!hasFood) continue;
  const entrance = getBuildingEntrance(b);
  const dist = Math.abs(entrance.x - v.x) + Math.abs(entrance.y - v.y);
  if (dist < bestDist) { bestDist = dist; bestSH = b; }
}
// NEW
const bestSH = findNearestBuilding(buildings, v.x, v.y, b => {
  if (!isStorehouse(b.type) || !b.constructed) return false;
  return FOOD_PRIORITY.some(({ resource }) => (b.localBuffer[resource] || 0) > 0);
});
```

**Step 5: Run all tests**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && for f in src/tests/test-v2-*.ts; do npx tsx "$f" || exit 1; done
```

**Step 6: Commit**

```bash
git add src/simulation/helpers.ts src/simulation/villagers.ts
git commit -m "refactor: extract findNearestBuilding generic helper"
```

---

### Task 3: Extract `findStorehouseWithResource` helper

**Files:**
- Modify: `src/simulation/helpers.ts` (add function, update `autoEquipTool`, `autoEquipWeapon`)
- Modify: `src/simulation/villagers.ts` (update `trySeekHealing`)
- Modify: `src/simulation/daily.ts` (update clothing equip)

**Step 1: Add the helper to `helpers.ts`**

```typescript
export function findStorehouseWithResource(buildings: Building[], res: ResourceType): Building | null {
  for (const b of buildings) {
    if (isStorehouse(b.type) && b.constructed && (b.localBuffer[res] || 0) > 0) return b;
  }
  return null;
}
```

**Step 2: Update `autoEquipTool` in `helpers.ts`**

Replace the inner storehouse search loop (lines 196-201):
```typescript
// OLD
if (buildings) {
  for (const b of buildings) {
    if (isStorehouse(b.type) && b.constructed && (b.localBuffer[res] || 0) > 0) {
      deductFromBuffer(b.localBuffer, res, 1);
      break;
    }
  }
}
// NEW
if (buildings) {
  const sh = findStorehouseWithResource(buildings, res);
  if (sh) deductFromBuffer(sh.localBuffer, res, 1);
}
```

**Step 3: Update `autoEquipWeapon` in `helpers.ts`**

Same pattern as Step 2 (lines 227-233).

**Step 4: Update `trySeekHealing` in `villagers.ts`**

Add `findStorehouseWithResource` to imports.

Replace lines 166-174:
```typescript
// OLD
for (const b of buildings) {
  if (!isStorehouse(b.type) || !b.constructed) continue;
  if ((b.localBuffer.herbs || 0) > 0 && resources.herbs > 0) {
    const entrance = getBuildingEntrance(b);
    planPath(v, grid, width, height, entrance.x, entrance.y);
    v.state = 'traveling_to_heal';
    return true;
  }
}
// NEW
const sh = findStorehouseWithResource(buildings, 'herbs');
if (sh && resources.herbs > 0) {
  const entrance = getBuildingEntrance(sh);
  planPath(v, grid, width, height, entrance.x, entrance.y);
  v.state = 'traveling_to_heal';
  return true;
}
```

**Step 5: Update clothing equip in `daily.ts`**

Add `findStorehouseWithResource` to imports.

Replace lines 100-114:
```typescript
// OLD
for (const b of ts.buildings) {
  if (!isStorehouse(b.type) || !b.constructed) continue;
  for (const mat of ['linen', 'leather'] as const) {
    if ((b.localBuffer[mat] || 0) > 0 && ts.resources[mat] > 0) {
      deductFromBuffer(b.localBuffer, mat, 1);
      ts.resources[mat] -= 1;
      v.clothed = true;
      v.clothingDurability = 10;
      break;
    }
  }
  if (v.clothed) break;
}
// NEW
for (const mat of ['linen', 'leather'] as const) {
  const sh = findStorehouseWithResource(ts.buildings, mat);
  if (sh && ts.resources[mat] > 0) {
    deductFromBuffer(sh.localBuffer, mat, 1);
    ts.resources[mat] -= 1;
    v.clothed = true;
    v.clothingDurability = 10;
    break;
  }
}
```

**Step 6: Run all tests**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && for f in src/tests/test-v2-*.ts; do npx tsx "$f" || exit 1; done
```

**Step 7: Commit**

```bash
git add src/simulation/helpers.ts src/simulation/villagers.ts src/simulation/daily.ts
git commit -m "refactor: extract findStorehouseWithResource helper"
```

---

### Task 4: Extract `destroyBuildingAndCreateRubble` helper

**Files:**
- Modify: `src/simulation/helpers.ts` (add function — needs `CONSTRUCTION_TICKS` import from world.ts)
- Modify: `src/simulation/combat.ts` (replace 3 destroy sites)
- Modify: `src/simulation/buildings.ts` (replace fire destroy site)

**Step 1: Add the helper to `helpers.ts`**

Add `CONSTRUCTION_TICKS` to the import from `../world.js`.

```typescript
export function destroyBuildingAndCreateRubble(
  building: Building,
  buildings: Building[],
  grid: Tile[][],
  villagers: { id: string; jobBuildingId: string | null; homeBuildingId: string | null; role: string; state: string }[],
  width: number, height: number,
  nextBuildingIdRef: { value: number },
): void {
  // Unassign workers/residents
  for (const v of villagers) {
    if (v.jobBuildingId === building.id) { v.jobBuildingId = null; v.role = 'idle'; v.state = 'idle'; }
    if (v.homeBuildingId === building.id) v.homeBuildingId = null;
  }
  // Remove original building from array
  const idx = buildings.findIndex(b => b.id === building.id);
  if (idx >= 0) buildings.splice(idx, 1);
  // Create rubble at each tile the building occupied
  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const gy = building.y + dy;
      const gx = building.x + dx;
      if (gy < height && gx < width) {
        const rubble: Building = {
          id: `b${nextBuildingIdRef.value++}`,
          type: 'rubble', x: gx, y: gy, width: 1, height: 1,
          assignedWorkers: [],
          hp: 1, maxHp: 1,
          constructed: false,
          constructionProgress: 0,
          constructionRequired: CONSTRUCTION_TICKS['rubble'] || 30,
          localBuffer: {}, bufferCapacity: 0,
          onFire: false,
        };
        buildings.push(rubble);
        grid[gy][gx] = { ...grid[gy][gx], building: rubble };
      }
    }
  }
}
```

**Step 2: Replace `destroyBuilding` in `combat.ts`**

Import `destroyBuildingAndCreateRubble` from `./helpers.js`. Remove the local `destroyBuilding` function entirely (lines 46-82).

Replace all calls to `destroyBuilding(...)` with `destroyBuildingAndCreateRubble(...)` — same arguments, same name change.

**Step 3: Replace 0-HP building cleanup in `combat.ts`**

Replace lines 584-615 (the loop that converts 0-hp buildings to rubble):

```typescript
// OLD: 30-line inline loop creating rubble
// NEW:
for (let i = ts.buildings.length - 1; i >= 0; i--) {
  const b = ts.buildings[i];
  if (b.hp <= 0 && b.type !== 'rubble') {
    destroyBuildingAndCreateRubble(b, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef);
    // Note: splice happened inside the helper, so index shifted — re-check this index
    i = Math.min(i, ts.buildings.length); // Adjust for splice
  }
}
```

Important: The `destroyBuildingAndCreateRubble` helper does `buildings.splice(idx, 1)` which shifts indices. The reverse loop handles this correctly since we're going backwards.

**Step 4: Replace fire destroy in `buildings.ts`**

Import `destroyBuildingAndCreateRubble` from `./helpers.js`.

Replace lines 220-256 (the fire rubble replacement loop):

```typescript
// OLD: 36-line inline loop
// NEW:
const nextBldIdRef = { value: ts.nextBuildingId };
for (const id of toRemove) {
  const building = ts.buildings.find(b => b.id === id);
  if (building) {
    destroyBuildingAndCreateRubble(building, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef);
  }
}
ts.nextBuildingId = nextBldIdRef.value;
```

Remove the `CONSTRUCTION_TICKS` import from `buildings.ts` if it's only used for this pattern (check first — it IS used in `placeBuilding` too, so keep it).

**Step 5: Run all tests**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && for f in src/tests/test-v2-*.ts; do npx tsx "$f" || exit 1; done
```

**Step 6: Commit**

```bash
git add src/simulation/helpers.ts src/simulation/combat.ts src/simulation/buildings.ts
git commit -m "refactor: extract destroyBuildingAndCreateRubble to eliminate building destruction duplication"
```

---

### Task 5: Parametrize BFS pathfinding

**Files:**
- Modify: `src/simulation/movement.ts`

**Step 1: Extract shared BFS core**

Add a private core function and rewrite both public functions as thin wrappers:

```typescript
// --- Core BFS Pathfinding ---
function findPathCore(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
  canPassTile: (tile: Tile, isDestination: boolean) => boolean,
): { x: number; y: number }[] {
  if (fromX === toX && fromY === toY) return [];
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [];
  queue.push({ x: fromX, y: fromY, path: [] });
  visited.add(`${fromX},${fromY}`);
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited.has(key)) continue;
      const tile = grid[ny][nx];
      if (tile.terrain === 'water') continue;
      const isDest = nx === toX && ny === toY;
      if (!isDest && !canPassTile(tile, false)) continue;
      const newPath = [...current.path, { x: nx, y: ny }];
      if (isDest) return newPath;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: newPath });
    }
  }
  return [];
}

// --- Ally pathfinding: buildings block except gate, rubble, fence ---
export function findPath(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
): { x: number; y: number }[] {
  return findPathCore(grid, width, height, fromX, fromY, toX, toY, (tile) => {
    if (!tile.building) return true;
    const t = tile.building.type;
    return t === 'gate' || t === 'rubble' || t === 'fence';
  });
}

// --- Enemy pathfinding: walls, fences, gates block ---
export function findPathEnemy(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
): { x: number; y: number }[] {
  return findPathCore(grid, width, height, fromX, fromY, toX, toY, (tile) => {
    if (!tile.building) return true;
    const t = tile.building.type;
    return t !== 'wall' && t !== 'fence' && t !== 'gate';
  });
}
```

Keep `moveOneStep`, `atDestination`, and `planPath` unchanged.

**Step 2: Run all tests**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && for f in src/tests/test-v2-*.ts; do npx tsx "$f" || exit 1; done
```

**Step 3: Commit**

```bash
git add src/simulation/movement.ts
git commit -m "refactor: parametrize BFS pathfinding to eliminate ally/enemy duplication"
```

---

### Task 6: Run stress test and final verification

**Step 1: Run stress test**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && npx tsx src/tests/test-v2-stress.ts
```

Expected: Passes with same results as before refactoring.

**Step 2: Final commit (if any fixups needed)**

If stress test reveals issues, fix them and commit. Otherwise, this task is a no-op verification step.
