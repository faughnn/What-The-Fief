// test-v2-inn.ts — Inn building: upgraded tavern, housing, festivals, morale visits

import {
  createWorld, GameState, TICKS_PER_DAY, BUILDING_TEMPLATES, HOUSING_INFO,
  TAVERN_MORALE_THRESHOLD, TAVERN_MORALE_BOOST,
  FESTIVAL_MORALE_BOOST, FESTIVAL_DURATION, FESTIVAL_FOOD_COST, FESTIVAL_GOLD_COST,
} from '../world.js';
import { tick, placeBuilding, assignVillager, upgradeBuilding, holdFestival } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function makeInnWorld(): GameState {
  let state = createWorld(20, 20, 2);
  state.fog = state.fog.map(row => row.map(() => true));
  state.territory = state.territory.map(row => row.map(() => true));
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
    }
  }
  // Give plenty of resources
  state.resources = { ...state.resources, wood: 200, stone: 200, food: 200, gold: 100, planks: 50, rope: 20 };
  // Place storehouse and pre-construct
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { food: 200, wood: 200, stone: 200, gold: 100, planks: 50, rope: 20 } : b.localBuffer,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } } : tile
    )),
  };
  return state;
}

// ========================
// INN TEMPLATE
// ========================

console.log('\n=== Inn: template exists ===');
{
  const template = BUILDING_TEMPLATES['inn'];
  assert(template !== undefined, 'Inn template exists');
  assert(template.width === 2 && template.height === 2, `Inn is 2x2 (${template.width}x${template.height})`);
}

console.log('\n=== Inn: housing info ===');
{
  const info = HOUSING_INFO['inn'];
  assert(info !== undefined, 'Inn has housing info');
  if (info) {
    assert(info.capacity === 4, `Inn houses 4 villagers (got ${info.capacity})`);
    assert(info.morale === 15, `Inn gives +15 morale (got ${info.morale})`);
  }
}

// ========================
// INN PLACEMENT
// ========================

console.log('\n=== Inn: can place and construct ===');
{
  let state = makeInnWorld();
  state = placeBuilding(state, 'inn', 10, 10);
  const inn = state.buildings.find(b => b.type === 'inn');
  assert(inn !== undefined, 'Inn building placed');
  if (inn) {
    assert(inn.constructed === false, 'Inn requires construction');
    assert(inn.width === 2 && inn.height === 2, 'Inn occupies 2x2');
  }
}

// ========================
// UPGRADE FROM TAVERN
// ========================

console.log('\n=== Inn: upgrade from tavern ===');
{
  let state = makeInnWorld();
  state = placeBuilding(state, 'tavern', 10, 10);
  // Pre-construct the tavern
  state = {
    ...state,
    buildings: state.buildings.map(b => b.type === 'tavern' ? {
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    } : b),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'tavern' ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } } : tile
    )),
  };
  const tavern = state.buildings.find(b => b.type === 'tavern');
  assert(tavern !== undefined, 'Tavern placed');
  if (tavern) {
    state = upgradeBuilding(state, tavern.id);
    const inn = state.buildings.find(b => b.type === 'inn');
    assert(inn !== undefined, 'Tavern upgraded to inn');
  }
}

// ========================
// INN WORKS AS TAVERN FOR FESTIVALS
// ========================

console.log('\n=== Inn: festival works with inn (no tavern) ===');
{
  let state = makeInnWorld();
  state = placeBuilding(state, 'inn', 10, 10);
  // Pre-construct the inn
  state = {
    ...state,
    buildings: state.buildings.map(b => b.type === 'inn' ? {
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    } : b),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'inn' ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } } : tile
    )),
  };
  // Ensure we have food+gold in storehouse buffer for festival
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.food = 200;
  sh.localBuffer.gold = 100;
  state.resources.food = 200;
  state.resources.gold = 100;

  const result = holdFestival(state);
  assert(result !== state, 'Festival accepted with inn (no tavern needed)');
  if (result !== state) {
    const currentDay = Math.floor(result.tick / TICKS_PER_DAY);
    assert(result.lastFestivalDay === currentDay, `Festival day recorded (${result.lastFestivalDay} === ${currentDay})`);
  }
}

// ========================
// INN WORKS AS TAVERN FOR MORALE VISITS
// ========================

console.log('\n=== Inn: villager visits inn for morale (no tavern) ===');
{
  let state = makeInnWorld();
  state = placeBuilding(state, 'inn', 8, 8);
  state = placeBuilding(state, 'tent', 7, 7);
  // Pre-construct everything
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } } : tile
    )),
  };
  // Set up villager with low morale near the inn
  const v = state.villagers[0];
  v.x = 8; v.y = 8;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v.morale = TAVERN_MORALE_THRESHOLD - 10; // Below threshold → should visit
  v.tavernVisitCooldown = 0;
  v.state = 'idle';
  v.food = 8;

  // Tick many times to let villager visit
  for (let t = 0; t < TICKS_PER_DAY; t++) {
    state = tick(state);
  }

  // Villager should have gained morale from the inn visit
  const vAfter = state.villagers.find(vv => vv.id === v.id)!;
  // Either they visited (morale boosted) or they traveled toward the inn
  const visitedInn = vAfter.morale > (TAVERN_MORALE_THRESHOLD - 10) || vAfter.state === 'traveling_to_tavern' || vAfter.state === 'relaxing';
  assert(visitedInn, `Villager engaged with inn (morale=${vAfter.morale}, state=${vAfter.state})`);
}

// ========================
// INN HOUSING
// ========================

console.log('\n=== Inn: housing capacity is 4 ===');
{
  const innInfo = HOUSING_INFO['inn']!;
  assert(innInfo.capacity === 4, `Inn capacity is 4 (got ${innInfo.capacity})`);
  assert(innInfo.morale === 15, `Inn morale bonus is 15 (got ${innInfo.morale})`);
  // Housing morale > house(10) and > manor(15) tied — inn is a tavern upgrade with lodging
  assert(innInfo.morale >= 15, 'Inn morale >= house morale');
}

// ========================
// SUMMARY
// ========================

console.log(`\n========================================`);
console.log(`V2 Inn Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
