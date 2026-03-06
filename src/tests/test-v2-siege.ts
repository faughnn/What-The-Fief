// test-v2-siege.ts — Siege equipment tests
// Battering rams deal extra damage to walls. Siege towers bypass walls.

import {
  createWorld, createVillager, GameState, Building, EnemyEntity,
  TICKS_PER_DAY, NIGHT_TICKS,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
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

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

function constructAll(state: GameState): GameState {
  return {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } } : tile
    )),
  };
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  v.food = 8;
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

// ================================================================
// TEST 1: Battering ram deals extra damage to walls
// ================================================================
heading('Battering Ram vs Wall');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  // Place wall blocking the path
  state = placeBuilding(state, 'wall', 5, 5);

  // Pre-construct wall
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
  };

  const wallHpBefore = state.buildings[0].hp;

  // Place a battering ram enemy adjacent to the wall
  const ram: EnemyEntity = {
    id: 'e1', type: 'bandit', x: 4, y: 5,
    hp: 25, maxHp: 25, attack: 5, defense: 3,
    range: 0, siege: 'battering_ram', ticksAlive: 0,
  };
  state = { ...state, enemies: [ram], nextEnemyId: 2 };

  // Run 1 tick — ram should attack wall with 5 damage
  state = advance(state, 1);

  const wall = state.buildings.find(b => b.type === 'wall');
  assert(wall !== undefined, 'Wall still standing');
  if (wall) {
    const dmg = wallHpBefore - wall.hp;
    assert(dmg === 5, `Battering ram dealt 5 damage (dmg=${dmg})`);
  }
}

// ================================================================
// TEST 2: Normal enemy deals less damage than battering ram
// ================================================================
heading('Normal Enemy vs Wall (Comparison)');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };
  state = placeBuilding(state, 'wall', 5, 5);
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
  };

  const wallHpBefore = state.buildings[0].hp;

  // Normal bandit (attack=3, no siege)
  const bandit: EnemyEntity = {
    id: 'e1', type: 'bandit', x: 4, y: 5,
    hp: 10, maxHp: 10, attack: 3, defense: 1,
    range: 0, siege: 'none', ticksAlive: 0,
  };
  state = { ...state, enemies: [bandit], nextEnemyId: 2 };

  state = advance(state, 1);

  const wall = state.buildings.find(b => b.type === 'wall');
  if (wall) {
    const dmg = wallHpBefore - wall.hp;
    assert(dmg < 5, `Normal enemy dealt less than ram (dmg=${dmg})`);
  }
}

// ================================================================
// TEST 3: Siege tower bypasses walls
// ================================================================
heading('Siege Tower Bypasses Wall');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  // Build a wall line blocking the path from left to center
  state = placeBuilding(state, 'wall', 8, 3);
  state = placeBuilding(state, 'wall', 8, 4);
  state = placeBuilding(state, 'wall', 8, 5);
  state = placeBuilding(state, 'wall', 8, 6);
  state = placeBuilding(state, 'wall', 8, 7);

  // Also place a house at center (settlement)
  state = placeBuilding(state, 'house', 10, 5);

  // Pre-construct all
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
  };

  // Place siege tower on the left side of the wall
  const tower: EnemyEntity = {
    id: 'e1', type: 'bandit', x: 5, y: 5,
    hp: 20, maxHp: 20, attack: 2, defense: 2,
    range: 0, siege: 'siege_tower', ticksAlive: 0,
  };
  state = { ...state, enemies: [tower], nextEnemyId: 2 };

  // Run several ticks — siege tower should move past the wall
  state = advance(state, 10);

  const e = state.enemies[0];
  assert(e !== undefined, 'Siege tower still alive');
  if (e) {
    // Should have moved past x=8 (the wall line)
    assert(e.x > 5, `Siege tower moved from start (x=${e.x})`);
    // Walls should NOT be damaged (siege tower bypasses, doesn't attack)
    const walls = state.buildings.filter(b => b.type === 'wall');
    const wallsDamaged = walls.some(w => w.hp < w.maxHp);
    assert(!wallsDamaged, 'Siege tower did not damage walls');
  }
}

// ================================================================
// TEST 4: Battering ram destroys gate
// ================================================================
heading('Battering Ram Destroys Gate');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };
  state = placeBuilding(state, 'gate', 5, 5);

  // Pre-construct with low HP
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      hp: 10, // Low HP so ram destroys it quickly
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: {
            ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired,
            hp: 10,
          }}
        : tile
    )),
  };

  // Ram adjacent to gate
  const ram: EnemyEntity = {
    id: 'e1', type: 'bandit', x: 4, y: 5,
    hp: 25, maxHp: 25, attack: 5, defense: 3,
    range: 0, siege: 'battering_ram', ticksAlive: 0,
  };
  state = { ...state, enemies: [ram], nextEnemyId: 2 };

  // 10 HP / 5 dmg per tick = 2 ticks to destroy
  state = advance(state, 3);

  const gate = state.buildings.find(b => b.type === 'gate');
  assert(gate === undefined, 'Gate destroyed by battering ram');

  // Should have rubble
  const rubble = state.buildings.find(b => b.type === 'rubble');
  assert(rubble !== undefined, 'Rubble left after gate destruction');
}

// ================================================================
// TEST 5: High-level raid spawns siege equipment
// ================================================================
heading('High-Level Raid Spawns Siege Equipment');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  // Need 6+ villagers and 8+ buildings for raids to trigger
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'tent', 4, 5);
  state = placeBuilding(state, 'tent', 6, 7);
  state = placeBuilding(state, 'tent', 7, 5);
  state = placeBuilding(state, 'tent', 8, 5);
  state = placeBuilding(state, 'tent', 9, 5);
  state = placeBuilding(state, 'farm', 3, 7);
  state = constructAll(state);
  for (let i = 0; i < 6; i++) state = addVillager(state, 5 + i, 5);

  // Set raid level high enough for siege equipment
  // Tick must be at day boundary for isNewDay=true
  state = {
    ...state,
    tick: TICKS_PER_DAY - 1,
    raidBar: 100,
    raidLevel: 2, // Will become 3 after triggering → battering ram
  };

  state = advance(state, 1); // Trigger new day and raid

  const siegeEnemies = state.enemies.filter(e => e.siege !== 'none');
  assert(siegeEnemies.length > 0, `Raid level 3 spawns siege equipment (found ${siegeEnemies.length})`);

  const rams = state.enemies.filter(e => e.siege === 'battering_ram');
  assert(rams.length > 0, `Battering ram spawned (count=${rams.length})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Siege Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
