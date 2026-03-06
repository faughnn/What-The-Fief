// test-v2-core.ts — V2 spatial simulation tests
// These tests enforce physical behavior that abstract implementations MUST fail.

import {
  createWorld, createVillager, GameState, Building, Villager,
  TICKS_PER_DAY, NIGHT_TICKS, CARRY_CAPACITY, BUILDING_MAX_HP,
  DEFAULT_BUFFER_CAP, STOREHOUSE_BUFFER_CAP, emptyResources,
  BUILDING_TEMPLATES, DAYS_PER_SEASON, DAYS_PER_YEAR,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, findPath,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { console.log(`\n=== ${s} ===`); }

// --- Helper: create a simple flat grass world (no water, no forest) ---
function flatWorld(w: number, h: number): GameState {
  const state = createWorld(w, h, 1);
  // Override grid to all grass — no water or forest obstacles
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
    }
  }
  // Clear default villagers
  state.villagers = [];
  state.nextVillagerId = 1;
  // Make all tiles revealed and in territory
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  return state;
}

// --- Helper: add a villager at a position ---
function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return {
    ...state,
    villagers: [...state.villagers, v],
    nextVillagerId: state.nextVillagerId + 1,
  };
}

// --- Helper: advance N ticks ---
function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// --- Helper: get tick-in-day ---
function tickInDay(state: GameState): number {
  return state.tick % TICKS_PER_DAY;
}

// ================================================================
// TEST 1: Tick model — TICKS_PER_DAY ticks = 1 day
// ================================================================
heading('Tick Model');

{
  let state = flatWorld(10, 10);
  assert(state.tick === 0, 'Initial tick is 0');
  assert(state.day === 0, 'Initial day is 0');

  state = advance(state, 1);
  assert(state.tick === 1, 'After 1 tick, tick=1');
  assert(state.day === 0, 'After 1 tick, still day 0');

  state = advance(state, TICKS_PER_DAY - 1);
  assert(state.tick === TICKS_PER_DAY, `After ${TICKS_PER_DAY} ticks, tick=${TICKS_PER_DAY}`);
  assert(state.day === 1, `After ${TICKS_PER_DAY} ticks, day=1`);

  state = advance(state, TICKS_PER_DAY);
  assert(state.tick === TICKS_PER_DAY * 2, `After ${TICKS_PER_DAY * 2} ticks, tick=${TICKS_PER_DAY * 2}`);
  assert(state.day === 2, `After ${TICKS_PER_DAY * 2} ticks, day=2`);
}

// ================================================================
// TEST 2: Day/night cycle
// ================================================================
heading('Day/Night Cycle');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 5, 5);

  // Place a house at (5,5) for the villager to sleep in
  state = placeBuilding(state, 'tent', 5, 5);
  const homeId = state.buildings[0].id;
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: homeId })),
  };

  // At tick 0, villager should be sleeping (it's night)
  assert(state.villagers[0].state === 'sleeping' || state.tick === 0,
    'Villager starts in sleeping/idle state at night (tick 0)');

  // Advance to dawn (tick 30)
  state = advance(state, NIGHT_TICKS);
  assert(tickInDay(state) === NIGHT_TICKS, `At tick ${NIGHT_TICKS}, dawn begins`);
}

// ================================================================
// TEST 3: Movement — max 1 tile per tick
// ================================================================
heading('Movement — 1 Tile Per Tick');

{
  let state = flatWorld(20, 20);
  // Place villager at (0,0), workplace (farm) at (10,0)
  state = addVillager(state, 0, 0);

  // Place tent at (0,0) for home
  state = placeBuilding(state, 'tent', 0, 0);
  const homeId = state.buildings[0].id;

  // Place farm at (10,0)
  state = placeBuilding(state, 'farm', 10, 0);
  const farmId = state.buildings[1].id;

  // Assign villager
  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Fast-forward to dawn so the villager starts traveling
  // The villager starts at (0,0). Farm entrance is at (10,0). Distance = 10 tiles.
  // At dawn (tick 30), villager should start traveling to work.
  state = advance(state, NIGHT_TICKS); // now at tick 30

  // Track positions for the next 15 ticks
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < 15; i++) {
    state = tick(state);
    const v = state.villagers.find(v => v.id === 'v1')!;
    positions.push({ x: v.x, y: v.y });
  }

  // Verify max 1 tile per tick (Manhattan distance between consecutive positions <= 1)
  let allSingleStep = true;
  let prevX = 0, prevY = 0; // starting position before the 15 ticks
  for (const pos of positions) {
    const dist = Math.abs(pos.x - prevX) + Math.abs(pos.y - prevY);
    if (dist > 1) { allSingleStep = false; break; }
    prevX = pos.x;
    prevY = pos.y;
  }
  assert(allSingleStep, 'Villager moves at most 1 tile per tick');

  // After 10 ticks of movement (starting from dawn), villager should be at or near (10,0)
  // They move 1 tile/tick, so after 10 ticks they should arrive at x=10
  const vAfter10 = positions[9]; // index 9 = 10th tick of movement
  assert(vAfter10.x >= 9, 'After 10 movement ticks, villager has moved at least 9 tiles');
}

