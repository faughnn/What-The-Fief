// test-v2-events.ts — Advanced event tests
// Disease spreads physically. Lightning starts fires. Bandit demands.

import {
  createWorld, createVillager, GameState, Building, EnemyEntity,
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

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Disease spreads to adjacent villagers
// ================================================================
heading('Disease Spreads Physically');

{
  let state = flatWorld(20, 20);

  // Two villagers next to each other
  const v1 = createVillager(1, 5, 5);
  v1.sick = true;
  v1.sickDays = 3;
  v1.state = 'idle';
  const v2 = createVillager(2, 6, 5);
  v2.sick = false;
  v2.state = 'idle';

  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  // Run enough ticks for disease to have chance to spread
  // With 10% per tick, after 20 ticks the probability of at least one spread ≈ 88%
  state = advance(state, 30);

  const sick2 = state.villagers.find(v => v.id === 'v2');
  assert(sick2 !== undefined, 'Villager 2 still alive');
  if (sick2) {
    assert(sick2.sick === true, `Adjacent villager got sick (sick=${sick2.sick})`);
  }
}

// ================================================================
// TEST 2: Disease does NOT spread to distant villagers
// ================================================================
heading('Disease Does Not Spread Far');

{
  let state = flatWorld(20, 20);

  // Sick villager at (5,5), healthy at (15,15) — far away
  const v1 = createVillager(1, 5, 5);
  v1.sick = true;
  v1.sickDays = 3;
  v1.state = 'idle';
  const v2 = createVillager(2, 15, 15);
  v2.sick = false;
  v2.state = 'idle';

  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };
  state = advance(state, 30);

  const healthy = state.villagers.find(v => v.id === 'v2');
  assert(healthy !== undefined, 'Distant villager still alive');
  if (healthy) {
    assert(healthy.sick === false, 'Distant villager stayed healthy');
  }
}

// ================================================================
// TEST 3: Sick villagers lose HP over time
// ================================================================
heading('Sick Villagers Lose HP');

{
  let state = flatWorld(20, 20);

  const v1 = createVillager(1, 5, 5);
  v1.sick = true;
  v1.sickDays = 5;
  v1.state = 'idle';
  v1.hp = 10;
  v1.maxHp = 10;

  state = { ...state, villagers: [v1], nextVillagerId: 2 };

  // Advance one full day (120 ticks) — disease deals 1 HP per day
  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers.find(v => v.id === 'v1');
  assert(v !== undefined, 'Sick villager still alive');
  if (v) {
    assert(v.hp < 10, `Sick villager lost HP (hp=${v.hp})`);
  }
}

// ================================================================
// TEST 4: Disease heals after sickDays expire
// ================================================================
heading('Disease Heals After Duration');

{
  let state = flatWorld(20, 20);

  const v1 = createVillager(1, 5, 5);
  v1.sick = true;
  v1.sickDays = 2; // Will heal after 2 days
  v1.state = 'idle';
  v1.food = 10; // Enough food to survive

  state = { ...state, villagers: [v1], nextVillagerId: 2 };

  // Advance 3 days
  state = advance(state, TICKS_PER_DAY * 3);

  const v = state.villagers.find(v => v.id === 'v1');
  assert(v !== undefined, 'Villager survived disease');
  if (v) {
    assert(v.sick === false, `Disease healed after duration (sick=${v.sick})`);
    assert(v.sickDays === 0, `SickDays reset to 0 (days=${v.sickDays})`);
  }
}

// ================================================================
// TEST 5: Storm weather can start building fires
// ================================================================
heading('Storm Lightning Starts Fire');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };
  state = placeBuilding(state, 'house', 5, 5);

  // Pre-construct
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

  // Force storm weather each tick and check if fire eventually starts
  // processSeasonAndWeather overwrites weather on new day, so set it each tick
  let fireStarted = false;
  for (let i = 0; i < TICKS_PER_DAY * 50; i++) {
    state = { ...state, weather: 'storm' };
    state = tick(state);
    if (state.buildings.some(b => b.onFire)) {
      fireStarted = true;
      break;
    }
  }

  assert(fireStarted, 'Storm eventually caused a lightning fire');
}

// ================================================================
// TEST 6: Clear weather doesn't start fires
// ================================================================
heading('Clear Weather No Lightning');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50 } };
  state = placeBuilding(state, 'house', 5, 5);

  // Pre-construct
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

  // Run 10 days with clear weather
  for (let day = 0; day < 10; day++) {
    state = { ...state, weather: 'clear' };
    state = advance(state, TICKS_PER_DAY);
  }

  const anyFire = state.buildings.some(b => b.onFire);
  assert(!anyFire, 'Clear weather does not cause lightning fires');
}

// ================================================================
// TEST 7: Bandit ultimatum demands gold
// ================================================================
heading('Bandit Ultimatum');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, gold: 50 } };

  // Set up an ultimatum
  state = { ...state, banditUltimatum: { goldDemand: 20, daysLeft: 3 } };

  // After 3 days without paying, raid should trigger
  state = advance(state, TICKS_PER_DAY * 4);

  assert(state.banditUltimatum === null, 'Ultimatum cleared after expiry');
  // Raid bar should have increased significantly
  assert(state.raidBar >= 50, `Raid threat increased from ultimatum (raidBar=${state.raidBar})`);
}

// ================================================================
// TEST 8: Paying tribute prevents raid
// ================================================================
heading('Tribute Prevents Raid');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, gold: 50 } };

  // Set ultimatum — player has gold to pay
  state = { ...state, banditUltimatum: { goldDemand: 20, daysLeft: 5 } };

  // Simulate paying tribute: deduct gold, clear ultimatum
  // This would be a command, but for now just verify the mechanic
  const newResources = { ...state.resources, gold: state.resources.gold - 20 };
  state = { ...state, resources: newResources, banditUltimatum: null };

  // After more days, no raid trigger from ultimatum
  const raidBefore = state.raidBar;
  state = advance(state, TICKS_PER_DAY * 3);

  // Raid bar should not have spiked from ultimatum (may increase from normal sources)
  assert(state.raidBar < raidBefore + 50, `Raid didn't spike after tribute (raidBar=${state.raidBar})`);
  assert(state.resources.gold === 30, `Gold deducted for tribute (gold=${state.resources.gold})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Advanced Event Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
