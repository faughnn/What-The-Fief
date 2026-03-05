// test-v2-job-priorities.ts — Tests for per-villager job preferences
import {
  createWorld, createVillager, GameState, Building,
  BUILDING_TEMPLATES, TICKS_PER_DAY, BuildingType,
} from '../world.js';
import { tick, placeBuilding, assignVillager, setPreferredJob, setJobPriority } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function setupColony(villagersCount: number): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200 };
  state.resources.food = 200;

  for (let i = 0; i < villagersCount; i++) {
    state = placeBuilding(state, 'tent', 5 + i, 5);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 5 + i)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  const tents = state.buildings.filter(b => b.type === 'tent');
  const villagers = [];
  for (let i = 0; i < villagersCount; i++) {
    const v = createVillager(i + 1, 10, 10);
    v.food = 8;
    v.morale = 80;
    v.homeBuildingId = tents[i].id;
    villagers.push(v);
  }
  state.villagers = villagers;
  state.nextVillagerId = villagersCount + 1;

  return state;
}

// ========================
// TESTS
// ========================

console.log('\n=== Job Priority: setPreferredJob Command ===');
{
  let state = setupColony(2);
  state = setPreferredJob(state, 'v1', 'farm');
  assert(state.villagers.find(v => v.id === 'v1')!.preferredJob === 'farm', 'v1 preferredJob set to farm');

  state = setPreferredJob(state, 'v1', null);
  assert(state.villagers.find(v => v.id === 'v1')!.preferredJob === null, 'v1 preferredJob cleared to null');
}

console.log('\n=== Job Priority: setPreferredJob Rejects Invalid Building ===');
{
  let state = setupColony(1);
  const before = { ...state };
  state = setPreferredJob(state, 'v1', 'wall');
  assert(state.villagers.find(v => v.id === 'v1')!.preferredJob === null,
    'Cannot set preferredJob to wall (no worker slots)');
}

console.log('\n=== Job Priority: setPreferredJob Rejects Invalid Villager ===');
{
  let state = setupColony(1);
  state = setPreferredJob(state, 'v999', 'farm');
  assert(state.villagers.length === 1, 'No crash on invalid villagerId');
}

console.log('\n=== Job Priority: Preferred Villager Assigned to Preferred Building ===');
{
  let state = setupColony(3);

  // v1 prefers tanner, v2 and v3 have no preference
  state = setPreferredJob(state, 'v1', 'tanner');

  // Zero out all skills so preference is the deciding factor
  for (const v of state.villagers) {
    v.skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0 };
  }

  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'tanner', 12, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  const tannerId = state.buildings.find(b => b.type === 'tanner')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state.buildings.find(b => b.id === tannerId)!.constructed = true;
  state.buildings.find(b => b.id === tannerId)!.hp = state.buildings.find(b => b.id === tannerId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const tanner = state.buildings.find(b => b.id === tannerId)!;
  assert(tanner.assignedWorkers.includes('v1'), 'v1 (prefers tanner) assigned to tanner');
}

