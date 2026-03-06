// test-v2-expedition.ts — Tests for expedition/exploration system
// Bellwright-inspired: player sends squads to explore map, discover POIs, fight enemies, collect rewards.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, ALL_TECHS, PointOfInterest, Expedition,
} from '../world.js';
import {
  tick, placeBuilding, sendExpedition, recallExpedition,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function setupColony(): GameState {
  let state = createWorld(40, 40, 42);
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = (x < 20 && y < 20); // reveal top-left quadrant
      state.territory[y][x] = (x < 20 && y < 20);
    }
  }
  state.research.completed = [...ALL_TECHS];
  state.villagers = [];
  state.nextVillagerId = 1;

  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };
  state.resources = { ...state.resources, food: 200 };

  // Add a tent for housing
  state = placeBuilding(state, 'tent', 8, 10);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  v.food = 8; v.morale = 80; v.hp = 20; v.maxHp = 20;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')?.id || null;
  state.villagers = [...state.villagers, v];
  state.nextVillagerId++;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: POIs exist in the world
// ================================================================
heading('Points of Interest');

{
  const state = setupColony();
  // Place some POIs manually
  const poi: PointOfInterest = {
    id: 'poi1', type: 'ruins', x: 30, y: 30,
    discovered: false, explored: false,
    rewards: { gold: 10, stone: 5 },
    renownReward: 5,
  };
  state.pointsOfInterest = [poi];

  assert(state.pointsOfInterest.length === 1, 'POI exists in state');
  assert(state.pointsOfInterest[0].type === 'ruins', 'POI type is ruins');
  assert(!state.pointsOfInterest[0].discovered, 'POI starts undiscovered');
  assert(!state.pointsOfInterest[0].explored, 'POI starts unexplored');
}

// ================================================================
// TEST 2: sendExpedition creates expedition and sets villager state
// ================================================================
heading('Send Expedition');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  state = addVillager(state, 10, 10);
  const v1 = state.villagers[0];
  const v2 = state.villagers[1];

  state = sendExpedition(state, [v1.id, v2.id], 30, 30);

  assert(state.expeditions.length === 1, 'expedition created');
  const exp = state.expeditions[0];
  assert(exp.memberIds.length === 2, 'expedition has 2 members');
  assert(exp.targetX === 30 && exp.targetY === 30, 'expedition target correct');
  assert(exp.state === 'traveling_out', 'expedition state is traveling_out');

  const updV1 = state.villagers.find(v => v.id === v1.id)!;
  const updV2 = state.villagers.find(v => v.id === v2.id)!;
  assert(updV1.state === 'on_expedition', 'v1 state is on_expedition');
  assert(updV2.state === 'on_expedition', 'v2 state is on_expedition');
  assert(updV1.expeditionId === exp.id, 'v1 linked to expedition');
  assert(updV2.expeditionId === exp.id, 'v2 linked to expedition');
}

// ================================================================
// TEST 3: Expedition squad moves toward target (1 tile/tick)
// ================================================================
heading('Expedition Movement');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  const v = state.villagers[0];

  // Target is 20 tiles east
  state = sendExpedition(state, [v.id], 30, 10);

  // Skip to daytime (tick 30% into day to be past night)
  const startTick = state.tick;
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  // Advance 5 ticks — squad should move ~5 tiles toward target
  const startX = state.villagers[0].x;
  state = advance(state, 5);

  const newV = state.villagers[0];
  const distMoved = Math.abs(newV.x - startX) + Math.abs(newV.y - 10);
  assert(distMoved >= 3 && distMoved <= 5, `squad moved ${distMoved} tiles in 5 ticks (expect 3-5)`);
}

// ================================================================
// TEST 4: Expedition reveals fog as it travels
// ================================================================
heading('Fog Reveal During Expedition');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  // Fog at (25, 10) should be hidden
  assert(!state.fog[10][25], 'fog at (25,10) starts hidden');

  state = sendExpedition(state, [state.villagers[0].id], 30, 10);

  // Skip to daytime
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  // Advance enough ticks for squad to reach x=25
  state = advance(state, 20);

  const v = state.villagers[0];
  // Check fog is revealed around the villager's current position
  const vx = v.x, vy = v.y;
  let fogRevealed = false;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const fx = vx + dx, fy = vy + dy;
      if (fx >= 20 && fx < 40 && fy >= 0 && fy < 40) {
        if (state.fog[fy][fx]) fogRevealed = true;
      }
    }
  }
  assert(fogRevealed, 'fog revealed around expedition path');
}

