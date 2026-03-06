// test-v2-rubble.ts — V2 rubble and clearing tests
// Destroyed buildings leave clearable rubble instead of vanishing.

import {
  createWorld, createVillager, GameState, Building, EnemyEntity,
  TICKS_PER_DAY, NIGHT_TICKS, ENEMY_TEMPLATES, BUILDING_TEMPLATES,
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
    range: 0, siege: 'none', ticksAlive: 0,
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
// TEST 1: Destroyed building leaves rubble
// ================================================================
heading('Destroyed Building Leaves Rubble');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, stone: 100 } };

  // Place a wall and manually destroy it
  state = placeBuilding(state, 'wall', 5, 5);
  const wallId = state.buildings[0].id;

  // Damage wall to 0 HP
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.id === wallId ? { ...b, hp: 0 } : b
    ),
  };

  // Advance one tick — should process destruction and leave rubble
  state = tick(state);

  // Check that rubble exists at wall position
  const rubble = state.buildings.find(b => b.type === 'rubble' && b.x === 5 && b.y === 5);
  assert(!!rubble, 'Rubble building exists at destroyed wall position (5,5)');

  // Check that the grid tile has rubble
  const tile = state.grid[5][5];
  assert(tile.building !== null && tile.building.type === 'rubble',
    'Grid tile at (5,5) has rubble building reference');
}

// ================================================================
// TEST 2: Rubble is passable (does not block movement)
// ================================================================
heading('Rubble Is Passable');

{
  let state = flatWorld(10, 5);
  state = { ...state, resources: { ...state.resources, stone: 100 } };

  // Place a wall, destroy it to leave rubble
  state = placeBuilding(state, 'wall', 5, 2);

  // Manually set to 0 HP and tick to create rubble
  state = {
    ...state,
    buildings: state.buildings.map(b => ({ ...b, hp: 0 })),
  };
  state = tick(state);

  // Verify rubble exists
  const rubble = state.buildings.find(b => b.type === 'rubble');
  assert(!!rubble, 'Rubble exists after wall destruction');

  // Check pathfinding — rubble should NOT block movement
  const path = findPath(state.grid, state.width, state.height, 0, 2, 9, 2);
  assert(path.length > 0, 'Path exists through rubble tile');

  // Verify path goes through the rubble tile
  const throughRubble = path.some(p => p.x === 5 && p.y === 2);
  assert(throughRubble, 'Path routes through rubble at (5,2)');
}

// ================================================================
// TEST 3: Worker clears rubble
// ================================================================
heading('Worker Clears Rubble');

{
  let state = flatWorld(15, 10);
  state = { ...state, resources: { ...state.resources, stone: 100 } };

  // Place a wall and destroy it
  state = placeBuilding(state, 'wall', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => b.type === 'wall' ? { ...b, hp: 0 } : b),
  };
  state = tick(state);

  // Verify rubble
  const rubbleEntry = state.buildings.find(b => b.type === 'rubble');
  if (!rubbleEntry) {
    assert(false, 'Rubble exists for clearing test (prerequisite)');
    // Skip rest of test
  } else {
  const rubbleId = rubbleEntry.id;

  // Add a worker and home
  state = addVillager(state, 5, 5);
  state = placeBuilding(state, 'tent', 4, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({
      ...v,
      homeBuildingId: state.buildings.find(b => b.type === 'tent')!.id,
    })),
  };

  // Assign worker to clear rubble
  state = assignVillager(state, 'v1', rubbleId);

  // Advance through several days — worker should clear rubble
  state = advance(state, NIGHT_TICKS + TICKS_PER_DAY * 2);

  // Rubble should be gone
  const remainingRubble = state.buildings.find(b => b.type === 'rubble');
  assert(!remainingRubble, 'Rubble cleared by worker');

  // Grid tile should be empty
  const tile = state.grid[5][5];
  assert(tile.building === null, 'Grid tile (5,5) is clear after rubble removal');
  } // end rubbleEntry guard
}

// ================================================================
// TEST 4: Enemy destroys wall — rubble left, enemy can pass through
// ================================================================
heading('Enemy Destroys Wall — Rubble Passable By Enemies');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, stone: 100 } };

  // Wall line blocking enemy at y=5
  for (let y = 0; y < 10; y++) {
    state = placeBuilding(state, 'wall', 10, y);
  }

  // Manually set one wall segment to 1 HP so it breaks quickly
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      (b.x === 10 && b.y === 5) ? { ...b, hp: 1, constructed: true } : { ...b, constructed: true }
    ),
  };

  // Place enemy adjacent to the weak wall
  state = addEnemy(state, 'bandit', 9, 5);

  // Advance — enemy should destroy the wall
  state = advance(state, 3);

  // Check rubble at the breach point
  const rubble = state.buildings.find(b => b.type === 'rubble' && b.x === 10 && b.y === 5);
  assert(!!rubble, 'Rubble at breach point (10,5) after wall destroyed by enemy');
}

// ================================================================
// TEST 5: Cannot build on rubble tile (must clear first)
// ================================================================
heading('Cannot Build On Rubble');

{
  let state = flatWorld(10, 10);
  state = { ...state, resources: { ...state.resources, stone: 100, wood: 100 } };

  // Create rubble
  state = placeBuilding(state, 'wall', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => b.type === 'wall' ? { ...b, hp: 0 } : b),
  };
  state = tick(state);

  // Verify rubble exists
  assert(!!state.buildings.find(b => b.type === 'rubble'), 'Rubble exists at (5,5)');

  // Try to build on rubble tile — should fail (building count stays same)
  const buildingsBefore = state.buildings.length;
  state = placeBuilding(state, 'farm', 5, 5);
  assert(state.buildings.length === buildingsBefore,
    'Cannot place building on rubble tile — must clear first');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Rubble Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
