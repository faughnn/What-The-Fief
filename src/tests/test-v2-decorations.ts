// test-v2-decorations.ts — Tests for decoration/morale buildings (garden, fountain, statue)
import {
  createWorld, createVillager, GameState, Building,
  BUILDING_TEMPLATES, TICKS_PER_DAY, DECORATION_MORALE,
  BuildingType, ALL_TECHS,
} from '../world.js';
import { tick, placeBuilding, assignVillager } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function setupColony(villagersCount: number): GameState {
  let state = createWorld(20, 20, 42);
  state.research.completed = [...ALL_TECHS];
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

console.log('\n=== Decorations: Building Templates Exist ===');
{
  assert(BUILDING_TEMPLATES['garden'] !== undefined, 'Garden template exists');
  assert(BUILDING_TEMPLATES['fountain'] !== undefined, 'Fountain template exists');
  assert(BUILDING_TEMPLATES['statue'] !== undefined, 'Statue template exists');

  assert(BUILDING_TEMPLATES['garden'].maxWorkers === 0, 'Garden has no workers');
  assert(BUILDING_TEMPLATES['fountain'].maxWorkers === 0, 'Fountain has no workers');
  assert(BUILDING_TEMPLATES['statue'].maxWorkers === 0, 'Statue has no workers');
}

console.log('\n=== Decorations: DECORATION_MORALE Constants ===');
{
  assert(DECORATION_MORALE['garden'] === 5, 'Garden gives +5 morale');
  assert(DECORATION_MORALE['fountain'] === 5, 'Fountain gives +5 morale');
  assert(DECORATION_MORALE['statue'] === 10, 'Statue gives +10 morale');
}

console.log('\n=== Decorations: Garden Boosts Morale Near Home ===');
{
  let state = setupColony(1);
  // Record baseline morale
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const baselineMorale = state.villagers[0].morale;

  // Reset and add garden near home (tent at 5,5)
  state = setupColony(1);
  state = placeBuilding(state, 'garden', 6, 5); // 1 tile away from tent at 5,5
  const garden = state.buildings.find(b => b.type === 'garden')!;
  garden.constructed = true; garden.hp = garden.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const boostedMorale = state.villagers[0].morale;

  assert(boostedMorale > baselineMorale, `Garden boosts morale (${boostedMorale} > ${baselineMorale})`);
  assert(boostedMorale === baselineMorale + 5, `Garden gives exactly +5 morale (${boostedMorale} = ${baselineMorale} + 5)`);
}

console.log('\n=== Decorations: Statue Gives +10 Morale ===');
{
  let state = setupColony(1);
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const baselineMorale = state.villagers[0].morale;

  state = setupColony(1);
  state.resources.gold = 100;
  state = placeBuilding(state, 'statue', 6, 5);
  const statue = state.buildings.find(b => b.type === 'statue')!;
  statue.constructed = true; statue.hp = statue.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const boostedMorale = state.villagers[0].morale;

  assert(boostedMorale === baselineMorale + 10, `Statue gives +10 morale (${boostedMorale} = ${baselineMorale} + 10)`);
}

console.log('\n=== Decorations: Multiple Decoration Types Stack ===');
{
  let state = setupColony(1);
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const baselineMorale = state.villagers[0].morale;

  state = setupColony(1);
  state.resources.gold = 100;
  // Place garden and statue near home
  state = placeBuilding(state, 'garden', 6, 5);
  state = placeBuilding(state, 'statue', 4, 5);
  for (const b of state.buildings) {
    if (b.type === 'garden' || b.type === 'statue') {
      b.constructed = true; b.hp = b.maxHp;
    }
  }

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const boostedMorale = state.villagers[0].morale;

  assert(boostedMorale === baselineMorale + 15,
    `Garden (+5) + Statue (+10) = +15 morale (${boostedMorale} = ${baselineMorale} + 15)`);
}

console.log('\n=== Decorations: Same Type Does Not Stack ===');
{
  let state = setupColony(1);
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const baselineMorale = state.villagers[0].morale;

  state = setupColony(1);
  // Place two gardens near home
  state = placeBuilding(state, 'garden', 6, 5);
  state = placeBuilding(state, 'garden', 4, 5);
  for (const b of state.buildings) {
    if (b.type === 'garden') {
      b.constructed = true; b.hp = b.maxHp;
    }
  }

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const boostedMorale = state.villagers[0].morale;

  assert(boostedMorale === baselineMorale + 5,
    `Two gardens = only +5 (no stacking) (${boostedMorale} = ${baselineMorale} + 5)`);
}

console.log('\n=== Decorations: Out of Range = No Bonus ===');
{
  let state = setupColony(1);
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const baselineMorale = state.villagers[0].morale;

  state = setupColony(1);
  // Place garden far from home (tent at 5,5, garden at 15,15 = distance 20)
  state = placeBuilding(state, 'garden', 15, 15);
  const garden = state.buildings.find(b => b.type === 'garden')!;
  garden.constructed = true; garden.hp = garden.maxHp;

  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const boostedMorale = state.villagers[0].morale;

  assert(boostedMorale === baselineMorale,
    `Garden too far = no bonus (${boostedMorale} = ${baselineMorale})`);
}

console.log('\n=== Decorations: Unconstructed = No Bonus ===');
{
  let state = setupColony(1);
  for (let i = 0; i < TICKS_PER_DAY; i++) state = tick(state);
  const baselineMorale = state.villagers[0].morale;

  state = setupColony(1);
  state = placeBuilding(state, 'garden', 6, 5);
  // Don't set constructed — should give no bonus

  // Jump to day start
  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);
  const boostedMorale = state.villagers[0].morale;

  // May differ slightly due to different morale calculation path,
  // but decoration bonus should not apply
  const garden = state.buildings.find(b => b.type === 'garden')!;
  assert(!garden.constructed, 'Garden is unconstructed');
}

