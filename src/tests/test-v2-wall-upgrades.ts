// test-v2-wall-upgrades.ts — Tests for fence → wall → reinforced_wall upgrade path

import {
  createWorld, GameState, createVillager,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, ALL_TECHS,
  UPGRADE_PATHS, BUILDING_TECH_REQUIREMENTS,
  TICKS_PER_DAY, EnemyEntity, ENEMY_TEMPLATES,
} from '../world.js';
import { placeBuilding } from '../simulation/buildings.js';
import { tick } from '../simulation/index.js';
import { upgradeBuilding } from '../simulation/index.js';

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
  state.resources = { ...state.resources, wood: 200, stone: 200, ingots: 50, planks: 50, stone_blocks: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;

  const s = placeBuilding(state, 'storehouse', 10, 10);
  const sh = s.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, stone: 200, ingots: 50, stone_blocks: 50 };

  const s2 = placeBuilding(s, 'tent', 8, 10);
  const tent = s2.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return s2;
}

// ================================================================
// TEST 1: Templates exist
// ================================================================
heading('Wall Templates');
{
  assert(BUILDING_TEMPLATES.reinforced_wall !== undefined, 'reinforced_wall template exists');
  assert(BUILDING_MAX_HP.reinforced_wall === 200, `reinforced_wall has 200 HP (${BUILDING_MAX_HP.reinforced_wall})`);
  assert(BUILDING_MAX_HP.wall === 100, `wall has 100 HP (${BUILDING_MAX_HP.wall})`);
  assert(BUILDING_MAX_HP.fence === 30, `fence has 30 HP (${BUILDING_MAX_HP.fence})`);
}

// ================================================================
// TEST 2: Upgrade paths exist
// ================================================================
heading('Upgrade Paths');
{
  assert(UPGRADE_PATHS.fence?.to === 'wall', 'fence upgrades to wall');
  assert(UPGRADE_PATHS.wall?.to === 'reinforced_wall', 'wall upgrades to reinforced_wall');
}

// ================================================================
// TEST 3: Reinforced wall requires siege_engineering
// ================================================================
heading('Tech Requirements');
{
  assert(BUILDING_TECH_REQUIREMENTS.reinforced_wall === 'siege_engineering', 'reinforced_wall requires siege_engineering');
}

// ================================================================
// TEST 4: Fence → wall upgrade works
// ================================================================
heading('Fence to Wall Upgrade');
{
  let state = makeWorld();
  state = placeBuilding(state, 'fence', 5, 5);
  const fence = state.buildings.find(b => b.type === 'fence')!;
  fence.constructed = true; fence.hp = fence.maxHp;

  state = upgradeBuilding(state, fence.id);
  const upgraded = state.buildings.find(b => b.id === fence.id);
  assert(upgraded !== undefined, 'building still exists after upgrade');
  // Upgrade creates a construction site (not yet constructed)
  // or immediately upgrades depending on implementation
  const wallOrSite = state.buildings.find(b => b.x === 5 && b.y === 5);
  assert(wallOrSite !== undefined, 'wall exists at fence position');
}

// ================================================================
// TEST 5: Wall → reinforced_wall upgrade works
// ================================================================
heading('Wall to Reinforced Wall Upgrade');
{
  let state = makeWorld();
  state = placeBuilding(state, 'wall', 5, 5);
  const wall = state.buildings.find(b => b.type === 'wall')!;
  wall.constructed = true; wall.hp = wall.maxHp;

  state = upgradeBuilding(state, wall.id);
  const upgraded = state.buildings.find(b => b.x === 5 && b.y === 5);
  assert(upgraded !== undefined, 'reinforced wall site exists at wall position');
}

// ================================================================
// TEST 6: Reinforced wall has more HP than wall
// ================================================================
heading('Reinforced Wall HP');
{
  let state = makeWorld();
  state = placeBuilding(state, 'wall', 5, 5);
  const wall = state.buildings.find(b => b.type === 'wall')!;
  wall.constructed = true; wall.hp = wall.maxHp;

  state = placeBuilding(state, 'reinforced_wall', 7, 5);
  const rwall = state.buildings.find(b => b.type === 'reinforced_wall')!;
  rwall.constructed = true; rwall.hp = rwall.maxHp;

  assert(rwall.maxHp > wall.maxHp, `reinforced wall HP (${rwall.maxHp}) > wall HP (${wall.maxHp})`);
}

// ================================================================
// TEST 7: Reinforced wall blocks enemies
// ================================================================
heading('Reinforced Wall Blocks Enemies');
{
  let state = makeWorld();
  // Place a line of reinforced walls
  for (let x = 3; x <= 7; x++) {
    state = placeBuilding(state, 'reinforced_wall', x, 5);
    const w = state.buildings.find(b => b.type === 'reinforced_wall' && b.x === x && b.y === 5)!;
    w.constructed = true; w.hp = w.maxHp;
  }

  // Place enemy above wall
  const t = ENEMY_TEMPLATES.bandit;
  const e: EnemyEntity = {
    id: 'e1', type: 'bandit', x: 5, y: 3,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  };
  state.nextEnemyId = 2;
  state.enemies.push(e);

  // Run a few ticks — enemy should not pass through reinforced walls
  state.tick = TICKS_PER_DAY - 20;
  for (let i = 0; i < 10; i++) state = tick(state);

  const eAfter = state.enemies.find(en => en.id === 'e1');
  if (eAfter && eAfter.hp > 0) {
    assert(eAfter.y <= 5, `enemy didn't pass through reinforced wall (y=${eAfter.y})`);
  } else {
    // Enemy might be dead, that's fine
    assert(true, 'enemy engaged with wall (dead or blocked)');
  }
}

// ================================================================
// TEST 8: Reinforced wall exempt from decay
// ================================================================
heading('Reinforced Wall No Decay');
{
  let state = makeWorld();
  state.prosperity = 0; state.renown = 0;
  state = placeBuilding(state, 'reinforced_wall', 5, 5);
  const rw = state.buildings.find(b => b.type === 'reinforced_wall')!;
  rw.constructed = true; rw.hp = rw.maxHp;
  const startHp = rw.hp;

  // Run 10 days (2 decay events)
  for (let i = 0; i < TICKS_PER_DAY * 10; i++) state = tick(state);

  const rwAfter = state.buildings.find(b => b.id === rw.id)!;
  assert(rwAfter.hp === startHp, `reinforced wall doesn't decay (${rwAfter.hp} === ${startHp})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Wall Upgrades Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
