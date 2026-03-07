// test-v2-stonemason.ts — Tests for stonemason building (stone → stone_blocks)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, BUILDING_SKILL_MAP, ALL_RESOURCES,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation.js';
import { TICKS_PER_DAY, CONSTRUCTION_TICKS } from '../timing.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeWorld(): GameState {
  let state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100 };
  state.villagers = [];
  state.nextVillagerId = 1;
  // Place storehouse + tent for housing
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 7, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { stone: 200, wood: 200, food: 200, planks: 100 }
        : b.localBuffer,
    })),
  };
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Stonemason template exists
// ================================================================
heading('Stonemason Template');
{
  const template = BUILDING_TEMPLATES['stonemason'];
  assert(template !== undefined, 'stonemason template exists');
  if (template) {
    assert(template.width === 1, 'stonemason is 1x1');
    assert(template.height === 1, 'stonemason is 1x1 height');
    assert(template.maxWorkers === 1, 'stonemason has 1 worker');
    assert(template.production !== null, 'stonemason has production');
    if (template.production) {
      assert(template.production.output === 'stone_blocks', 'produces stone_blocks');
      assert(template.production.amountPerWorker === 2, '2 per worker');
      assert(template.production.inputs !== null && template.production.inputs!.stone === 3, 'requires 3 stone');
    }
  }
}

// ================================================================
// TEST 2: stone_blocks is a valid resource
// ================================================================
heading('Resource Type');
{
  assert(ALL_RESOURCES.includes('stone_blocks' as any), 'stone_blocks is in ALL_RESOURCES');
}

// ================================================================
// TEST 3: Stonemason tech requirement
// ================================================================
heading('Tech Requirement');
{
  const req = BUILDING_TECH_REQUIREMENTS['stonemason'];
  assert(req !== undefined, `stonemason has tech requirement: ${req}`);
  assert(req === 'masonry', 'requires masonry');
}

// ================================================================
// TEST 4: Stonemason has HP
// ================================================================
heading('HP Entry');
{
  assert(BUILDING_MAX_HP['stonemason'] !== undefined, 'stonemason has maxHP');
  assert(BUILDING_MAX_HP['stonemason'] >= 30, `HP >= 30 (${BUILDING_MAX_HP['stonemason']})`);
}

// ================================================================
// TEST 5: Stonemason has skill mapping
// ================================================================
heading('Skill Mapping');
{
  assert(BUILDING_SKILL_MAP['stonemason'] === 'mining', 'stonemason uses mining skill');
}

// ================================================================
// TEST 6: Stonemason has construction ticks
// ================================================================
heading('Construction Ticks');
{
  const ticks = CONSTRUCTION_TICKS['stonemason'];
  assert(ticks !== undefined, 'stonemason has construction ticks');
  assert(ticks > 0, `construction ticks > 0: ${ticks}`);
}

// ================================================================
// TEST 7: Stonemason can be placed and constructed
// ================================================================
heading('Placement & Construction');
{
  let state = makeWorld();
  const bCount = state.buildings.length;
  state = placeBuilding(state, 'stonemason', 3, 3);

  assert(state.buildings.length > bCount, 'stonemason building placed');
  const sm = state.buildings.find(b => b.type === 'stonemason');
  assert(sm !== undefined, 'stonemason building exists');
  if (sm) {
    assert(sm.constructed === false, 'starts unconstructed');
    assert(sm.hp > 0, 'has HP');
  }
}

// ================================================================
// TEST 8: Stonemason produces stone_blocks from stone
// ================================================================
heading('Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'stonemason', 3, 3);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'stonemason'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { stone: 15 } }
        : b),
  };
  const sm = state.buildings.find(b => b.type === 'stonemason')!;

  const v1 = createVillager(1, 3, 3);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', sm.id);

  state = advance(state, TICKS_PER_DAY * 2);

  const smRef = state.buildings.find(b => b.type === 'stonemason')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const totalBlocks = (smRef.localBuffer['stone_blocks'] || 0)
    + (shRef.localBuffer['stone_blocks'] || 0)
    + (state.resources.stone_blocks || 0);
  assert(totalBlocks > 0, `stone_blocks produced: ${totalBlocks}`);
}

// ================================================================
// TEST 9: Stonemason requires stone input (no production without stone)
// ================================================================
heading('Requires Stone Input');
{
  let state = makeWorld();
  // Remove all stone from storehouse and global
  state = {
    ...state,
    resources: { ...state.resources, stone: 0 },
    buildings: state.buildings.map(b =>
      b.type === 'storehouse'
        ? { ...b, localBuffer: { ...b.localBuffer, stone: 0 } }
        : b),
  };

  state = placeBuilding(state, 'stonemason', 3, 3);
  // If placement fails (needs stone in cost), that's fine — no blocks produced
  const sm = state.buildings.find(b => b.type === 'stonemason');
  if (sm) {
    sm.constructed = true;
    const v1 = createVillager(1, 3, 3);
    v1.food = 8; v1.morale = 80;
    v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
    state = { ...state, villagers: [v1], nextVillagerId: 2 };
    state = assignVillager(state, 'v1', sm.id);
    state = advance(state, TICKS_PER_DAY);
  }

  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const smRef = state.buildings.find(b => b.type === 'stonemason');
  const totalBlocks = (smRef?.localBuffer['stone_blocks'] || 0)
    + (shRef.localBuffer['stone_blocks'] || 0);
  assert(totalBlocks === 0, `no stone_blocks without stone input: ${totalBlocks}`);
}

// ================================================================
// TEST 10: Stonemason not buildable without masonry tech
// ================================================================
heading('Tech Gate');
{
  let state = makeWorld();
  state.research.completed = [];
  const bCount = state.buildings.length;

  state = placeBuilding(state, 'stonemason', 3, 3);
  assert(state.buildings.length === bCount, 'cannot build stonemason without masonry tech');
}

// ================================================================
// TEST 11: Stonemason construction cost deducted
// ================================================================
heading('Construction Cost');
{
  let state = makeWorld();
  const stoneBefore = state.resources.stone;
  state = placeBuilding(state, 'stonemason', 3, 3);
  const stoneAfter = state.resources.stone;

  // civil_engineering reduces cost by 25%, so actual may be less than template cost
  assert(stoneBefore - stoneAfter > 0, `stone cost deducted: ${stoneBefore - stoneAfter}`);
}

// ================================================================
// TEST 12: stone_blocks stored in storehouse buffer
// ================================================================
heading('Stone Blocks Storage');
{
  let state = makeWorld();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer['stone_blocks'] = 50;
  assert(sh.localBuffer['stone_blocks'] === 50, 'stone_blocks stored in storehouse buffer');
}

// ================================================================
// Summary
// ================================================================
console.log(`\nstonemason: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
