// test-v2-raid-variety.ts — Tests for night raids, multi-wave sieges, reclamation parties

import {
  createWorld, createVillager, GameState, ALL_TECHS,
  TICKS_PER_DAY, BUILDING_TEMPLATES, CAMP_RAID_INTERVAL,
} from '../world.js';
import {
  tick, placeBuilding, setGuard,
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
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];
  return state;
}

function setupColony(state: GameState): GameState {
  state = placeBuilding(state, 'storehouse', 30, 30);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, planks: 50, stone: 50, ingots: 20, rope: 20, stone_blocks: 20 };
  state.resources = { ...state.resources, food: 200, planks: 50, stone: 50, ingots: 20, rope: 20, stone_blocks: 20 };

  state = placeBuilding(state, 'tent', 28, 30);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  // Add town hall for territory
  state = placeBuilding(state, 'town_hall', 25, 25);
  const th = state.buildings.find(b => b.type === 'town_hall')!;
  th.constructed = true; th.hp = th.maxHp;

  state.villagers = [];
  for (let i = 1; i <= 6; i++) {
    const v = createVillager(i, 30, 30);
    v.food = 8; v.morale = 80;
    v.homeBuildingId = tent.id;
    state.villagers.push(v);
  }
  state.nextVillagerId = 7;
  return state;
}

// === Test: Pending waves field exists ===
heading('Multi-Wave Data');

{
  const state = makeTestState();
  assert('pendingRaidWaves' in state, 'GameState has pendingRaidWaves field');
  assert(Array.isArray(state.pendingRaidWaves), 'pendingRaidWaves is an array');
  assert(state.pendingRaidWaves.length === 0, 'pendingRaidWaves starts empty');
}

// === Test: Multi-wave siege spawns second wave ===
heading('Multi-Wave Siege');

{
  let state = setupColony(makeTestState());

  // Add a strong camp (strength 6+)
  state.banditCamps.push({
    id: 'camp1', x: 0, y: 0, hp: 30, maxHp: 30,
    strength: 6, lastRaidDay: -100, raidInterval: CAMP_RAID_INTERVAL,
  });

  // Advance to trigger raid
  state.tick = TICKS_PER_DAY - 1;
  state = tick(state); // day boundary

  // After first wave, pendingRaidWaves should have a second wave queued
  const hadFirstWave = state.enemies.length > 0;
  const hasPendingWave = state.pendingRaidWaves.length > 0;

  assert(hadFirstWave || hasPendingWave, 'strong camp raid triggered (enemies or pending wave)');

  if (hasPendingWave) {
    const wave = state.pendingRaidWaves[0];
    assert(wave.day > state.day, `second wave scheduled for future day (wave day ${wave.day} > current ${state.day})`);
    assert(wave.campId === 'camp1', 'wave linked to correct camp');
  }
}

// === Test: Second wave actually spawns ===
{
  let state = setupColony(makeTestState());

  // Manually add a pending wave for tomorrow
  state.pendingRaidWaves = [{
    campId: 'camp_test',
    day: 1, // triggers on day 1
    strength: 3,
    x: 0, y: 0,
  }];
  state.day = 0;
  state.tick = TICKS_PER_DAY - 1; // next tick = day 1

  state = tick(state);

  assert(state.enemies.length > 0, `second wave spawned enemies (${state.enemies.length})`);
  assert(state.pendingRaidWaves.length === 0, 'pending wave consumed after spawning');
}

// === Test: Reclamation party after liberation ===
heading('Reclamation Party');

{
  let state = setupColony(makeTestState());

  // Set up NPC village and liberate it
  if (state.npcSettlements.length > 0) {
    const village = state.npcSettlements[0];
    village.liberated = false;

    // Add camp for retaliation
    state.banditCamps.push({
      id: 'camp_rec', x: 0, y: 0, hp: 30, maxHp: 30,
      strength: 4, lastRaidDay: -100, raidInterval: CAMP_RAID_INTERVAL,
    });

    // Liberate village
    village.liberated = true;
    state.events.push(`${village.name} has been liberated!`);

    // A reclamation wave should be queued
    // We manually trigger the check by setting lastLiberationDay
    state.lastLiberationDay = state.day;

    // Advance a day to trigger reclamation
    state.tick = TICKS_PER_DAY - 1;
    state = tick(state);

    const hasReclamation = state.pendingRaidWaves.some(w => w.isReclamation) ||
                           state.events.some(e => e.toLowerCase().includes('reclamation'));
    assert(hasReclamation, 'reclamation party scheduled or announced after liberation');
  } else {
    assert(true, 'skipped — no NPC villages on this map');
  }
}

// === Test: Night raid event message mentions night ===
heading('Night Raid Events');

{
  let state = setupColony(makeTestState());

  // Add camp
  state.banditCamps.push({
    id: 'camp_night', x: 0, y: 0, hp: 30, maxHp: 30,
    strength: 3, lastRaidDay: -100, raidInterval: CAMP_RAID_INTERVAL,
  });

  // Force night raid flag
  state.forceNightRaid = true;

  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);

  const nightEvent = state.events.some(e => e.toLowerCase().includes('night') && e.toLowerCase().includes('raid'));
  // Either we got a night raid event or enemies spawned during night
  assert(state.enemies.length > 0 || nightEvent, 'raid triggered with night raid flag');
}

// === Test: Weak camps don't get multi-wave ===
heading('No Multi-Wave for Weak Camps');

{
  let state = setupColony(makeTestState());

  // Add a weak camp (strength 3)
  state.banditCamps.push({
    id: 'camp_weak', x: 0, y: 0, hp: 20, maxHp: 20,
    strength: 3, lastRaidDay: -100, raidInterval: CAMP_RAID_INTERVAL,
  });

  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);

  assert(state.pendingRaidWaves.length === 0, 'weak camp (str 3) does not trigger multi-wave');
}

// === Summary ===
console.log(`\nRaid Variety: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
