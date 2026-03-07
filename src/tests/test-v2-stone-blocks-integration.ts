// test-v2-stone-blocks-integration.ts — Tests for stone_blocks as advanced building material

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  UPGRADE_PATHS,
} from '../world.js';
import { tick, placeBuilding } from '../simulation.js';

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
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, stone_blocks: 100, ingots: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { wood: 200, stone: 200, food: 200, planks: 100, stone_blocks: 100, ingots: 50 }
        : b.localBuffer,
    })),
  };
  return state;
}

// ================================================================
// TEST 1: Reinforced wall requires stone_blocks
// ================================================================
heading('Reinforced Wall Cost');
{
  const template = BUILDING_TEMPLATES['reinforced_wall'];
  assert(template.cost.stone_blocks !== undefined && template.cost.stone_blocks > 0,
    `reinforced_wall requires stone_blocks: ${template.cost.stone_blocks}`);
}

// ================================================================
// TEST 2: Church requires stone_blocks
// ================================================================
heading('Church Cost');
{
  const template = BUILDING_TEMPLATES['church'];
  assert(template.cost.stone_blocks !== undefined && template.cost.stone_blocks > 0,
    `church requires stone_blocks: ${template.cost.stone_blocks}`);
}

// ================================================================
// TEST 3: Manor upgrade requires stone_blocks
// ================================================================
heading('Manor Upgrade Cost');
{
  const upgrade = UPGRADE_PATHS['house'];
  assert(upgrade !== undefined, 'house has upgrade path');
  if (upgrade) {
    assert(upgrade.to === 'manor', 'house upgrades to manor');
    assert(upgrade.cost.stone_blocks !== undefined && upgrade.cost.stone_blocks > 0,
      `manor upgrade requires stone_blocks: ${upgrade.cost.stone_blocks}`);
  }
}

// ================================================================
// TEST 4: Large storehouse requires stone_blocks
// ================================================================
heading('Large Storehouse Cost');
{
  const upgrade = UPGRADE_PATHS['storehouse'];
  assert(upgrade !== undefined, 'storehouse has upgrade path');
  if (upgrade) {
    assert(upgrade.to === 'large_storehouse', 'upgrades to large_storehouse');
    assert(upgrade.cost.stone_blocks !== undefined && upgrade.cost.stone_blocks > 0,
      `large_storehouse upgrade requires stone_blocks: ${upgrade.cost.stone_blocks}`);
  }
}

// ================================================================
// TEST 5: Can place reinforced_wall with stone_blocks
// ================================================================
heading('Place With Stone Blocks');
{
  let state = makeWorld();
  const bCount = state.buildings.length;
  state = placeBuilding(state, 'reinforced_wall', 1, 1);
  assert(state.buildings.length > bCount, 'reinforced_wall placed with stone_blocks available');
}

// ================================================================
// TEST 6: Cannot place reinforced_wall without stone_blocks
// ================================================================
heading('Cannot Place Without Stone Blocks');
{
  let state = makeWorld();
  state.resources = { ...state.resources, stone_blocks: 0 };
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'storehouse'
        ? { ...b, localBuffer: { ...b.localBuffer, stone_blocks: 0 } }
        : b),
  };
  const bCount = state.buildings.length;
  state = placeBuilding(state, 'reinforced_wall', 1, 1);
  assert(state.buildings.length === bCount, 'cannot place reinforced_wall without stone_blocks');
}

// ================================================================
// TEST 7: stone_blocks cost deducted on placement
// ================================================================
heading('Cost Deduction');
{
  let state = makeWorld();
  const blocksBefore = state.resources.stone_blocks;
  state = placeBuilding(state, 'reinforced_wall', 1, 1);
  const blocksAfter = state.resources.stone_blocks;
  assert(blocksBefore > blocksAfter, `stone_blocks deducted: ${blocksBefore} → ${blocksAfter}`);
}

// ================================================================
// TEST 8: Fountain requires stone_blocks
// ================================================================
heading('Fountain Cost');
{
  const template = BUILDING_TEMPLATES['fountain'];
  assert(template.cost.stone_blocks !== undefined && template.cost.stone_blocks > 0,
    `fountain requires stone_blocks: ${template.cost.stone_blocks}`);
}

// ================================================================
// TEST 9: Statue requires stone_blocks
// ================================================================
heading('Statue Cost');
{
  const template = BUILDING_TEMPLATES['statue'];
  assert(template.cost.stone_blocks !== undefined && template.cost.stone_blocks > 0,
    `statue requires stone_blocks: ${template.cost.stone_blocks}`);
}

// ================================================================
// Summary
// ================================================================
console.log(`\nstone_blocks_integration: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