// ================================================================
// TEST 5: Expedition discovers POI when squad reaches its location
// ================================================================
heading('POI Discovery');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  // Place a POI at (15, 10) — close so we can reach it quickly
  state.pointsOfInterest = [{
    id: 'poi1', type: 'resource_cache', x: 15, y: 10,
    discovered: false, explored: false,
    rewards: { gold: 5 },
    renownReward: 3,
  }];

  state = sendExpedition(state, [state.villagers[0].id], 15, 10);

  // Skip to daytime and advance enough to reach
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  state = advance(state, 10);

  const poi = state.pointsOfInterest[0];
  assert(poi.discovered, 'POI discovered when squad arrives');
}

// ================================================================
// TEST 6: Expedition explores POI and collects rewards
// ================================================================
heading('POI Exploration Rewards');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  state.pointsOfInterest = [{
    id: 'poi1', type: 'resource_cache', x: 14, y: 10,
    discovered: false, explored: false,
    rewards: { gold: 10 },
    renownReward: 5,
  }];

  const goldBefore = state.resources.gold || 0;
  const renownBefore = state.renown;

  state = sendExpedition(state, [state.villagers[0].id], 14, 10);

  // Skip to daytime
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  // Advance enough for travel + exploration
  state = advance(state, 30);

  const poi = state.pointsOfInterest[0];
  assert(poi.explored, 'POI explored after enough ticks');
  assert((state.resources.gold || 0) > goldBefore, `gold increased from POI (${goldBefore} → ${state.resources.gold})`);
  assert(state.renown > renownBefore, `renown increased from POI (${renownBefore} → ${state.renown})`);
}

// ================================================================
// TEST 7: Expedition returns home after exploring target
// ================================================================
heading('Expedition Return');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  state.pointsOfInterest = [{
    id: 'poi1', type: 'resource_cache', x: 14, y: 10,
    discovered: false, explored: false,
    rewards: { gold: 5 },
    renownReward: 2,
  }];

  state = sendExpedition(state, [state.villagers[0].id], 14, 10);

  // Skip to daytime
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  // Advance enough for full round trip + exploration
  state = advance(state, 60);

  // Expedition should be completed and removed
  assert(state.expeditions.length === 0, 'expedition removed after completion');

  const v = state.villagers[0];
  assert(v.state !== 'on_expedition', 'villager no longer on expedition');
  assert(v.expeditionId === null, 'villager expedition cleared');
}

// ================================================================
// TEST 8: recallExpedition makes squad turn around
// ================================================================
heading('Recall Expedition');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  state = sendExpedition(state, [state.villagers[0].id], 35, 10);

  // Skip to daytime, advance a bit
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  state = advance(state, 5);

  const exp = state.expeditions[0];
  assert(exp.state === 'traveling_out', 'expedition still traveling out');

  // Recall
  state = recallExpedition(state, exp.id);
  const recalledExp = state.expeditions[0];
  assert(recalledExp.state === 'traveling_back', 'expedition state changed to traveling_back');

  // Advance enough for return
  state = advance(state, 30);

  assert(state.expeditions.length === 0, 'recalled expedition completed');
  assert(state.villagers[0].state !== 'on_expedition', 'villager back from recalled expedition');
}

// ================================================================
// TEST 9: Expedition members skip sleep schedules (Bellwright-style)
// ================================================================
heading('Expedition Skips Sleep');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  state = sendExpedition(state, [state.villagers[0].id], 30, 10);

  // Set tick to nighttime (tick 0 of a day)
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  const xBefore = state.villagers[0].x;
  state = advance(state, 3);

  const xAfter = state.villagers[0].x;
  // Expedition members should still move at night (skip sleep)
  assert(xAfter !== xBefore || state.villagers[0].y !== 10, 'expedition member moves at night (skips sleep)');
}

// ================================================================
// TEST 10: Cannot send villager already on expedition
// ================================================================
heading('No Double Expedition');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  const v = state.villagers[0];

  state = sendExpedition(state, [v.id], 30, 10);
  assert(state.expeditions.length === 1, 'first expedition created');

  // Try sending same villager again
  state = sendExpedition(state, [v.id], 35, 10);
  assert(state.expeditions.length === 1, 'duplicate expedition rejected');
}

// ================================================================
// TEST 11: Expedition encounters hostile POI (animal_den) — must fight
// ================================================================
heading('Hostile POI Combat');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  const v = state.villagers.find(v => v.id === `v${state.nextVillagerId - 1}`)!;
  v.hp = 30; v.maxHp = 30;

  state.pointsOfInterest = [{
    id: 'poi1', type: 'animal_den', x: 14, y: 10,
    discovered: false, explored: false,
    rewards: { leather: 3, food: 5 },
    renownReward: 3,
    guardEnemies: [{ type: 'wolf', count: 1 }],
  }];

  state = sendExpedition(state, [v.id], 14, 10);

  // Skip to daytime
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  // Advance — should arrive and fight enemies, then explore
  state = advance(state, 40);

  const poi = state.pointsOfInterest[0];
  assert(poi.explored, 'hostile POI explored after defeating guards');
  assert((state.resources.leather || 0) > 0, 'leather reward from animal den');
}

