// test-v2-bandit-camps.ts — Tests for bandit camp system (persistent world threats)
import {
  createWorld, createVillager, GameState, Building, BanditCamp,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, CONSTRUCTION_TICKS,
  CAMP_BASE_HP, CAMP_HP_PER_LEVEL, CAMP_RAID_INTERVAL,
  CAMP_SPAWN_DAY, CAMP_CLEAR_GOLD, CAMP_CLEAR_RENOWN,
  TICKS_PER_DAY, ENEMY_TEMPLATES,
} from '../world.js';
import { tick, assaultCamp, setGuard, placeBuilding } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

// --- Helper: set up an established colony (pop >= 6, buildings >= 8) ---
function setupEstablishedColony(): GameState {
  let state = createWorld(30, 30, 42);
  // Ensure all grass, fog revealed, and territory around center for building
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  // Place storehouse
  state = placeBuilding(state, 'storehouse', 3, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100, wood: 50, stone: 50 };
  state.resources = { ...state.resources, food: 100, wood: 50, stone: 50, gold: 0 };

  // Place enough buildings (need >= 8 constructed)
  const buildingPositions: [string, number, number][] = [
    ['tent', 5, 10], ['tent', 6, 10], ['tent', 7, 10],
    ['tent', 8, 10], ['tent', 9, 10], ['tent', 10, 10],
    ['farm', 5, 12], ['woodcutter', 8, 12],
  ];
  for (const [type, x, y] of buildingPositions) {
    state = placeBuilding(state, type as any, x, y);
    const b = state.buildings.find(b2 => b2.x === x && b2.y === y && b2.type === type)!;
    b.constructed = true; b.hp = b.maxHp;
  }

  // Add villagers (need >= 6)
  while (state.villagers.length < 8) {
    const v = createVillager(state.nextVillagerId, 5, 11);
    v.food = 8; v.homeBuildingId = state.buildings[1].id;
    state.villagers.push(v);
    state.nextVillagerId++;
  }

  return state;
}

// --- Helper: advance to a specific day ---
function advanceToDayStart(state: GameState, targetDay: number): GameState {
  const targetTick = targetDay * TICKS_PER_DAY;
  while (state.tick < targetTick) {
    state = tick(state);
  }
  return state;
}

// --- Helper: manually add a camp for testing ---
function addTestCamp(state: GameState, x: number, y: number, strength: number = 1): GameState {
  const campHp = CAMP_BASE_HP + strength * CAMP_HP_PER_LEVEL;
  state.banditCamps.push({
    id: `camp${state.nextCampId}`,
    x, y,
    hp: campHp, maxHp: campHp,
    strength,
    lastRaidDay: state.day,
    raidInterval: CAMP_RAID_INTERVAL,
  });
  state.nextCampId++;
  return state;
}

// ========================
// TESTS
// ========================

console.log('\n=== Bandit Camp Data ===');
{
  const state = createWorld(30, 30);
  assert(Array.isArray(state.banditCamps), 'GameState has banditCamps array');
  assert(state.banditCamps.length === 0, 'No camps at start');
  assert(state.nextCampId === 1, 'nextCampId starts at 1');
}

console.log('\n=== Camp Spawning (established colony) ===');
{
  let state = setupEstablishedColony();
  // Advance past CAMP_SPAWN_DAY
  state = advanceToDayStart(state, CAMP_SPAWN_DAY);
  // Run one more tick to trigger daily check
  state = tick(state);

  assert(state.banditCamps.length >= 1, `Camp spawned after day ${CAMP_SPAWN_DAY} (found ${state.banditCamps.length})`);
  if (state.banditCamps.length > 0) {
    const camp = state.banditCamps[0];
    assert(camp.hp > 0, `Camp has HP (${camp.hp})`);
    assert(camp.maxHp === camp.hp, `Camp starts at full HP (${camp.hp}/${camp.maxHp})`);
    // Camp should be at a map edge
    const atEdge = camp.x === 0 || camp.x === state.width - 1 || camp.y === 0 || camp.y === state.height - 1;
    assert(atEdge, `Camp at map edge (${camp.x},${camp.y})`);
    assert(camp.strength >= 1, `Camp has strength >= 1 (${camp.strength})`);
  }
}

console.log('\n=== Camp Does Not Spawn Without Established Colony ===');
{
  let state = createWorld(30, 30);
  // Only 3 villagers, few buildings — below milestone gate
  state = advanceToDayStart(state, CAMP_SPAWN_DAY + 5);
  assert(state.banditCamps.length === 0, 'No camps with small colony');
}

