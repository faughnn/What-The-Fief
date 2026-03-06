// test-v2-cottage.ts — Tests for cottage housing tier

import {
  createWorld, GameState,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, HOUSING_INFO, HOUSING_COMFORT,
  UPGRADE_PATHS, ALL_TECHS,
} from '../world.js';
import { placeBuilding, upgradeBuilding } from '../simulation/index.js';

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
  state.resources = { ...state.resources, wood: 200, stone: 200, food: 200, planks: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

// ================================================================
// TEST 1: Cottage template exists
// ================================================================
heading('Cottage Template');
{
  const t = BUILDING_TEMPLATES.cottage;
  assert(t !== undefined, 'cottage template exists');
  assert(t.cost.wood === 6, `costs 6 wood (${t.cost.wood})`);
  assert(t.maxWorkers === 0, 'no workers');
  assert(BUILDING_MAX_HP.cottage === 35, `HP is 35 (${BUILDING_MAX_HP.cottage})`);
}

// ================================================================
// TEST 2: Cottage housing info
// ================================================================
heading('Cottage Housing');
{
  const info = HOUSING_INFO.cottage;
  assert(info !== undefined, 'cottage has housing info');
  assert(info!.capacity === 2, `capacity 2 (${info!.capacity})`);
  assert(info!.morale === 5, `morale bonus 5 (${info!.morale})`);
  assert(HOUSING_COMFORT.cottage === 1, `comfort level 1 (${HOUSING_COMFORT.cottage})`);
}

// ================================================================
// TEST 3: Upgrade path tent → cottage → house → manor
// ================================================================
heading('Upgrade Path');
{
  assert(UPGRADE_PATHS.tent?.to === 'cottage', `tent upgrades to cottage (${UPGRADE_PATHS.tent?.to})`);
  assert(UPGRADE_PATHS.cottage?.to === 'house', `cottage upgrades to house (${UPGRADE_PATHS.cottage?.to})`);
  assert(UPGRADE_PATHS.house?.to === 'manor', `house upgrades to manor (${UPGRADE_PATHS.house?.to})`);
}

// ================================================================
// TEST 4: Can place and upgrade tent → cottage
// ================================================================
heading('Tent to Cottage Upgrade');
{
  let state = makeWorld();
  state = placeBuilding(state, 'tent', 5, 5);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state = upgradeBuilding(state, tent.id);
  const cottage = state.buildings.find(b => b.x === 5 && b.y === 5 && b.type === 'cottage');
  assert(cottage !== undefined, 'tent upgraded to cottage');
}

// ================================================================
// TEST 5: Can upgrade cottage → house
// ================================================================
heading('Cottage to House Upgrade');
{
  let state = makeWorld();
  state = placeBuilding(state, 'tent', 5, 5); // tent first (instant)
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state = upgradeBuilding(state, tent.id); // tent → cottage
  const cottage = state.buildings.find(b => b.type === 'cottage')!;
  cottage.constructed = true; cottage.hp = cottage.maxHp;

  state = upgradeBuilding(state, cottage.id); // cottage → house
  const house = state.buildings.find(b => b.x === 5 && b.y === 5 && b.type === 'house');
  assert(house !== undefined, 'cottage upgraded to house');
}

// ================================================================
// TEST 6: Housing stats are between tent and house
// ================================================================
heading('Cottage Stats Between Tent and House');
{
  const tentInfo = HOUSING_INFO.tent!;
  const cottageInfo = HOUSING_INFO.cottage!;
  const houseInfo = HOUSING_INFO.house!;

  assert(cottageInfo.capacity >= tentInfo.capacity, `capacity >= tent (${cottageInfo.capacity} >= ${tentInfo.capacity})`);
  assert(cottageInfo.capacity <= houseInfo.capacity, `capacity <= house (${cottageInfo.capacity} <= ${houseInfo.capacity})`);
  assert(cottageInfo.morale > tentInfo.morale, `morale > tent (${cottageInfo.morale} > ${tentInfo.morale})`);
  assert(cottageInfo.morale < houseInfo.morale, `morale < house (${cottageInfo.morale} < ${houseInfo.morale})`);

  assert(BUILDING_MAX_HP.cottage > BUILDING_MAX_HP.tent, `HP > tent (${BUILDING_MAX_HP.cottage} > ${BUILDING_MAX_HP.tent})`);
  assert(BUILDING_MAX_HP.cottage < BUILDING_MAX_HP.house, `HP < house (${BUILDING_MAX_HP.cottage} < ${BUILDING_MAX_HP.house})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Cottage Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
