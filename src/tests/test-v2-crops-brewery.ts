// test-v2-crops-brewery.ts — Tests for crop variety (barley, vegetables) and brewery (ale production)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, BUILDING_SKILL_MAP, OUTDOOR_BUILDINGS, FOOD_PRIORITY,
  TAVERN_MORALE_BOOST, ALE_MORALE_BONUS, TRADE_PRICES,
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
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, rope: 50, ingots: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  // Place storehouse + tent
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = placeBuilding(state, 'tent', 7, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { wood: 200, stone: 200, food: 200, rope: 50 }
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
// BARLEY FIELD TEMPLATE
// ================================================================
heading('Barley Field Template');
{
  const template = BUILDING_TEMPLATES['barley_field'];
  assert(template !== undefined, 'barley_field template exists');
  if (template) {
    assert(template.width === 2, 'barley_field is 2x2 width');
    assert(template.height === 2, 'barley_field is 2x2 height');
    assert(template.maxWorkers === 2, 'barley_field has 2 workers');
    assert(template.production !== null, 'barley_field has production');
    if (template.production) {
      assert(template.production.output === 'barley', 'produces barley');
      assert(template.production.amountPerWorker === 3, '3 barley per worker');
      assert(template.production.inputs === null, 'no inputs (primary production)');
    }
  }
}

heading('Barley Field Properties');
{
  assert(OUTDOOR_BUILDINGS.includes('barley_field'), 'barley_field is outdoor (weather affected)');
  assert(BUILDING_SKILL_MAP['barley_field'] === 'farming', 'barley_field uses farming skill');
  assert(BUILDING_TECH_REQUIREMENTS['barley_field'] === 'crop_rotation', 'barley_field requires crop_rotation');
  assert(BUILDING_MAX_HP['barley_field'] !== undefined, 'barley_field has HP entry');
}

heading('Barley Is Food');
{
  const barleyFood = FOOD_PRIORITY.find(f => f.resource === 'barley');
  assert(barleyFood !== undefined, 'barley is in FOOD_PRIORITY');
  if (barleyFood) {
    assert(barleyFood.satisfaction === 0.8, 'barley has low satisfaction (0.8) — mainly for brewing');
  }
}

heading('Barley Field Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'barley_field', 8, 8);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'barley_field'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
  };
  const bfId = state.buildings.find(b => b.type === 'barley_field')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  const v1 = createVillager(1, 8, 8);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', bfId);

  state = advance(state, TICKS_PER_DAY * 2);

  const field = state.buildings.find(b => b.type === 'barley_field')!;
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const totalBarley = (field.localBuffer.barley || 0) + (sh.localBuffer.barley || 0);
  assert(totalBarley > 0, `barley field produces barley (got ${totalBarley})`);
}

// ================================================================
// VEGETABLE GARDEN TEMPLATE
// ================================================================
heading('Vegetable Garden Template');
{
  const template = BUILDING_TEMPLATES['vegetable_garden'];
  assert(template !== undefined, 'vegetable_garden template exists');
  if (template) {
    assert(template.width === 1, 'vegetable_garden is 1x1');
    assert(template.height === 1, 'vegetable_garden is 1x1 height');
    assert(template.maxWorkers === 1, 'vegetable_garden has 1 worker');
    assert(template.production !== null, 'vegetable_garden has production');
    if (template.production) {
      assert(template.production.output === 'vegetables', 'produces vegetables');
      assert(template.production.amountPerWorker === 3, '3 vegetables per worker');
      assert(template.production.inputs === null, 'no inputs (primary production)');
    }
  }
}

heading('Vegetable Garden Properties');
{
  assert(OUTDOOR_BUILDINGS.includes('vegetable_garden'), 'vegetable_garden is outdoor');
  assert(BUILDING_SKILL_MAP['vegetable_garden'] === 'farming', 'vegetable_garden uses farming skill');
  assert(BUILDING_TECH_REQUIREMENTS['vegetable_garden'] === 'crop_rotation', 'vegetable_garden requires crop_rotation');
  assert(BUILDING_MAX_HP['vegetable_garden'] !== undefined, 'vegetable_garden has HP entry');
}

