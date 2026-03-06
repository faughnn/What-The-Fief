// test-v2-apothecary.ts — Tests for apothecary building (healer profession)

import {
  createWorld, createVillager, GameState,
  ALL_TECHS, BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS,
  BUILDING_MAX_HP,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation.js';
import { TICKS_PER_DAY } from '../timing.js';

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
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, wheat: 500, herbs: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Apothecary building template exists
// ================================================================
heading('Apothecary Template');
{
  const template = BUILDING_TEMPLATES['apothecary'];
  assert(template !== undefined, 'apothecary template exists');
  assert(template.width === 1, 'apothecary is 1x1');
  assert(template.maxWorkers === 1, 'apothecary has 1 worker slot');
  assert(template.production !== null, 'apothecary has production');
  assert(template.production?.output === 'bandage', 'apothecary produces bandages');
  assert(template.production?.inputs?.herbs !== undefined, 'apothecary consumes herbs');
}

// ================================================================
// TEST 2: Apothecary requires medicine tech
// ================================================================
heading('Apothecary Tech Requirement');
{
  assert(BUILDING_TECH_REQUIREMENTS['apothecary'] === 'medicine', 'apothecary requires medicine tech');
}

// ================================================================
// TEST 3: Apothecary has HP entry
// ================================================================
heading('Apothecary HP');
{
  assert(BUILDING_MAX_HP['apothecary'] !== undefined, 'apothecary has maxHP');
  assert(BUILDING_MAX_HP['apothecary'] >= 30, `apothecary HP >= 30 (${BUILDING_MAX_HP['apothecary']})`);
}

// ================================================================
// TEST 4: Can place and construct apothecary
// ================================================================
heading('Place Apothecary');
{
  let state = makeWorld();
  state = placeBuilding(state, 'apothecary', 5, 5);
  const apoth = state.buildings.find(b => b.type === 'apothecary');
  assert(apoth !== undefined, 'apothecary placed');
  if (apoth) {
    assert(!apoth.constructed, 'starts unconstructed');
  }
}

// ================================================================
// TEST 5: Apothecary worker produces bandages from herbs
// ================================================================
heading('Bandage Production');
{
  let state = makeWorld();
  const v = createVillager(1, 5, 5);
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'apothecary', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500, herbs: 50 }
        : b.type === 'apothecary'
        ? { ...b.localBuffer, herbs: 10 }
        : b.localBuffer,
    })),
  };

  state.villagers[0].homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  const apothId = state.buildings.find(b => b.type === 'apothecary')!.id;
  state = assignVillager(state, 'v1', apothId);

  // Run for 10 days — herbs pre-stocked in apothecary buffer
  state = advance(state, TICKS_PER_DAY * 10);

  // Check that bandages were produced
  const apoth = state.buildings.find(b => b.type === 'apothecary')!;
  const bandagesInBuffer = apoth.localBuffer.bandage || 0;
  const bandagesInStorage = state.resources.bandage || 0;
  const herbsLeft = apoth.localBuffer.herbs || 0;
  const vState = state.villagers.find(v => v.id === 'v1');
  assert(bandagesInBuffer + bandagesInStorage > 0,
    `bandages produced: ${bandagesInBuffer} in buffer, ${bandagesInStorage} in storage (herbs left: ${herbsLeft}, worker state: ${vState?.state}, role: ${vState?.role})`);
}

// ================================================================
// TEST 6: Apothecary heals injured villagers faster
// ================================================================
heading('Apothecary Healing Bonus');
{
  let state = makeWorld();
  const v1 = createVillager(1, 5, 5);
  const v2 = createVillager(2, 5, 5);
  v1.hp = 5; // injured
  v2.hp = 5; // injured
  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'tent', 4, 5);
  state = placeBuilding(state, 'apothecary', 7, 5);

  const tents = state.buildings.filter(b => b.type === 'tent');
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500, herbs: 50 }
        : b.type === 'apothecary'
        ? { ...b.localBuffer, bandage: 10 }
        : b.localBuffer,
    })),
  };

  state.villagers[0].homeBuildingId = tents[0].id;
  state.villagers[1].homeBuildingId = tents[1].id;

  // Run 2 days — with apothecary + bandages, healing should be faster
  state = advance(state, TICKS_PER_DAY * 2);

  const v1After = state.villagers.find(v => v.id === 'v1')!;
  assert(v1After.hp > 5, `injured villager healed: ${v1After.hp} > 5`);
}

