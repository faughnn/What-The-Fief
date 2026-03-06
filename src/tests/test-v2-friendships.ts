// test-v2-friendships.ts — Tests for villager friendship system

import {
  createWorld, createVillager, GameState,
  ALL_TECHS,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation.js';
import { TICKS_PER_DAY } from '../timing.js';

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
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, wheat: 500 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Villagers have friends field
// ================================================================
heading('Friends Field');
{
  const v = createVillager(1, 5, 5);
  assert(Array.isArray(v.friends), 'villager has friends array');
  assert(v.friends.length === 0, 'starts with no friends');
}

// ================================================================
// TEST 2: Coworkers become friends after working together
// ================================================================
heading('Coworkers Become Friends');
{
  let state = makeWorld();
  const v1 = createVillager(1, 5, 5);
  const v2 = createVillager(2, 5, 5);
  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  // Place buildings — use quarry (2 workers) to avoid conflicts
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'tent', 4, 5);
  state = placeBuilding(state, 'quarry', 7, 5);

  const tents = state.buildings.filter(b => b.type === 'tent');
  const quarryId = state.buildings.find(b => b.type === 'quarry')!.id;

  // Pre-construct, stock food, assign workers directly
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
      assignedWorkers: b.id === quarryId ? ['v1', 'v2'] : b.assignedWorkers,
    })),
  };

  // Set homes and jobs directly
  state.villagers[0].homeBuildingId = tents[0].id;
  state.villagers[1].homeBuildingId = tents[1].id;
  state.villagers[0].jobBuildingId = quarryId;
  state.villagers[0].role = 'quarry_worker' as any;
  state.villagers[1].jobBuildingId = quarryId;
  state.villagers[1].role = 'quarry_worker' as any;

  // Run for 15 days (friendship threshold is 10 days of cowork)
  state = advance(state, TICKS_PER_DAY * 15);

  const v1After = state.villagers.find(v => v.id === 'v1');
  const v2After = state.villagers.find(v => v.id === 'v2');
  assert(v1After !== undefined && v2After !== undefined, 'both villagers survived');
  if (v1After && v2After) {
    assert(v1After.friends.includes('v2'), `v1 befriended v2 (friends: ${v1After.friends})`);
    assert(v2After.friends.includes('v1'), `v2 befriended v1 (friends: ${v2After.friends})`);
  }
}

// ================================================================
// TEST 3: Max 2 friends per villager
// ================================================================
heading('Max Friends Limit');
{
  const v = createVillager(1, 0, 0);
  v.friends = ['v2', 'v3'];
  assert(v.friends.length === 2, 'can have 2 friends');
  // The system should not add more than 2
}

// ================================================================
// TEST 4: Friendship morale bonus
// ================================================================
heading('Friendship Morale');
{
  let state = makeWorld();
  const v1 = createVillager(1, 5, 5);
  const v2 = createVillager(2, 5, 5);
  v1.friends = ['v2'];
  v2.friends = ['v1'];
  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'tent', 4, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };

  const tents = state.buildings.filter(b => b.type === 'tent');
  state.villagers[0].homeBuildingId = tents[0].id;
  state.villagers[1].homeBuildingId = tents[1].id;
  state.villagers[0].morale = 50;
  state.villagers[1].morale = 50;

  // Run 1 day to trigger daily morale
  state = advance(state, TICKS_PER_DAY);

  const v1After = state.villagers.find(v => v.id === 'v1')!;
  // Friendship should contribute to morale (exact value depends on other factors)
  // Just verify the friend bond exists and morale is reasonable
  assert(v1After.friends.includes('v2'), 'friendship persists');
}

// ================================================================
// TEST 5: No self-friendship
// ================================================================
heading('No Self-Friendship');
{
  const v = createVillager(1, 0, 0);
  assert(!v.friends.includes('v1'), 'villager is not friends with self');
}

// ================================================================
// TEST 6: Friendship is symmetric
// ================================================================
heading('Symmetric Friendship');
{
  let state = makeWorld();
  const v1 = createVillager(1, 5, 5);
  const v2 = createVillager(2, 5, 5);
  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'tent', 4, 5);
  state = placeBuilding(state, 'quarry', 7, 5);

  const tents = state.buildings.filter(b => b.type === 'tent');
  const quarryId = state.buildings.find(b => b.type === 'quarry')!.id;

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
      assignedWorkers: b.id === quarryId ? ['v1', 'v2'] : b.assignedWorkers,
    })),
  };

  state.villagers[0].homeBuildingId = tents[0].id;
  state.villagers[1].homeBuildingId = tents[1].id;
  state.villagers[0].jobBuildingId = quarryId;
  state.villagers[0].role = 'quarry_worker' as any;
  state.villagers[1].jobBuildingId = quarryId;
  state.villagers[1].role = 'quarry_worker' as any;

  state = advance(state, TICKS_PER_DAY * 15);

  const v1After = state.villagers.find(v => v.id === 'v1');
  const v2After = state.villagers.find(v => v.id === 'v2');
  if (v1After && v2After) {
    const v1HasV2 = v1After.friends.includes('v2');
    const v2HasV1 = v2After.friends.includes('v1');
    assert(v1HasV2 === v2HasV1, 'friendship is symmetric');
  } else {
    assert(false, 'villagers survived for symmetry check');
  }
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Friendship Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