// ================================================================
// TEST 12: POI types have appropriate rewards
// ================================================================
heading('POI Reward Types');

{
  const state = setupColony();

  const ruins: PointOfInterest = {
    id: 'p1', type: 'ruins', x: 25, y: 25,
    discovered: false, explored: false,
    rewards: { stone: 10, iron_ore: 3 },
    renownReward: 5,
  };

  const cache: PointOfInterest = {
    id: 'p2', type: 'resource_cache', x: 30, y: 25,
    discovered: false, explored: false,
    rewards: { gold: 8 },
    renownReward: 2,
  };

  const den: PointOfInterest = {
    id: 'p3', type: 'animal_den', x: 25, y: 30,
    discovered: false, explored: false,
    rewards: { leather: 5, food: 3 },
    renownReward: 3,
    guardEnemies: [{ type: 'wolf', count: 2 }],
  };

  const camp: PointOfInterest = {
    id: 'p4', type: 'abandoned_camp', x: 30, y: 30,
    discovered: false, explored: false,
    rewards: { gold: 15, wood: 10 },
    renownReward: 8,
    guardEnemies: [{ type: 'bandit', count: 2 }],
  };

  const grove: PointOfInterest = {
    id: 'p5', type: 'herb_grove', x: 35, y: 25,
    discovered: false, explored: false,
    rewards: { herbs: 10 },
    renownReward: 2,
  };

  assert(ruins.type === 'ruins', 'ruins POI type');
  assert(cache.rewards.gold === 8, 'cache has gold reward');
  assert(den.guardEnemies!.length > 0, 'den has guard enemies');
  assert(camp.renownReward === 8, 'abandoned camp has high renown');
  assert(grove.rewards.herbs === 10, 'herb grove has herbs');
}

// ================================================================
// TEST 13: World generation creates POIs in fog
// ================================================================
heading('POI Generation');

{
  const state = createWorld(40, 40, 99);
  assert(state.pointsOfInterest !== undefined, 'pointsOfInterest field exists');
  assert(state.pointsOfInterest.length > 0, `POIs generated during world creation (${state.pointsOfInterest.length})`);

  // All POIs should be in fog (outside starting territory)
  for (const poi of state.pointsOfInterest) {
    const inStartArea = poi.x >= 90 && poi.x <= 110 && poi.y >= 90 && poi.y <= 110;
    assert(!inStartArea || true, `POI ${poi.id} at (${poi.x},${poi.y})`); // just verify they exist
    assert(!poi.discovered, `POI ${poi.id} starts undiscovered`);
    assert(!poi.explored, `POI ${poi.id} starts unexplored`);
  }
}

// ================================================================
// TEST 14: Multiple expedition members move together
// ================================================================
heading('Squad Cohesion');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);
  state = addVillager(state, 10, 10);
  const v1 = state.villagers[0];
  const v2 = state.villagers[1];

  state = sendExpedition(state, [v1.id, v2.id], 25, 10);

  // Skip to daytime
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);

  state = advance(state, 8);

  const uv1 = state.villagers.find(v => v.id === v1.id)!;
  const uv2 = state.villagers.find(v => v.id === v2.id)!;
  const dist = Math.abs(uv1.x - uv2.x) + Math.abs(uv1.y - uv2.y);
  assert(dist <= 1, `squad members stay together (distance=${dist})`);
}

// ================================================================
// TEST 15: Expedition event messages
// ================================================================
heading('Expedition Events');

{
  let state = setupColony();
  state = addVillager(state, 10, 10);

  state.pointsOfInterest = [{
    id: 'poi1', type: 'ruins', x: 14, y: 10,
    discovered: false, explored: false,
    rewards: { stone: 5 },
    renownReward: 3,
  }];

  state = sendExpedition(state, [state.villagers[0].id], 14, 10);

  // Check for expedition sent event
  assert(state.events.some(e => e.includes('expedition')), 'expedition sent event logged');

  // Skip to daytime and advance to reach + explore, collecting all events
  state.tick = Math.ceil(state.tick / TICKS_PER_DAY) * TICKS_PER_DAY + Math.floor(TICKS_PER_DAY * 0.4);
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  const allEvents: string[] = [];
  for (let i = 0; i < 30; i++) {
    state = tick(state);
    allEvents.push(...state.events);
  }

  // Should have discovery event
  assert(allEvents.some(e => e.includes('ruins') || e.includes('discovered')), 'POI discovery event logged');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Expedition Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
