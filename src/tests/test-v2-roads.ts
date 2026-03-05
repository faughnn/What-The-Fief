// test-v2-roads.ts — Road system: placement, movement speed bonus, strategic layout

import {
  createWorld, GameState, TICKS_PER_DAY,
  BUILDING_TEMPLATES, Tile,
} from '../world.js';
import { tick, placeBuilding } from '../simulation/index.js';
import { moveOneStep, planPath, findPath, findPathEnemy } from '../simulation/movement.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

// Create a state with all fog/territory revealed and a clear grass strip for testing
function makeRoadWorld(): GameState {
  let state = createWorld(20, 20, 2);
  // Reveal all fog and territory
  state.fog = state.fog.map(row => row.map(() => true));
  state.territory = state.territory.map(row => row.map(() => true));
  // Clear row 3 and row 15 to be pure grass (no water, no buildings)
  for (let x = 0; x < 20; x++) {
    state.grid[3][x] = { terrain: 'grass', building: null, deposit: null };
    state.grid[15][x] = { terrain: 'grass', building: null, deposit: null };
  }
  return state;
}

// ========================
// ROAD PLACEMENT
// ========================

console.log('\n=== Roads: can place road on grass ===');
{
  let state = makeRoadWorld();
  state = placeBuilding(state, 'road', 5, 3);
  const roadBuilding = state.buildings.find(b => b.type === 'road');
  assert(roadBuilding !== undefined, 'Road building placed');
  if (roadBuilding) {
    assert(roadBuilding.constructed === true, 'Road is instantly constructed (no build time)');
  }
}

console.log('\n=== Roads: road does not block movement ===');
{
  let state = makeRoadWorld();
  state = placeBuilding(state, 'road', 5, 3);
  const path = findPath(state.grid, state.width, state.height, 4, 3, 6, 3);
  assert(path.length > 0, `Path through road exists (length ${path.length})`);
  const goesThrough = path.some(p => p.x === 5 && p.y === 3);
  assert(goesThrough, 'Path goes through road tile');
}

console.log('\n=== Roads: road costs stone to build ===');
{
  let state = makeRoadWorld();
  const stoneBefore = state.resources.stone;
  state = placeBuilding(state, 'road', 5, 3);
  assert(state.resources.stone < stoneBefore, `Stone consumed (${stoneBefore} → ${state.resources.stone})`);
}

console.log('\n=== Roads: road does not cost construction points ===');
{
  let state = makeRoadWorld();
  const cpBefore = state.constructionPoints;
  state = placeBuilding(state, 'road', 5, 3);
  assert(state.constructionPoints === cpBefore, `Construction points unchanged (${cpBefore})`);
}

// ========================
// MOVEMENT SPEED BONUS
// ========================

console.log('\n=== Roads: villager moves 2 tiles on road ===');
{
  let state = makeRoadWorld();
  // Place roads from x=3 to x=7 on row 3
  for (let x = 3; x <= 7; x++) {
    state = placeBuilding(state, 'road', x, 3);
  }
  const v = state.villagers[0];
  v.x = 2;
  v.y = 3;
  planPath(v, state.grid, state.width, state.height, 8, 3);
  assert(v.path.length > 0, `Path planned (${v.path.length} steps)`);

  // First step: from (2,3) — not on road. Steps to (3,3) which IS road → bonus step to (4,3)
  const moved1 = moveOneStep(v, state.grid);
  assert(moved1, 'First step taken');
  assert(v.x === 4 && v.y === 3, `After step 1 (road bonus): at (${v.x},${v.y}) expected (4,3)`);

  // Second step: from (4,3) which IS road — steps to (5,3) which IS road → bonus to (6,3)
  const moved2 = moveOneStep(v, state.grid);
  assert(moved2, 'Second step taken');
  assert(v.x === 6 && v.y === 3, `After step 2 on road: at (${v.x},${v.y}) expected (6,3)`);
}

console.log('\n=== Roads: villager moves 1 tile off road ===');
{
  let state = makeRoadWorld();
  const v = state.villagers[0];
  v.x = 2;
  v.y = 15;
  planPath(v, state.grid, state.width, state.height, 5, 15);
  assert(v.path.length > 0, `Path planned (${v.path.length} steps)`);

  const moved = moveOneStep(v, state.grid);
  assert(moved, 'Step taken');
  const dist = Math.abs(v.x - 2) + Math.abs(v.y - 15);
  assert(dist === 1, `Off-road: moved 1 tile (dist ${dist})`);
}

console.log('\n=== Roads: road speed proven by travel time ===');
{
  let state = makeRoadWorld();
  // Place road from x=3 to x=12 on row 3 — 10 tiles of road
  for (let x = 3; x <= 12; x++) {
    state = placeBuilding(state, 'road', x, 3);
  }

  // Villager A: walks on road from (2,3) to (13,3) — 11 tiles
  const vA = { ...state.villagers[0] };
  vA.x = 2; vA.y = 3;
  planPath(vA, state.grid, state.width, state.height, 13, 3);
  let stepsA = 0;
  while (vA.pathIndex < vA.path.length) {
    moveOneStep(vA, state.grid);
    stepsA++;
  }

  // Villager B: walks off-road from (2,15) to (13,15) — 11 tiles, no road
  const vB = { ...state.villagers[1] };
  vB.x = 2; vB.y = 15;
  planPath(vB, state.grid, state.width, state.height, 13, 15);
  let stepsB = 0;
  while (vB.pathIndex < vB.path.length) {
    moveOneStep(vB, state.grid);
    stepsB++;
  }

  assert(stepsB === 11, `Off-road: 11 tiles = 11 steps (got ${stepsB})`);
  assert(stepsA < stepsB, `Road travel faster: ${stepsA} steps vs ${stepsB} off-road`);
  assert(stepsA <= 8, `On road: significantly fewer steps (${stepsA} <= 8)`);
}

console.log('\n=== Roads: enemy pathfinding works through roads ===');
{
  let state = makeRoadWorld();
  for (let x = 3; x <= 12; x++) {
    state = placeBuilding(state, 'road', x, 3);
  }
  const path = findPathEnemy(state.grid, state.width, state.height, 2, 3, 13, 3);
  assert(path.length > 0, `Enemy can pathfind through roads (${path.length} steps)`);
}

// ========================
// INTEGRATION
// ========================

console.log('\n=== Roads: road tile has road building ===');
{
  let state = makeRoadWorld();
  state = placeBuilding(state, 'road', 5, 3);
  const tile = state.grid[3][5];
  assert(tile.building !== null, 'Road tile has building');
  if (tile.building) {
    assert(tile.building.type === 'road', 'Building type is road');
  }
}

console.log('\n=== Roads: multiple roads form a network ===');
{
  let state = makeRoadWorld();
  for (let x = 3; x <= 7; x++) state = placeBuilding(state, 'road', x, 3);
  // Also place vertical section (clear those tiles first)
  for (let y = 3; y <= 7; y++) state.grid[y][7] = { terrain: 'grass', building: null, deposit: null };
  for (let y = 4; y <= 7; y++) state = placeBuilding(state, 'road', 7, y);

  const roads = state.buildings.filter(b => b.type === 'road');
  assert(roads.length >= 9, `Road network: ${roads.length} road tiles placed`);
}

// ========================
// SUMMARY
// ========================

console.log(`\n========================================`);
console.log(`V2 Road Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