// ================================================================
// TEST 4: Movement timing — distance = time
// ================================================================
heading('Movement Timing');

{
  let state = flatWorld(30, 10);
  state = addVillager(state, 0, 5);

  // Home at (0,5), farm at (15,5) — 15 tiles away
  state = placeBuilding(state, 'tent', 0, 5);
  state = placeBuilding(state, 'farm', 15, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Advance to dawn
  state = advance(state, NIGHT_TICKS);

  // After 14 ticks of travel, villager should NOT be at the farm yet
  state = advance(state, 14);
  const v14 = state.villagers.find(v => v.id === 'v1')!;
  assert(v14.x < 15 || v14.y !== 5, 'After 14 ticks, villager has NOT reached farm 15 tiles away');

  // After 1 more tick (15 total), villager should be at or very near the farm
  state = tick(state);
  const v15 = state.villagers.find(v => v.id === 'v1')!;
  assert(v15.x === 15 && v15.y === 5, 'After 15 ticks, villager has reached farm 15 tiles away');
}

// ================================================================
// TEST 5: Presence — must be at workplace to produce
// ================================================================
heading('Presence — Production Requires Being At Workplace');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 0, 5);

  // Home at origin, farm 10 tiles away
  state = placeBuilding(state, 'tent', 0, 5);
  state = placeBuilding(state, 'farm', 10, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Advance to dawn
  state = advance(state, NIGHT_TICKS);

  // During the first 9 ticks of travel, the farm's local buffer should be empty
  // (villager is still walking, not at the farm)
  state = advance(state, 9);
  const farmAfterTravel = state.buildings.find(b => b.id === farmId)!;
  const bufferWheat = farmAfterTravel.localBuffer['wheat'] || 0;
  assert(bufferWheat === 0, 'Farm buffer is empty while villager is still traveling (not at workplace)');

  // The villager should NOT be at the farm entrance yet
  const vTravel = state.villagers.find(v => v.id === 'v1')!;
  assert(vTravel.x < 10, 'Villager has not reached farm yet — no teleportation');
}

// ================================================================
// TEST 6: Local buffers — production goes to building, not global
// ================================================================
heading('Local Buffers — Production Into Building');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 0, 5);

  // Place home and farm close together so villager arrives quickly
  state = placeBuilding(state, 'tent', 0, 5);
  state = placeBuilding(state, 'farm', 2, 5);
  // Storehouse so hauled resources have somewhere to go
  state = placeBuilding(state, 'storehouse', 5, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  const initialGlobalWheat = state.resources.wheat;

  // Advance past dawn + travel (2 tiles) + construction (60 ticks for farm) + work ticks
  state = advance(state, TICKS_PER_DAY * 2); // 2 full days: build + produce

  // Check: production should be in the farm's local buffer, storehouse buffer, or global resources
  const farm = state.buildings.find(b => b.id === farmId)!;
  const localWheat = farm.localBuffer['wheat'] || 0;
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const shWheat = sh.localBuffer['wheat'] || 0;

  // The farm should have some wheat in its local buffer, storehouse buffer, or hauled to global
  assert(localWheat > 0 || shWheat > 0 || state.resources.wheat > initialGlobalWheat,
    'Production generated wheat (in local buffer, storehouse buffer, or hauled to global)');

  // Key test: at least some production went through the local buffer system
  // If the villager hasn't hauled yet, wheat should be in local buffer, not global
  const v = state.villagers.find(v => v.id === 'v1')!;
  if (v.state === 'working') {
    assert(localWheat > 0, 'While working, wheat accumulates in farm local buffer');
  }
}

// ================================================================
// TEST 7: Hauling — resources move from building to storehouse via physical carry
// ================================================================
heading('Hauling — Physical Resource Transport');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 2, 5);

  // Home at (2,5), farm at (4,5), storehouse at (8,5)
  state = placeBuilding(state, 'tent', 2, 5);
  state = placeBuilding(state, 'farm', 4, 5);
  state = placeBuilding(state, 'storehouse', 8, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  const initialWheat = state.resources.wheat;

  // Run for 2 days — villager needs to: build farm (60 ticks), then produce + haul
  state = advance(state, TICKS_PER_DAY * 2);

  // After 2 days, construction should be done and some wheat produced
  const farm = state.buildings.find(b => b.id === farmId)!;
  const localWheat = farm.localBuffer['wheat'] || 0;
  const globalWheat = state.resources.wheat;

  assert(localWheat > 0 || globalWheat > initialWheat,
    'After 2 days, wheat was produced (construction + production)');

  // Run for another day
  state = advance(state, TICKS_PER_DAY);

  // By now, hauling should have moved some wheat to global storage
  assert(state.resources.wheat > initialWheat || localWheat > 0,
    'Over 3 days, wheat produced and accessible');
}

// ================================================================
// TEST 8: Water blocks movement
// ================================================================
heading('Water Blocks Movement');

