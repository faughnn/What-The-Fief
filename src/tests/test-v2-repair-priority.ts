// test-v2-repair-priority.ts — Tests for urgent repair priority system
// Severely damaged buildings (< 50% HP) should be repaired before new construction

import {
  createWorld, createVillager, GameState,
  TICKS_PER_DAY, NIGHT_TICKS, ALL_TECHS, BUILDING_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function setupColony(): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];
  state.villagers = [];
  state.nextVillagerId = 1;

  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };
  state.resources = { ...state.resources, food: 200 };

  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return state;
}

// ================================================================
// TEST 1: Severely damaged building (< 50% HP) repaired before construction
// ================================================================
heading('Urgent Repair Priority');

{
  let state = setupColony();

  // Place a guard tower and damage it severely (below 50%)
  state = placeBuilding(state, 'watchtower', 6, 10);
  const tower = state.buildings.find(b => b.type === 'watchtower')!;
  tower.constructed = true;
  tower.hp = Math.floor(tower.maxHp * 0.3); // 30% HP — urgent

  // Place an unconstructed building (construction site)
  state.resources = { ...state.resources, wood: 50, stone: 50, planks: 50 };
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer = { ...sh.localBuffer, wood: 50, stone: 50, planks: 50 };
  state = placeBuilding(state, 'farm', 12, 10);
  const farm = state.buildings.find(b => b.type === 'farm')!;
  // farm is NOT constructed — it's a construction site

  // Add an idle villager near both buildings
  const v = createVillager(1, 9, 10);
  v.food = 8; v.morale = 80; v.hp = 20; v.maxHp = 20;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')?.id || null;
  state.villagers = [v];
  state.nextVillagerId = 2;

  // Run until the villager picks a task (daytime)
  // Start at dawn so the villager is awake
  state.tick = NIGHT_TICKS; // exactly dawn

  // Run a few ticks for the villager to pick up an idle task
  for (let i = 0; i < 5; i++) state = tick(state);

  const villager = state.villagers[0];
  // The villager should be heading to repair the damaged tower, not build the farm
  // jobBuildingId should be the tower, not the farm
  assert(
    villager.jobBuildingId === tower.id,
    `idle villager prioritizes urgent repair (job=${villager.jobBuildingId}, tower=${tower.id}, farm=${farm.id})`
  );
}

// ================================================================
// TEST 2: Lightly damaged building (> 50% HP) does NOT preempt construction
// ================================================================
heading('Normal Repair After Construction');

{
  let state = setupColony();

  // Place a guard tower with minor damage (80% HP — not urgent)
  state = placeBuilding(state, 'watchtower', 6, 10);
  const tower = state.buildings.find(b => b.type === 'watchtower')!;
  tower.constructed = true;
  tower.hp = Math.floor(tower.maxHp * 0.8); // 80% HP — not urgent

  // Place an unconstructed building
  state.resources = { ...state.resources, wood: 50, stone: 50, planks: 50 };
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer = { ...sh.localBuffer, wood: 50, stone: 50, planks: 50 };
  state = placeBuilding(state, 'farm', 12, 10);
  const farm = state.buildings.find(b => b.type === 'farm')!;

  // Add an idle villager
  const v = createVillager(1, 9, 10);
  v.food = 8; v.morale = 80; v.hp = 20; v.maxHp = 20;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')?.id || null;
  state.villagers = [v];
  state.nextVillagerId = 2;

  state.tick = NIGHT_TICKS; // exactly dawn

  for (let i = 0; i < 20; i++) state = tick(state);

  const villager = state.villagers[0];
  // Should go to the construction site (farm) first, not repair
  assert(
    villager.jobBuildingId === farm.id,
    `idle villager builds before minor repair (job=${villager.jobBuildingId}, tower=${tower.id}, farm=${farm.id})`
  );
}

// ================================================================
// TEST 3: Urgent repair threshold is 50% HP
// ================================================================
heading('50% Threshold');

{
  let state = setupColony();

  // Place a building at exactly 50% HP
  state = placeBuilding(state, 'watchtower', 6, 10);
  const tower = state.buildings.find(b => b.type === 'watchtower')!;
  tower.constructed = true;
  // Set to exactly half (avoid Math.floor rounding below 50%)
  tower.hp = Math.ceil(tower.maxHp * 0.5); // at or above 50%

  // Place an unconstructed building
  state.resources = { ...state.resources, wood: 50, stone: 50, planks: 50 };
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer = { ...sh.localBuffer, wood: 50, stone: 50, planks: 50 };
  state = placeBuilding(state, 'farm', 12, 10);
  const farm = state.buildings.find(b => b.type === 'farm')!;

  const v = createVillager(1, 9, 10);
  v.food = 8; v.morale = 80; v.hp = 20; v.maxHp = 20;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')?.id || null;
  state.villagers = [v];
  state.nextVillagerId = 2;

  state.tick = NIGHT_TICKS; // exactly dawn

  // Run just 1 tick (dawn) to see initial task assignment
  state = tick(state);

  const villager = state.villagers[0];
  // At exactly 50%, should NOT be urgent — construction takes priority
  assert(
    villager.jobBuildingId === farm.id,
    `50% HP is not urgent (job=${villager.jobBuildingId}, state=${villager.state}, tower=${tower.id}, farm=${farm.id})`
  );
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Repair Priority Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
