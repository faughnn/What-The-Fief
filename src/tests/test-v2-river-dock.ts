// test-v2-river-dock.ts — Tests for river dock building
// River dock allows villagers to cross water tiles adjacent to the dock.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, ALL_TECHS, BUILDING_TEMPLATES, BUILDING_MAX_HP,
  BUILDING_TECH_REQUIREMENTS,
} from '../world.js';
import {
  tick, placeBuilding, findPath,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

// Create a small map with a river dividing it
function setupRiverMap(): GameState {
  let state = createWorld(20, 10, 42);
  // Clear map
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  // Create a vertical river at x=10
  for (let y = 0; y < 10; y++) {
    state.grid[y][10] = { terrain: 'water', building: null, deposit: null };
  }

  state.research.completed = [...ALL_TECHS];

  // Storehouse with resources on the left side
  state = placeBuilding(state, 'storehouse', 5, 5);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { planks: 50, rope: 20, wood: 50, stone: 50 };
  state.resources = { ...state.resources, planks: 50, rope: 20, wood: 50, stone: 50 };

  return state;
}

// === Test: Building template exists ===
heading('River Dock Template');

{
  const template = BUILDING_TEMPLATES.river_dock;
  assert(template !== undefined, 'river_dock template exists');
  assert(template.maxWorkers === 0, 'river_dock has no workers');
  assert(template.cost.planks === 10, 'costs 10 planks');
  assert(template.cost.rope === 5, 'costs 5 rope');
  assert(template.cost.wood === 5, 'costs 5 wood');
}

// === Test: Tech requirement ===
{
  const req = BUILDING_TECH_REQUIREMENTS['river_dock'];
  assert(req === 'civil_engineering', `requires civil_engineering (got: ${req})`);
}

// === Test: HP ===
{
  const hp = BUILDING_MAX_HP['river_dock'];
  assert(hp === 40, `river_dock HP is 40 (got: ${hp})`);
}

// === Test: Cannot cross river without dock ===
heading('Water Crossing');

{
  const state = setupRiverMap();
  // Try to pathfind from left (5,5) to right (15,5) — blocked by river
  const path = findPath(state.grid, state.width, state.height, 5, 5, 15, 5);
  assert(path.length === 0, 'cannot cross river without dock');
}

// === Test: Can cross river with dock ===
{
  let state = setupRiverMap();
  // Place dock adjacent to water at (9,5) — left bank
  state = placeBuilding(state, 'river_dock', 9, 5);
  const dock = state.buildings.find(b => b.type === 'river_dock')!;
  dock.constructed = true; dock.hp = dock.maxHp;

  // Now path from left (5,5) to right (15,5) should work — water at (10,5) is crossable
  const path = findPath(state.grid, state.width, state.height, 5, 5, 15, 5);
  assert(path.length > 0, `can cross river with dock (path length: ${path.length})`);

  // Verify path goes through water tile
  const crossesWater = path.some(p => state.grid[p.y][p.x].terrain === 'water');
  assert(crossesWater, 'path crosses water tile adjacent to dock');
}

// === Test: Unconstructed dock doesn't enable crossing ===
{
  let state = setupRiverMap();
  state = placeBuilding(state, 'river_dock', 9, 5);
  // Don't construct it

  const path = findPath(state.grid, state.width, state.height, 5, 5, 15, 5);
  assert(path.length === 0, 'unconstructed dock does not enable water crossing');
}

// === Test: Water tiles NOT adjacent to dock remain blocked ===
{
  let state = setupRiverMap();
  state = placeBuilding(state, 'river_dock', 9, 5);
  const dock = state.buildings.find(b => b.type === 'river_dock')!;
  dock.constructed = true; dock.hp = dock.maxHp;

  // Try to cross at y=0, far from dock at y=5
  const path = findPath(state.grid, state.width, state.height, 5, 0, 15, 0);
  // Path should either be empty (can't cross far from dock) or go around to the dock
  if (path.length > 0) {
    // If a path exists, it should route through the dock area
    const goesNearDock = path.some(p => Math.abs(p.y - 5) <= 1);
    assert(goesNearDock, 'path routes through dock area (not directly across far water)');
  } else {
    assert(true, 'cannot cross far from dock');
  }
}

// === Test: Must be placed adjacent to water ===
heading('Placement Rules');

{
  let state = setupRiverMap();
  // Try to place at (5,5) — not adjacent to water (river is at x=10)
  const before = state.buildings.length;
  state = placeBuilding(state, 'river_dock', 1, 1);
  assert(state.buildings.filter(b => b.type === 'river_dock').length === 0, 'cannot place river_dock away from water');
}

// === Test: Can place adjacent to water ===
{
  let state = setupRiverMap();
  state = placeBuilding(state, 'river_dock', 9, 5); // adjacent to water at x=10
  const dock = state.buildings.find(b => b.type === 'river_dock');
  assert(dock !== undefined, 'can place river_dock adjacent to water');
}

// === Test: Dock on other side of river also works ===
{
  let state = setupRiverMap();
  // Place dock on right bank at (11,5)
  state = placeBuilding(state, 'river_dock', 11, 5);
  const dock = state.buildings.find(b => b.type === 'river_dock')!;
  dock.constructed = true; dock.hp = dock.maxHp;

  const path = findPath(state.grid, state.width, state.height, 5, 5, 15, 5);
  assert(path.length > 0, `dock on right bank enables crossing (path length: ${path.length})`);
}

// === Test: Two docks enable wider crossing ===
{
  let state = setupRiverMap();
  // Place docks at y=3 and y=7
  state = placeBuilding(state, 'river_dock', 9, 3);
  state = placeBuilding(state, 'river_dock', 9, 7);
  for (const b of state.buildings) {
    if (b.type === 'river_dock') { b.constructed = true; b.hp = b.maxHp; }
  }

  // Can cross at y=3
  const path1 = findPath(state.grid, state.width, state.height, 5, 3, 15, 3);
  assert(path1.length > 0, 'can cross at first dock position');

  // Can cross at y=7
  const path2 = findPath(state.grid, state.width, state.height, 5, 7, 15, 7);
  assert(path2.length > 0, 'can cross at second dock position');
}

// === Test: Villager physically crosses water via dock ===
heading('Physical Movement');

{
  let state = setupRiverMap();
  state = placeBuilding(state, 'river_dock', 9, 5);
  const dock = state.buildings.find(b => b.type === 'river_dock')!;
  dock.constructed = true; dock.hp = dock.maxHp;

  // Town hall needed for settlement
  state = placeBuilding(state, 'town_hall', 1, 1);
  const th = state.buildings.find(b => b.type === 'town_hall')!;
  th.constructed = true; th.hp = th.maxHp;

  // Place a tent on the right side of the river
  state = placeBuilding(state, 'tent', 15, 5);
  const tent = state.buildings.find(b => b.type === 'tent' && b.x === 15)!;
  tent.constructed = true; tent.hp = tent.maxHp;

  // Create villager on left side
  state.villagers = [];
  const v = createVillager(1, 5, 5);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = tent.id;
  state.villagers.push(v);
  state.nextVillagerId = 2;

  // Run simulation — villager should eventually cross the river to get home
  let crossedWater = false;
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    state = tick(state);
    const vv = state.villagers[0];
    if (vv && state.grid[vv.y]?.[vv.x]?.terrain === 'water') {
      crossedWater = true;
    }
    // Check if villager reached the right side
    if (vv && vv.x >= 11) {
      break;
    }
  }

  const vFinal = state.villagers[0];
  if (vFinal) {
    assert(vFinal.x >= 11, `villager crossed river (at x=${vFinal.x})`);
  } else {
    assert(false, 'villager died before crossing');
  }
}

// === Summary ===
console.log(`\nRiver Dock: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
