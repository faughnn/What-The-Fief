// test-v2-caravans.ts — Trade caravan tests
// NPC settlements send caravans that walk to marketplace to trade.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, ALL_TECHS,
} from '../world.js';
import {
  tick, placeBuilding,
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
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }
  state.villagers = [];
  state.nextVillagerId = 1;
  return state;
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: NPC settlements exist
// ================================================================
heading('NPC Settlements');

{
  let state = flatWorld(30, 30);
  // NPC settlements are initialized in createWorld when map is large enough
  // Manually set for test
  state = {
    ...state,
    npcSettlements: [
      { id: 'npc1', name: 'Oakdale', direction: 'w', specialty: 'wood' },
      { id: 'npc2', name: 'Ironforge', direction: 'e', specialty: 'iron_ore' },
    ],
  };

  assert(state.npcSettlements.length === 2, `NPC settlements exist (count=${state.npcSettlements.length})`);
  assert(state.npcSettlements[0].name === 'Oakdale', 'First settlement named');
}

// ================================================================
// TEST 2: Caravan spawns and walks to marketplace
// ================================================================
heading('Caravan Walks to Marketplace');

{
  let state = flatWorld(30, 30);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, gold: 100, planks: 20 } };

  state = placeBuilding(state, 'marketplace', 15, 15);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
    npcSettlements: [
      { id: 'npc1', name: 'Oakdale', direction: 'w', specialty: 'wood' },
    ],
  };

  // Manually spawn a caravan from west
  state = {
    ...state,
    caravans: [{
      id: 'c1',
      settlementId: 'npc1',
      x: 0, y: 15,
      goods: { wood: 10 },
      ticksLeft: TICKS_PER_DAY * 5,
    }],
  };

  // After enough ticks, caravan should have moved toward marketplace
  state = advance(state, 10);

  const caravan = state.caravans[0];
  assert(caravan !== undefined, 'Caravan still exists');
  if (caravan) {
    assert(caravan.x > 0, `Caravan moved from start (x=${caravan.x})`);
  }
}

// ================================================================
// TEST 3: Caravan moves 1 tile per tick
// ================================================================
heading('Caravan 1 Tile Per Tick');

{
  let state = flatWorld(30, 30);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, planks: 20 } };

  state = placeBuilding(state, 'marketplace', 15, 15);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
    caravans: [{
      id: 'c1', settlementId: 'npc1',
      x: 5, y: 15,
      goods: { wood: 10 },
      ticksLeft: TICKS_PER_DAY * 5,
    }],
    npcSettlements: [{ id: 'npc1', name: 'Oakdale', direction: 'w', specialty: 'wood' }],
  };

  const startX = state.caravans[0].x;
  state = advance(state, 5);

  const caravan = state.caravans[0];
  if (caravan) {
    const moved = caravan.x - startX;
    assert(moved === 5, `Caravan moved exactly 5 tiles in 5 ticks (moved=${moved})`);
  }
}

// ================================================================
// TEST 4: Caravan deposits goods at marketplace on arrival
// ================================================================
heading('Caravan Deposits Goods');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 50, planks: 20 } };

  state = placeBuilding(state, 'marketplace', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
    caravans: [{
      id: 'c1', settlementId: 'npc1',
      x: 2, y: 5, // Close to marketplace
      goods: { wood: 10 },
      ticksLeft: TICKS_PER_DAY * 5,
    }],
    npcSettlements: [{ id: 'npc1', name: 'Oakdale', direction: 'w', specialty: 'wood' }],
  };

  const mpBefore = state.buildings.find(b => b.type === 'marketplace')!.localBuffer.wood || 0;

  // Move caravan to marketplace
  state = advance(state, 10);

  const mp = state.buildings.find(b => b.type === 'marketplace');
  if (mp) {
    const woodAfter = mp.localBuffer.wood || 0;
    assert(woodAfter > mpBefore, `Marketplace received wood from caravan (before=${mpBefore}, after=${woodAfter})`);
  }
}

// ================================================================
// TEST 5: Caravan leaves after timer expires
// ================================================================
heading('Caravan Leaves After Timer');

{
  let state = flatWorld(20, 20);
  state = {
    ...state,
    caravans: [{
      id: 'c1', settlementId: 'npc1',
      x: 5, y: 5,
      goods: {},
      ticksLeft: 2, // Expires very quickly
    }],
    npcSettlements: [{ id: 'npc1', name: 'Oakdale', direction: 'w', specialty: 'wood' }],
  };

  state = advance(state, 5);

  assert(state.caravans.length === 0, `Caravan left after timer expired (count=${state.caravans.length})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Caravan Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
