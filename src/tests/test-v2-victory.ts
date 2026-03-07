// test-v2-victory.ts — Tests for endgame victory condition
// Victory: liberate all NPC villages + prosperity >= 100 + all techs researched + population >= 15

import {
  createWorld, createVillager, GameState, ALL_TECHS, ALL_RESOURCES,
  TICKS_PER_DAY, BUILDING_TEMPLATES,
} from '../world.js';
import {
  tick, placeBuilding,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function makeTestState(): GameState {
  let state = createWorld(60, 60, 42);
  // Clear grid for testing
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  return state;
}

// === Test: Victory field exists in GameState ===
heading('Victory Field');

{
  const state = makeTestState();
  assert('victory' in state, 'GameState has victory field');
  assert(state.victory === false, 'victory starts as false');
}

// === Test: Victory not triggered when conditions not met ===
heading('Victory Not Triggered');

{
  let state = makeTestState();
  // Run a few ticks — victory should not trigger with empty state
  for (let i = 0; i < 10; i++) state = tick(state);
  assert(state.victory === false, 'victory not triggered with empty state');
}

// === Test: Victory not triggered with only some conditions met ===
heading('Partial Conditions');

{
  let state = makeTestState();
  // All techs but no villages liberated
  state.research.completed = [...ALL_TECHS];
  state.prosperity = 100;
  for (let i = 1; i <= 15; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 16;
  // NPC villages not liberated
  for (const npc of state.npcSettlements) npc.liberated = false;

  state = tick(state);
  assert(state.victory === false, 'victory not triggered without village liberation');
}

{
  let state = makeTestState();
  // Villages liberated but not enough techs
  for (const npc of state.npcSettlements) npc.liberated = true;
  state.prosperity = 100;
  state.research.completed = [ALL_TECHS[0]]; // only 1 tech
  for (let i = 1; i <= 15; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 16;

  state = tick(state);
  assert(state.victory === false, 'victory not triggered without all techs');
}

{
  let state = makeTestState();
  // Everything but not enough population
  for (const npc of state.npcSettlements) npc.liberated = true;
  state.prosperity = 100;
  state.research.completed = [...ALL_TECHS];
  // Only 5 villagers
  for (let i = 1; i <= 5; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 6;

  state = tick(state);
  assert(state.victory === false, 'victory not triggered with < 15 population');
}

{
  let state = makeTestState();
  // Everything but low prosperity
  for (const npc of state.npcSettlements) npc.liberated = true;
  state.prosperity = 50;
  state.research.completed = [...ALL_TECHS];
  for (let i = 1; i <= 15; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 16;

  state = tick(state);
  assert(state.victory === false, 'victory not triggered with prosperity < 100');
}

// === Test: Victory IS triggered when all conditions met ===
heading('Victory Triggered');

{
  let state = makeTestState();
  for (const npc of state.npcSettlements) npc.liberated = true;
  state.prosperity = 100;
  state.research.completed = [...ALL_TECHS];
  for (let i = 1; i <= 15; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 16;
  state.tick = TICKS_PER_DAY - 1;

  state = tick(state);
  assert(state.victory === true, 'victory triggered with all conditions met');
}

// === Test: Victory event message ===
heading('Victory Event');

{
  let state = makeTestState();
  for (const npc of state.npcSettlements) npc.liberated = true;
  state.prosperity = 100;
  state.research.completed = [...ALL_TECHS];
  for (let i = 1; i <= 15; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 16;
  state.tick = TICKS_PER_DAY - 1;

  state = tick(state);
  const victoryEvent = state.events.find(e => e.toLowerCase().includes('victory'));
  assert(victoryEvent !== undefined, 'victory event message generated');
}

// === Test: Victory stays true once triggered ===
heading('Victory Persistence');

{
  let state = makeTestState();
  for (const npc of state.npcSettlements) npc.liberated = true;
  state.prosperity = 100;
  state.research.completed = [...ALL_TECHS];
  for (let i = 1; i <= 15; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 16;
  state.tick = TICKS_PER_DAY - 1;

  state = tick(state);
  assert(state.victory === true, 'victory triggered');

  // Run more ticks — victory should persist
  for (let i = 0; i < 5; i++) state = tick(state);
  assert(state.victory === true, 'victory persists after more ticks');
}

// === Test: Victory works with no NPC villages (small map) ===
heading('Victory Small Map');

{
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  // Small map has no NPC settlements — liberation is vacuously true
  state.npcSettlements = [];
  state.prosperity = 100;
  state.research.completed = [...ALL_TECHS];
  for (let i = 1; i <= 15; i++) {
    const v = createVillager(i, 5, 5);
    v.food = 8; v.morale = 80;
    state.villagers.push(v);
  }
  state.nextVillagerId = 16;
  state.tick = TICKS_PER_DAY - 1;

  state = tick(state);
  assert(state.victory === true, 'victory works on small map with no NPC villages');
}

// === Summary ===
console.log(`\nVictory Condition: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
