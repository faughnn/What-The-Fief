// test-v2-foraging-lodge.ts — Tests for foraging lodge (upgraded foraging hut)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, UPGRADE_PATHS, BUILDING_SKILL_MAP,
} from '../world.js';
import { tick, placeBuilding, assignVillager, upgradeBuilding } from '../simulation.js';
import { TICKS_PER_DAY, CONSTRUCTION_TICKS } from '../timing.js';

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
// TEST 1: Foraging lodge template exists
// ================================================================
heading('Foraging Lodge Template');
{
  const template = BUILDING_TEMPLATES['foraging_lodge'];
  assert(template !== undefined, 'foraging_lodge template exists');
  if (template) {
    assert(template.width === 1, 'foraging_lodge is 1x1');
    assert(template.maxWorkers === 2, 'foraging_lodge has 2 workers');
    assert(template.production !== null && template.production!.amountPerWorker === 3,
      'foraging_lodge produces 3 food per worker');
  }
}

// ================================================================
// TEST 2: Foraging lodge has tech requirement
// ================================================================
heading('Foraging Lodge Tech Requirement');
{
  const req = BUILDING_TECH_REQUIREMENTS['foraging_lodge'];
  assert(req !== undefined, `foraging_lodge has tech requirement: ${req}`);
  assert(req === 'advanced_farming', 'foraging_lodge requires advanced_farming');
}

// ================================================================
// TEST 3: Foraging lodge has HP entry
// ================================================================
heading('Foraging Lodge HP');
{
  assert(BUILDING_MAX_HP['foraging_lodge'] !== undefined, 'foraging_lodge has maxHP');
  assert(BUILDING_MAX_HP['foraging_lodge'] >= 30, `foraging_lodge HP >= 30 (${BUILDING_MAX_HP['foraging_lodge']})`);
}

// ================================================================
// TEST 4: Foraging lodge has construction ticks
// ================================================================
heading('Foraging Lodge Construction');
{
  assert(CONSTRUCTION_TICKS['foraging_lodge'] !== undefined, 'foraging_lodge has construction ticks');
  assert(CONSTRUCTION_TICKS['foraging_lodge'] > 0, `construction ticks > 0 (${CONSTRUCTION_TICKS['foraging_lodge']})`);
}

// ================================================================
// TEST 5: Foraging lodge has skill mapping
// ================================================================
heading('Foraging Lodge Skill');
{
  assert(BUILDING_SKILL_MAP['foraging_lodge'] === 'herbalism', 'foraging_lodge uses herbalism skill');
}

// ================================================================
// TEST 6: Upgrade path from foraging hut to lodge
// ================================================================
heading('Upgrade Path');
{
  const path = UPGRADE_PATHS['foraging_hut'];
  assert(path !== undefined, 'foraging_hut has upgrade path');
  if (path) {
    assert(path.to === 'foraging_lodge', `upgrade target is foraging_lodge (${path.to})`);
    assert((path.cost.wood || 0) > 0, 'upgrade costs wood');
  }
}

// ================================================================
// TEST 7: Can place foraging lodge
// ================================================================
heading('Place Foraging Lodge');
{
  let state = makeWorld();
  state = placeBuilding(state, 'foraging_lodge', 5, 5);
  const lodge = state.buildings.find(b => b.type === 'foraging_lodge');
  assert(lodge !== undefined, 'foraging_lodge placed');
}

// ================================================================
// TEST 8: Foraging lodge produces more than foraging hut
// ================================================================
heading('Foraging Lodge vs Hut Production');
{
  const templateHut = BUILDING_TEMPLATES['foraging_hut'];
  const templateLodge = BUILDING_TEMPLATES['foraging_lodge'];
  if (templateHut && templateLodge && templateHut.production && templateLodge.production) {
    const hutTotal = templateHut.maxWorkers * templateHut.production.amountPerWorker;
    const lodgeTotal = templateLodge.maxWorkers * templateLodge.production.amountPerWorker;
    assert(lodgeTotal > hutTotal,
      `lodge total output (${lodgeTotal}) > hut total output (${hutTotal})`);
  }
}

// ================================================================
// TEST 9: Can upgrade foraging hut to lodge
// ================================================================
heading('Upgrade Foraging Hut');
{
  let state = makeWorld();
  state = placeBuilding(state, 'foraging_hut', 5, 5);
  const hut = state.buildings.find(b => b.type === 'foraging_hut');
  assert(hut !== undefined, 'foraging_hut placed for upgrade test');
  if (hut) {
    // Mark as constructed
    state = {
      ...state,
      buildings: state.buildings.map(b => b.id === hut.id
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
    };
    state = upgradeBuilding(state, hut.id);
    const upgraded = state.buildings.find(b => b.type === 'foraging_lodge');
    assert(upgraded !== undefined, 'foraging_hut upgraded to foraging_lodge');
  }
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Foraging Lodge Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
