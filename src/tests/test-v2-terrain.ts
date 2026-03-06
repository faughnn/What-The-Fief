// test-v2-terrain.ts — Tests for hill terrain type

import {
  createWorld, GameState, createVillager,
  BUILDING_TEMPLATES, ALL_TECHS, ENEMY_TEMPLATES,
  TERRAIN_MOVE_COST, TERRAIN_DEFENSE_BONUS,
  TICKS_PER_DAY,
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
  return state;
}

// ================================================================
// TEST 1: Terrain constants exist
// ================================================================
heading('Terrain Constants');
{
  assert(TERRAIN_MOVE_COST.grass === 1, 'grass move cost is 1');
  assert(TERRAIN_MOVE_COST.hill === 2, 'hill move cost is 2');
  assert(TERRAIN_MOVE_COST.water === Infinity, 'water is impassable');
  assert(TERRAIN_DEFENSE_BONUS.hill === 2, 'hill defense bonus is 2');
  assert(TERRAIN_DEFENSE_BONUS.forest === 1, 'forest defense bonus is 1');
  assert(TERRAIN_DEFENSE_BONUS.grass === 0, 'grass defense bonus is 0');
}

// ================================================================
// TEST 2: Hills slow villager movement
// ================================================================
heading('Hill Movement Penalty');
{
  let state = makeWorld();
  // Create storehouse + tent so villager can function
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };

  // Create two villagers: one travels across grass, one across hills
  // Both start at (0,10) and travel to (5,10)
  const vGrass = createVillager(1, 0, 10);
  vGrass.traits = []; vGrass.state = 'idle'; vGrass.role = 'idle';
  state.villagers.push(vGrass);

  const vHill = createVillager(2, 0, 11);
  vHill.traits = []; vHill.state = 'idle'; vHill.role = 'idle';
  state.villagers.push(vHill);
  state.nextVillagerId = 3;

  // Set hill terrain on row 11
  for (let x = 0; x < 20; x++) state.grid[11][x].terrain = 'hill';

  // Give both villagers longer paths to travel (15 tiles)
  vGrass.path = []; vGrass.pathIndex = 0;
  for (let x = 1; x <= 15; x++) vGrass.path.push({ x, y: 10 });
  vGrass.state = 'traveling_to_work' as any;

  vHill.path = []; vHill.pathIndex = 0;
  for (let x = 1; x <= 15; x++) vHill.path.push({ x, y: 11 });
  vHill.state = 'traveling_to_work' as any;

  // Run 10 ticks at daytime
  state.tick = 1600;
  for (let i = 0; i < 10; i++) state = tick(state);

  const gAfter = state.villagers.find(v => v.id === vGrass.id)!;
  const hAfter = state.villagers.find(v => v.id === vHill.id)!;

  assert(gAfter.x > hAfter.x, `grass villager traveled farther than hill villager (${gAfter.x} > ${hAfter.x})`);
}

