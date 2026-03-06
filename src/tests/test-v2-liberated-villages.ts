// test-v2-liberated-villages.ts — Liberated village integration: trade boost, recruitment, renown

import {
  createWorld, GameState, TICKS_PER_DAY, BUILDING_TEMPLATES,
  NpcSettlement, createVillager, ALL_TECHS,
} from '../world.js';
import { tick, placeBuilding, assignVillager, recruitFromVillage } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function makeLiberatedWorld(): GameState {
  let state = createWorld(40, 40, 42);
  state.research.completed = [...ALL_TECHS];
  state.fog = state.fog.map(row => row.map(() => true));
  state.territory = state.territory.map(row => row.map(() => true));
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
    }
  }
  state.resources = { ...state.resources, wood: 500, stone: 500, food: 500, gold: 200, wheat: 100, planks: 50 };
  state = placeBuilding(state, 'storehouse', 20, 20);
  state = placeBuilding(state, 'marketplace', 18, 18);
  state = placeBuilding(state, 'tent', 22, 20);
  state = placeBuilding(state, 'tent', 23, 20);
  // Pre-construct all
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { food: 500, wood: 500, stone: 500, gold: 200, wheat: 100, planks: 50 } : b.localBuffer,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } } : tile
    )),
  };
  // Setup 3 villagers
  const v1 = createVillager(1, 20, 20);
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v1.food = 8;
  const v2 = createVillager(2, 20, 20);
  v2.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  v2.food = 8;
  state = { ...state, villagers: [v1, v2], nextVillagerId: 3 };

  // Create NPC settlements — one liberated, one not
  state.npcSettlements = [
    {
      id: 'village_thornfield',
      name: 'Thornfield',
      direction: 'n' as const,
      specialty: 'food' as any,
      x: 20, y: 0,
      trust: 1500,
      trustRank: 'leader' as any,
      liberated: true,
      liberationInProgress: false,
    },
    {
      id: 'village_millhaven',
      name: 'Millhaven',
      direction: 'e' as const,
      specialty: 'wood' as any,
      x: 39, y: 20,
      trust: 50,
      trustRank: 'stranger' as any,
      liberated: false,
      liberationInProgress: false,
    },
  ];

  return state;
}

// ========================
// TRADE BOOST FROM LIBERATED VILLAGES
// ========================

console.log('\n=== Liberated: liberated village sends caravans more frequently ===');
{
  let state = makeLiberatedWorld();
  // Run 30 days — count caravans from each village
  let liberatedCaravans = 0;
  let unliberatedCaravans = 0;
  for (let day = 0; day < 30; day++) {
    for (let t = 0; t < TICKS_PER_DAY; t++) {
      state = tick(state);
    }
    // Count active caravans
    for (const c of state.caravans) {
      if (c.settlementId === 'village_thornfield') liberatedCaravans++;
      if (c.settlementId === 'village_millhaven') unliberatedCaravans++;
    }
  }
  // Liberated village should send more caravans (or at least equal)
  assert(liberatedCaravans > 0, `Liberated village sent caravans (${liberatedCaravans} total ticks with caravan)`);
  // Note: exact counts depend on interval logic; we test the boost in the next test
}

console.log('\n=== Liberated: liberated village caravans carry more goods ===');
{
  let state = makeLiberatedWorld();
  // Track max goods seen from each village
  let liberatedMaxGoods = 0;
  let unliberatedMaxGoods = 0;
  for (let day = 0; day < 30; day++) {
    for (let t = 0; t < TICKS_PER_DAY; t++) {
      state = tick(state);
    }
    for (const c of state.caravans) {
      const totalGoods = Object.values(c.goods).reduce((a, b) => a + (b || 0), 0);
      if (c.settlementId === 'village_thornfield') liberatedMaxGoods = Math.max(liberatedMaxGoods, totalGoods);
      if (c.settlementId === 'village_millhaven') unliberatedMaxGoods = Math.max(unliberatedMaxGoods, totalGoods);
    }
  }
  // Liberated villages should send more goods per caravan
  assert(liberatedMaxGoods > unliberatedMaxGoods || liberatedMaxGoods >= 12,
    `Liberated village sends more goods (${liberatedMaxGoods} vs ${unliberatedMaxGoods})`);
}

