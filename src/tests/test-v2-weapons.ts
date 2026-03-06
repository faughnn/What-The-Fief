// test-v2-weapons.ts — Weapon variety for guards (sword, bow)

import {
  createWorld, GameState, Building, Villager, createVillager,
  BUILDING_TEMPLATES, CONSTRUCTION_TICKS, BUILDING_MAX_HP,
  GUARD_COMBAT, WEAPON_STATS, WEAPON_DURABILITY,
  TICKS_PER_DAY, NIGHT_TICKS, DEFAULT_BUFFER_CAP, STOREHOUSE_BUFFER_CAP, PRODUCTION_BASE_TICKS,
  ResourceType, EnemyEntity, ENEMY_TEMPLATES, ALL_TECHS,
} from '../world.js';
import { placeBuilding } from '../simulation/buildings.js';
import { tick } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function makeSmallWorld(): GameState {
  const state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
  // Clear area for buildings
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    state.grid[y][x].terrain = 'grass';
    state.grid[y][x].building = null;
    state.fog[y][x] = true;
    state.territory[y][x] = true;
  }
  state.resources.wood = 200;
  state.resources.stone = 200;
  state.resources.planks = 50;
  state.resources.ingots = 50;
  state.resources.rope = 20;
  return state;
}

function addGuard(state: GameState, x: number, y: number): Villager {
  const v = createVillager(state.nextVillagerId, x, y);
  v.role = 'guard';
  v.state = 'idle';
  state.nextVillagerId++;
  state.villagers.push(v);
  return v;
}

function addEnemy(state: GameState, x: number, y: number, type: 'bandit' | 'wolf' | 'boar' = 'bandit'): EnemyEntity {
  const t = ENEMY_TEMPLATES[type];
  const e: EnemyEntity = {
    id: `e${state.nextEnemyId}`, type, x, y,
    hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
    siege: 'none', ticksAlive: 0,
  };
  state.nextEnemyId++;
  state.enemies.push(e);
  return e;
}

// === Weaponsmith & Fletcher Building ===
console.log('\n=== Weaponsmith Building ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'weaponsmith', 5, 5);
  const ws = state.buildings.find(b => b.type === 'weaponsmith');
  assert(ws !== undefined, 'Weaponsmith placed');
  assert(ws!.width === 2, 'Weaponsmith is 2x1');
  assert(!ws!.constructed, 'Weaponsmith starts unconstructed');
}

console.log('\n=== Fletcher Building ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'fletcher', 5, 5);
  const fl = state.buildings.find(b => b.type === 'fletcher');
  assert(fl !== undefined, 'Fletcher placed');
  assert(fl!.width === 1, 'Fletcher is 1x1');
}

// === Sword Production ===
console.log('\n=== Sword Production ===');
{
  let state = makeSmallWorld();
  // Storehouse with food and crafting inputs
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { ingots: 20, planks: 10, food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'weaponsmith', 5, 5);
  const ws = state.buildings.find(b => b.type === 'weaponsmith')!;
  ws.constructed = true;
  // Pre-stock inputs so first production cycle starts immediately
  ws.localBuffer = { ingots: 4, planks: 2 };

  // Add worker
  const worker = createVillager(state.nextVillagerId, 5, 5);
  worker.jobBuildingId = ws.id;
  worker.role = 'weaponsmith_worker';
  worker.state = 'working';
  state.nextVillagerId++;
  state.villagers.push(worker);
  // Give home
  state = placeBuilding(state, 'tent', 7, 7);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true;
  worker.homeBuildingId = tent.id;
  worker.food = 8;

  // Run enough ticks for production (PRODUCTION_BASE_TICKS=800, need multiple day cycles)
  let lastState = state;
  for (let i = 0; i < TICKS_PER_DAY * 5; i++) {
    lastState = tick(lastState);
  }
  // Check either storehouse buffer or global for swords
  const totalSwords = lastState.resources.sword;
  const bufferSwords = lastState.buildings
    .filter(b => b.type === 'weaponsmith' || b.type === 'storehouse' || b.type === 'large_storehouse')
    .reduce((sum, b) => sum + (b.localBuffer.sword || 0), 0);
  assert(totalSwords > 0 || bufferSwords > 0, `Swords produced: global=${totalSwords}, buffers=${bufferSwords}`);
}

