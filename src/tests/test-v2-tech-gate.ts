// test-v2-tech-gate.ts — Tech-gated building construction: research unlocks buildings

import {
  createWorld, GameState, BUILDING_TEMPLATES, BuildingType, TechId,
  TECH_TREE,
} from '../world.js';
import { tick, placeBuilding, setResearch } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function makeWorld(): GameState {
  let state = createWorld(30, 30, 2);
  state.fog = state.fog.map(row => row.map(() => true));
  state.territory = state.territory.map(row => row.map(() => true));
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
    }
  }
  state.resources = {
    ...state.resources,
    wood: 500, stone: 500, food: 500, gold: 200,
    planks: 100, ingots: 100, leather: 50, linen: 50, rope: 50,
    iron_ore: 50, herbs: 50, flax: 50, hemp: 50,
    flour: 50, bread: 50,
    basic_tools: 20, sturdy_tools: 20, iron_tools: 20,
    sword: 10, bow: 10, leather_armor: 10, iron_armor: 10,
  };
  // Place a storehouse first (always available)
  state = placeBuilding(state, 'storehouse', 5, 5);
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
  return state;
}

// Helper: complete a tech instantly
function completeTech(state: GameState, techId: TechId): GameState {
  if (!state.research.completed.includes(techId)) {
    state.research.completed.push(techId);
  }
  return state;
}

// ========================
// BUILDING_TECH_REQUIREMENTS exists
// ========================

console.log('\n=== Tech Gate: BUILDING_TECH_REQUIREMENTS mapping exists ===');
{
  const { BUILDING_TECH_REQUIREMENTS } = require('../world.js');
  assert(BUILDING_TECH_REQUIREMENTS !== undefined, 'BUILDING_TECH_REQUIREMENTS exists');
  assert(typeof BUILDING_TECH_REQUIREMENTS === 'object', 'BUILDING_TECH_REQUIREMENTS is an object');
}

// ========================
// ALWAYS-AVAILABLE buildings can be placed without any tech
// ========================

console.log('\n=== Tech Gate: starter buildings need no tech ===');
{
  const alwaysAvailable: BuildingType[] = [
    'tent', 'house', 'farm', 'woodcutter', 'quarry', 'storehouse',
    'blacksmith', 'research_desk', 'wall', 'fence', 'gate', 'road',
    'herb_garden', 'tanner', 'weaver', 'hemp_field', 'flax_field', 'well',
  ];
  for (const btype of alwaysAvailable) {
    let state = makeWorld();
    // No research completed
    state.research.completed = [];
    const before = state.buildings.length;
    state = placeBuilding(state, btype, 10, 10);
    assert(state.buildings.length > before, `${btype} placed without any tech`);
  }
}

// ========================
// GATED buildings CANNOT be placed without required tech
// ========================

console.log('\n=== Tech Gate: gated buildings blocked without tech ===');
{
  // Sample of gated buildings and their required techs
  const gatedBuildings: [BuildingType, TechId][] = [
    ['large_farm', 'crop_rotation'],
    ['deep_quarry', 'masonry'],
    ['town_hall', 'masonry'],
    ['toolmaker', 'improved_tools'],
    ['watchtower', 'fortification'],
    ['chicken_coop', 'animal_husbandry'],
    ['mill', 'basic_cooking'],
    ['smelter', 'metallurgy'],
    ['marketplace', 'trade_routes'],
    ['fletcher', 'archery'],
    ['weaponsmith', 'steel_forging'],
    ['leather_workshop', 'master_crafting'],
    ['inn', 'architecture'],
  ];
  for (const [btype, tech] of gatedBuildings) {
    let state = makeWorld();
    state.research.completed = [];
    const before = state.buildings.length;
    state = placeBuilding(state, btype, 12, 12);
    assert(state.buildings.length === before, `${btype} blocked without ${tech} tech`);
  }
}

// ========================
// GATED buildings CAN be placed after researching required tech
// ========================

console.log('\n=== Tech Gate: gated buildings allowed after research ===');
{
  const gatedBuildings: [BuildingType, TechId][] = [
    ['large_farm', 'crop_rotation'],
    ['deep_quarry', 'masonry'],
    ['town_hall', 'masonry'],
    ['toolmaker', 'improved_tools'],
    ['watchtower', 'fortification'],
    ['chicken_coop', 'animal_husbandry'],
    ['mill', 'basic_cooking'],
    ['smelter', 'metallurgy'],
    ['marketplace', 'trade_routes'],
    ['fletcher', 'archery'],
    ['weaponsmith', 'steel_forging'],
    ['leather_workshop', 'master_crafting'],
    ['inn', 'architecture'],
  ];
  for (const [btype, tech] of gatedBuildings) {
    let state = makeWorld();
    state.research.completed = [];
    state = completeTech(state, tech);
    const before = state.buildings.length;
    state = placeBuilding(state, btype, 14, 14);
    assert(state.buildings.length > before, `${btype} placed after researching ${tech}`);
  }
}

// ========================
// WRONG tech doesn't help
// ========================

console.log('\n=== Tech Gate: wrong tech does not unlock building ===');
{
  let state = makeWorld();
  state.research.completed = [];
  state = completeTech(state, 'crop_rotation'); // Wrong tech for smelter
  const before = state.buildings.length;
  state = placeBuilding(state, 'smelter', 16, 16);
  assert(state.buildings.length === before, 'smelter blocked with wrong tech (crop_rotation instead of metallurgy)');
}

// ========================
// Upgrade buildings respect tech
// ========================

console.log('\n=== Tech Gate: upgrade buildings respect tech ===');
{
  // lumber_mill requires architecture
  let state = makeWorld();
  state.research.completed = [];
  const before = state.buildings.length;
  state = placeBuilding(state, 'lumber_mill', 18, 18);
  assert(state.buildings.length === before, 'lumber_mill blocked without architecture');

  state = completeTech(state, 'architecture');
  state = placeBuilding(state, 'lumber_mill', 20, 18);
  assert(state.buildings.length > before, 'lumber_mill placed after architecture');
}

// ========================
// graveyard and rubble always placeable (special buildings)
// ========================

console.log('\n=== Tech Gate: special buildings always available ===');
{
  let state = makeWorld();
  state.research.completed = [];
  const before = state.buildings.length;
  state = placeBuilding(state, 'graveyard', 20, 20);
  assert(state.buildings.length > before, 'graveyard always available');
}

// ========================
// SUMMARY
// ========================

console.log(`\n=== Tech Gate: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
