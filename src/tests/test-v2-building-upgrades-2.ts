// test-v2-building-upgrades-2.ts — Tests for new building upgrade paths (guard_tower, logging_camp)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, BUILDING_SKILL_MAP, UPGRADE_PATHS,
  WATCHTOWER_RANGE, WATCHTOWER_DAMAGE,
} from '../world.js';
import { tick, placeBuilding, assignVillager, upgradeBuilding, setGuard } from '../simulation.js';
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
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, rope: 50, ingots: 50, stone_blocks: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 7, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { wood: 200, stone: 200, food: 200, rope: 50, planks: 50, ingots: 30, stone_blocks: 30 }
        : b.localBuffer,
    })),
  };
  return state;
}

// ================================================================
// GUARD TOWER (watchtower upgrade)
// ================================================================
heading('Guard Tower Template');
{
  const template = BUILDING_TEMPLATES['guard_tower'];
  assert(template !== undefined, 'guard_tower template exists');
  if (template) {
    assert(template.width === 1, 'guard_tower is 1x1');
    assert(template.height === 1, 'guard_tower is 1x1 height');
    assert(template.maxWorkers === 1, 'guard_tower has 1 worker (guard)');
  }
}

heading('Guard Tower Upgrade Path');
{
  const path = UPGRADE_PATHS['watchtower'];
  assert(path !== undefined, 'watchtower has upgrade path');
  if (path) {
    assert(path.to === 'guard_tower', 'watchtower upgrades to guard_tower');
    assert(path.cost.stone !== undefined, 'upgrade costs stone');
    assert(path.cost.ingots !== undefined, 'upgrade costs ingots');
  }
}

heading('Guard Tower Properties');
{
  assert(BUILDING_MAX_HP['guard_tower'] !== undefined, 'guard_tower has HP entry');
  assert(BUILDING_MAX_HP['guard_tower']! > BUILDING_MAX_HP['watchtower']!, 'guard_tower has more HP than watchtower');
  assert(CONSTRUCTION_TICKS['guard_tower'] !== undefined, 'guard_tower has construction ticks');
  assert(BUILDING_TECH_REQUIREMENTS['guard_tower'] !== undefined, 'guard_tower has tech requirement');
}

heading('Guard Tower Enhanced Stats');
{
  // Guard tower should have better range and/or damage than watchtower
  // Check via GUARD_TOWER_RANGE and GUARD_TOWER_DAMAGE constants
  const { GUARD_TOWER_RANGE, GUARD_TOWER_DAMAGE } = require('../world.js');
  assert(GUARD_TOWER_RANGE > WATCHTOWER_RANGE, `guard_tower range (${GUARD_TOWER_RANGE}) > watchtower range (${WATCHTOWER_RANGE})`);
  assert(GUARD_TOWER_DAMAGE > WATCHTOWER_DAMAGE, `guard_tower damage (${GUARD_TOWER_DAMAGE}) > watchtower damage (${WATCHTOWER_DAMAGE})`);
}

heading('Guard Tower Upgrade Works');
{
  let state = makeWorld();
  state = placeBuilding(state, 'watchtower', 3, 3);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'watchtower' ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b),
  };
  const wtId = state.buildings.find(b => b.type === 'watchtower')!.id;

  state = upgradeBuilding(state, wtId);
  const upgraded = state.buildings.find(b => b.x === 3 && b.y === 3 && b.type !== 'rubble');
  assert(upgraded !== undefined, 'building exists at watchtower position after upgrade');
  if (upgraded) {
    assert(upgraded.type === 'guard_tower', `upgraded to guard_tower (got ${upgraded.type})`);
    assert(!upgraded.constructed, 'guard_tower starts as construction site');
  }
}

// ================================================================
// LOGGING CAMP (woodcutter upgrade)
// ================================================================
heading('Logging Camp Template');
{
  const template = BUILDING_TEMPLATES['logging_camp'];
  assert(template !== undefined, 'logging_camp template exists');
  if (template) {
    assert(template.width === 1, 'logging_camp is 1x1');
    assert(template.height === 1, 'logging_camp is 1x1 height');
    assert(template.maxWorkers === 2, 'logging_camp has 2 workers');
    assert(template.production !== null, 'logging_camp has production');
    if (template.production) {
      assert(template.production.output === 'wood', 'produces wood');
      assert(template.production.amountPerWorker >= 2, `${template.production.amountPerWorker} wood per worker`);
    }
  }
}

heading('Logging Camp Upgrade Path');
{
  const path = UPGRADE_PATHS['woodcutter'];
  assert(path !== undefined, 'woodcutter has upgrade path');
  if (path) {
    assert(path.to === 'logging_camp', 'woodcutter upgrades to logging_camp');
  }
}

heading('Logging Camp Properties');
{
  assert(BUILDING_MAX_HP['logging_camp'] !== undefined, 'logging_camp has HP entry');
  assert(CONSTRUCTION_TICKS['logging_camp'] !== undefined, 'logging_camp has construction ticks');
  assert(BUILDING_SKILL_MAP['logging_camp'] === 'woodcutting', 'logging_camp uses woodcutting skill');
  assert(BUILDING_TECH_REQUIREMENTS['logging_camp'] !== undefined, 'logging_camp has tech requirement');
}

heading('Logging Camp Upgrade Works');
{
  let state = makeWorld();
  state = placeBuilding(state, 'woodcutter', 3, 3);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'woodcutter' ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b),
  };
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;

  state = upgradeBuilding(state, wcId);
  const upgraded = state.buildings.find(b => b.x === 3 && b.y === 3 && b.type !== 'rubble');
  assert(upgraded !== undefined, 'building exists at woodcutter position after upgrade');
  if (upgraded) {
    assert(upgraded.type === 'logging_camp', `upgraded to logging_camp (got ${upgraded.type})`);
  }
}

heading('Logging Camp Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'logging_camp', 8, 8);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'logging_camp' ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b),
  };
  const lcId = state.buildings.find(b => b.type === 'logging_camp')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  const v1 = createVillager(1, 8, 8);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', lcId);

  for (let i = 0; i < TICKS_PER_DAY * 2; i++) state = tick(state);

  const lc = state.buildings.find(b => b.type === 'logging_camp')!;
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const totalWood = (lc.localBuffer.wood || 0) + (sh.localBuffer.wood || 0);
  // Should have produced some wood (storehouse starts with 200, so look for increase or check local)
  assert((lc.localBuffer.wood || 0) > 0 || totalWood > 200, `logging_camp produces wood`);
}

// ================================================================
// SUMMARY
// ================================================================
console.log(`\nBuilding Upgrades 2: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