console.log('\n=== Job Priority: Preferred Villager Beats Higher Skill ===');
{
  let state = setupColony(2);

  // v1 has high crafting but no preference; v2 has low crafting but prefers tanner
  state.villagers[0].skills = { farming: 0, mining: 0, crafting: 30, woodcutting: 0, cooking: 0, herbalism: 0 };
  state.villagers[1].skills = { farming: 0, mining: 0, crafting: 5, woodcutting: 0, cooking: 0, herbalism: 0 };
  state = setPreferredJob(state, 'v2', 'tanner');

  state = placeBuilding(state, 'tanner', 8, 8);
  const tannerId = state.buildings.find(b => b.type === 'tanner')!.id;
  state.buildings.find(b => b.id === tannerId)!.constructed = true;
  state.buildings.find(b => b.id === tannerId)!.hp = state.buildings.find(b => b.id === tannerId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const tanner = state.buildings.find(b => b.id === tannerId)!;
  assert(tanner.assignedWorkers.includes('v2'),
    'v2 (prefers tanner, low skill) beats v1 (high skill, no preference)');
}

console.log('\n=== Job Priority: Preference Does Not Block Other Buildings ===');
{
  // v1 prefers tanner, but there's no tanner — should still be assigned to farm
  let state = setupColony(1);
  state = setPreferredJob(state, 'v1', 'tanner');

  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  assert(farm.assignedWorkers.includes('v1'),
    'v1 (prefers tanner) still assigned to farm when no tanner exists');
}

console.log('\n=== Job Priority: Multiple Preferred Villagers for Same Building ===');
{
  let state = setupColony(3);

  // v1 and v2 both prefer farm; v1 has higher farming skill
  state.villagers[0].skills = { farming: 25, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0 };
  state.villagers[1].skills = { farming: 15, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0 };
  state.villagers[2].skills = { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0 };
  state = setPreferredJob(state, 'v1', 'farm');
  state = setPreferredJob(state, 'v2', 'farm');

  state = placeBuilding(state, 'farm', 8, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const farm = state.buildings.find(b => b.id === farmId)!;
  // Farm maxWorkers=2, both preferred villagers should be assigned
  assert(farm.assignedWorkers.includes('v1'), 'v1 (prefers farm, skill 25) assigned');
  assert(farm.assignedWorkers.includes('v2'), 'v2 (prefers farm, skill 15) assigned');
  assert(!farm.assignedWorkers.includes('v3'), 'v3 (no preference) not on farm');
}

console.log('\n=== Job Priority: Preference Survives Across Days ===');
{
  let state = setupColony(2);
  state = setPreferredJob(state, 'v1', 'woodcutter');

  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'woodcutter', 12, 8);
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  const wcId = state.buildings.find(b => b.type === 'woodcutter')!.id;
  state.buildings.find(b => b.id === farmId)!.constructed = true;
  state.buildings.find(b => b.id === farmId)!.hp = state.buildings.find(b => b.id === farmId)!.maxHp;
  state.buildings.find(b => b.id === wcId)!.constructed = true;
  state.buildings.find(b => b.id === wcId)!.hp = state.buildings.find(b => b.id === wcId)!.maxHp;

  // Run for 3 days
  for (let i = 0; i < TICKS_PER_DAY * 3; i++) state = tick(state);

  const wc = state.buildings.find(b => b.id === wcId)!;
  assert(wc.assignedWorkers.includes('v1'), 'v1 still at woodcutter after 3 days');
  assert(state.villagers.find(v => v.id === 'v1')!.preferredJob === 'woodcutter',
    'preferredJob persists across days');
}

console.log('\n=== Job Priority: Default preferredJob is null ===');
{
  const v = createVillager(1, 0, 0);
  assert(v.preferredJob === null, 'New villager has preferredJob = null');
}

console.log('\n=== Job Priority: Clearing Preference Returns to Skill-Based ===');
{
  let state = setupColony(2);

  // v1 has high crafting, v2 has low crafting
  state.villagers[0].skills = { farming: 0, mining: 0, crafting: 30, woodcutting: 0, cooking: 0, herbalism: 0 };
  state.villagers[1].skills = { farming: 0, mining: 0, crafting: 5, woodcutting: 0, cooking: 0, herbalism: 0 };

  // Set v2 to prefer tanner, then clear it
  state = setPreferredJob(state, 'v2', 'tanner');
  state = setPreferredJob(state, 'v2', null);

  state = placeBuilding(state, 'tanner', 8, 8);
  const tannerId = state.buildings.find(b => b.type === 'tanner')!.id;
  state.buildings.find(b => b.id === tannerId)!.constructed = true;
  state.buildings.find(b => b.id === tannerId)!.hp = state.buildings.find(b => b.id === tannerId)!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const tanner = state.buildings.find(b => b.id === tannerId)!;
  // With no preferences, skill-based: v1 (crafting 30) should get tanner
  assert(tanner.assignedWorkers.includes('v1'),
    'After clearing preference, skill-based assignment resumes (v1 gets tanner)');
}

// ========================
// JOB PRIORITIES (1-9 SCALE)
// ========================

console.log('\n=== JobPriority Scale: setJobPriority sets priority ===');
{
  let state = setupColony(1);
  state = setJobPriority(state, 'v1', 'farm', 1);
  assert(state.villagers[0].jobPriorities.farm === 1, 'Priority for farm set to 1');
}

console.log('\n=== JobPriority Scale: multiple priorities ===');
{
  let state = setupColony(1);
  state = setJobPriority(state, 'v1', 'farm', 1);
  state = setJobPriority(state, 'v1', 'woodcutter', 3);
  state = setJobPriority(state, 'v1', 'quarry', 0);
  const v = state.villagers[0];
  assert(v.jobPriorities.farm === 1, 'Farm priority 1');
  assert(v.jobPriorities.woodcutter === 3, 'Woodcutter priority 3');
  assert(v.jobPriorities.quarry === 0, 'Quarry disabled');
}

console.log('\n=== JobPriority Scale: invalid range rejected ===');
{
  let state = setupColony(1);
  state = setJobPriority(state, 'v1', 'farm', 10);
  assert(state.villagers[0].jobPriorities.farm === undefined, 'Priority 10 rejected');
  state = setJobPriority(state, 'v1', 'farm', -1);
  assert(state.villagers[0].jobPriorities.farm === undefined, 'Priority -1 rejected');
}

console.log('\n=== JobPriority Scale: disabled job blocks assignment ===');
{
  let state = setupColony(1);
  state = setJobPriority(state, 'v1', 'farm', 0);

  state = placeBuilding(state, 'farm', 8, 8);
  state.buildings.find(b => b.type === 'farm')!.constructed = true;
  state.buildings.find(b => b.type === 'farm')!.hp = state.buildings.find(b => b.type === 'farm')!.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const v = state.villagers.find(vv => vv.id === 'v1')!;
  assert(v.role !== 'farmer', `Disabled farm: not assigned (role=${v.role})`);
}

console.log('\n=== JobPriority Scale: higher priority preferred ===');
{
  let state = setupColony(1);
  state = setJobPriority(state, 'v1', 'farm', 5);
  state = setJobPriority(state, 'v1', 'woodcutter', 1);

  state = placeBuilding(state, 'farm', 8, 8);
  state = placeBuilding(state, 'woodcutter', 12, 8);
  for (const b of state.buildings) {
    if (b.type === 'farm' || b.type === 'woodcutter') {
      b.constructed = true; b.hp = b.maxHp;
    }
  }

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const v = state.villagers.find(vv => vv.id === 'v1')!;
  assert(v.role === 'woodcutter', `Higher priority woodcutter(1) beats farm(5): role=${v.role}`);
}

console.log('\n=== JobPriority Scale: default villager has empty jobPriorities ===');
{
  const v = createVillager(1, 0, 0);
  assert(Object.keys(v.jobPriorities).length === 0, 'New villager has empty jobPriorities');
}

// ========================
// SUMMARY
// ========================
console.log('\n========================================');
console.log(`V2 Job Priority Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