console.log('\n=== Raids Originate From Camps ===');
{
  let state = setupEstablishedColony();
  // Manually add a camp at north edge
  state = addTestCamp(state, 15, 0, 1);
  const camp = state.banditCamps[0];
  // Set lastRaidDay so the interval is exceeded
  camp.lastRaidDay = state.day - CAMP_RAID_INTERVAL - 1;

  // Advance to next day to trigger raid
  const targetTick = (state.day + 1) * TICKS_PER_DAY;
  while (state.tick < targetTick) {
    state = tick(state);
  }
  // One more tick to process the new day
  state = tick(state);

  assert(state.enemies.length > 0, `Enemies spawned from camp (${state.enemies.length} enemies)`);
  if (state.enemies.length > 0) {
    // Enemies should be near the camp position
    const nearCamp = state.enemies.some(e =>
      Math.abs(e.x - 15) <= 2 && Math.abs(e.y - 0) <= 2
    );
    assert(nearCamp, 'Enemies spawned near camp position (15,0)');
  }
  // Check that the camp's lastRaidDay was updated (proves raid came from camp)
  const raidCamp = state.banditCamps.find(c => c.x === 15 && c.y === 0);
  assert(!!raidCamp && raidCamp.lastRaidDay >= state.day - 1, 'Camp lastRaidDay updated after raid');
}

console.log('\n=== Guard Assault Command ===');
{
  let state = setupEstablishedColony();
  state = addTestCamp(state, 15, 0, 1);
  const camp = state.banditCamps[0];

  // Make a guard
  state = setGuard(state, state.villagers[0].id);
  const guard = state.villagers.find(v => v.role === 'guard')!;

  // Issue assault command
  state = assaultCamp(state, guard.id, camp.id);
  const updatedGuard = state.villagers.find(v => v.id === guard.id)!;
  assert(updatedGuard.assaultTargetId === camp.id, `Guard assigned to assault camp (target=${updatedGuard.assaultTargetId})`);
  assert(updatedGuard.state === 'assaulting_camp', `Guard state = assaulting_camp`);
}

console.log('\n=== Guard Moves Toward Camp ===');
{
  let state = setupEstablishedColony();
  state = addTestCamp(state, 15, 0, 1);
  const camp = state.banditCamps[0];

  state = setGuard(state, state.villagers[0].id);
  const guard = state.villagers.find(v => v.role === 'guard')!;
  const startX = guard.x;
  const startY = guard.y;

  state = assaultCamp(state, guard.id, camp.id);

  // Run 5 ticks — guard should move toward camp
  for (let i = 0; i < 5; i++) state = tick(state);

  const movedGuard = state.villagers.find(v => v.id === guard.id)!;
  const startDist = Math.abs(startX - camp.x) + Math.abs(startY - camp.y);
  const newDist = Math.abs(movedGuard.x - camp.x) + Math.abs(movedGuard.y - camp.y);
  assert(newDist < startDist, `Guard moved toward camp (dist: ${startDist} → ${newDist})`);
}

console.log('\n=== Guard Attacks Camp When Adjacent ===');
{
  let state = setupEstablishedColony();
  // Place camp at a reachable position
  state = addTestCamp(state, 5, 9, 1);
  const camp = state.banditCamps[0];
  const campHpBefore = camp.hp;

  // Make guard and place adjacent to camp
  state = setGuard(state, state.villagers[0].id);
  const guard = state.villagers.find(v => v.role === 'guard')!;
  guard.x = 5;
  guard.y = 10; // adjacent to camp at (5,9)

  state = assaultCamp(state, guard.id, camp.id);

  // Run 1 tick — guard should attack camp
  state = tick(state);

  const updatedCamp = state.banditCamps.find(c => c.id === camp.id);
  if (updatedCamp) {
    assert(updatedCamp.hp < campHpBefore, `Camp took damage (HP: ${campHpBefore} → ${updatedCamp.hp})`);
  } else {
    assert(true, 'Camp was destroyed in one hit (very high damage)');
  }
}

console.log('\n=== Camp Fights Back Against Guards ===');
{
  let state = setupEstablishedColony();
  state = addTestCamp(state, 5, 9, 2);

  state = setGuard(state, state.villagers[0].id);
  const guard = state.villagers.find(v => v.role === 'guard')!;
  guard.x = 5;
  guard.y = 10;
  const guardHpBefore = guard.hp;

  state = assaultCamp(state, guard.id, state.banditCamps[0].id);
  state = tick(state);

  const updatedGuard = state.villagers.find(v => v.id === guard.id);
  if (updatedGuard) {
    assert(updatedGuard.hp < guardHpBefore, `Guard took damage from camp (HP: ${guardHpBefore} → ${updatedGuard.hp})`);
  } else {
    assert(true, 'Guard died from camp retaliation (expected for weak guard)');
  }
}