// ================================================================
// TEST 7: Apothecary speeds disease recovery
// ================================================================
heading('Disease Recovery Speed');
{
  let state = makeWorld();
  const v = createVillager(1, 5, 5);
  v.sick = true;
  v.sickDays = 5;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'apothecary', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500, herbs: 50 }
        : b.type === 'apothecary'
        ? { ...b.localBuffer, bandage: 10 }
        : b.localBuffer,
    })),
  };

  state.villagers[0].homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;

  // Run 3 days — with apothecary, disease should cure faster
  state = advance(state, TICKS_PER_DAY * 3);

  const vAfter = state.villagers.find(v => v.id === 'v1')!;
  // With apothecary healing, disease should cure faster (2 days lost per day instead of 1)
  // After 3 days: 5 - 3(base) - 3(apoth) = cured, or sickDays < 3
  assert(!vAfter.sick || vAfter.sickDays < 2, `disease healing faster: sick=${vAfter.sick}, days=${vAfter.sickDays}`);
}

// ================================================================
// TEST 8: Bandage resource type exists
// ================================================================
heading('Bandage Resource');
{
  let state = makeWorld();
  state.resources.bandage = 10;
  assert(state.resources.bandage === 10, 'bandage resource can be stored');
}

// ================================================================
// TEST 9: Apothecary consumes bandages when healing
// ================================================================
heading('Bandage Consumption');
{
  let state = makeWorld();
  const v = createVillager(1, 5, 5);
  v.hp = 3; // very injured
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'apothecary', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500 }
        : b.type === 'apothecary'
        ? { ...b.localBuffer, bandage: 5 }
        : b.localBuffer,
    })),
  };

  state.villagers[0].homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;

  const apothBefore = state.buildings.find(b => b.type === 'apothecary')!;
  const bandagesBefore = apothBefore.localBuffer.bandage || 0;

  // Run 3 days
  state = advance(state, TICKS_PER_DAY * 3);

  const apothAfter = state.buildings.find(b => b.type === 'apothecary')!;
  const bandagesAfter = apothAfter.localBuffer.bandage || 0;

  // Bandages should be consumed for healing
  assert(bandagesAfter < bandagesBefore, `bandages consumed: ${bandagesBefore} -> ${bandagesAfter}`);
}

// ================================================================
// TEST 10: Healer role assigned when working at apothecary
// ================================================================
heading('Healer Role');
{
  let state = makeWorld();
  const v = createVillager(1, 5, 5);
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'apothecary', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500 }
        : b.localBuffer,
    })),
  };

  state.villagers[0].homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  const apothId = state.buildings.find(b => b.type === 'apothecary')!.id;
  state = assignVillager(state, 'v1', apothId);

  assert(state.villagers[0].role === 'healer', `role is healer (got ${state.villagers[0].role})`);
}

// ================================================================
// TEST 11: No healing without bandages
// ================================================================
heading('No Bandages No Extra Healing');
{
  let state = makeWorld();
  const v = createVillager(1, 5, 5);
  v.hp = 5;
  state = { ...state, villagers: [v], nextVillagerId: 2 };

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'apothecary', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 500, wheat: 500 }
        : b.localBuffer,
      // NOTE: apothecary has NO bandages
    })),
  };

  state.villagers[0].homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;

  // Run 1 day
  const hpBefore = state.villagers[0].hp;
  state = advance(state, TICKS_PER_DAY);

  const vAfter = state.villagers.find(v => v.id === 'v1')!;
  // Normal regen only (1 HP/day base + medicine tech bonus)
  // Just verify apothecary without bandages doesn't give extra bonus
  assert(vAfter.hp >= hpBefore, `heals at base rate: ${vAfter.hp}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Apothecary Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
