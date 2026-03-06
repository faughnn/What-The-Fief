// test-v2-loot.ts — Tests for enemy loot drops
// Bellwright enemies drop equipment/resources when killed.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, ALL_TECHS, ENEMY_LOOT,
} from '../world.js';
import {
  tick, placeBuilding,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function setupColony(): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];

  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100 };
  state.resources = { ...state.resources, food: 100 };

  return state;
}

// ================================================================
// TEST 1: ENEMY_LOOT table exists
// ================================================================
heading('Enemy Loot Table');

{
  assert(ENEMY_LOOT !== undefined, 'ENEMY_LOOT table exists');
  assert(ENEMY_LOOT.bandit !== undefined, 'bandit has loot entry');
  assert(ENEMY_LOOT.bandit_archer !== undefined, 'bandit_archer has loot entry');
  assert(ENEMY_LOOT.bandit_brute !== undefined, 'bandit_brute has loot entry');
  assert(ENEMY_LOOT.wolf !== undefined, 'wolf has loot entry');
  assert(ENEMY_LOOT.boar !== undefined, 'boar has loot entry');

  // Each loot entry has at least one drop
  for (const [type, drops] of Object.entries(ENEMY_LOOT)) {
    assert(drops.length > 0, `${type} has at least 1 loot drop`);
    for (const drop of drops) {
      assert(drop.resource !== undefined, `${type} drop has resource`);
      assert(drop.amount > 0, `${type} drop has positive amount`);
    }
  }
}

// ================================================================
// TEST 2: Killing an enemy drops loot into storehouse
// ================================================================
heading('Loot Drops On Kill');

{
  let state = setupColony();

  // Add a guard near storehouse
  const v = createVillager(1, 10, 9);
  v.food = 8; v.morale = 80; v.role = 'guard'; v.hp = 30; v.maxHp = 30;
  v.homeBuildingId = null;
  state.villagers = [v];
  state.nextVillagerId = 2;

  // Spawn a weak bandit adjacent to the guard
  state.enemies = [{
    id: 'e1', type: 'bandit', x: 10, y: 8, hp: 1, maxHp: 10,
    attack: 1, defense: 0, range: 0,
  }];

  const goldBefore = state.resources.gold || 0;

  // Tick once — guard should kill the bandit
  state = tick(state);

  // Enemy should be dead and removed
  assert(state.enemies.length === 0, 'enemy removed after death');

  // Gold should have increased (bandit always drops gold)
  assert(state.resources.gold > goldBefore, `bandit dropped gold (${goldBefore} → ${state.resources.gold})`);
}

// ================================================================
// TEST 3: Wolf drops leather
// ================================================================
heading('Wolf Loot');

{
  let state = setupColony();

  const v = createVillager(1, 10, 9);
  v.food = 8; v.morale = 80; v.role = 'guard'; v.hp = 30; v.maxHp = 30;
  state.villagers = [v];
  state.nextVillagerId = 2;

  state.enemies = [{
    id: 'e1', type: 'wolf', x: 10, y: 8, hp: 1, maxHp: 6,
    attack: 1, defense: 0, range: 0,
  }];

  const leatherBefore = state.resources.leather || 0;
  state = tick(state);

  assert(state.resources.leather > leatherBefore, `wolf dropped leather (${leatherBefore} → ${state.resources.leather})`);
}

// ================================================================
// TEST 4: Boar drops food
// ================================================================
heading('Boar Loot');

{
  let state = setupColony();

  const v = createVillager(1, 10, 9);
  v.food = 8; v.morale = 80; v.role = 'guard'; v.hp = 30; v.maxHp = 30;
  state.villagers = [v];
  state.nextVillagerId = 2;

  state.enemies = [{
    id: 'e1', type: 'boar', x: 10, y: 8, hp: 1, maxHp: 15,
    attack: 1, defense: 0, range: 0,
  }];

  const foodBefore = state.resources.food || 0;
  state = tick(state);

  assert(state.resources.food > foodBefore, `boar dropped food (${foodBefore} → ${state.resources.food})`);
}

// ================================================================
// TEST 5: Brute drops more gold
// ================================================================
heading('Brute Loot');

{
  let state = setupColony();

  const v = createVillager(1, 10, 9);
  v.food = 8; v.morale = 80; v.role = 'guard'; v.hp = 30; v.maxHp = 30;
  state.villagers = [v];
  state.nextVillagerId = 2;

  state.enemies = [{
    id: 'e1', type: 'bandit_brute', x: 10, y: 8, hp: 1, maxHp: 18,
    attack: 1, defense: 0, range: 0,
  }];

  const goldBefore = state.resources.gold || 0;
  state = tick(state);

  const goldGained = (state.resources.gold || 0) - goldBefore;
  assert(goldGained >= 2, `brute dropped at least 2 gold (got ${goldGained})`);
}

// ================================================================
// TEST 6: Loot deposited to storehouse buffer
// ================================================================
heading('Loot Goes To Storehouse');

{
  let state = setupColony();

  const v = createVillager(1, 10, 9);
  v.food = 8; v.morale = 80; v.role = 'guard'; v.hp = 30; v.maxHp = 30;
  state.villagers = [v];
  state.nextVillagerId = 2;

  state.enemies = [{
    id: 'e1', type: 'bandit', x: 10, y: 8, hp: 1, maxHp: 10,
    attack: 1, defense: 0, range: 0,
  }];

  state = tick(state);

  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const goldInSh = sh.localBuffer.gold || 0;
  assert(goldInSh > 0, `loot deposited in storehouse buffer (gold=${goldInSh})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Loot Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