console.log('\n=== Clearing Camp Gives Rewards ===');
{
  let state = setupEstablishedColony();
  // Add a camp with just 1 HP
  state.banditCamps.push({
    id: 'camp_weak',
    x: 5, y: 9,
    hp: 1, maxHp: 30,
    strength: 1,
    lastRaidDay: 0,
    raidInterval: CAMP_RAID_INTERVAL,
  });

  const goldBefore = state.resources.gold;
  const renownBefore = state.renown;

  state = setGuard(state, state.villagers[0].id);
  const guard = state.villagers.find(v => v.role === 'guard')!;
  guard.x = 5;
  guard.y = 10; // adjacent

  state = assaultCamp(state, guard.id, 'camp_weak');
  state = tick(state);

  assert(state.banditCamps.length === 0, 'Camp destroyed and removed');
  assert(state.resources.gold >= goldBefore + CAMP_CLEAR_GOLD, `Gold rewarded (+${CAMP_CLEAR_GOLD}, now ${state.resources.gold})`);
  assert(state.renown >= renownBefore + CAMP_CLEAR_RENOWN, `Renown rewarded (+${CAMP_CLEAR_RENOWN}, now ${state.renown})`);

  // Check guard's assault order is cleared
  const clearedGuard = state.villagers.find(v => v.id === guard.id);
  if (clearedGuard) {
    assert(clearedGuard.assaultTargetId === null, 'Guard assault order cleared after camp destroyed');
  }

  // Check event message
  const clearEvent = state.events.find(e => e.includes('destroyed'));
  assert(!!clearEvent, 'Camp clear event logged');
}

console.log('\n=== Assault Non-Guard Fails ===');
{
  let state = setupEstablishedColony();
  state = addTestCamp(state, 15, 0, 1);
  const farmer = state.villagers.find(v => v.role !== 'guard')!;
  const before = { ...state };
  state = assaultCamp(state, farmer.id, state.banditCamps[0].id);
  assert(state.villagers.find(v => v.id === farmer.id)!.assaultTargetId === null,
    'Non-guard cannot assault camp');
}

console.log('\n=== Assault Invalid Camp Fails ===');
{
  let state = setupEstablishedColony();
  state = setGuard(state, state.villagers[0].id);
  state = assaultCamp(state, state.villagers[0].id, 'camp_nonexistent');
  assert(state.villagers[0].assaultTargetId === null, 'Cannot assault nonexistent camp');
}

console.log('\n=== Fallback Raid (No Camps) Still Works ===');
{
  let state = setupEstablishedColony();
  // Ensure no camps
  assert(state.banditCamps.length === 0, 'No camps present');
  // Manually pump raidBar
  state.raidBar = 100;
  // Advance to next new day
  const targetDay = state.day + 1;
  state = advanceToDayStart(state, targetDay);
  state = tick(state);
  assert(state.enemies.length > 0, `Fallback raid spawned without camps (${state.enemies.length} enemies)`);
}

console.log('\n=== Camp Max Count ===');
{
  let state = setupEstablishedColony();
  // Add 3 camps (max)
  state = addTestCamp(state, 15, 0, 1);
  state = addTestCamp(state, 0, 15, 1);
  state = addTestCamp(state, 29, 15, 1);
  assert(state.banditCamps.length === 3, '3 camps placed');

  // Advance well past spawn interval — should NOT add a 4th camp
  state = advanceToDayStart(state, CAMP_SPAWN_DAY + 100);
  state = tick(state);
  assert(state.banditCamps.length <= 3, `No more than 3 camps (${state.banditCamps.length})`);
}

console.log('\n=== Weapon Damage to Camp ===');
{
  let state = setupEstablishedColony();
  state = addTestCamp(state, 5, 9, 1);
  const camp = state.banditCamps[0];

  // Give guard a sword
  state = setGuard(state, state.villagers[0].id);
  const guard = state.villagers.find(v => v.role === 'guard')!;
  guard.x = 5; guard.y = 10;
  guard.weapon = 'sword'; guard.weaponDurability = 40;
  state.resources.sword = 1; // for re-equip if needed

  const campHpBefore = camp.hp;
  state = assaultCamp(state, guard.id, camp.id);
  state = tick(state);

  const updatedCamp = state.banditCamps.find(c => c.id === camp.id);
  if (updatedCamp) {
    // Sword attack = 6, should deal at least 6 damage
    const dmg = campHpBefore - updatedCamp.hp;
    assert(dmg >= 6, `Sword dealt ${dmg} damage to camp (expected >= 6)`);
  } else {
    assert(true, 'Camp destroyed by sword (high damage)');
  }
}

// ========================
// SUMMARY
// ========================
console.log('\n========================================');
console.log(`V2 Bandit Camp Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
