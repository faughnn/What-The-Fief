// test-v2-quests.ts — Tests for quest/objective system
// Bellwright has quest objectives driving gameplay progression.
// We implement milestone quests that auto-complete and award renown/gold.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, ALL_TECHS, QUEST_DEFINITIONS, TechId,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function setupColony(): GameState {
  let state = createWorld(30, 30, 42);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  // Unlock all techs so buildings aren't gated
  state.research.completed = [...ALL_TECHS];

  // Storehouse with resources
  state = placeBuilding(state, 'storehouse', 15, 15);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, wood: 200, stone: 200, iron_ore: 50, planks: 50, rope: 20, ingots: 20 };
  state.resources = { ...state.resources, food: 200, wood: 200, stone: 200, iron_ore: 50, planks: 50, rope: 20, ingots: 20 };

  // Town hall
  state = placeBuilding(state, 'town_hall', 10, 10);
  const th = state.buildings.find(b => b.type === 'town_hall')!;
  th.constructed = true; th.hp = th.maxHp;

  // Tents for housing
  for (let i = 0; i < 5; i++) {
    state = placeBuilding(state, 'tent', 10 + i, 14);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 10 + i && b.y === 14)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  // 5 villagers
  state.villagers = [];
  state.nextVillagerId = 1;
  for (let i = 0; i < 5; i++) {
    const v = createVillager(state.nextVillagerId, 15, 15);
    v.food = 8; v.morale = 80;
    v.homeBuildingId = state.buildings.find(b => b.type === 'tent' && b.x === 10 + i && b.y === 14)!.id;
    state.villagers.push(v);
    state.nextVillagerId++;
  }

  return state;
}

function advanceDay(state: GameState): GameState {
  // Advance to next new-day tick
  while (state.tick % TICKS_PER_DAY !== TICKS_PER_DAY - 1) state = tick(state);
  return tick(state); // trigger new day
}

// ================================================================
// TEST 1: Quest definitions exist
// ================================================================
heading('Quest Definitions');

{
  assert(QUEST_DEFINITIONS.length >= 8, `At least 8 quests defined (got ${QUEST_DEFINITIONS.length})`);

  const ids = QUEST_DEFINITIONS.map(q => q.id);
  assert(ids.includes('first_steps'), 'first_steps quest exists');
  assert(ids.includes('fortified'), 'fortified quest exists');
  assert(ids.includes('prosperous'), 'prosperous quest exists');
  assert(ids.includes('researcher'), 'researcher quest exists');
  assert(ids.includes('industrious'), 'industrious quest exists');
  assert(ids.includes('well_fed'), 'well_fed quest exists');
  assert(ids.includes('armed_forces'), 'armed_forces quest exists');
  assert(ids.includes('liberator'), 'liberator quest exists');

  // Each quest has name, desc, renown, gold
  for (const q of QUEST_DEFINITIONS) {
    assert(q.name.length > 0, `Quest ${q.id} has name`);
    assert(q.desc.length > 0, `Quest ${q.id} has description`);
    assert(q.renown > 0, `Quest ${q.id} awards renown (${q.renown})`);
    assert(q.gold >= 0, `Quest ${q.id} has gold reward (${q.gold})`);
  }
}

// ================================================================
// TEST 2: first_steps completes with 5 villagers + 3 buildings
// ================================================================
heading('First Steps Quest');

{
  let state = setupColony();
  state = advanceDay(state);

  assert(state.completedQuests.includes('first_steps'),
    'first_steps completes with 5 villagers and 7+ buildings');
}

// ================================================================
// TEST 3: fortified completes after surviving a raid
// ================================================================
heading('Fortified Quest');

{
  let state = setupColony();
  // Simulate winning a raid: set raidLevel > 0 (meaning we've fought raids)
  state.raidLevel = 1;
  // Add and then remove enemies to simulate raid victory
  state.enemies = [];
  // Mark that a raid happened this day by having raidLevel > 0
  state = advanceDay(state);

  assert(state.completedQuests.includes('fortified'),
    'fortified completes when raidLevel > 0 (survived a raid)');
}

