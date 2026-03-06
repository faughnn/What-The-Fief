// test-v2-library.ts — Tests for library building (research speed boost)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP,
} from '../world.js';
import { tick, placeBuilding, assignVillager, setResearch } from '../simulation.js';
import { TICKS_PER_DAY, RESEARCH_TICKS_PER_POINT } from '../timing.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  const state = createWorld(20, 20, 42);
  // Only unlock basic techs — leave research tree open for testing
  state.research.completed = ['basic_farming', 'basic_cooking', 'herbalism_lore'];
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
// TEST 1: Library building template exists
// ================================================================
heading('Library Template');
{
  const template = BUILDING_TEMPLATES['library'];
  assert(template !== undefined, 'library template exists');
  if (template) {
    assert(template.width === 1, 'library is 1x1');
    assert(template.maxWorkers === 0, 'library has no workers (passive)');
  }
}

// ================================================================
// TEST 2: Library requires a tech
// ================================================================
heading('Library Tech Requirement');
{
  const req = BUILDING_TECH_REQUIREMENTS['library'];
  assert(req !== undefined, `library has tech requirement: ${req}`);
}

// ================================================================
// TEST 3: Library has HP entry
// ================================================================
heading('Library HP');
{
  assert(BUILDING_MAX_HP['library'] !== undefined, 'library has maxHP');
  assert(BUILDING_MAX_HP['library'] >= 30, `library HP >= 30 (${BUILDING_MAX_HP['library']})`);
}

// ================================================================
// TEST 4: Can place library
// ================================================================
heading('Place Library');
{
  let state = makeWorld();
  state.research.completed = [...ALL_TECHS];
  state = placeBuilding(state, 'library', 5, 5);
  const lib = state.buildings.find(b => b.type === 'library');
  assert(lib !== undefined, 'library placed');
}

// ================================================================
// TEST 5: Research desk produces faster with library nearby
// ================================================================
heading('Library Research Boost');
{
  // Test: measure research progress after 2 days (not enough to complete)
  // Use a high-cost tech so it doesn't complete during the test
  // metallurgy costs 15, requires basic_farming — should take many days

  // WITH library
  let withLib = makeWorld();
  withLib.research.completed = [...ALL_TECHS]; // for building placement
  const v1 = createVillager(1, 5, 5);
  withLib = { ...withLib, villagers: [v1], nextVillagerId: 2 };

  withLib = placeBuilding(withLib, 'storehouse', 5, 6);
  withLib = placeBuilding(withLib, 'tent', 5, 5);
  withLib = placeBuilding(withLib, 'research_desk', 7, 5);
  withLib = placeBuilding(withLib, 'library', 8, 5);

  withLib = {
    ...withLib,
    buildings: withLib.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };

  withLib.villagers[0].homeBuildingId = withLib.buildings.find(b => b.type === 'tent')!.id;
  const deskId = withLib.buildings.find(b => b.type === 'research_desk')!.id;
  withLib = assignVillager(withLib, 'v1', deskId);

  // Research something with high cost
  withLib.research.completed = [];
  withLib = setResearch(withLib, 'improved_tools');

  withLib = advance(withLib, TICKS_PER_DAY * 2);

  const progressWithLib = withLib.research.progress;

  // WITHOUT library
  let withoutLib = makeWorld();
  withoutLib.research.completed = [...ALL_TECHS];
  const v2 = createVillager(1, 5, 5);
  withoutLib = { ...withoutLib, villagers: [v2], nextVillagerId: 2 };

  withoutLib = placeBuilding(withoutLib, 'storehouse', 5, 6);
  withoutLib = placeBuilding(withoutLib, 'tent', 5, 5);
  withoutLib = placeBuilding(withoutLib, 'research_desk', 7, 5);

  withoutLib = {
    ...withoutLib,
    buildings: withoutLib.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };

  withoutLib.villagers[0].homeBuildingId = withoutLib.buildings.find(b => b.type === 'tent')!.id;
  const deskId2 = withoutLib.buildings.find(b => b.type === 'research_desk')!.id;
  withoutLib = assignVillager(withoutLib, 'v1', deskId2);

  withoutLib.research.completed = [];
  withoutLib = setResearch(withoutLib, 'improved_tools');

  withoutLib = advance(withoutLib, TICKS_PER_DAY * 2);

  const progressWithoutLib = withoutLib.research.progress;

  // With library should produce more research progress
  assert(progressWithLib > progressWithoutLib,
    `library boosts research: ${progressWithLib} > ${progressWithoutLib} (diff=${progressWithLib - progressWithoutLib})`);
}

// ================================================================
// TEST 6: Library is a passive building (no workers needed)
// ================================================================
heading('Library Passive');
{
  const template = BUILDING_TEMPLATES['library'];
  if (template) {
    assert(template.maxWorkers === 0, 'library needs no workers');
    assert(template.production === null, 'library has no production');
  }
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Library Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
