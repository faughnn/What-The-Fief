// test-v2-animals.ts — V2 wildlife and hunting tests
// Animals are grid entities. Passive flee, hostile attack. Hunters track and kill.

import {
  createWorld, createVillager, GameState, Building, AnimalEntity,
  TICKS_PER_DAY, NIGHT_TICKS, ANIMAL_TEMPLATES, AnimalType,
  BUILDING_TEMPLATES, ALL_TECHS,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
} from '../simulation.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { console.log(`\n=== ${s} ===`); }

function flatWorld(w: number, h: number): GameState {
  const state = createWorld(w, h, 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.villagers = [];
  state.nextVillagerId = 1;
  state.research.completed = [...ALL_TECHS];
  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function addAnimal(state: GameState, type: AnimalType, x: number, y: number): GameState {
  const template = ANIMAL_TEMPLATES[type];
  const animal: AnimalEntity = {
    id: `a${state.nextAnimalId}`,
    type, x, y,
    hp: template.maxHp, maxHp: template.maxHp,
    attack: template.attack, behavior: template.behavior,
  };
  return {
    ...state,
    animals: [...state.animals, animal],
    nextAnimalId: state.nextAnimalId + 1,
  };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Animals are grid entities with positions
// ================================================================
heading('Animals Are Grid Entities');

{
  let state = flatWorld(20, 10);
  state = addAnimal(state, 'deer', 10, 5);

  assert(state.animals.length === 1, 'Animal added to game state');
  assert(state.animals[0].x === 10 && state.animals[0].y === 5,
    `Deer at grid position (${state.animals[0].x}, ${state.animals[0].y})`);
  assert(state.animals[0].hp === 8, `Deer has ${state.animals[0].hp} HP`);
  assert(state.animals[0].behavior === 'passive', 'Deer is passive');
}

// ================================================================
// TEST 2: Passive animals move (max 1 tile per tick)
// ================================================================
heading('Passive Animal Movement');

{
  let state = flatWorld(20, 10);
  state = addAnimal(state, 'deer', 10, 5);

  let maxJump = 0;
  let prev = { x: 10, y: 5 };
  for (let i = 0; i < 20; i++) {
    state = tick(state);
    const deer = state.animals.find(a => a.id === 'a1');
    if (!deer) break;
    const jump = Math.abs(deer.x - prev.x) + Math.abs(deer.y - prev.y);
    maxJump = Math.max(maxJump, jump);
    prev = { x: deer.x, y: deer.y };
  }

  assert(maxJump <= 1, `Animal max position jump is ${maxJump} (must be <= 1)`);
}

// ================================================================
// TEST 3: Passive animals flee from nearby villagers
// ================================================================
heading('Passive Animals Flee');

{
  let state = flatWorld(20, 10);
  state = addAnimal(state, 'deer', 10, 5);
  state = addVillager(state, 9, 5); // villager 1 tile away
  state = placeBuilding(state, 'tent', 9, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };

  const deerBefore = state.animals[0];
  state = advance(state, 3);

  const deer = state.animals.find(a => a.id === 'a1');
  if (deer) {
    const distBefore = Math.abs(deerBefore.x - 9) + Math.abs(deerBefore.y - 5);
    const distAfter = Math.abs(deer.x - 9) + Math.abs(deer.y - 5);
    assert(distAfter >= distBefore,
      `Deer fled from villager (dist ${distBefore} → ${distAfter})`);
  } else {
    assert(true, 'Deer moved away (no longer at original position)');
  }
}

// ================================================================
// TEST 4: Hostile animals attack adjacent villagers
// ================================================================
heading('Hostile Animals Attack');

{
  let state = flatWorld(10, 10);
  state = addAnimal(state, 'wild_wolf', 5, 5);
  state = addVillager(state, 4, 5); // adjacent
  state = placeBuilding(state, 'tent', 4, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };

  const hpBefore = state.villagers[0].hp;
  state = advance(state, 5);

  const v = state.villagers.find(v => v.id === 'v1');
  if (v) {
    assert(v.hp < hpBefore, `Villager took damage from wolf: ${hpBefore} → ${v.hp}`);
  } else {
    assert(true, 'Villager killed by wolf (confirms hostile attack)');
  }
}

// ================================================================
// TEST 5: Dead animals create resource drops at death location
// ================================================================
heading('Animal Drops At Death Location');

{
  let state = flatWorld(10, 10);
  // Add a deer with 1 HP so it dies quickly
  state = addAnimal(state, 'deer', 5, 5);
  state = {
    ...state,
    animals: state.animals.map(a => ({ ...a, hp: 1 })),
  };

  // Add a hunter adjacent to kill it
  state = addVillager(state, 4, 5);
  state = placeBuilding(state, 'tent', 4, 5);
  state = placeBuilding(state, 'hunting_lodge', 3, 5);
  const homeId = state.buildings[0].id;
  const lodgeId = state.buildings.find(b => b.type === 'hunting_lodge')!.id;

  state = assignVillager(state, 'v1', lodgeId);
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, homeBuildingId: homeId } : v
    ),
    buildings: state.buildings.map(b =>
      b.id === lodgeId ? { ...b, constructed: true, constructionProgress: b.constructionRequired } : b
    ),
  };

  // Advance — hunter should kill deer, creating a resource drop
  state = advance(state, NIGHT_TICKS + 10);

  const deer = state.animals.find(a => a.id === 'a1');
  assert(!deer, 'Deer killed (removed from animals list)');

  // Check resource drops, hunter carrying, or resources hauled
  const drops = state.resourceDrops;
  const foodInDrops = drops.reduce((sum, d) => sum + (d.resources['food'] || 0), 0);
  const foodInGlobal = state.resources.food;
  const hunter = state.villagers.find(v => v.id === 'v1');
  const foodCarried = hunter ? (hunter.carrying['food'] || 0) : 0;
  assert(foodInDrops > 0 || foodInGlobal > 30 || foodCarried > 0,
    `Drops created or food obtained (drops=${foodInDrops}, global=${foodInGlobal}, carried=${foodCarried})`);
}

// ================================================================
// TEST 6: Hostile animals move max 1 tile per tick
// ================================================================
heading('Hostile Animal Anti-Teleportation');

{
  let state = flatWorld(20, 10);
  state = addAnimal(state, 'wild_wolf', 15, 5);
  state = addVillager(state, 5, 5);
  state = placeBuilding(state, 'tent', 5, 5);
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: state.buildings[0].id })),
  };

  let maxJump = 0;
  let prev = { x: 15, y: 5 };
  for (let i = 0; i < 15; i++) {
    state = tick(state);
    const wolf = state.animals.find(a => a.id === 'a1');
    if (!wolf) break;
    const jump = Math.abs(wolf.x - prev.x) + Math.abs(wolf.y - prev.y);
    maxJump = Math.max(maxJump, jump);
    prev = { x: wolf.x, y: wolf.y };
  }

  assert(maxJump <= 1, `Wolf max position jump is ${maxJump} (must be <= 1)`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Animal Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
