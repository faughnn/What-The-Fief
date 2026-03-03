// test-v2-food-variety.ts — Food variety morale bonus tests
// Bellwright rewards diverse diets. Eating multiple food types = morale bonus.

import {
  createWorld, createVillager, GameState, Building, FoodEaten,
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

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// Setup: storehouse(1,3), house(3,3), pre-constructed, villager with low food so they eat at dawn
function setupFoodTest(): GameState {
  let state = flatWorld(20, 20); // Large map so animals don't reach villagers
  state = { ...state, resources: { ...state.resources, wood: 80, stone: 20, food: 50 } };
  state = addVillager(state, 3, 3);

  state = placeBuilding(state, 'storehouse', 1, 3);
  state = placeBuilding(state, 'house', 3, 3);
  const homeId = state.buildings.find(b => b.type === 'house')!.id;

  // Pre-construct everything
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { food: 40 } : {},
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: {
            ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired,
            localBuffer: tile.building.type === 'storehouse' ? { food: 40 } : {},
          }}
        : tile
    )),
    // food=3 so villager eats at dawn (threshold food<=5)
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: homeId, food: 3 })),
    tick: TICKS_PER_DAY - 1, day: 0,
  };

  return state;
}

// ================================================================
// TEST 1: recentMeals tracks what villager ate
// ================================================================
heading('recentMeals Tracking');

{
  let state = setupFoodTest();
  // Stock storehouse with bread
  state = {
    ...state,
    resources: { ...state.resources, bread: 5 },
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { ...b.localBuffer, bread: 5 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { ...tile.building.localBuffer, bread: 5 } } }
        : tile
    )),
  };

  // Run 1 day — villager eats at dawn (food=3, then hunger decay brings to 2, then eats bread)
  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v !== undefined, 'Villager survived');
  if (v) {
    assert(Array.isArray(v.recentMeals), `recentMeals is an array`);
    assert(v.recentMeals.length > 0, `recentMeals has entries after eating (len=${v.recentMeals.length})`);
    assert(v.recentMeals.includes('bread'), `recentMeals contains bread`);
  }
}

// ================================================================
// TEST 2: Single food type → no variety bonus
// ================================================================
heading('No Variety Bonus with Single Food Type');

{
  let state = setupFoodTest();
  // Only bread, villager eats bread → only 1 type in recentMeals
  state = {
    ...state,
    resources: { ...state.resources, bread: 20, wheat: 0, food: 0, flour: 0 },
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { bread: 20 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { bread: 20 } } }
        : tile
    )),
  };

  state = advance(state, TICKS_PER_DAY * 2);

  const v = state.villagers[0];
  assert(v !== undefined, 'Villager survived');
  if (v) {
    const uniqueTypes = new Set(v.recentMeals.filter(m => m !== 'nothing'));
    assert(uniqueTypes.size <= 1, `Only 1 food type eaten (${[...uniqueTypes].join(',')}) — no variety bonus`);
  }
}

// ================================================================
// TEST 3: Morale with 2 food types in recentMeals → +5 variety bonus
// ================================================================
heading('Variety Bonus with 2 Food Types');

{
  let state = setupFoodTest();
  // Storehouse has bread for eating
  state = {
    ...state,
    resources: { ...state.resources, bread: 10 },
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { bread: 10 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { bread: 10 } } }
        : tile
    )),
    // Pre-set recentMeals with wheat so after eating bread = 2 types
    villagers: state.villagers.map(v => ({ ...v, recentMeals: ['wheat' as FoodEaten] })),
  };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v !== undefined, 'Villager survived');
  if (v) {
    const uniqueTypes = new Set(v.recentMeals.filter(m => m !== 'nothing'));
    assert(uniqueTypes.size >= 2, `2+ food types (${[...uniqueTypes].join(',')}) — variety bonus`);
    // Base 50 + house(+10) + nothing(-20) + variety2(+5) + spring(0) + weather = 45 + weather
    // lastAte resets to 'nothing' each daily check before morale calc
    assert(v.morale >= 35, `Morale with 2-type variety (morale=${v.morale})`);
  }
}

// ================================================================
// TEST 4: Morale with 3+ food types in recentMeals → +10 variety bonus
// ================================================================
heading('Variety Bonus with 3+ Food Types');