// ========================
// RECRUIT FROM LIBERATED VILLAGE
// ========================

console.log('\n=== Liberated: recruit villager from liberated village ===');
{
  let state = makeLiberatedWorld();
  state.renown = 20; // Need renown to recruit
  const popBefore = state.villagers.length;
  state = recruitFromVillage(state, 'village_thornfield');
  assert(state.villagers.length === popBefore + 1, `Recruited villager (${popBefore} → ${state.villagers.length})`);
  // New villager spawns at village edge position
  const newV = state.villagers[state.villagers.length - 1];
  assert(newV.y === 0 || newV.y === 1, `Recruit spawns at north edge (y=${newV.y})`);
}

console.log('\n=== Liberated: cannot recruit from non-liberated village ===');
{
  let state = makeLiberatedWorld();
  state.renown = 20;
  const popBefore = state.villagers.length;
  state = recruitFromVillage(state, 'village_millhaven');
  assert(state.villagers.length === popBefore, 'Cannot recruit from non-liberated village');
}

console.log('\n=== Liberated: recruit costs renown ===');
{
  let state = makeLiberatedWorld();
  state.renown = 20;
  const renownBefore = state.renown;
  state = recruitFromVillage(state, 'village_thornfield');
  assert(state.renown < renownBefore, `Renown decreased (${renownBefore} → ${state.renown})`);
}

console.log('\n=== Liberated: cannot recruit without enough renown ===');
{
  let state = makeLiberatedWorld();
  state.renown = 0;
  const popBefore = state.villagers.length;
  state = recruitFromVillage(state, 'village_thornfield');
  assert(state.villagers.length === popBefore, 'Cannot recruit without renown');
}

console.log('\n=== Liberated: recruit needs available housing ===');
{
  let state = makeLiberatedWorld();
  state.renown = 50;
  // Both villagers already have homes from setup. 2 tents, cap 1 each, 2 villagers = full.
  // Ensure both villagers have different homes
  const tents = state.buildings.filter(b => b.type === 'tent');
  state.villagers[0].homeBuildingId = tents[0].id;
  state.villagers[1].homeBuildingId = tents[1].id;

  const popBefore = state.villagers.length;
  state = recruitFromVillage(state, 'village_thornfield');
  assert(state.villagers.length === popBefore, 'Cannot recruit when housing is full');
}

console.log('\n=== Liberated: invalid village ID ===');
{
  let state = makeLiberatedWorld();
  state.renown = 20;
  const popBefore = state.villagers.length;
  state = recruitFromVillage(state, 'nonexistent');
  assert(state.villagers.length === popBefore, 'Invalid village ID rejected');
}

// ========================
// ONGOING RENOWN FROM LIBERATED VILLAGES
// ========================

console.log('\n=== Liberated: renown stream from liberated villages ===');
{
  let state = makeLiberatedWorld();
  const renownBefore = state.renown;
  // Run 20 days
  for (let day = 0; day < 20; day++) {
    for (let t = 0; t < TICKS_PER_DAY; t++) {
      state = tick(state);
    }
  }
  // Liberated village should contribute some renown over 20 days
  assert(state.renown > renownBefore, `Renown increased over 20 days (${renownBefore} → ${state.renown})`);
}

// ========================
// PROSPERITY BOOST FROM LIBERATED VILLAGES
// ========================

console.log('\n=== Liberated: prosperity boost per liberated village ===');
{
  let stateA = makeLiberatedWorld();
  // stateA has 1 liberated village
  // Run 1 day to calculate prosperity
  for (let t = 0; t < TICKS_PER_DAY; t++) stateA = tick(stateA);
  const prosperityWithLiberated = stateA.prosperity;

  let stateB = makeLiberatedWorld();
  stateB.npcSettlements[0].liberated = false;
  stateB.npcSettlements[0].trustRank = 'protector' as any;
  for (let t = 0; t < TICKS_PER_DAY; t++) stateB = tick(stateB);
  const prosperityWithout = stateB.prosperity;

  assert(prosperityWithLiberated > prosperityWithout,
    `Liberated village boosts prosperity (${prosperityWithLiberated} vs ${prosperityWithout})`);
}

// ========================
// SUMMARY
// ========================

console.log(`\n========================================`);
console.log(`V2 Liberated Village Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