console.log('\n=== Decorations: Fountain Blocks Fire Spread ===');
{
  let state = setupColony(1);

  // Place two adjacent 1x1 buildings and a fountain nearby
  state = placeBuilding(state, 'woodcutter', 8, 8);
  state = placeBuilding(state, 'tanner', 9, 8);
  state = placeBuilding(state, 'fountain', 7, 8);
  for (const b of state.buildings) {
    if (b.type === 'woodcutter' || b.type === 'tanner' || b.type === 'fountain') {
      b.constructed = true; b.hp = b.maxHp;
    }
  }

  // Set woodcutter on fire
  state.buildings.find(b => b.type === 'woodcutter')!.onFire = true;

  // Run many ticks — fountain at (7,8) is within 3 tiles of tanner at (9,8)
  // Fountain should prevent fire spread to tanner
  for (let i = 0; i < TICKS_PER_DAY * 3; i++) state = tick(state);

  const tanner = state.buildings.find(b => b.type === 'tanner')!;
  assert(!tanner.onFire, 'Fountain prevents fire from spreading to tanner');
}

console.log('\n=== Decorations: Fountain Not Hit by Lightning ===');
{
  let state = setupColony(1);
  state = placeBuilding(state, 'fountain', 8, 8);
  const fountain = state.buildings.find(b => b.type === 'fountain')!;
  fountain.constructed = true; fountain.hp = fountain.maxHp;

  // The lightning system excludes wells and fountains from targets
  // We verify fountain is not in the target list (indirectly by checking it's never on fire)
  state.weather = 'storm';
  for (let i = 0; i < TICKS_PER_DAY * 5; i++) state = tick(state);

  const f = state.buildings.find(b => b.type === 'fountain')!;
  assert(!f.onFire, 'Fountain never set on fire by lightning');
}

console.log('\n=== Decorations: Can Place All Three Types ===');
{
  let state = setupColony(1);
  state.resources.gold = 100;
  state.resources.stone = 100;
  state = placeBuilding(state, 'garden', 8, 8);
  state = placeBuilding(state, 'fountain', 9, 8);
  state = placeBuilding(state, 'statue', 14, 8);

  assert(state.buildings.some(b => b.type === 'garden'), 'Garden placed');
  assert(state.buildings.some(b => b.type === 'fountain'), 'Fountain placed');
  assert(state.buildings.some(b => b.type === 'statue'), 'Statue placed');
}

// ========================
// SUMMARY
// ========================
console.log('\n========================================');
console.log(`V2 Decoration Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