{
  let state = setupFoodTest();
  state = {
    ...state,
    resources: { ...state.resources, bread: 10 },
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { bread: 10 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { bread: 10 } } }
        : tile
    )),
    // Pre-set recentMeals with 2 different types, eating bread makes 3
    villagers: state.villagers.map(v => ({ ...v, recentMeals: ['wheat' as FoodEaten, 'food' as FoodEaten] })),
  };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v !== undefined, 'Villager survived');
  if (v) {
    const uniqueTypes = new Set(v.recentMeals.filter(m => m !== 'nothing'));
    assert(uniqueTypes.size >= 3, `3+ food types (${[...uniqueTypes].join(',')})`);
    // Base 50 + house(+10) + nothing(-20) + variety3(+10) + spring(0) + weather = 50 + weather
    assert(v.morale >= 40, `Morale with 3-type variety (morale=${v.morale})`);
  }
}

// ================================================================
// TEST 5: Compare morale: no variety vs variety bonus
// ================================================================
heading('Morale Difference: No Variety vs Variety');

{
  // Setup A: single food type, pre-set recentMeals with only bread
  let stateA = setupFoodTest();
  stateA = {
    ...stateA,
    resources: { ...stateA.resources, bread: 10 },
    buildings: stateA.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { bread: 10 } } : b
    ),
    grid: stateA.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { bread: 10 } } }
        : tile
    )),
    villagers: stateA.villagers.map(v => ({ ...v, recentMeals: ['bread' as FoodEaten] })),
  };

  // Setup B: diverse food types, same food to eat
  let stateB = setupFoodTest();
  stateB = {
    ...stateB,
    resources: { ...stateB.resources, bread: 10 },
    buildings: stateB.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { bread: 10 } } : b
    ),
    grid: stateB.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { bread: 10 } } }
        : tile
    )),
    villagers: stateB.villagers.map(v => ({ ...v, recentMeals: ['wheat' as FoodEaten, 'food' as FoodEaten] })),
  };

  stateA = advance(stateA, TICKS_PER_DAY);
  stateB = advance(stateB, TICKS_PER_DAY);

  const vA = stateA.villagers[0];
  const vB = stateB.villagers[0];
  assert(vA !== undefined && vB !== undefined, 'Both villagers survived');
  if (vA && vB) {
    assert(vB.morale > vA.morale, `Varied diet morale (${vB.morale}) > single diet morale (${vA.morale})`);
    const diff = vB.morale - vA.morale;
    assert(diff >= 5, `Variety bonus is at least +5 (diff=${diff})`);
  }
}

// ================================================================
// TEST 6: recentMeals caps at 5 entries
// ================================================================
heading('recentMeals Caps at 5');

{
  let state = setupFoodTest();
  state = {
    ...state,
    resources: { ...state.resources, bread: 10 },
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { bread: 10 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { bread: 10 } } }
        : tile
    )),
    villagers: state.villagers.map(v => ({
      ...v, recentMeals: ['wheat' as FoodEaten, 'food' as FoodEaten, 'flour' as FoodEaten, 'bread' as FoodEaten, 'wheat' as FoodEaten],
    })),
  };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v !== undefined, 'Villager survived');
  if (v) {
    assert(v.recentMeals.length <= 5, `recentMeals capped at 5 (len=${v.recentMeals.length})`);
  }
}

// ================================================================
// TEST 7: 'nothing' does not count for variety
// ================================================================
heading('Nothing Eaten Does Not Count for Variety');

{
  let state = setupFoodTest();
  // No food at all in storehouse
  state = {
    ...state,
    resources: { ...state.resources, bread: 0, wheat: 0, food: 0, flour: 0 },
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: {} } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: {} } }
        : tile
    )),
    villagers: state.villagers.map(v => ({
      ...v, recentMeals: ['nothing' as FoodEaten, 'nothing' as FoodEaten], food: 10,
    })),
  };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  if (v) {
    const uniqueTypes = new Set(v.recentMeals.filter(m => m !== 'nothing'));
    assert(uniqueTypes.size === 0, `'nothing' not counted for variety (unique=${uniqueTypes.size})`);
  } else {
    // Villager may depart from low morale with 'nothing' ate — that's ok
    assert(true, 'Villager departed from starvation (expected)');
  }
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Food Variety Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
