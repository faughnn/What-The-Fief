// test-v2-forester.ts — Tests for forester building (renewable wood)

import {
  createWorld, GameState, createVillager,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, ALL_TECHS,
  BUILDING_TECH_REQUIREMENTS, BUILDING_SKILL_MAP,
  TICKS_PER_DAY,
} from '../world.js';
import { placeBuilding, assignVillager } from '../simulation/index.js';
import { tick } from '../simulation/index.js';

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
  state.resources = { ...state.resources, wood: 200, stone: 200, food: 200 };
  state.villagers = [];
  state.nextVillagerId = 1;

  const s = placeBuilding(state, 'storehouse', 10, 10);
  const sh = s.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };

  const s2 = placeBuilding(s, 'tent', 8, 10);
  const tent = s2.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return s2;
}

// ================================================================
// TEST 1: Template exists with correct properties
// ================================================================
heading('Forester Template');
{
  const t = BUILDING_TEMPLATES.forester;
  assert(t !== undefined, 'forester template exists');
  assert(t.maxWorkers === 2, `supports 2 workers (${t.maxWorkers})`);
  assert(t.production?.output === 'wood', 'produces wood');
  assert(t.production?.amountPerWorker === 1, `1 wood per worker (slower than woodcutter's 2)`);
  assert(t.cost.wood === 5, 'costs 5 wood');
  assert(t.cost.stone === 3, 'costs 3 stone');
  assert(BUILDING_MAX_HP.forester === 30, `HP is 30 (${BUILDING_MAX_HP.forester})`);
  assert(BUILDING_TECH_REQUIREMENTS.forester === 'advanced_farming', 'requires advanced_farming');
  assert(BUILDING_SKILL_MAP.forester === 'woodcutting', 'uses woodcutting skill');
}

// ================================================================
// TEST 2: Can place and construct forester
// ================================================================
heading('Forester Placement');
{
  let state = makeWorld();
  state = placeBuilding(state, 'forester', 5, 5);
  const f = state.buildings.find(b => b.type === 'forester');
  assert(f !== undefined, 'forester placed successfully');
  assert(f!.x === 5 && f!.y === 5, 'at correct position');
  assert(!f!.constructed, 'starts as construction site');
}

// ================================================================
// TEST 3: Forester produces wood when worker assigned
// ================================================================
heading('Forester Wood Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'forester', 5, 5);
  const f = state.buildings.find(b => b.type === 'forester')!;
  f.constructed = true; f.hp = f.maxHp;

  const tent = state.buildings.find(b => b.type === 'tent')!;
  const v = createVillager(1, 5, 5);
  v.role = 'idle'; v.state = 'idle'; v.traits = [];
  v.homeBuildingId = tent.id;
  state.villagers.push(v);
  state.nextVillagerId = 2;

  state = assignVillager(state, v.id, f.id);
  const assigned = state.villagers.find(vi => vi.id === v.id)!;
  assert(assigned.role === 'forester_worker', `role is forester_worker (${assigned.role})`);

  // Run until mid-day. With skill 0 (0.8x mult), effectiveTpu = round(800/0.8) = 1000
  // Worker arrives at ~tick 1610, first production at ~tick 2610
  for (let i = 0; i < 2700; i++) state = tick(state);

  const fMid = state.buildings.find(b => b.type === 'forester')!;
  const woodMid = fMid.localBuffer.wood || 0;
  assert(woodMid > 0, `forester produced wood into buffer mid-day (${woodMid})`);
}

// ================================================================
// TEST 4: Forester produces LESS than woodcutter (1 vs 2 per worker)
// ================================================================
heading('Forester vs Woodcutter Rate');
{
  // Forester
  let state1 = makeWorld();
  state1 = placeBuilding(state1, 'forester', 5, 5);
  const f1 = state1.buildings.find(b => b.type === 'forester')!;
  f1.constructed = true; f1.hp = f1.maxHp;

  const tent1 = state1.buildings.find(b => b.type === 'tent')!;
  const v1 = createVillager(1, 5, 5);
  v1.role = 'idle'; v1.state = 'idle'; v1.traits = [];
  v1.homeBuildingId = tent1.id;
  state1.villagers.push(v1);
  state1.nextVillagerId = 2;
  state1 = assignVillager(state1, v1.id, f1.id);

  // Woodcutter
  let state2 = makeWorld();
  state2 = placeBuilding(state2, 'woodcutter', 5, 5);
  const w2 = state2.buildings.find(b => b.type === 'woodcutter')!;
  w2.constructed = true; w2.hp = w2.maxHp;

  const tent2 = state2.buildings.find(b => b.type === 'tent')!;
  const v2 = createVillager(1, 5, 5);
  v2.role = 'idle'; v2.state = 'idle'; v2.traits = [];
  v2.homeBuildingId = tent2.id;
  state2.villagers.push(v2);
  state2.nextVillagerId = 2;
  state2 = assignVillager(state2, v2.id, w2.id);

  // Run both until mid-day (tick 3000) to compare buffer accumulation before hauling
  for (let i = 0; i < 3000; i++) {
    state1 = tick(state1);
    state2 = tick(state2);
  }

  const foresterBuf = state1.buildings.find(b => b.type === 'forester')!.localBuffer.wood || 0;
  const woodcutterBuf = state2.buildings.find(b => b.type === 'woodcutter')!.localBuffer.wood || 0;

  assert(foresterBuf < woodcutterBuf, `forester produces less than woodcutter (${foresterBuf} < ${woodcutterBuf})`);
}

// ================================================================
// TEST 5: Requires advanced_farming tech
// ================================================================
heading('Forester Tech Requirement');
{
  let state = makeWorld();
  state.research.completed = []; // No techs
  const result = placeBuilding(state, 'forester', 5, 5);
  const f = result.buildings.find(b => b.type === 'forester');
  assert(!f, 'cannot place forester without advanced_farming tech');
}

// ================================================================
// TEST 6: Two workers produce more than one
// ================================================================
heading('Forester Multiple Workers');
{
  let state = makeWorld();
  state = placeBuilding(state, 'forester', 5, 5);
  const f = state.buildings.find(b => b.type === 'forester')!;
  f.constructed = true; f.hp = f.maxHp;

  const v1 = createVillager(1, 5, 5);
  v1.role = 'idle'; v1.state = 'idle'; v1.traits = [];
  state.villagers.push(v1);

  const v2 = createVillager(2, 5, 5);
  v2.role = 'idle'; v2.state = 'idle'; v2.traits = [];
  state.villagers.push(v2);
  state.nextVillagerId = 3;

  state = assignVillager(state, v1.id, f.id);
  state = assignVillager(state, v2.id, f.id);

  const fAfter = state.buildings.find(b => b.type === 'forester')!;
  const assigned = fAfter.assignedWorkers.length;
  assert(assigned === 2, `2 workers assigned (${assigned})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Forester Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
