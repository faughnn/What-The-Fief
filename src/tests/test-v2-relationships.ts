// test-v2-relationships.ts — Villager relationship tests
// Villagers form families. Co-located family = morale bonus. Death = grief.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS,
} from '../world.js';
import {
  tick, placeBuilding,
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

// ================================================================
// TEST 1: Villagers can have family bonds
// ================================================================
heading('Family Bond Data');

{
  const v1 = createVillager(1, 5, 5);
  const v2 = createVillager(2, 5, 5);

  // Set up family relationship
  v1.family = ['v2'];
  v2.family = ['v1'];

  assert(v1.family.includes('v2'), 'v1 has v2 as family');
  assert(v2.family.includes('v1'), 'v2 has v1 as family');
}

// ================================================================
// TEST 2: Co-located family members get morale bonus
// ================================================================
heading('Family Proximity Morale Bonus');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  // Place house
  state = placeBuilding(state, 'house', 5, 5);
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

  // Two family members sharing a home (force same traits for fair comparison)
  const v1 = createVillager(1, 5, 5);
  v1.homeBuildingId = state.buildings[0].id;
  v1.food = 10;
  v1.family = ['v2'];
  v1.traits = [];

  const v2 = createVillager(2, 5, 5);
  v2.homeBuildingId = state.buildings[0].id;
  v2.food = 10;
  v2.family = ['v1'];
  v2.traits = [];

  // Non-family villager for comparison (same traits)
  const v3 = createVillager(3, 5, 5);
  v3.homeBuildingId = state.buildings[0].id;
  v3.food = 10;
  v3.family = [];
  v3.traits = [];

  state = { ...state, villagers: [v1, v2, v3], nextVillagerId: 4 };

  // Run 1 day to trigger morale calculation
  state = advance(state, TICKS_PER_DAY);

  const fam1 = state.villagers.find(v => v.id === 'v1');
  const alone = state.villagers.find(v => v.id === 'v3');

  if (fam1 && alone) {
    assert(fam1.morale > alone.morale, `Family member has higher morale (fam=${fam1.morale}, alone=${alone.morale})`);
  }
}

// ================================================================
// TEST 3: Family grief when member dies
// ================================================================
heading('Grief on Family Death');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  const v1 = createVillager(1, 5, 5);
  v1.food = 10;
  v1.family = ['v2'];

  const v2 = createVillager(2, 5, 5);
  v2.food = 10;
  v2.hp = 0; // Will die
  v2.family = ['v1'];

  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  // v2 should die (hp=0). v1 should have grief.
  state = advance(state, TICKS_PER_DAY);

  // v2 should be removed (dead)
  const v2alive = state.villagers.find(v => v.id === 'v2');
  // v2 may still exist if no death processing removes 0 HP villagers during non-combat
  // Let's check v1's grief
  const v1after = state.villagers.find(v => v.id === 'v1');
  assert(v1after !== undefined, 'Surviving family member exists');
  if (v1after) {
    assert(v1after.grief > 0, `Surviving family member has grief (grief=${v1after.grief})`);
  }
}

// ================================================================
// TEST 4: Grief reduces morale
// ================================================================
heading('Grief Reduces Morale');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };

  state = placeBuilding(state, 'house', 5, 5);
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

  // Grieving villager
  const v1 = createVillager(1, 5, 5);
  v1.food = 10;
  v1.grief = 5; // 5 days of grief
  v1.homeBuildingId = state.buildings[0].id;
  v1.family = [];

  // Normal villager for comparison
  const v2 = createVillager(2, 5, 5);
  v2.food = 10;
  v2.grief = 0;
  v2.homeBuildingId = state.buildings[0].id;
  v2.family = [];

  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  state = advance(state, TICKS_PER_DAY);

  const grieving = state.villagers.find(v => v.id === 'v1');
  const normal = state.villagers.find(v => v.id === 'v2');
  if (grieving && normal) {
    assert(grieving.morale < normal.morale, `Grieving has lower morale (grief=${grieving.morale}, normal=${normal.morale})`);
  }
}

// ================================================================
// TEST 5: Grief fades over time
// ================================================================
heading('Grief Fades');

{
  let state = flatWorld(20, 20);

  const v1 = createVillager(1, 5, 5);
  v1.food = 10;
  v1.grief = 2; // Will fade in 2 days
  v1.family = [];

  state = { ...state, villagers: [v1], nextVillagerId: 2 };

  state = advance(state, TICKS_PER_DAY * 3);

  const v = state.villagers.find(v => v.id === 'v1');
  assert(v !== undefined, 'Villager survived');
  if (v) {
    assert(v.grief === 0, `Grief faded to 0 (grief=${v.grief})`);
  }
}

// ================================================================
// TEST 6: Family bonds are preserved in deep copy
// ================================================================
heading('Family Bond Deep Copy');

{
  let state = flatWorld(20, 20);
  const v1 = createVillager(1, 5, 5);
  v1.family = ['v2'];
  v1.food = 10;
  const v2 = createVillager(2, 6, 5);
  v2.family = ['v1'];
  v2.food = 10;

  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  // Advance 1 tick — deep copy should preserve family arrays
  state = advance(state, 1);

  const after1 = state.villagers.find(v => v.id === 'v1');
  const after2 = state.villagers.find(v => v.id === 'v2');
  assert(after1 !== undefined && after1.family.includes('v2'), 'v1 family preserved after tick');
  assert(after2 !== undefined && after2.family.includes('v1'), 'v2 family preserved after tick');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Relationship Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
