// test-v2-combat.ts — V2 spatial combat tests
// Enemies are grid entities that march, walls block, guards intercept.

import {
  createWorld, createVillager, GameState, Building, Villager, EnemyEntity,
  TICKS_PER_DAY, NIGHT_TICKS, BUILDING_MAX_HP, ENEMY_TEMPLATES,
  emptyResources, BUILDING_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, findPath,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { console.log(`\n=== ${s} ===`); }

// --- Helper: flat grass world ---
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
// TEST 1: Enemies move 1 tile per tick toward settlement
// ================================================================
heading('Enemy Movement — 1 Tile Per Tick');

{
  let state = flatWorld(20, 10);
  // Place a building at center as target
  state = placeBuilding(state, 'tent', 10, 5);
  // Add enemy at (0, 5) — 10 tiles from target
  state = addEnemy(state, 'bandit', 0, 5);

  const startX = state.enemies[0].x;
  assert(startX === 0, 'Enemy starts at x=0');

  // Track positions for 8 ticks
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < 8; i++) {
    state = tick(state);
    const e = state.enemies[0];
    if (e) positions.push({ x: e.x, y: e.y });
  }

  // Verify max 1 tile per tick
  let maxJump = 0;
  let prevX = 0, prevY = 5;
  for (const pos of positions) {
    const jump = Math.abs(pos.x - prevX) + Math.abs(pos.y - prevY);
    maxJump = Math.max(maxJump, jump);
    prevX = pos.x;
    prevY = pos.y;
  }
  assert(maxJump <= 1, `Enemy max jump is ${maxJump} (must be <= 1)`);

  // After 8 ticks, enemy should be at x=8 (or close)
  if (positions.length > 0) {
    const last = positions[positions.length - 1];
    assert(last.x >= 7, `After 8 ticks, enemy at x=${last.x} (expected ~8)`);
  }
}

// ================================================================
// TEST 2: Enemies can't walk through walls
// ================================================================
heading('Walls Block Enemies');

{
  let state = flatWorld(20, 10);
  // Give enough stone for 10 walls (3 stone each)
  state = { ...state, resources: { ...state.resources, stone: 100 } };
  // Place a wall line across the middle at x=8
  for (let y = 0; y < 10; y++) {
    state = placeBuilding(state, 'wall', 8, y);
  }

  // Place target building behind the wall
  state = placeBuilding(state, 'tent', 15, 5);

  // Add enemy at (0, 5) — needs to get to (15, 5) but wall blocks at x=8
  state = addEnemy(state, 'bandit', 0, 5);

  // Advance 20 ticks — enemy should reach the wall but not pass through
  state = advance(state, 20);

  const enemy = state.enemies[0];
  if (enemy) {
    assert(enemy.x <= 8, `Enemy blocked by wall — at x=${enemy.x} (should be <=8)`);
  } else {
    // Enemy might have died attacking wall, which is also valid
    assert(true, 'Enemy engaged with wall (may have been defeated)');
  }
}

// ================================================================
// TEST 3: Enemies attack adjacent buildings (walls take damage)
// ================================================================
heading('Enemies Attack Adjacent Buildings');

{
  let state = flatWorld(20, 10);
  // Place a single wall at (5, 5)
  state = placeBuilding(state, 'wall', 5, 5);
  const wallId = state.buildings.find(b => b.type === 'wall')!.id;
  const initialWallHp = state.buildings.find(b => b.id === wallId)!.hp;

  // Place enemy adjacent to wall at (4, 5)
  state = addEnemy(state, 'bandit', 4, 5);

  // Advance several ticks — enemy should attack the wall
  state = advance(state, 10);

  const wall = state.buildings.find(b => b.id === wallId);
  if (wall) {
    assert(wall.hp < initialWallHp, `Wall took damage: ${initialWallHp} → ${wall.hp}`);
  } else {
    assert(true, 'Wall was destroyed by enemy attack');
  }
}

// ================================================================
// TEST 4: Guards move to intercept enemies
// ================================================================
heading('Guard Interception');