heading('Vegetables Are Food');
{
  const vegFood = FOOD_PRIORITY.find(f => f.resource === 'vegetables');
  assert(vegFood !== undefined, 'vegetables is in FOOD_PRIORITY');
  if (vegFood) {
    assert(vegFood.satisfaction === 1.3, 'vegetables have decent satisfaction (1.3)');
  }
}

heading('Vegetable Garden Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'vegetable_garden', 8, 8);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'vegetable_garden'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
  };
  const vgId = state.buildings.find(b => b.type === 'vegetable_garden')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  const v1 = createVillager(1, 8, 8);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', vgId);

  state = advance(state, TICKS_PER_DAY * 2);

  const garden = state.buildings.find(b => b.type === 'vegetable_garden')!;
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const totalVeg = (garden.localBuffer.vegetables || 0) + (sh.localBuffer.vegetables || 0);
  assert(totalVeg > 0, `vegetable garden produces vegetables (got ${totalVeg})`);
}

// ================================================================
// BREWERY TEMPLATE
// ================================================================
heading('Brewery Template');
{
  const template = BUILDING_TEMPLATES['brewery'];
  assert(template !== undefined, 'brewery template exists');
  if (template) {
    assert(template.width === 1, 'brewery is 1x1');
    assert(template.height === 1, 'brewery is 1x1 height');
    assert(template.maxWorkers === 1, 'brewery has 1 worker');
    assert(template.production !== null, 'brewery has production');
    if (template.production) {
      assert(template.production.output === 'ale', 'produces ale');
      assert(template.production.amountPerWorker === 2, '2 ale per worker');
      assert(template.production.inputs !== null, 'requires inputs');
      if (template.production.inputs) {
        assert(template.production.inputs.barley === 2, 'requires 2 barley per cycle');
      }
    }
  }
}

heading('Brewery Properties');
{
  assert(!OUTDOOR_BUILDINGS.includes('brewery'), 'brewery is NOT outdoor');
  assert(BUILDING_SKILL_MAP['brewery'] === 'cooking', 'brewery uses cooking skill');
  assert(BUILDING_TECH_REQUIREMENTS['brewery'] === 'basic_cooking', 'brewery requires basic_cooking');
  assert(BUILDING_MAX_HP['brewery'] !== undefined, 'brewery has HP entry');
}

heading('Brewery Production');
{
  let state = makeWorld();
  state = placeBuilding(state, 'brewery', 8, 8);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'brewery'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
  };
  // Stock barley in storehouse
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.barley = 50;
  state.resources.barley = 50;

  const brewId = state.buildings.find(b => b.type === 'brewery')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  const v1 = createVillager(1, 8, 8);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', brewId);

  state = advance(state, TICKS_PER_DAY * 2);

  const brewery = state.buildings.find(b => b.type === 'brewery')!;
  const shAfter = state.buildings.find(b => b.type === 'storehouse')!;
  const aleProduced = (brewery.localBuffer.ale || 0) + (shAfter.localBuffer.ale || 0);
  assert(aleProduced > 0, `brewery produces ale from barley (got ${aleProduced})`);
}

heading('Brewery Needs Barley');
{
  let state = makeWorld();
  state = placeBuilding(state, 'brewery', 8, 8);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'brewery'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
  };
  // No barley — should produce nothing
  const brewId = state.buildings.find(b => b.type === 'brewery')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  const v1 = createVillager(1, 8, 8);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', brewId);

  state = advance(state, TICKS_PER_DAY * 2);

  const brewery = state.buildings.find(b => b.type === 'brewery')!;
  const aleProduced = brewery.localBuffer.ale || 0;
  assert(aleProduced === 0, `brewery produces nothing without barley (got ${aleProduced})`);
}

