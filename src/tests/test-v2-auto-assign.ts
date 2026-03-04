// test-v2-auto-assign.ts — Tests for idle villager auto-assignment to understaffed buildings
import {
  createWorld, createVillager, GameState, Building,
  BUILDING_TEMPLATES, TICKS_PER_DAY,
} from '../world.js';
import { tick, placeBuilding, assignVillager, setGuard } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function setupColony(villagersCount: number): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };
  state.resources.food = 200;

  for (let i = 0; i < villagersCount; i++) {
    state = placeBuilding(state, 'tent', 5 + i, 5);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 5 + i)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  const tents = state.buildings.filter(b => b.type === 'tent');
  const villagers = [];
  for (let i = 0; i < villagersCount; i++) {
    const v = createVillager(i + 1, 10, 10);
    v.food = 8;
    v.morale = 80;
    v.homeBuildingId = tents[i].id;
    villagers.push(v);
  }
  state.villagers = villagers;
  state.nextVillagerId = villagersCount + 1;

  return state;
}

// Helper: find building by type after tick (fresh reference)
function findBuilding(state: GameState, type: string): Building | undefined {
  return state.buildings.find(b => b.type === type);
}

// ========================
// TESTS
// ========================

console.log('\n=== Auto-Assign: Idle Villager Fills Empty Farm ===');
{
  let state = setupColony(3);
  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;

  assert(state.villagers.every(v => v.role === 'idle'), 'All villagers start idle');

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.assignedWorkers.length >= 1, `Farm got a worker (${farm.assignedWorkers.length})`);
  assert(state.villagers.some(v => v.role === 'farmer'), 'A villager became a farmer');
}

