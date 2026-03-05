// test-v2-fishing.ts — Fishing hut: water-adjacent placement, fish production, food variety

import {
  createWorld, GameState, TICKS_PER_DAY, BUILDING_TEMPLATES,
  FOOD_PRIORITY, ALL_RESOURCES, OUTDOOR_BUILDINGS, BUILDING_SKILL_MAP,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function makeFishingWorld(): GameState {
  let state = createWorld(20, 20, 2);
  state.fog = state.fog.map(row => row.map(() => true));
  state.territory = state.territory.map(row => row.map(() => true));
  // Default: all grass
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
    }
  }
  // Add water strip along y=10 (tiles 0-19, y=10)
  for (let x = 0; x < 20; x++) {
    state.grid[10][x] = { terrain: 'water', building: null, deposit: null };
  }
  // Resources
  state.resources = { ...state.resources, wood: 200, stone: 200, food: 200, gold: 100 };
  // Storehouse at (5,5) — constructed
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 200, wood: 200, stone: 200, gold: 100 }
        : b.localBuffer,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };
  return state;
}

// ========================
// TEMPLATE & DATA
// ========================

console.log('\n=== Fishing: template exists ===');
{
  const template = BUILDING_TEMPLATES['fishing_hut' as keyof typeof BUILDING_TEMPLATES];
  assert(template !== undefined, 'Fishing hut template exists');
  if (template) {
    assert(template.maxWorkers === 1, `Fishing hut has 1 worker slot (got ${template.maxWorkers})`);
    assert(template.production !== null, 'Fishing hut has production');
    if (template.production) {
      assert(template.production.output === 'fish', `Produces fish (got ${template.production.output})`);
    }
  }
}

console.log('\n=== Fishing: fish is a food resource ===');
{
  assert(ALL_RESOURCES.includes('fish'), 'fish is in ALL_RESOURCES');
  const fishFood = FOOD_PRIORITY.find(f => f.resource === 'fish');
  assert(fishFood !== undefined, 'fish is in FOOD_PRIORITY');
  if (fishFood) {
    assert(fishFood.satisfaction > 1.0, `fish has satisfaction > 1.0 (got ${fishFood.satisfaction})`);
  }
}

// ========================
// PLACEMENT — WATER ADJACENCY
// ========================

console.log('\n=== Fishing: placement requires water adjacency ===');
{
  const state = makeFishingWorld();
  // Place at (3, 3) — far from water at y=10. Should fail.
  const result = placeBuilding(state, 'fishing_hut', 3, 3);
  assert(result.buildings.length === state.buildings.length,
    'Cannot place fishing hut far from water');
}

console.log('\n=== Fishing: placement succeeds adjacent to water ===');
{
  const state = makeFishingWorld();
  // Place at (3, 9) — adjacent to water at y=10
  const result = placeBuilding(state, 'fishing_hut', 3, 9);
  assert(result.buildings.length === state.buildings.length + 1,
    'Can place fishing hut adjacent to water');
  const hut = result.buildings.find(b => b.type === 'fishing_hut');
  assert(hut !== undefined, 'Fishing hut building created');
  if (hut) {
    assert(hut.x === 3 && hut.y === 9, `Placed at (3,9) — got (${hut.x},${hut.y})`);
  }
}

console.log('\n=== Fishing: placement on water tile fails ===');
{
  const state = makeFishingWorld();
  // Place at (3, 10) — ON water tile. Should fail (terrain check).
  const result = placeBuilding(state, 'fishing_hut', 3, 10);
  assert(result.buildings.length === state.buildings.length,
    'Cannot place fishing hut on water');
}

console.log('\n=== Fishing: placement below water succeeds ===');
{
  const state = makeFishingWorld();
  // Place at (3, 11) — below water at y=10, adjacent
  const result = placeBuilding(state, 'fishing_hut', 3, 11);
  assert(result.buildings.length === state.buildings.length + 1,
    'Can place fishing hut below water');
}

// ========================
// PRODUCTION — FISH OUTPUT
// ========================

console.log('\n=== Fishing: assigned fisher produces fish ===');
{
  let state = makeFishingWorld();
  // Place tent at (3,7) for villager home, fishing hut at (3,9) adjacent to water at y=10
  state = placeBuilding(state, 'tent', 3, 7);
  state = placeBuilding(state, 'fishing_hut', 3, 9);
  // Construct all buildings immediately
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
  const tent = state.buildings.find(b => b.type === 'tent')!;
  const hut = state.buildings.find(b => b.type === 'fishing_hut');
  if (!hut) {
    assert(false, 'Fishing hut not placed — skipping production tests');
  } else {
    // Set villager at hut entrance, with home, start at daytime
    state.villagers[0].x = 3;
    state.villagers[0].y = 9;
    state.villagers[0].hp = 100;
    state.villagers[0].hunger = 0;
    state.villagers[0].homeBuildingId = tent.id;
    state = assignVillager(state, state.villagers[0].id, hut.id);
    const fisher = state.villagers.find(v => v.jobBuildingId === hut.id);
    assert(fisher !== undefined, 'Villager assigned to fishing hut');
    assert(fisher!.role === 'fisher', `Role is fisher (got ${fisher!.role})`);

    // Start at dawn so we get a full work day
    state.tick = 29; // next tick will be 30 = dawn
    // Run for 2 full days to allow production + hauling
    for (let i = 0; i < TICKS_PER_DAY * 2; i++) {
      state = tick(state);
    }
    // Fish may be in buffer, in storehouse resources, or being carried
    const hutNow = state.buildings.find(b => b.id === hut.id)!;
    const fisherNow = state.villagers.find(v => v.jobBuildingId === hut.id)!;
    const totalFish = (hutNow.localBuffer.fish || 0)
      + (state.resources.fish || 0)
      + (fisherNow.carrying.fish || 0);
    assert(totalFish > 0, `Fish produced and tracked (got ${totalFish})`);
  }
}

// ========================
// OUTDOOR BUILDING — WEATHER AFFECTS FISHING
// ========================

console.log('\n=== Fishing: fishing hut is outdoor building ===');
{
  assert(OUTDOOR_BUILDINGS.includes('fishing_hut'),
    'Fishing hut is in OUTDOOR_BUILDINGS list');
}

console.log('\n=== Fishing: fishing hut uses farming skill ===');
{
  assert(BUILDING_SKILL_MAP['fishing_hut'] === 'farming',
    `Fishing hut skill is farming (got ${BUILDING_SKILL_MAP['fishing_hut']})`);
}

// ========================
// AUTO-ASSIGN — FISHING HUT IN ASSIGN ORDER
// ========================

console.log('\n=== Fishing: idle villager auto-assigned to fishing hut ===');
{
  let state = makeFishingWorld();
  // Place and construct fishing hut
  state = placeBuilding(state, 'fishing_hut', 3, 9);
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
  // Set villager to idle
  state.villagers[0].role = 'idle' as any;
  state.villagers[0].jobBuildingId = null;
  state.villagers[0].hp = 100;

  // Run a new day for auto-assign to trigger
  // Advance to tick 0 of a new day
  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);

  const hut = state.buildings.find(b => b.type === 'fishing_hut');
  if (!hut) {
    assert(false, 'Fishing hut not placed — skipping auto-assign test');
  } else {
    const assigned = state.villagers.find(v => v.jobBuildingId === hut.id);
    assert(assigned !== undefined, 'Idle villager auto-assigned to fishing hut');
  }
}

// ========================
// SUMMARY
// ========================

console.log(`\n=== Fishing: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
