// test-v2-travel-sign.ts — Tests for travel sign building
// Travel signs boost villager movement speed in nearby tiles (3-tile radius, 2x speed)

import {
  createWorld, createVillager, GameState, ALL_TECHS,
  TICKS_PER_DAY, BUILDING_TEMPLATES, BUILDING_MAX_HP,
  BUILDING_TECH_REQUIREMENTS,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

// === Test: Travel sign template exists ===
heading('Travel Sign Template');

{
  const tmpl = BUILDING_TEMPLATES['travel_sign'];
  assert(tmpl !== undefined, 'travel_sign template exists');
  assert(tmpl.w === 1 && tmpl.h === 1, 'travel_sign is 1x1');
  assert(tmpl.maxWorkers === 0, 'travel_sign has 0 workers (passive)');
  assert(tmpl.cost.wood > 0, 'travel_sign costs wood');
}

// === Test: Travel sign has HP ===
heading('Travel Sign Properties');

{
  assert(BUILDING_MAX_HP['travel_sign'] > 0, 'travel_sign has HP entry');
  assert(BUILDING_TECH_REQUIREMENTS['travel_sign'] !== undefined, 'travel_sign has tech requirement');
}

// === Test: Travel sign placement ===
heading('Travel Sign Placement');

{
  let state = createWorld(30, 30, 42);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];
  state = placeBuilding(state, 'storehouse', 15, 15);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { wood: 50, stone: 50 };
  state.resources = { ...state.resources, wood: 50, stone: 50 };

  state = placeBuilding(state, 'travel_sign', 10, 10);
  const sign = state.buildings.find(b => b.type === 'travel_sign');
  assert(sign !== undefined, 'travel_sign placed successfully');
  assert(sign!.constructed === false, 'travel_sign starts unconstructed');
}

// === Test: Travel sign boosts movement speed ===
heading('Travel Sign Speed Boost');

{
  let state = createWorld(30, 30, 42);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];

  // Storehouse and resources
  state = placeBuilding(state, 'storehouse', 25, 15);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100 };
  state.resources = { ...state.resources, food: 100 };

  // Place travel sign at (10, 15) — villagers near it should move faster
  state = placeBuilding(state, 'travel_sign', 10, 15);
  const sign = state.buildings.find(b => b.type === 'travel_sign')!;
  sign.constructed = true; sign.hp = sign.maxHp;

  // Place tent (home) and farm (work) — travel sign is along the route
  state = placeBuilding(state, 'tent', 5, 15);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state = placeBuilding(state, 'farm', 20, 15);
  const farm = state.buildings.find(b => b.type === 'farm')!;
  farm.constructed = true; farm.hp = farm.maxHp;

  // Villager with travel sign along route
  state.villagers = [];
  const v1 = createVillager(1, 5, 15);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tent.id;
  v1.assignedBuildingId = farm.id;
  v1.role = 'worker';
  v1.state = 'traveling_to_work';
  v1.path = [];
  for (let x = 6; x <= 20; x++) v1.path.push({ x, y: 15 });
  v1.pathIndex = 0;
  state.villagers.push(v1);
  state.nextVillagerId = 2;

  // Start during daytime
  state.tick = 1600;

  // Run 10 ticks
  for (let i = 0; i < 10; i++) {
    state = tick(state);
  }

  const vAfter = state.villagers.find(v => v.id === 'v1')!;
  // With travel sign, villager should move faster than 10 tiles in 10 ticks
  // (road-like double speed when near sign)
  assert(vAfter.x > 5 + 10, `travel sign boosts speed (x=${vAfter.x}, expected > 15)`);
}

// === Test: No boost from unconstructed sign ===
heading('No Boost From Unconstructed');

{
  let state = createWorld(30, 30, 42);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];

  state = placeBuilding(state, 'storehouse', 25, 15);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100 };
  state.resources = { ...state.resources, food: 100 };

  // Unconstructed travel sign
  state = placeBuilding(state, 'travel_sign', 10, 15);
  // Don't construct it

  state = placeBuilding(state, 'tent', 5, 15);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  state.villagers = [];
  const v1 = createVillager(1, 5, 15);
  v1.food = 8; v1.morale = 80;
  v1.homeBuildingId = tent.id;
  v1.state = 'traveling_to_work';
  v1.path = [];
  for (let x = 6; x <= 20; x++) v1.path.push({ x, y: 15 });
  v1.pathIndex = 0;
  state.villagers.push(v1);
  state.nextVillagerId = 2;

  state.tick = 1600;
  for (let i = 0; i < 10; i++) {
    state = tick(state);
  }

  const vAfter = state.villagers.find(v => v.id === 'v1')!;
  // Without constructed sign, normal speed: 1 tile/tick = 10 tiles in 10 ticks
  assert(vAfter.x <= 15, `no boost from unconstructed sign (x=${vAfter.x})`);
}

// === Test: Multiple travel signs ===
heading('Multiple Signs');

{
  let state = createWorld(30, 30, 42);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.research.completed = [...ALL_TECHS];

  state = placeBuilding(state, 'storehouse', 25, 15);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100, wood: 50 };
  state.resources = { ...state.resources, food: 100, wood: 50 };

  // Two signs along the path
  state = placeBuilding(state, 'travel_sign', 8, 15);
  const sign1 = state.buildings.find(b => b.type === 'travel_sign' && b.x === 8)!;
  sign1.constructed = true; sign1.hp = sign1.maxHp;

  state = placeBuilding(state, 'travel_sign', 16, 15);
  const sign2 = state.buildings.find(b => b.type === 'travel_sign' && b.x === 16)!;
  sign2.constructed = true; sign2.hp = sign2.maxHp;

  assert(state.buildings.filter(b => b.type === 'travel_sign').length === 2, 'can place multiple travel signs');
}

// === Summary ===
console.log(`\nTravel Sign: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