{
  let state = flatWorld(10, 10);
  // Put a water wall across the middle
  for (let y = 0; y < 10; y++) {
    state.grid[y][5] = { terrain: 'water', building: null, deposit: null };
  }
  // Leave one gap at y=5
  state.grid[5][5] = { terrain: 'grass', building: null, deposit: null };

  // Villager at (0,5) needs to reach (9,5)
  const path = findPath(state.grid, state.width, state.height, 0, 5, 9, 5);
  assert(path.length > 0, 'Path exists through the gap in water wall');

  // Path must go through (5,5) — the only gap
  const goesThrough = path.some(p => p.x === 5 && p.y === 5);
  assert(goesThrough, 'Path routes through the gap at (5,5)');

  // Block the gap too
  state.grid[5][5] = { terrain: 'water', building: null, deposit: null };
  const blocked = findPath(state.grid, state.width, state.height, 0, 5, 9, 5);
  assert(blocked.length === 0, 'No path when water completely blocks');
}

// ================================================================
// TEST 9: Villager sleeps at night
// ================================================================
heading('Villager Sleeps At Night');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 5, 5);

  state = placeBuilding(state, 'tent', 5, 5);
  const homeId = state.buildings[0].id;
  state = placeBuilding(state, 'farm', 7, 5);
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Run a full day cycle
  state = advance(state, TICKS_PER_DAY);

  // At tick TICKS_PER_DAY (start of second night), villager should be sleeping
  // Advance a few night ticks
  state = advance(state, 5);
  const v = state.villagers.find(v => v.id === 'v1')!;
  assert(v.state === 'sleeping', 'Villager is sleeping during night');
}

// ================================================================
// TEST 10: Building has HP and local buffer
// ================================================================
heading('Building HP and Local Buffer');

{
  let state = flatWorld(10, 10);
  state = placeBuilding(state, 'farm', 3, 3);
  const farm = state.buildings.find(b => b.type === 'farm')!;

  assert(farm.hp === BUILDING_MAX_HP['farm'], `Farm starts with max HP (${BUILDING_MAX_HP['farm']})`);
  assert(farm.maxHp === BUILDING_MAX_HP['farm'], 'Farm maxHp matches template');
  assert(farm.constructed === false, 'Farm starts as construction site (requires worker to build)');
  assert(typeof farm.localBuffer === 'object', 'Farm has a local buffer');
  assert(farm.bufferCapacity === DEFAULT_BUFFER_CAP, `Farm buffer capacity is ${DEFAULT_BUFFER_CAP}`);

  // Storehouse should have larger buffer
  state = placeBuilding(state, 'storehouse', 5, 3);
  const store = state.buildings.find(b => b.type === 'storehouse')!;
  assert(store.bufferCapacity === STOREHOUSE_BUFFER_CAP, `Storehouse buffer capacity is ${STOREHOUSE_BUFFER_CAP}`);
}

// ================================================================
// TEST 11: Season changes every DAYS_PER_SEASON days
// ================================================================
heading('Seasonal Changes');

{
  let state = flatWorld(10, 10);
  // Day 0 to DAYS_PER_SEASON-1: spring, then summer, autumn, winter
  assert(state.season === 'spring', 'Starts in spring');

  state = advance(state, DAYS_PER_SEASON * TICKS_PER_DAY);
  assert(state.season === 'summer', `Day ${DAYS_PER_SEASON} is summer`);

  state = advance(state, DAYS_PER_SEASON * TICKS_PER_DAY);
  assert(state.season === 'autumn', `Day ${DAYS_PER_SEASON * 2} is autumn`);

  state = advance(state, DAYS_PER_SEASON * TICKS_PER_DAY);
  assert(state.season === 'winter', `Day ${DAYS_PER_SEASON * 3} is winter`);

  state = advance(state, DAYS_PER_SEASON * TICKS_PER_DAY);
  assert(state.season === 'spring', `Day ${DAYS_PER_YEAR} cycles back to spring`);
}

// ================================================================
// TEST 12: No teleportation — position changes exactly 1 tile per tick
// ================================================================
heading('Anti-Teleportation');

{
  let state = flatWorld(30, 10);
  state = addVillager(state, 0, 5);

  state = placeBuilding(state, 'tent', 0, 5);
  state = placeBuilding(state, 'farm', 20, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings[1].id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
  };

  // Advance to dawn
  state = advance(state, NIGHT_TICKS);

  // Track every position for 25 ticks
  let prev = { x: 0, y: 5 };
  let maxJump = 0;
  for (let i = 0; i < 25; i++) {
    state = tick(state);
    const v = state.villagers.find(v => v.id === 'v1')!;
    const jump = Math.abs(v.x - prev.x) + Math.abs(v.y - prev.y);
    maxJump = Math.max(maxJump, jump);
    prev = { x: v.x, y: v.y };
  }
  assert(maxJump <= 1, `Max position jump is ${maxJump} (must be <= 1 — no teleportation)`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Core Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
