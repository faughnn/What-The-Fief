// test-v2-formations.ts — Tests for guard formation system (charge/hold/front/back)
import {
  createWorld, createVillager, GameState, Building,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, CONSTRUCTION_TICKS,
  ENEMY_TEMPLATES, TICKS_PER_DAY, WEAPON_STATS,
} from '../world.js';
import { tick, setGuard, setFormation, placeBuilding } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

// Helper: create a simple world with a guard and enemy
function setupCombatScenario(): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  // Place storehouse with food
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 50 };
  state.resources.food = 50;

  // Place tent for guard's home
  state = placeBuilding(state, 'tent', 9, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  // Create guard at center
  const guard = createVillager(1, 10, 10);
  guard.food = 8; guard.homeBuildingId = tent.id;
  state.villagers = [guard];
  state.nextVillagerId = 2;
  state = setGuard(state, guard.id);

  return state;
}

// ========================
// TESTS
// ========================

console.log('\n=== Default Formation ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  assert(guard.guardMode === 'patrol', `Default mode is patrol (got ${guard.guardMode})`);
  assert(guard.guardLine === 'front', `Default line is front (got ${guard.guardLine})`);
}

console.log('\n=== Set Formation Command ===');
{
  let state = setupCombatScenario();
  state = setFormation(state, state.villagers[0].id, 'charge', 'front');
  assert(state.villagers[0].guardMode === 'charge', 'Mode set to charge');
  assert(state.villagers[0].guardLine === 'front', 'Line set to front');

  state = setFormation(state, state.villagers[0].id, 'hold', 'back');
  assert(state.villagers[0].guardMode === 'hold', 'Mode changed to hold');
  assert(state.villagers[0].guardLine === 'back', 'Line changed to back');
}

console.log('\n=== Set Formation Non-Guard Fails ===');
{
  let state = setupCombatScenario();
  // Add a non-guard villager
  const farmer = createVillager(2, 10, 11);
  farmer.food = 8;
  state.villagers.push(farmer);
  state = setFormation(state, farmer.id, 'charge', 'front');
  assert(farmer.guardMode === 'patrol', 'Non-guard mode unchanged');
}

console.log('\n=== Charge Mode: Engages At Long Range ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 5; guard.y = 10;
  state = setFormation(state, guard.id, 'charge', 'front');

  // Place enemy far away (beyond normal 10-tile detect range)
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 19, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  const startX = guard.x;
  // Run 3 ticks
  for (let i = 0; i < 3; i++) state = tick(state);

  const movedGuard = state.villagers.find(v => v.id === guard.id)!;
  assert(movedGuard.x > startX, `Charge guard moved toward distant enemy (${startX} → ${movedGuard.x})`);
}

console.log('\n=== Hold Mode: Does Not Move Toward Distant Enemy ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 5; guard.y = 10;
  state = setFormation(state, guard.id, 'hold', 'front');

  // Place enemy at distance 8 (beyond hold range of 3)
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 13, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  const startX = guard.x;
  for (let i = 0; i < 3; i++) state = tick(state);

  const movedGuard = state.villagers.find(v => v.id === guard.id)!;
  assert(movedGuard.x === startX, `Hold guard stayed put (x=${movedGuard.x}, expected ${startX})`);
}

console.log('\n=== Hold Mode: Fights Adjacent Enemy ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 10; guard.y = 9;
  state = setFormation(state, guard.id, 'hold', 'front');

  // Place enemy adjacent
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 10, y: 8,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  state = tick(state);

  const enemy = state.enemies.find(e => e.id === 'e1');
  assert(!enemy || enemy.hp < t.maxHp, 'Hold guard fights adjacent enemy');
}

console.log('\n=== Hold Mode: Engages Within 3 Tiles ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 10; guard.y = 10;
  state = setFormation(state, guard.id, 'hold', 'front');

  // Place enemy 3 tiles away (within hold range)
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 13, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  const startX = guard.x;
  // Hold mode still doesn't move (it only fights if adjacent or in detect range but waits)
  state = tick(state);
  const movedGuard = state.villagers.find(v => v.id === guard.id)!;
  // Within detect range (3) so guard detects, but hold mode doesn't advance
  assert(movedGuard.x === startX, `Hold guard detects at 3 tiles but stays (x=${movedGuard.x})`);
}

console.log('\n=== Back Line: Bow Guard Stays at Range ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 10; guard.y = 10;
  guard.weapon = 'bow'; guard.weaponDurability = 30;
  state = setFormation(state, guard.id, 'patrol', 'back');

  // Place enemy at range 3 (within bow range of 4)
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 13, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  state = tick(state);

  // Back-line bow guard should shoot and NOT move closer
  const enemy = state.enemies.find(e => e.id === 'e1');
  const updatedGuard = state.villagers.find(v => v.id === guard.id)!;
  assert(!enemy || enemy.hp < t.maxHp, 'Back-line bow guard shot at enemy');
  assert(updatedGuard.x === 10, `Back-line guard stayed at range (x=${updatedGuard.x})`);
}

console.log('\n=== Front Line: Sword Guard Closes to Melee ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 10; guard.y = 10;
  guard.weapon = 'sword'; guard.weaponDurability = 40;
  state = setFormation(state, guard.id, 'patrol', 'front');

  // Place enemy at range 5
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 15, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  const startX = guard.x;
  for (let i = 0; i < 3; i++) state = tick(state);

  const movedGuard = state.villagers.find(v => v.id === guard.id)!;
  assert(movedGuard.x > startX, `Front-line guard moved toward enemy (${startX} → ${movedGuard.x})`);
}

console.log('\n=== Back Line: Melee When Cornered ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 10; guard.y = 10;
  guard.weapon = 'bow'; guard.weaponDurability = 30;
  state = setFormation(state, guard.id, 'patrol', 'back');

  // Place enemy adjacent — back-line guard must fight even if they prefer range
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 11, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  state = tick(state);

  const enemy = state.enemies.find(e => e.id === 'e1');
  assert(!enemy || enemy.hp < t.maxHp, 'Back-line guard fights when cornered (adjacent enemy)');
}

console.log('\n=== Patrol Mode: Standard Behavior (10-Tile Range) ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 5; guard.y = 10;
  // Default: patrol mode

  // Place enemy at distance 9 (within 10-tile detect range)
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 14, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  const startX = guard.x;
  for (let i = 0; i < 3; i++) state = tick(state);

  const movedGuard = state.villagers.find(v => v.id === guard.id)!;
  assert(movedGuard.x > startX, `Patrol guard moved toward enemy within 10 tiles (${startX} → ${movedGuard.x})`);
}

console.log('\n=== Patrol Mode: Ignores Enemy Beyond 10 Tiles ===');
{
  let state = setupCombatScenario();
  const guard = state.villagers[0];
  guard.x = 2; guard.y = 10;

  // Place enemy at distance 15 (beyond 10-tile detect range)
  const t = ENEMY_TEMPLATES.bandit;
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 17, y: 10,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  });

  const startX = guard.x;
  for (let i = 0; i < 3; i++) state = tick(state);

  const movedGuard = state.villagers.find(v => v.id === guard.id)!;
  // Guard should NOT have moved toward enemy (too far for patrol mode)
  assert(movedGuard.x <= startX + 1, `Patrol guard ignores enemy beyond 10 tiles (x=${movedGuard.x})`);
}

// ========================
// SUMMARY
// ========================
console.log('\n========================================');
console.log(`V2 Formation Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