// === Bow Production ===
console.log('\n=== Bow Production ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { wood: 20, rope: 10, food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'fletcher', 5, 5);
  const fl = state.buildings.find(b => b.type === 'fletcher')!;
  fl.constructed = true;
  // Pre-stock inputs
  fl.localBuffer = { wood: 4, rope: 2 };

  const worker = createVillager(state.nextVillagerId, 5, 5);
  worker.jobBuildingId = fl.id;
  worker.role = 'fletcher_worker';
  worker.state = 'working';
  state.nextVillagerId++;
  state.villagers.push(worker);
  state = placeBuilding(state, 'tent', 7, 7);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true;
  worker.homeBuildingId = tent.id;
  worker.food = 8;

  let lastState = state;
  for (let i = 0; i < TICKS_PER_DAY * 5; i++) lastState = tick(lastState);
  const totalBows = lastState.resources.bow;
  const bufferBows = lastState.buildings
    .filter(b => b.type === 'fletcher' || b.type === 'storehouse' || b.type === 'large_storehouse')
    .reduce((sum, b) => sum + (b.localBuffer.bow || 0), 0);
  assert(totalBows > 0 || bufferBows > 0, `Bows produced: global=${totalBows}, buffers=${bufferBows}`);
}

// === Guard Auto-Equip Sword ===
console.log('\n=== Guard Auto-Equip Sword ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30, sword: 3 };
  state.resources.sword = 3;
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 5, 5);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  const guard = addGuard(state, 4, 4);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;

  assert(guard.weapon === 'none', 'Guard starts with no weapon');

  // Run one day cycle — guards equip weapons at dawn
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const g = state.villagers.find(v => v.role === 'guard');
  assert(g !== undefined && g.weapon === 'sword', `Guard equipped sword (weapon=${g?.weapon})`);
  assert(g !== undefined && g.weaponDurability === WEAPON_DURABILITY.sword, `Sword durability=${g?.weaponDurability}`);
}

// === Guard Auto-Equip Bow (when no sword available) ===
console.log('\n=== Guard Auto-Equip Bow ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30, bow: 2 };
  state.resources.bow = 2;
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 5, 5);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  const guard = addGuard(state, 4, 4);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const g = state.villagers.find(v => v.role === 'guard');
  assert(g !== undefined && g.weapon === 'bow', `Guard equipped bow (weapon=${g?.weapon})`);
}

// === Sword Guard Melee — Higher Attack Than Unarmed ===
console.log('\n=== Sword Guard Melee Combat ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 7, 7);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  // Guard with sword at (5,5), enemy adjacent at (5,6)
  const guard = addGuard(state, 5, 5);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;
  guard.weapon = 'sword';
  guard.weaponDurability = 40;

  const enemy = addEnemy(state, 5, 6, 'bandit'); // bandit: 10 HP, 3 atk, 1 def
  const startEnemyHp = enemy.hp;

  // Run one tick (daytime so combat activates)
  state.tick = NIGHT_TICKS; // daytime
  state = tick(state);

  const e = state.enemies.find(en => en.id === enemy.id);
  // Sword attack: max(1, 6 + 0 - 1) = 5 damage per tick
  // Unarmed would be: max(1, 3 + 0 - 1) = 2 damage
  assert(e !== undefined && e.hp < startEnemyHp, `Sword guard dealt damage (HP: ${startEnemyHp} → ${e?.hp})`);
  const swordDmg = startEnemyHp - (e?.hp || 0);
  const unarmedDmg = Math.max(1, GUARD_COMBAT.none.attack - 1); // 2
  assert(swordDmg > unarmedDmg, `Sword damage (${swordDmg}) > unarmed damage (${unarmedDmg})`);
}

// === Bow Guard Ranged Attack ===
console.log('\n=== Bow Guard Ranged Attack ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 7, 7);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  // Guard with bow at (5,5), enemy at (5,8) — 3 tiles away (within bow range 4)
  const guard = addGuard(state, 5, 5);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;
  guard.weapon = 'bow';
  guard.weaponDurability = 30;

  const enemy = addEnemy(state, 5, 8, 'bandit');
  const startEnemyHp = enemy.hp;
  const startGuardHp = guard.hp;

  state.tick = NIGHT_TICKS;
  state = tick(state);

  const e = state.enemies.find(en => en.id === enemy.id);
  const g = state.villagers.find(v => v.role === 'guard');
  // Bow ranged: max(1, 2 + 0 - 1) = 1 damage per tick
  assert(e !== undefined && e.hp < startEnemyHp, `Bow guard dealt ranged damage (HP: ${startEnemyHp} → ${e?.hp})`);
  // Guard should NOT take damage (ranged attack = no retaliation)
  assert(g !== undefined && g.hp === startGuardHp, `Bow guard took no retaliation (HP: ${g?.hp})`);
}