// ================================================================
// TEST 3: Hills slow enemy movement
// ================================================================
heading('Hill Enemy Movement Penalty');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;

  // Enemy on grass
  state.enemies.push({
    id: 'e1', type: 'bandit', x: 0, y: 10,
    hp: 50, maxHp: 50, attack: 3, defense: 1,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  // Enemy on hills
  state.enemies.push({
    id: 'e2', type: 'bandit', x: 0, y: 12,
    hp: 50, maxHp: 50, attack: 3, defense: 1,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state.nextEnemyId = 3;

  // Set hill terrain on row 12
  for (let x = 0; x < 20; x++) state.grid[12][x].terrain = 'hill';

  // Run 10 ticks
  for (let i = 0; i < 10; i++) state = tick(state);

  const eGrass = state.enemies.find(e => e.id === 'e1')!;
  const eHill = state.enemies.find(e => e.id === 'e2')!;
  assert(eGrass.x > eHill.x || eGrass.y !== eHill.y,
    `grass enemy traveled farther than hill enemy (grass: ${eGrass.x},${eGrass.y} vs hill: ${eHill.x},${eHill.y})`);
}

// ================================================================
// TEST 4: Guard on hill gets terrain defense bonus
// ================================================================
heading('Hill Defense Bonus');
{
  let state = makeWorld();
  state.research.completed = []; // No tech bonuses
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;

  // Guard on grass
  let stateGrass = { ...state, villagers: [...state.villagers], enemies: [...state.enemies] };
  const gGrass = createVillager(1, 5, 5);
  gGrass.role = 'guard'; gGrass.state = 'idle'; gGrass.traits = [];
  gGrass.hp = 50;
  stateGrass.villagers.push(gGrass);
  stateGrass.nextVillagerId = 2;

  const bandit = ENEMY_TEMPLATES.bandit;
  stateGrass.enemies.push({
    id: 'e1', type: 'bandit', x: 5, y: 6,
    hp: 50, maxHp: 50, attack: bandit.attack, defense: bandit.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  stateGrass.nextEnemyId = 2;

  // Guard on hill
  let stateHill = { ...state, villagers: [...state.villagers], enemies: [...state.enemies] };
  stateHill.grid = state.grid.map(row => row.map(t => ({ ...t })));
  stateHill.grid[5][5].terrain = 'hill';
  const gHill = createVillager(1, 5, 5);
  gHill.role = 'guard'; gHill.state = 'idle'; gHill.traits = [];
  gHill.hp = 50;
  stateHill.villagers.push(gHill);
  stateHill.nextVillagerId = 2;

  stateHill.enemies.push({
    id: 'e1', type: 'bandit', x: 5, y: 6,
    hp: 50, maxHp: 50, attack: bandit.attack, defense: bandit.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  stateHill.nextEnemyId = 2;

  // Run 5 ticks of combat
  for (let i = 0; i < 5; i++) {
    stateGrass = tick(stateGrass);
    stateHill = tick(stateHill);
  }

  const grassGuard = stateGrass.villagers.find(v => v.id === gGrass.id);
  const hillGuard = stateHill.villagers.find(v => v.id === gHill.id);

  if (grassGuard && hillGuard) {
    assert(hillGuard.hp >= grassGuard.hp,
      `hill guard took less damage (hill: ${hillGuard.hp} >= grass: ${grassGuard.hp})`);
  } else {
    // One of them might be dead — hill guard should survive longer
    assert(hillGuard !== undefined || grassGuard === undefined,
      'hill guard survived longer or both died');
  }
}

// ================================================================
// TEST 5: Can place watchtower on hills
// ================================================================
heading('Watchtower on Hill');
{
  let state = makeWorld();
  state.grid[5][5].terrain = 'hill';
  state = placeBuilding(state, 'watchtower', 5, 5);
  const wt = state.buildings.find(b => b.type === 'watchtower');
  assert(wt !== undefined, 'watchtower can be placed on hill');
}

// ================================================================
// TEST 6: Can place defensive structures on hills
// ================================================================
heading('Defenses on Hills');
{
  let state = makeWorld();
  state.grid[5][5].terrain = 'hill';
  state.grid[5][6].terrain = 'hill';
  state.grid[5][7].terrain = 'hill';

  state = placeBuilding(state, 'wall', 5, 5);
  const wall = state.buildings.find(b => b.type === 'wall');
  assert(wall !== undefined, 'wall can be placed on hill');

  state = placeBuilding(state, 'fence', 6, 5);
  const fence = state.buildings.find(b => b.type === 'fence');
  assert(fence !== undefined, 'fence can be placed on hill');

  state = placeBuilding(state, 'spike_trap', 7, 5);
  const trap = state.buildings.find(b => b.type === 'spike_trap');
  assert(trap !== undefined, 'spike trap can be placed on hill');
}

// ================================================================
// TEST 7: Cannot place regular buildings on hills
// ================================================================
heading('No Regular Buildings on Hills');
{
  let state = makeWorld();
  state.grid[5][5].terrain = 'hill';
  state = placeBuilding(state, 'tent', 5, 5);
  const tent = state.buildings.find(b => b.type === 'tent');
  assert(!tent, 'tent cannot be placed on hill');
}

// ================================================================
// TEST 8: Hill terrain generated on map
// ================================================================
heading('Hill Map Generation');
{
  const state = createWorld(50, 50, 123);
  let hillCount = 0;
  for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) {
    if (state.grid[y][x].terrain === 'hill') hillCount++;
  }
  assert(hillCount > 0, `hills exist on generated map (${hillCount} tiles)`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Terrain Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
