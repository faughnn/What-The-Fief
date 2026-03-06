// test-v2-watchtower.ts — Watchtower ranged combat tests
// Guards in watchtowers shoot enemies within range (5 tiles).

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, WATCHTOWER_RANGE, WATCHTOWER_DAMAGE,
  EnemyEntity, ENEMY_TEMPLATES, ALL_TECHS,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard,
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
  state.research.completed = [...ALL_TECHS];
  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

function addEnemy(state: GameState, x: number, y: number): GameState {
  const t = ENEMY_TEMPLATES['bandit'];
  const enemy: EnemyEntity = {
    id: `e${state.nextEnemyId}`, type: 'bandit',
    x, y, hp: t.maxHp, maxHp: t.maxHp,
    attack: t.attack, defense: t.defense,
  };
  return { ...state, enemies: [...state.enemies, enemy], nextEnemyId: state.nextEnemyId + 1 };
}

// ================================================================
// TEST 1: Guard in watchtower attacks enemy at range
// ================================================================
heading('Guard in Watchtower Ranged Attack');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, food: 20 } };
  state = addVillager(state, 10, 5);

  // Place watchtower and pre-construct it
  state = placeBuilding(state, 'tent', 8, 5);
  state = placeBuilding(state, 'watchtower', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;

  // Pre-construct watchtower
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  // Make villager a guard assigned to watchtower
  state = setGuard(state, 'v1');
  state = assignVillager(state, 'v1', towerId);

  // Place enemy at range 4 from watchtower (within range 5)
  state = addEnemy(state, 14, 5);
  const enemyHpBefore = state.enemies[0].hp;

  // Run a few ticks (guard should shoot)
  state = advance(state, 5);

  const enemy = state.enemies.find(e => e.id === 'e1');
  const enemyHpAfter = enemy ? enemy.hp : 0;

  assert(enemyHpAfter < enemyHpBefore, `Guard shot enemy at range (hp: ${enemyHpBefore} → ${enemyHpAfter})`);
}

// ================================================================
// TEST 2: Guard NOT in watchtower cannot attack at range
// ================================================================
heading('Guard Without Tower Has No Range');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, food: 20 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })) };

  state = setGuard(state, 'v1');

  // Place enemy at range 4 (NOT adjacent)
  state = addEnemy(state, 14, 5);
  const enemyHpBefore = state.enemies[0].hp;

  // Run 1 tick — guard should move, not shoot
  state = advance(state, 1);

  const enemy = state.enemies.find(e => e.id === 'e1')!;
  // Guard should move toward enemy, not damage them at range
  // Enemy HP unchanged (guard moves 1 tile closer, still not adjacent)
  assert(enemy.hp === enemyHpBefore, `Guard without tower didn't shoot at range (hp: ${enemyHpBefore} → ${enemy.hp})`);
}

// ================================================================
// TEST 3: Watchtower doesn't shoot beyond range
// ================================================================
heading('Watchtower Range Limit');

{
  let state = flatWorld(30, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, food: 20 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 8, 5);
  state = placeBuilding(state, 'watchtower', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;

  // Pre-construct
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  state = setGuard(state, 'v1');
  state = assignVillager(state, 'v1', towerId);

  // Place enemy at range 8 (beyond watchtower range of 5)
  state = addEnemy(state, 18, 5);
  const enemyHpBefore = state.enemies[0].hp;

  // Run a tick
  state = advance(state, 1);

  const enemy = state.enemies.find(e => e.id === 'e1')!;
  assert(enemy.hp === enemyHpBefore, `Tower didn't shoot enemy beyond range 5 (dist=8, hp unchanged: ${enemy.hp})`);
}

// ================================================================
// TEST 4: Guard stays at watchtower (doesn't chase)
// ================================================================
heading('Guard Stays at Watchtower');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, food: 20 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 8, 5);
  state = placeBuilding(state, 'watchtower', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;

  // Pre-construct
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  state = setGuard(state, 'v1');
  state = assignVillager(state, 'v1', towerId);

  // Place guard at tower position
  state = { ...state, villagers: state.villagers.map(v => ({ ...v, x: 10, y: 5 })) };

  // Place enemy at range 3
  state = addEnemy(state, 13, 5);

  // Run several ticks
  state = advance(state, 5);

  const guard = state.villagers.find(v => v.id === 'v1')!;
  assert(guard.x === 10 && guard.y === 5, `Guard stayed at watchtower (pos=${guard.x},${guard.y})`);
}

// ================================================================
// TEST 5: Watchtower guard kills enemy at range
// ================================================================
heading('Watchtower Guard Kills Enemy');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, food: 20 } };
  state = addVillager(state, 10, 5);

  state = placeBuilding(state, 'tent', 8, 5);
  state = placeBuilding(state, 'watchtower', 10, 5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;

  // Pre-construct
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId })),
  };

  state = setGuard(state, 'v1');
  state = assignVillager(state, 'v1', towerId);
  state = { ...state, villagers: state.villagers.map(v => ({ ...v, x: 10, y: 5 })) };

  // Add weak enemy (3 HP) at range 3
  state = addEnemy(state, 13, 5);
  state = { ...state, enemies: state.enemies.map(e => ({ ...e, hp: 3, maxHp: 3 })) };

  // Run enough ticks to kill it (WATCHTOWER_DAMAGE=2, so 2 shots = 4 damage > 3 HP)
  state = advance(state, 5);

  assert(state.enemies.length === 0, `Enemy killed by watchtower (remaining enemies: ${state.enemies.length})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Watchtower Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