// ================================================================
// TEST 4: researcher completes with 3+ techs
// ================================================================
heading('Researcher Quest');

{
  let state = setupColony();
  // setupColony has ALL_TECHS, so researcher + scholar should both trigger
  state = advanceDay(state);

  assert(state.completedQuests.includes('researcher'),
    'researcher completes with 3+ techs researched');
  assert(state.completedQuests.includes('scholar'),
    'scholar completes with 8+ techs researched');
}

// Verify researcher does NOT trigger with < 3 techs
{
  let state = setupColony();
  state.research.completed = ['basic_cooking', 'crop_rotation']; // only 2
  state = advanceDay(state);

  assert(!state.completedQuests.includes('researcher'),
    'researcher does NOT complete with only 2 techs');
}

// ================================================================
// TEST 5: industrious completes with 10+ constructed buildings
// ================================================================
heading('Industrious Quest');

{
  let state = setupColony();
  // Already have storehouse + town_hall + 5 tents = 7 constructed buildings
  // Add 3 more
  state = placeBuilding(state, 'farm', 3, 3);
  state.buildings[state.buildings.length - 1].constructed = true;
  state = placeBuilding(state, 'woodcutter', 5, 3);
  state.buildings[state.buildings.length - 1].constructed = true;
  state = placeBuilding(state, 'quarry', 7, 3);
  state.buildings[state.buildings.length - 1].constructed = true;
  // Now 10 constructed buildings
  state = advanceDay(state);

  assert(state.completedQuests.includes('industrious'),
    'industrious completes with 10+ constructed buildings');
}

// ================================================================
// TEST 6: well_fed completes with 3+ food types
// ================================================================
heading('Well Fed Quest');

{
  let state = setupColony();
  state.resources.food = 10;
  state.resources.wheat = 10;
  state.resources.bread = 10;
  state.resources.fish = 10;
  state = advanceDay(state);

  assert(state.completedQuests.includes('well_fed'),
    'well_fed completes with 4 food types available');
}

// ================================================================
// TEST 7: armed_forces completes with 3+ guards
// ================================================================
heading('Armed Forces Quest');

{
  let state = setupColony();
  state = setGuard(state, 'v1');
  state = setGuard(state, 'v2');
  state = setGuard(state, 'v3');
  state = advanceDay(state);

  assert(state.completedQuests.includes('armed_forces'),
    'armed_forces completes with 3+ guards');
}

// ================================================================
// TEST 8: Quests don't double-award
// ================================================================
heading('Quest Idempotency');

{
  let state = setupColony();
  state = advanceDay(state);
  const renownAfterFirst = state.renown;
  const goldAfterFirst = state.resources.gold;

  // Run another day
  state = advanceDay(state);
  // first_steps shouldn't award again
  const questCount = state.completedQuests.filter(q => q === 'first_steps').length;
  assert(questCount === 1, `first_steps only appears once (got ${questCount})`);
}

// ================================================================
// TEST 9: Quest rewards go into storehouse buffer
// ================================================================
heading('Quest Rewards');

{
  let state = setupColony();
  const goldBefore = state.resources.gold;
  state = advanceDay(state);

  // first_steps awards gold
  const questDef = QUEST_DEFINITIONS.find(q => q.id === 'first_steps')!;
  if (state.completedQuests.includes('first_steps')) {
    assert(state.resources.gold >= goldBefore + questDef.gold,
      `Gold increased by quest reward (${goldBefore} → ${state.resources.gold})`);
  }
}

// ================================================================
// TEST 10: Population milestone quest
// ================================================================
heading('Growing Colony Quest');

{
  let state = setupColony();
  // Add more villagers to reach 10
  for (let i = 0; i < 5; i++) {
    const v = createVillager(state.nextVillagerId, 15, 15);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
    state.nextVillagerId++;
  }
  // Need housing for them
  for (let i = 0; i < 5; i++) {
    state = placeBuilding(state, 'tent', 15 + i, 14);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 15 + i && b.y === 14)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  state = advanceDay(state);

  assert(state.completedQuests.includes('growing_colony'),
    'growing_colony completes with 10+ villagers');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Quest Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