console.log('\n=== Auto-Assign: Multiple Buildings Get Workers ===');
{
  let state = setupColony(5);
  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'woodcutter', 12, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state.buildings.find(b => b.id === wcId)!.constructed = true;
  state.buildings.find(b => b.id === wcId)!.hp = state.buildings.find(b => b.id === wcId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const wc = state.buildings.find(b => b.id === wcId)!;
  assert(farm.assignedWorkers.length >= 1, `Farm has a worker (${farm.assignedWorkers.length})`);
  assert(wc.assignedWorkers.length >= 1, `Woodcutter has a worker (${wc.assignedWorkers.length})`);
}

console.log('\n=== Auto-Assign: Priority Order — Farm Before Woodcutter ===');
{
  let state = setupColony(1);
  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'woodcutter', 12, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state.buildings.find(b => b.id === wcId)!.constructed = true;
  state.buildings.find(b => b.id === wcId)!.hp = state.buildings.find(b => b.id === wcId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const wc = state.buildings.find(b => b.id === wcId)!;
  assert(farm.assignedWorkers.length === 1, `Farm got the worker (${farm.assignedWorkers.length})`);
  assert(wc.assignedWorkers.length === 0, `Woodcutter stays empty (${wc.assignedWorkers.length})`);
}

console.log('\n=== Auto-Assign: Does Not Reassign Non-Idle Villagers ===');
{
  // With 3 villagers: v1 manually assigned to farm, auto-assign fills farm to capacity (2),
  // then v3 goes to woodcutter
  let state = setupColony(3);
  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'woodcutter', 12, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state.buildings.find(b => b.id === wcId)!.constructed = true;
  state.buildings.find(b => b.id === wcId)!.hp = state.buildings.find(b => b.id === wcId)!.maxHp;

  state = assignVillager(state, 'v1', farmId);

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const v1 = state.villagers.find(v => v.id === 'v1')!;
  const farm = state.buildings.find(b => b.id === farmId)!;
  const wc = state.buildings.find(b => b.id === wcId)!;
  assert(v1.role === 'farmer', `v1 stays farmer (role: ${v1.role})`);
  assert(farm.assignedWorkers.length === 2, `Farm filled to capacity (${farm.assignedWorkers.length})`);
  assert(wc.assignedWorkers.length >= 1, `Woodcutter filled by remaining idle (${wc.assignedWorkers.length})`);
}

console.log('\n=== Auto-Assign: Respects Max Workers ===');
{
  let state = setupColony(3);
  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const maxW = BUILDING_TEMPLATES['farm'].maxWorkers;
  assert(farm.assignedWorkers.length <= maxW, `Farm not overstaffed (${farm.assignedWorkers.length} <= ${maxW})`);
  assert(state.villagers.some(v => v.role === 'idle'), 'At least 1 villager remains idle');
}

console.log('\n=== Auto-Assign: Unconstructed Buildings Not Auto-Assigned ===');
{
  let state = setupColony(2);
  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  // Don't set constructed — auto-assign should skip it

  // Jump to day start to trigger auto-assign without simulating full day
  // (idle villagers would construct it over time via tryIdleTask)
  state.tick = TICKS_PER_DAY - 1;
  state = tick(state); // triggers isNewDay

  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.assignedWorkers.length === 0, `Unconstructed farm not auto-assigned (${farm.assignedWorkers.length})`);
}

console.log('\n=== Auto-Assign: Guards Are Not Reassigned ===');
{
  let state = setupColony(2);
  state = setGuard(state, 'v1');

  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const v1 = state.villagers.find(v => v.id === 'v1')!;
  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(v1.role === 'guard', `Guard stays guard (role: ${v1.role})`);
  assert(farm.assignedWorkers.length >= 1, `Farm filled by idle v2 (${farm.assignedWorkers.length})`);
}

console.log('\n=== Auto-Assign: Refills After Worker Death ===');
{
  let state = setupColony(3);
  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state = assignVillager(state, 'v1', farmId);

  // Kill v1
  state.villagers.find(v => v.id === 'v1')!.hp = 0;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  assert(!state.villagers.some(v => v.id === 'v1'), 'v1 removed (dead)');
  const farm = state.buildings.find(b => b.id === farmId)!;
  const liveWorkers = farm.assignedWorkers.filter(id => state.villagers.some(v => v.id === id));
  assert(liveWorkers.length >= 1, `Farm refilled after death (${liveWorkers.length} workers)`);
}

console.log('\n=== Auto-Assign: Reserves Idle Worker For Construction ===');
{
  let state = setupColony(2);
  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;

  // Also place an unconstructed woodcutter (construction site)
  state = placeBuilding(state, 'woodcutter', 12, 8);
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;
  // Don't set constructed — this is a construction site

  // Skip to day start to trigger auto-assign
  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const idleAfter = state.villagers.filter(v => v.role === 'idle').length;
  assert(farm.assignedWorkers.length === 1, `Farm got 1 worker (${farm.assignedWorkers.length})`);
  assert(idleAfter >= 1, `At least 1 idle reserved for construction (${idleAfter})`);
}

console.log('\n=== Auto-Assign: Breadth-First — 1 Worker Per Building Before Filling ===');
{
  // With 3 villagers, 1 farm (max 2 workers) + 1 woodcutter (max 1):
  // Pass 1: farm gets 1, woodcutter gets 1
  // Pass 2: farm gets 2nd worker
  let state = setupColony(3);
  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'woodcutter', 12, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state.buildings.find(b => b.id === wcId)!.constructed = true;
  state.buildings.find(b => b.id === wcId)!.hp = state.buildings.find(b => b.id === wcId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const wc = state.buildings.find(b => b.id === wcId)!;
  assert(farm.assignedWorkers.length === 2, `Farm filled to max (${farm.assignedWorkers.length})`);
  assert(wc.assignedWorkers.length === 1, `Woodcutter got 1 worker via breadth-first (${wc.assignedWorkers.length})`);
}

console.log('\n=== Auto-Assign: Breadth-First — Tanner Gets Worker Before 2nd Farm Slot ===');
{
  // 3 villagers, 1 farm (max 2) + 1 tanner (max 1):
  // Pass 1: farm(1), tanner(1). Pass 2: farm(2). All 3 assigned.
  let state = setupColony(3);
  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'tanner', 12, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  const tannerId = state.buildings.find(b => b.type === 'tanner')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state.buildings.find(b => b.id === tannerId)!.constructed = true;
  state.buildings.find(b => b.id === tannerId)!.hp = state.buildings.find(b => b.id === tannerId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  const tanner = state.buildings.find(b => b.id === tannerId)!;
  assert(farm.assignedWorkers.length === 2, `Farm filled to max (${farm.assignedWorkers.length})`);
  assert(tanner.assignedWorkers.length === 1, `Tanner got worker via breadth-first (${tanner.assignedWorkers.length})`);
}

// ========================
// SUMMARY
// ========================
console.log('\n========================================');
console.log(`V2 Auto-Assignment Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
