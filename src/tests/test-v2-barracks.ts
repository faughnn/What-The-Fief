// test-v2-barracks.ts — Tests for barracks military housing

import {
  createWorld, GameState, createVillager,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, ALL_TECHS,
  HOUSING_INFO, HOUSING_COMFORT, BUILDING_TECH_REQUIREMENTS,
  TICKS_PER_DAY, EnemyEntity, ENEMY_TEMPLATES,
} from '../world.js';
import { placeBuilding } from '../simulation/buildings.js';
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
  state.resources = { ...state.resources, wood: 200, stone: 200, planks: 50, food: 200 };
  state.villagers = [];
  state.nextVillagerId = 1;

  const s = placeBuilding(state, 'storehouse', 10, 10);
  const sh = s.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };

  return s;
}

// ================================================================
// TEST 1: Barracks template exists
// ================================================================
heading('Barracks Template');
{
  assert(BUILDING_TEMPLATES.barracks !== undefined, 'barracks template exists');
  assert(BUILDING_TEMPLATES.barracks.width === 2, 'barracks is 2x2');
  assert(BUILDING_TEMPLATES.barracks.height === 2, 'barracks is 2x2 height');
  assert(BUILDING_MAX_HP.barracks === 80, `barracks has 80 HP (${BUILDING_MAX_HP.barracks})`);
}

// ================================================================
// TEST 2: Barracks houses 4 with morale +5
// ================================================================
heading('Barracks Housing');
{
  const info = HOUSING_INFO.barracks!;
  assert(info.capacity === 4, `barracks houses 4 (${info.capacity})`);
  assert(info.morale === 5, `barracks +5 morale (${info.morale})`);
  assert(HOUSING_COMFORT.barracks === 2, `barracks comfort 2 (${HOUSING_COMFORT.barracks})`);
}

// ================================================================
// TEST 3: Barracks requires military_tactics
// ================================================================
heading('Barracks Tech Requirement');
{
  assert(BUILDING_TECH_REQUIREMENTS.barracks === 'military_tactics', 'barracks requires military_tactics');

  // Can't place without tech
  let state = makeWorld();
  state.research.completed = [];
  state = placeBuilding(state, 'barracks', 5, 5);
  const noTechBarracks = state.buildings.find(b => b.type === 'barracks');
  assert(noTechBarracks === undefined, 'cannot build barracks without military_tactics');

  // Can place with tech
  state.research.completed = ['military_tactics'];
  state = placeBuilding(state, 'barracks', 5, 5);
  const withTechBarracks = state.buildings.find(b => b.type === 'barracks');
  assert(withTechBarracks !== undefined, 'can build barracks with military_tactics');
}

// ================================================================
// TEST 4: Guards in barracks gain 2x combat XP
// ================================================================
heading('Barracks XP Bonus');
{
  // Guard WITHOUT barracks housing
  let state1 = makeWorld();
  state1 = placeBuilding(state1, 'tent', 5, 5);
  const tent = state1.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  const g1 = createVillager(1, 8, 8);
  g1.role = 'guard'; g1.state = 'idle'; g1.traits = [];
  g1.homeBuildingId = tent.id;
  state1.villagers.push(g1);
  state1.nextVillagerId = 2;

  const t1 = ENEMY_TEMPLATES.bandit;
  state1.enemies.push({
    id: 'e1', type: 'bandit', x: 8, y: 9,
    hp: t1.maxHp, maxHp: t1.maxHp, attack: t1.attack, defense: t1.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state1.nextEnemyId = 2;

  // Guard WITH barracks housing
  let state2 = makeWorld();
  state2 = placeBuilding(state2, 'barracks', 5, 5);
  const barracks = state2.buildings.find(b => b.type === 'barracks')!;
  barracks.constructed = true; barracks.hp = barracks.maxHp;

  const g2 = createVillager(1, 8, 8);
  g2.role = 'guard'; g2.state = 'idle'; g2.traits = [];
  g2.homeBuildingId = barracks.id;
  state2.villagers.push(g2);
  state2.nextVillagerId = 2;

  state2.enemies.push({
    id: 'e1', type: 'bandit', x: 8, y: 9,
    hp: t1.maxHp, maxHp: t1.maxHp, attack: t1.attack, defense: t1.defense,
    range: 0, siege: 'none', ticksAlive: 0,
  });
  state2.nextEnemyId = 2;

  state1.tick = TICKS_PER_DAY - 10;
  state2.tick = TICKS_PER_DAY - 10;
  state1 = tick(state1);
  state2 = tick(state2);

  const xp1 = state1.villagers[0].skills.combat;
  const xp2 = state2.villagers[0].skills.combat;
  assert(xp2 > xp1, `barracks guard gains more XP (${xp2} > ${xp1})`);
  assert(xp2 === xp1 * 2, `barracks doubles XP (${xp2} === ${xp1} * 2)`);
}

// ================================================================
// TEST 5: Barracks can be placed
// ================================================================
heading('Barracks Placement');
{
  let state = makeWorld();
  state = placeBuilding(state, 'barracks', 3, 3);
  const b = state.buildings.find(b => b.type === 'barracks');
  assert(b !== undefined, 'barracks placed successfully');
  assert(b!.x === 3 && b!.y === 3, `barracks at correct position (${b!.x},${b!.y})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Barracks Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