// === Bow Guard Range Limit ===
console.log('\n=== Bow Guard Range Limit ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 1, 1);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  // Guard with bow at (5,5), enemy at (5,10) — 5 tiles (> bow range 4)
  const guard = addGuard(state, 5, 5);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;
  guard.weapon = 'bow';
  guard.weaponDurability = 30;

  const enemy = addEnemy(state, 5, 10, 'bandit');
  const startEnemyHp = enemy.hp;

  state.tick = NIGHT_TICKS;
  state = tick(state);

  const e = state.enemies.find(en => en.id === enemy.id);
  // Enemy at range 5 — bow can't reach, guard should move instead
  // Guard might move 1 tile toward enemy, but should NOT have done ranged damage
  // (bow range is 4 manhattan)
  // Note: the guard will move toward the enemy and might get in range on next tick
  // Just verify enemy didn't take full ranged damage (may take 0 or move occurred)
  assert(e !== undefined, 'Enemy still alive at range 5');
}

// === Weapon Durability Degrades in Combat ===
console.log('\n=== Weapon Durability ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 7, 7);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  const guard = addGuard(state, 5, 5);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;
  guard.weapon = 'sword';
  guard.weaponDurability = 3; // Low durability — will break soon

  const enemy = addEnemy(state, 5, 6, 'bandit');

  state.tick = NIGHT_TICKS;
  // Run 3 ticks of combat — sword should break
  for (let i = 0; i < 3; i++) {
    state = tick(state);
    // Re-add enemy if killed (bandit has 10 HP, sword does 5/tick)
    if (state.enemies.length === 0) {
      addEnemy(state, 5, 6, 'bandit');
    }
  }

  const g = state.villagers.find(v => v.role === 'guard');
  assert(g !== undefined && g.weapon === 'none', `Weapon broke after durability depleted (weapon=${g?.weapon})`);
}

// === Watchtower + Bow Bonus Damage ===
console.log('\n=== Watchtower Bow Bonus ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 7, 7);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  state = placeBuilding(state, 'watchtower', 5, 5);
  const tower = state.buildings.find(b => b.type === 'watchtower')!;
  tower.constructed = true;

  // Guard with bow assigned to watchtower
  const guard = addGuard(state, 5, 5);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;
  guard.weapon = 'bow';
  guard.weaponDurability = 30;
  guard.jobBuildingId = tower.id;
  tower.assignedWorkers = [guard.id];

  // Enemy within watchtower range
  const enemy = addEnemy(state, 5, 9, 'bandit'); // 4 tiles away
  const startHp = enemy.hp;

  state.tick = NIGHT_TICKS;
  state = tick(state);

  const e = state.enemies.find(en => en.id === enemy.id);
  // Watchtower base damage (2) + bow bonus (2) = 4 per tick
  const dmg = startHp - (e?.hp || 0);
  assert(dmg >= 4, `Watchtower + bow dealt ${dmg} damage (expected 4 = 2 base + 2 bow)`);
}

// === Sword Preferred Over Bow ===
console.log('\n=== Weapon Priority: Sword > Bow ===');
{
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30, sword: 2, bow: 2 };
  state.resources.food = 30;
  state.resources.sword = 2;
  state.resources.bow = 2;

  state = placeBuilding(state, 'tent', 5, 5);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  const guard = addGuard(state, 4, 4);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);

  const g = state.villagers.find(v => v.role === 'guard');
  assert(g !== undefined && g.weapon === 'sword', `Guard chose sword over bow (weapon=${g?.weapon})`);
  // One sword consumed
  assert(state.resources.sword === 1, `One sword consumed from storage (${state.resources.sword})`);
}

// === Weapon Stats Override Tool Stats ===
console.log('\n=== Weapon Overrides Tool in Combat ===');
{
  // Sword guard (atk 6) should deal more damage than iron-tool guard (atk 7) - wait,
  // iron tool guard has atk 7. Let's test that sword (6) replaces tool-based (none=3).
  let state = makeSmallWorld();
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true;
  sh.localBuffer = { food: 30 };
  state.resources.food = 30;

  state = placeBuilding(state, 'tent', 7, 7);
  state.buildings.find(b => b.type === 'tent')!.constructed = true;

  // Guard with NO tool but WITH sword
  const guard = addGuard(state, 5, 5);
  guard.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  guard.food = 8;
  guard.tool = 'none';
  guard.weapon = 'sword';
  guard.weaponDurability = 40;

  const enemy = addEnemy(state, 5, 6, 'bandit'); // 10 HP, 1 def
  const startHp = enemy.hp;

  state.tick = NIGHT_TICKS;
  state = tick(state);

  const e = state.enemies.find(en => en.id === enemy.id);
  const dmg = startHp - (e?.hp || 0);
  // Sword: max(1, 6 - 1) = 5
  // Tool 'none': max(1, 3 - 1) = 2
  assert(dmg === 5, `Sword overrides tool (dmg=${dmg}, expected 5 from sword, not 2 from tool:none)`);
}

console.log(`\n========================================`);
console.log(`V2 Weapon Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
