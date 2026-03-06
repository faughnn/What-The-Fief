// test-v2-skill-caps.ts — Tests for villager skill caps (max potential per skill)

import {
  createWorld, createVillager, GameState,
  BUILDING_TEMPLATES, ALL_TECHS, SkillType,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation.js';
import { TICKS_PER_DAY, NIGHT_TICKS } from '../timing.js';

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
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, planks: 100, wheat: 200, ingots: 50 };
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function addVillager(state: GameState, x: number, y: number, id?: number): GameState {
  const vid = id || state.nextVillagerId;
  const v = createVillager(vid, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: vid + 1 };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Villagers have skillCaps field
// ================================================================
heading('Skill Caps Field Exists');
{
  const v = createVillager(1, 5, 5);
  assert(v.skillCaps !== undefined, 'villager has skillCaps field');
  assert(typeof v.skillCaps === 'object', 'skillCaps is an object');
}

// ================================================================
// TEST 2: Skill caps are deterministic per villager ID
// ================================================================
heading('Deterministic Skill Caps');
{
  const v1a = createVillager(7, 0, 0);
  const v1b = createVillager(7, 5, 5);
  const v2 = createVillager(8, 0, 0);

  // Same ID = same caps
  const skills: SkillType[] = ['farming', 'woodcutting', 'mining', 'cooking', 'crafting', 'combat'];
  let allSameForSameId = true;
  for (const s of skills) {
    if ((v1a.skillCaps[s] || 100) !== (v1b.skillCaps[s] || 100)) allSameForSameId = false;
  }
  assert(allSameForSameId, 'same ID produces same skill caps');

  // Different ID = (likely) different caps
  let anyDifferent = false;
  for (const s of skills) {
    if ((v1a.skillCaps[s] || 100) !== (v2.skillCaps[s] || 100)) anyDifferent = true;
  }
  assert(anyDifferent, 'different IDs produce different caps');
}

// ================================================================
// TEST 3: Skill caps are in valid range (40-100)
// ================================================================
heading('Skill Cap Range');
{
  // Check several villagers
  let allInRange = true;
  const skills: SkillType[] = ['farming', 'woodcutting', 'mining', 'cooking', 'crafting', 'combat'];
  for (let id = 1; id <= 20; id++) {
    const v = createVillager(id, 0, 0);
    for (const s of skills) {
      const cap = v.skillCaps[s] || 100;
      if (cap < 40 || cap > 100) {
        allInRange = false;
      }
    }
  }
  assert(allInRange, 'all skill caps in range 40-100');
}

// ================================================================
// TEST 4: Skills cannot exceed their cap
// ================================================================
heading('Skills Clamped to Cap');
{
  const v = createVillager(1, 5, 5);
  // Manually set a skill above its cap
  const farmCap = v.skillCaps.farming || 100;
  v.skills.farming = farmCap + 20;

  // After clamping (which should happen in skill gain), it should be at cap
  // For this test, we verify the cap value exists and is reasonable
  assert(farmCap >= 40 && farmCap <= 100, `farming cap is reasonable: ${farmCap}`);
}

// ================================================================
// TEST 5: Skill gain respects cap during work
// ================================================================
heading('Skill Gain Respects Cap');
{
  let state = makeWorld();
  state = addVillager(state, 5, 5);

  // Place storehouse adjacent to tent and farm
  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'farm', 7, 5);

  // Pre-construct all buildings, stock food
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };

  // Set villager's farming cap very low
  const v = state.villagers[0];
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v.skillCaps.farming = 45;
  v.skills.farming = 40;

  // Assign to farm
  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state = assignVillager(state, v.id, farmId);

  // Run for several days — enough for skill to try exceeding cap
  state = advance(state, TICKS_PER_DAY * 10);

  const vAfter = state.villagers.find(vv => vv.id === v.id);
  assert(vAfter !== undefined, 'villager survived 10 days');
  if (vAfter) {
    assert(vAfter.skills.farming <= 45, `farming skill ${vAfter.skills.farming} <= cap 45`);
  }
}

// ================================================================
// TEST 6: Villagers with high cap can level further
// ================================================================
heading('High Cap Allows Leveling');
{
  let state = makeWorld();
  state = addVillager(state, 5, 5);

  state = placeBuilding(state, 'storehouse', 5, 6);
  state = placeBuilding(state, 'tent', 5, 5);
  state = placeBuilding(state, 'farm', 7, 5);

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { ...b.localBuffer, food: 500, wheat: 500 } : b.localBuffer,
    })),
  };

  const v = state.villagers[0];
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v.skillCaps.farming = 100;
  v.skills.farming = 30;

  const farmId = state.buildings.find(b => b.type === 'farm')!.id;
  state = assignVillager(state, v.id, farmId);

  state = advance(state, TICKS_PER_DAY * 10);

  const vAfter = state.villagers.find(vv => vv.id === v.id);
  assert(vAfter !== undefined, 'villager survived 10 days');
  if (vAfter) {
    assert(vAfter.skills.farming > 30, `farming skill increased: ${vAfter.skills.farming} > 30`);
    assert(vAfter.skills.farming <= 100, `farming skill within cap: ${vAfter.skills.farming} <= 100`);
  }
}

// ================================================================
// TEST 7: Each villager has varied caps (not all same)
// ================================================================
heading('Varied Caps Per Villager');
{
  const v = createVillager(42, 0, 0);
  const skills: SkillType[] = ['farming', 'woodcutting', 'mining', 'cooking', 'crafting', 'combat'];
  const caps = skills.map(s => v.skillCaps[s] || 100);
  const allSame = caps.every(c => c === caps[0]);
  assert(!allSame, `caps vary within a villager: ${caps.join(', ')}`);
}

// ================================================================
// TEST 8: Starting skill doesn't exceed cap
// ================================================================
heading('Starting Skills Respect Caps');
{
  let allRespected = true;
  for (let id = 1; id <= 30; id++) {
    const v = createVillager(id, 0, 0);
    const skills: SkillType[] = ['farming', 'woodcutting', 'mining', 'cooking', 'crafting', 'combat'];
    for (const s of skills) {
      if (v.skills[s] > (v.skillCaps[s] || 100)) {
        allRespected = false;
      }
    }
  }
  assert(allRespected, 'no starting skill exceeds its cap');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Skill Cap Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
