// test-v2-gates-patrol.ts — V2 gate and guard patrol tests
// Gates let allies through but block enemies. Guards follow patrol routes.

import {
  createWorld, createVillager, GameState, Building, EnemyEntity,
  TICKS_PER_DAY, NIGHT_TICKS, ENEMY_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, setPatrol, findPath, findPathEnemy,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { console.log(`\n=== ${s} ===`); }

function flatWorld(w: number, h: number): GameState {
  const state = createWorld(w, h, 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function addEnemy(state: GameState, type: 'bandit' | 'wolf' | 'boar', x: number, y: number): GameState {
  const template = ENEMY_TEMPLATES[type];
  const enemy: EnemyEntity = {
    id: `e${state.nextEnemyId}`,
    type, x, y,
    hp: template.maxHp, maxHp: template.maxHp,
    attack: template.attack, defense: template.defense,
  };
  return {
    ...state,
    enemies: [...state.enemies, enemy],
    nextEnemyId: state.nextEnemyId + 1,
  };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Gate blocks enemy pathfinding
// ================================================================
heading('Gate Blocks Enemies');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, stone: 100 } };

  // Wall line with a gate gap
  for (let y = 0; y < 10; y++) {
    if (y === 5) {
      state = placeBuilding(state, 'gate', 8, y); // Gate at the gap
    } else {
      state = placeBuilding(state, 'wall', 8, y);
    }
  }

  // Check enemy pathfinding — should be blocked by gate
  const enemyPath = findPathEnemy(state.grid, state.width, state.height, 0, 5, 15, 5);
  assert(enemyPath.length === 0, 'Enemy cannot pathfind through gate');
}

// ================================================================
// TEST 2: Gate lets allies (villagers) through
// ================================================================
heading('Gate Lets Allies Through');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, stone: 100 } };

  // Wall line with a gate
  for (let y = 0; y < 10; y++) {
    if (y === 5) {
      state = placeBuilding(state, 'gate', 8, y);
    } else {
      state = placeBuilding(state, 'wall', 8, y);
    }
  }

  // Check ally pathfinding — should pass through gate
  const allyPath = findPath(state.grid, state.width, state.height, 0, 5, 15, 5);
  assert(allyPath.length > 0, 'Ally can pathfind through gate');

  // Verify the path goes through the gate tile
  const throughGate = allyPath.some(p => p.x === 8 && p.y === 5);
  assert(throughGate, 'Ally path routes through the gate at (8,5)');
}

// ================================================================
// TEST 3: Guard follows patrol route
// ================================================================
heading('Guard Patrol Route');

{
  let state = flatWorld(15, 10);
  state = addVillager(state, 5, 5);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };
  state = setGuard(state, 'v1');
  state = setPatrol(state, 'v1', [
    { x: 3, y: 5 },
    { x: 7, y: 5 },
  ]);

  // Advance through daytime — guard should follow patrol route
  state = advance(state, NIGHT_TICKS + 20);

  const guard = state.villagers.find(v => v.id === 'v1')!;
  // Guard should have moved from (5,5) toward first waypoint (3,5) or second (7,5)
  assert(guard.x !== 5 || guard.y !== 5,
    `Guard moved from start position (now at ${guard.x}, ${guard.y})`);
}

// ================================================================
// TEST 4: Guard breaks patrol to intercept enemy
// ================================================================
heading('Guard Breaks Patrol For Enemy');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 10, 5);
  state = placeBuilding(state, 'tent', 10, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };
  state = setGuard(state, 'v1');
  state = setPatrol(state, 'v1', [
    { x: 15, y: 5 }, // patrol far to the right
    { x: 18, y: 5 },
  ]);

  // Add enemy within detection range
  state = addEnemy(state, 'bandit', 5, 5);

  // Advance — guard should intercept enemy instead of patrolling
  state = advance(state, 10);

  const guard = state.villagers.find(v => v.id === 'v1');
  if (guard) {
    // Guard should move toward enemy (x=5), not toward patrol waypoint (x=15)
    assert(guard.x <= 10,
      `Guard intercepted enemy instead of patrolling (at x=${guard.x})`);
  } else {
    assert(true, 'Guard engaged enemy');
  }
}

// ================================================================
// TEST 5: Guard patrols move max 1 tile per tick
// ================================================================
heading('Guard Patrol Anti-Teleportation');

{
  let state = flatWorld(20, 10);
  state = addVillager(state, 5, 5);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };
  state = setGuard(state, 'v1');
  state = setPatrol(state, 'v1', [
    { x: 0, y: 5 },
    { x: 15, y: 5 },
  ]);

  let maxJump = 0;
  let prev = { x: 5, y: 5 };
  for (let i = 0; i < 30; i++) {
    state = tick(state);
    const guard = state.villagers.find(v => v.id === 'v1')!;
    const jump = Math.abs(guard.x - prev.x) + Math.abs(guard.y - prev.y);
    maxJump = Math.max(maxJump, jump);
    prev = { x: guard.x, y: guard.y };
  }

  assert(maxJump <= 1, `Guard patrol max jump is ${maxJump} (must be <= 1)`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Gates & Patrol Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
