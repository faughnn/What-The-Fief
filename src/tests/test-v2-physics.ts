// test-v2-physics.ts — V2 physics tests
// Buildings block movement, villagers die from combat, workers repair buildings.

import {
  createWorld, createVillager, GameState, Building, EnemyEntity,
  TICKS_PER_DAY, NIGHT_TICKS, BUILDING_MAX_HP, ENEMY_TEMPLATES,
  BUILDING_TEMPLATES,
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
// TEST 1: Buildings block pathfinding (villager routes around)
// ================================================================
heading('Buildings Block Movement');

{
  let state = flatWorld(10, 10);
  // Place a row of farms blocking direct path
  state = placeBuilding(state, 'farm', 5, 3); // 2x2 at (5,3)-(6,4)
  state = placeBuilding(state, 'farm', 5, 5); // 2x2 at (5,5)-(6,6)

  // Try to path from (3, 4) to (8, 4) — direct path blocked by buildings
  const path = findPath(state.grid, state.width, state.height, 3, 4, 8, 4);

  // Path should exist but route around the buildings
  assert(path.length > 0, 'Path exists around buildings');
  assert(path.length > 5, `Path routes around buildings (length=${path.length}, direct would be 5)`);

  // Verify no path step goes through building tiles
  const buildingTiles = new Set<string>();
  for (const b of state.buildings) {
    const t = BUILDING_TEMPLATES[b.type];
    for (let dy = 0; dy < t.height; dy++) {
      for (let dx = 0; dx < t.width; dx++) {
        // Don't count destination as blocked
        buildingTiles.add(`${b.x + dx},${b.y + dy}`);
      }
    }
  }
  // Remove destination from check
  buildingTiles.delete('8,4');

  let passedThroughBuilding = false;
  for (const step of path.slice(0, -1)) { // check all but destination
    if (buildingTiles.has(`${step.x},${step.y}`)) {
      passedThroughBuilding = true;
      break;
    }
  }
  assert(!passedThroughBuilding, 'Path does not go through building tiles');
}

// ================================================================
// TEST 2: Destination building tile is reachable
// ================================================================
heading('Workers Can Enter Their Workplace');

{
  let state = flatWorld(10, 10);
  state = placeBuilding(state, 'farm', 5, 5); // 2x2 at (5,5)-(6,6)

  // Path TO the farm building entrance (5,5)
  const path = findPath(state.grid, state.width, state.height, 2, 5, 5, 5);
  assert(path.length > 0, 'Path to building entrance exists');
  assert(path[path.length - 1].x === 5 && path[path.length - 1].y === 5,
    'Path ends at building entrance');
}

// ================================================================
// TEST 3: Villager dies from enemy attack
// ================================================================
heading('Villager Death From Combat');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 5, 5);
  state = placeBuilding(state, 'tent', 5, 5);

  // Set villager to 1 HP and place enemy adjacent
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, hp: 1, homeBuildingId: state.buildings[0].id })),
  };
  state = addEnemy(state, 'bandit', 4, 5);

  const villagerCount = state.villagers.length;
  state = advance(state, 5);

  assert(state.villagers.length < villagerCount,
    `Villager died from combat (was ${villagerCount}, now ${state.villagers.length})`);
}

// ================================================================
// TEST 4: Workers repair damaged buildings
// ================================================================
heading('Building Repair');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);
  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'farm', 4, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
    // Force farm to be constructed and damaged
    buildings: state.buildings.map(b =>
      b.id === farmId ? {
        ...b,
        constructed: true,
        constructionProgress: b.constructionRequired,
        hp: 10, // damaged from 30 max
      } : b
    ),
  };

  // Advance a day — worker should repair before producing
  state = advance(state, TICKS_PER_DAY);

  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.hp > 10, `Farm repaired: was 10 HP, now ${farm.hp}`);
}

// ================================================================
// TEST 5: Repair completes then production resumes
// ================================================================
heading('Repair Then Production');

{
  let state = flatWorld(10, 10);
  state = addVillager(state, 3, 5);
  state = placeBuilding(state, 'tent', 3, 5);
  state = placeBuilding(state, 'farm', 4, 5);
  const homeId = state.buildings[0].id;
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;

  state = assignVillager(state, 'v1', farmId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
    buildings: state.buildings.map(b =>
      b.id === farmId ? {
        ...b,
        constructed: true,
        constructionProgress: b.constructionRequired,
        hp: 25, // only 5 HP of damage — quick repair
      } : b
    ),
  };

  // Advance 2 full days — repair 5 ticks, then production
  state = advance(state, TICKS_PER_DAY * 2);

  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.hp === farm.maxHp, `Farm fully repaired: ${farm.hp}/${farm.maxHp}`);
  const wheat = farm.localBuffer['wheat'] || 0;
  const globalWheat = state.resources.wheat;
  assert(wheat > 0 || globalWheat > 0,
    `Production resumed after repair: local=${wheat}, global=${globalWheat}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Physics Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