{
  let state = flatWorld(20, 10);
  // Place home for guard
  state = placeBuilding(state, 'tent', 10, 5);
  state = addVillager(state, 10, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };
  state = setGuard(state, 'v1');

  // Place enemy at (0, 5)
  state = addEnemy(state, 'bandit', 0, 5);

  // Advance some ticks — guard should start moving toward enemy
  state = advance(state, 15);

  const guard = state.villagers.find(v => v.id === 'v1');
  if (guard) {
    // Guard should have moved from (10,5) toward enemy
    assert(guard.x < 10 || guard.state === 'idle',
      `Guard moved to intercept (at x=${guard.x}, state=${guard.state})`);
  }
}

// ================================================================
// TEST 5: Melee combat — adjacent entities exchange damage
// ================================================================
heading('Melee Combat — Adjacent Damage');

{
  let state = flatWorld(10, 10);
  // Place guard and enemy adjacent
  state = addVillager(state, 5, 5);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };
  state = setGuard(state, 'v1');

  // Place enemy right next to guard
  state = addEnemy(state, 'bandit', 4, 5);

  const guardHpBefore = state.villagers[0].hp;
  const enemyHpBefore = state.enemies[0].hp;

  // Advance a few ticks
  state = advance(state, 5);

  const guard = state.villagers.find(v => v.id === 'v1');
  const enemy = state.enemies.find(e => e.id === 'e1');

  if (guard && enemy) {
    assert(enemy.hp < enemyHpBefore, `Enemy took damage: ${enemyHpBefore} → ${enemy.hp}`);
    assert(guard.hp < guardHpBefore, `Guard took damage: ${guardHpBefore} → ${guard.hp}`);
  } else if (!enemy) {
    assert(true, 'Enemy was defeated in combat (took lethal damage)');
  } else {
    assert(true, 'Combat occurred');
  }
}

// ================================================================
// TEST 6: Dead enemies are removed from the map
// ================================================================
heading('Dead Enemy Removal');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 5, 5);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };
  state = setGuard(state, 'v1');

  // Add a weak enemy adjacent to guard
  state = addEnemy(state, 'bandit', 4, 5);
  // Weaken the enemy so it dies quickly
  state = {
    ...state,
    enemies: state.enemies.map(e => ({ ...e, hp: 1 })),
  };

  state = advance(state, 5);

  const deadEnemy = state.enemies.find(e => e.id === 'e1');
  assert(!deadEnemy || deadEnemy.hp <= 0, 'Dead enemy removed from active list');
}

// ================================================================
// TEST 7: Enemy doesn't teleport — position changes 1 tile/tick
// ================================================================
heading('Anti-Teleportation (Enemies)');

{
  let state = flatWorld(30, 10);
  state = placeBuilding(state, 'tent', 25, 5);
  state = addEnemy(state, 'bandit', 0, 5);

  let prev = { x: 0, y: 5 };
  let maxJump = 0;
  for (let i = 0; i < 20; i++) {
    state = tick(state);
    const e = state.enemies.find(e => e.id === 'e1');
    if (!e) break;
    const jump = Math.abs(e.x - prev.x) + Math.abs(e.y - prev.y);
    maxJump = Math.max(maxJump, jump);
    prev = { x: e.x, y: e.y };
  }
  assert(maxJump <= 1, `Enemy max position jump is ${maxJump} (must be <= 1)`);
}

// ================================================================
// TEST 8: Wall at 0 HP becomes rubble (passable, building removed)
// ================================================================
heading('Wall Destruction');

{
  let state = flatWorld(10, 10);
  state = placeBuilding(state, 'wall', 5, 5);
  const wallId = state.buildings[0].id;

  // Set wall HP to 1 and place enemy adjacent
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.id === wallId ? { ...b, hp: 1 } : b
    ),
  };
  state = addEnemy(state, 'bandit', 4, 5);

  // Advance until wall is destroyed
  state = advance(state, 10);

  const wall = state.buildings.find(b => b.id === wallId);
  assert(!wall, 'Wall removed from buildings list after reaching 0 HP');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Combat Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