// ================================================================
// ALE TAVERN INTEGRATION
// ================================================================
heading('Ale Boosts Tavern Visit');
{
  let state = makeWorld();
  state = placeBuilding(state, 'tavern', 3, 3);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
    })),
  };
  // Stock ale and food in storehouse
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.ale = 10;
  state.resources.ale = 10;
  sh.localBuffer.food = 50;

  // Create villager at tavern with low morale — set tick to daytime
  state.tick = TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.5); // mid-day, not night
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const v1 = createVillager(1, 3, 3);
  v1.morale = 30;
  v1.state = 'relaxing';
  v1.tavernVisitCooldown = 0;
  v1.food = 8;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };

  const initialAle = state.resources.ale;
  state = advance(state, 1);

  const aleAfter = state.resources.ale;
  assert(aleAfter < initialAle, `ale consumed during tavern visit (${initialAle} -> ${aleAfter})`);

  // Villager should get TAVERN_MORALE_BOOST + ALE_MORALE_BONUS
  const villager = state.villagers[0];
  const expectedMorale = Math.min(100, 30 + TAVERN_MORALE_BOOST + ALE_MORALE_BONUS);
  assert(villager.morale === expectedMorale, `morale = ${expectedMorale} with ale (got ${villager.morale})`);
}

heading('Tavern Without Ale');
{
  let state = makeWorld();
  state = placeBuilding(state, 'tavern', 3, 3);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b,
      constructed: true,
      constructionProgress: b.constructionRequired,
    })),
  };
  // No ale, just food
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.food = 50;

  // Set tick to daytime
  state.tick = TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.5);
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;
  const v1 = createVillager(1, 3, 3);
  v1.morale = 30;
  v1.state = 'relaxing';
  v1.tavernVisitCooldown = 0;
  v1.food = 8;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };

  state = advance(state, 1);

  const villager = state.villagers[0];
  const expectedMorale = Math.min(100, 30 + TAVERN_MORALE_BOOST);
  assert(villager.morale === expectedMorale, `morale = ${expectedMorale} without ale (got ${villager.morale})`);
}

heading('Ale Not Food');
{
  const aleFood = FOOD_PRIORITY.find(f => f.resource === 'ale');
  assert(aleFood === undefined, 'ale is NOT in FOOD_PRIORITY (luxury, not food)');
}

// ================================================================
// SEASONAL EFFECTS ON CROPS
// ================================================================
heading('Barley Field Winter');
{
  let state = makeWorld();
  state = placeBuilding(state, 'barley_field', 8, 8);
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'barley_field'
        ? { ...b, constructed: true, constructionProgress: b.constructionRequired }
        : b),
  };
  const bfId = state.buildings.find(b => b.type === 'barley_field')!.id;
  const tentId = state.buildings.find(b => b.type === 'tent')!.id;

  const v1 = createVillager(1, 8, 8);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tentId;
  state = { ...state, villagers: [v1], nextVillagerId: 2 };
  state = assignVillager(state, 'v1', bfId);

  state.season = 'winter';
  const barleyBefore = (state.buildings.find(b => b.type === 'barley_field')!.localBuffer.barley || 0);
  state = advance(state, TICKS_PER_DAY);
  const barleyAfter = (state.buildings.find(b => b.type === 'barley_field')!.localBuffer.barley || 0);
  assert(barleyAfter === barleyBefore, 'barley field produces nothing in winter');
}

// ================================================================
// TRADE PRICES
// ================================================================
heading('Trade Prices');
{
  assert(TRADE_PRICES['barley'] !== undefined, 'barley has trade price');
  assert(TRADE_PRICES['vegetables'] !== undefined, 'vegetables has trade price');
  assert(TRADE_PRICES['ale'] !== undefined, 'ale has trade price');
  if (TRADE_PRICES['ale']) {
    assert(TRADE_PRICES['ale']!.sell > (TRADE_PRICES['barley']?.sell || 0), 'ale sells for more than barley (value-added)');
  }
}

// ================================================================
// FOOD VARIETY
// ================================================================
heading('Crop Variety Adds to Food Diversity');
{
  const foodTypes = FOOD_PRIORITY.map(f => f.resource);
  assert(foodTypes.includes('barley'), 'barley in food priority list');
  assert(foodTypes.includes('vegetables'), 'vegetables in food priority list');
  assert(foodTypes.includes('wheat'), 'wheat still in food priority list');
  assert(foodTypes.length >= 10, `food variety has ${foodTypes.length} types (expected >= 10)`);
}

// ================================================================
// SUMMARY
// ================================================================
console.log(`\nCrops & Brewery: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
