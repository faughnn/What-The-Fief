// test-v2-weapon-rack.ts — Tests for weapon rack building

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP, WEAPON_RACK_RANGE, WEAPON_RACK_BUFFER,
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
  const state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, wheat: 500, ingots: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advanceDays(state: GameState, days: number): GameState {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Weapon rack template exists
// ================================================================
heading('Weapon Rack Template');
{
  const template = BUILDING_TEMPLATES['weapon_rack'];
  assert(template !== undefined, 'weapon_rack template exists');
  if (template) {
    assert(template.width === 1, 'weapon_rack is 1x1');
    assert(template.maxWorkers === 0, 'weapon_rack has no workers (passive)');
    assert(template.production === null, 'weapon_rack has no production');
  }
}

// ================================================================
// TEST 2: Weapon rack tech requirement
// ================================================================
heading('Tech Requirement');
{
  const req = BUILDING_TECH_REQUIREMENTS['weapon_rack'];
  assert(req !== undefined, `weapon_rack has tech requirement: ${req}`);
  assert(req === 'military_tactics', 'requires military_tactics');
}

// ================================================================
// TEST 3: Weapon rack has HP
// ================================================================
heading('HP Entry');
{
  assert(BUILDING_MAX_HP['weapon_rack'] !== undefined, 'weapon_rack has maxHP');
  assert(BUILDING_MAX_HP['weapon_rack'] >= 20, `HP >= 20 (${BUILDING_MAX_HP['weapon_rack']})`);
}

// ================================================================
// TEST 4: Weapon rack has construction ticks
// ================================================================
heading('Construction');
{
  assert(CONSTRUCTION_TICKS['weapon_rack'] !== undefined, 'has construction ticks');
  assert(CONSTRUCTION_TICKS['weapon_rack'] > 0, `ticks > 0 (${CONSTRUCTION_TICKS['weapon_rack']})`);
}

// ================================================================
// TEST 5: Constants
// ================================================================
heading('Constants');
{
  assert(WEAPON_RACK_RANGE >= 3, `range >= 3 (${WEAPON_RACK_RANGE})`);
  assert(WEAPON_RACK_BUFFER >= 20, `buffer >= 20 (${WEAPON_RACK_BUFFER})`);
}

// ================================================================
// TEST 6: Can place weapon rack
// ================================================================
heading('Place Weapon Rack');
{
  let state = makeWorld();
  state = placeBuilding(state, 'weapon_rack', 5, 5);
  const rack = state.buildings.find(b => b.type === 'weapon_rack');
  assert(rack !== undefined, 'weapon_rack placed');
}

// ================================================================
// TEST 7: Guard equips weapon from weapon rack buffer
// ================================================================
heading('Guard Equips From Rack');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'weapon_rack', 6, 5);
  state = placeBuilding(state, 'watchtower', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500 }
        : b.type === 'weapon_rack'
        ? { ...b.localBuffer, sword: 3 }
        : b.localBuffer,
    })),
  };
  // No weapons in storehouse — only in weapon rack
  state.resources.sword = 0;

  const v = createVillager(1, 7, 5);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v], nextVillagerId: 2 };
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;
  state = assignVillager(state, 'v1', towerId);

  // Run 1 day — guard should equip from weapon rack
  state = advanceDays(state, 1);

  const guard = state.villagers[0];
  assert(guard.weapon === 'sword', `guard equipped sword from rack (got ${guard.weapon})`);

  // Weapon rack should have 1 less sword
  const rack = state.buildings.find(b => b.type === 'weapon_rack')!;
  assert((rack.localBuffer.sword || 0) < 3, `rack consumed sword (${rack.localBuffer.sword || 0} remaining)`);
}

// ================================================================
// TEST 8: Guard equips armor from weapon rack
// ================================================================
heading('Guard Equips Armor From Rack');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'weapon_rack', 6, 5);
  state = placeBuilding(state, 'watchtower', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500 }
        : b.type === 'weapon_rack'
        ? { ...b.localBuffer, iron_armor: 2 }
        : b.localBuffer,
    })),
  };
  state.resources.iron_armor = 0;
  state.resources.leather_armor = 0;

  const v = createVillager(1, 7, 5);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v], nextVillagerId: 2 };
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;
  state = assignVillager(state, 'v1', towerId);

  state = advanceDays(state, 1);

  const guard = state.villagers[0];
  assert(guard.armor === 'iron_armor', `guard equipped iron_armor from rack (got ${guard.armor})`);
}

// ================================================================
// TEST 9: Guard out of range doesn't equip from rack
// ================================================================
heading('Out of Range');
{
  let state = makeWorld();
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'weapon_rack', 1, 1); // far away
  state = placeBuilding(state, 'watchtower', 15, 15); // far from rack

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500 }
        : b.type === 'weapon_rack'
        ? { ...b.localBuffer, sword: 5 }
        : b.localBuffer,
    })),
  };
  state.resources.sword = 0;

  const v = createVillager(1, 15, 15);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state = { ...state, villagers: [v], nextVillagerId: 2 };
  const towerId = state.buildings.find(b => b.type === 'watchtower')!.id;
  state = assignVillager(state, 'v1', towerId);

  state = advanceDays(state, 1);

  const guard = state.villagers[0];
  assert(guard.weapon === 'none', `guard NOT equipped (too far from rack): ${guard.weapon}`);

  // Rack should still have all swords
  const rack = state.buildings.find(b => b.type === 'weapon_rack')!;
  assert((rack.localBuffer.sword || 0) === 5, `rack still full (${rack.localBuffer.sword || 0})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Weapon Rack Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
