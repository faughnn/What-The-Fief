// test-v2-spike-trap.ts — Tests for spike trap building

import {
  createWorld, GameState, createVillager,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, ALL_TECHS,
  BUILDING_TECH_REQUIREMENTS, ENEMY_TEMPLATES,
} from '../world.js';
import { placeBuilding } from '../simulation/index.js';
import { tick } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  const state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 200, stone: 200, food: 200, ingots: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;

  const s = placeBuilding(state, 'storehouse', 10, 10);
  const sh = s.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };

  const s2 = placeBuilding(s, 'tent', 8, 10);
  const tent = s2.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return s2;
}

// ================================================================
// TEST 1: Template exists
// ================================================================
heading('Spike Trap Template');
{
  assert(BUILDING_TEMPLATES.spike_trap !== undefined, 'spike_trap template exists');
  assert(BUILDING_TEMPLATES.spike_trap.maxWorkers === 0, 'no workers needed');
  assert(BUILDING_TEMPLATES.spike_trap.mapChar === '^', 'map char is ^');
  assert(BUILDING_MAX_HP.spike_trap === 10, `HP is 10 (${BUILDING_MAX_HP.spike_trap})`);
  assert(BUILDING_TECH_REQUIREMENTS.spike_trap === 'fortification', 'requires fortification');
  assert(BUILDING_TEMPLATES.spike_trap.cost.wood === 3, 'costs 3 wood');
  assert(BUILDING_TEMPLATES.spike_trap.cost.ingots === 1, 'costs 1 ingot');
}

// ================================================================
// TEST 2: Enemy stepping on spike trap takes damage
// ================================================================
heading('Spike Trap Damages Enemy');
{
  let state = makeWorld();
  // Place spike trap between enemy and settlement center (10,10)
  // Enemy at (8,4), trap at (8,5), enemy moves toward center onto trap
  state = placeBuilding(state, 'spike_trap', 8, 5);
  const trap = state.buildings.find(b => b.type === 'spike_trap')!;
  trap.constructed = true; trap.hp = trap.maxHp;

  // Place enemy adjacent to trap, facing toward settlement center
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 8, y: 4,
    hp: 50, maxHp: 50, attack: 3, defense: 1,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state.nextEnemyId = 2;

  state = tick(state);
  const enemy = state.enemies.find(e => e.id === 'e1');
  assert(enemy !== undefined && enemy.hp < 50, `enemy took damage from spike trap (hp=${enemy?.hp})`);
  assert(enemy !== undefined && enemy.hp === 45, `enemy took exactly 5 damage (hp=${enemy?.hp})`);
}

// ================================================================
// TEST 3: Spike trap loses durability when triggered
// ================================================================
heading('Spike Trap Durability');
{
  let state = makeWorld();
  state = placeBuilding(state, 'spike_trap', 8, 5);
  const trap = state.buildings.find(b => b.type === 'spike_trap')!;
  trap.constructed = true; trap.hp = trap.maxHp;

  // Place enemy adjacent, moving toward trap
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 8, y: 4,
    hp: 50, maxHp: 50, attack: 3, defense: 1,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state.nextEnemyId = 2;

  const trapHpBefore = trap.hp;
  state = tick(state);
  const trapAfter = state.buildings.find(b => b.type === 'spike_trap');

  assert(trapAfter !== undefined, 'trap still exists after 1 trigger');
  if (trapAfter) {
    assert(trapAfter.hp < trapHpBefore, `trap lost durability (${trapHpBefore} -> ${trapAfter.hp})`);
    assert(trapAfter.hp === trapHpBefore - 2, `trap lost exactly 2 HP (${trapAfter.hp})`);
  }
}

// ================================================================
// TEST 4: Spike trap is destroyed after enough triggers
// ================================================================
heading('Spike Trap Destruction');
{
  let state = makeWorld();
  state.research.completed = ['fortification'] as any; // Only fortification, no siege_engineering
  state = placeBuilding(state, 'spike_trap', 8, 5);
  const trap = state.buildings.find(b => b.type === 'spike_trap')!;
  trap.constructed = true; trap.hp = 4; // Set to 4 HP so 2 triggers destroys it

  // Place tough enemy that will walk onto the trap and stay on it
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 8, y: 4,
    hp: 500, maxHp: 500, attack: 3, defense: 1,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state.nextEnemyId = 2;

  // Tick 1: enemy walks onto trap, takes 5 dmg, trap loses 2 HP (4->2)
  state = tick(state);
  let trapCheck = state.buildings.find(b => b.type === 'spike_trap');
  assert(trapCheck !== undefined && trapCheck.hp === 2, `trap at 2 HP after first trigger (${trapCheck?.hp})`);

  // Enemy is now on the trap tile and will move off next tick (toward center)
  // We need to force it back. Instead, place a second enemy to trigger it again.
  state.enemies.push({
    id: 'e2', type: 'bandit', x: 8, y: 4,
    hp: 500, maxHp: 500, attack: 3, defense: 1,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state.nextEnemyId = 3;

  // Tick 2: second enemy walks onto trap, trap loses 2 HP (2->0), destroyed
  state = tick(state);
  trapCheck = state.buildings.find(b => b.type === 'spike_trap');
  assert(!trapCheck, 'spike trap destroyed after enough triggers');
}

// ================================================================
// TEST 5: Enemies can path through spike trap tiles
// ================================================================
heading('Spike Trap Passable by Enemies');
{
  let state = makeWorld();
  // Create a narrow corridor with spike trap in the middle
  // Block all paths except through the trap
  state = placeBuilding(state, 'spike_trap', 5, 5);
  const trap = state.buildings.find(b => b.type === 'spike_trap')!;
  trap.constructed = true; trap.hp = trap.maxHp;

  // Place enemy near the trap — it should be able to move onto the trap tile
  const bandit = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 5, y: 4,
    hp: 50, maxHp: 50, attack: bandit.attack, defense: bandit.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state.nextEnemyId = 2;

  // Settlement center is around (10,10), enemy at (5,4) should move toward center
  // The trap at (5,5) shouldn't block enemy movement
  state = tick(state);
  const enemy = state.enemies.find(e => e.id === 'e1');
  assert(enemy !== undefined, 'enemy still exists after tick');
  if (enemy) {
    // Enemy should have moved (y increased toward center at 10,10)
    assert(enemy.y >= 5, `enemy moved through/past spike trap tile (y=${enemy.y})`);
  }
}

// ================================================================
// TEST 6: Spike trap doesn't damage allies
// ================================================================
heading('Spike Trap Ignores Allies');
{
  let state = makeWorld();
  state = placeBuilding(state, 'spike_trap', 5, 5);
  const trap = state.buildings.find(b => b.type === 'spike_trap')!;
  trap.constructed = true; trap.hp = trap.maxHp;

  // Place villager on the spike trap tile
  const v = createVillager(1, 5, 5);
  v.role = 'guard'; v.state = 'idle'; v.traits = [];
  state.villagers.push(v);
  state.nextVillagerId = 2;

  const hpBefore = v.hp;
  state = tick(state);
  const vAfter = state.villagers.find(vi => vi.id === v.id)!;
  assert(vAfter.hp === hpBefore, `villager on spike trap takes no damage (${vAfter.hp})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Spike Trap Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
