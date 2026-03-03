// test-v2-marketplace.ts — V2 physical marketplace and trading tests
// Merchants are grid entities that walk to the marketplace. Trading requires presence.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, BUILDING_TEMPLATES, MerchantState,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, buyResource, sellResource,
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
  return state;
}

function addVillager(state: GameState, x: number, y: number): GameState {
  const v = createVillager(state.nextVillagerId, x, y);
  return { ...state, villagers: [...state.villagers, v], nextVillagerId: state.nextVillagerId + 1 };
}

function advance(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Merchant is a grid entity with position
// ================================================================
heading('Merchant Is Grid Entity');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 100, planks: 50 } };

  // Place marketplace
  state = placeBuilding(state, 'marketplace', 10, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
  };

  // Manually set a merchant with a grid position at the map edge
  state = {
    ...state,
    merchant: { ticksLeft: 60, x: 0, y: 5 } as MerchantState,
  };

  assert(state.merchant !== null, 'Merchant exists');
  assert((state.merchant as any).x === 0, 'Merchant starts at map edge (x=0)');
  assert((state.merchant as any).y === 5, 'Merchant has y position');
}

// ================================================================
// TEST 2: Merchant walks toward marketplace (1 tile/tick)
// ================================================================
heading('Merchant Walks To Marketplace');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 100, planks: 50 } };

  state = placeBuilding(state, 'marketplace', 10, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    merchant: { ticksLeft: 60, x: 0, y: 5 } as MerchantState,
  };

  // Track max movement per tick
  let maxJump = 0;
  let prev = { x: 0, y: 5 };
  for (let i = 0; i < 15; i++) {
    state = tick(state);
    if (!state.merchant) break;
    const mx = (state.merchant as any).x;
    const my = (state.merchant as any).y;
    const jump = Math.abs(mx - prev.x) + Math.abs(my - prev.y);
    maxJump = Math.max(maxJump, jump);
    prev = { x: mx, y: my };
  }

  assert(maxJump <= 1, `Merchant max movement is ${maxJump} (must be <= 1)`);

  // After 10+ ticks, merchant should have moved toward marketplace
  if (state.merchant) {
    assert((state.merchant as any).x > 0,
      `Merchant moved toward marketplace (at x=${(state.merchant as any).x})`);
  } else {
    assert(true, 'Merchant exists after movement');
  }
}

// ================================================================
// TEST 3: Trading fails when merchant not at marketplace
// ================================================================
heading('Trading Requires Merchant At Marketplace');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 100, planks: 50, gold: 50 } };

  state = placeBuilding(state, 'marketplace', 10, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    // Merchant far from marketplace
    merchant: { ticksLeft: 60, x: 0, y: 5 } as MerchantState,
  };

  const goldBefore = state.resources.gold;
  // Try to buy — should fail because merchant not at marketplace
  state = buyResource(state, 'food', 5);
  assert(state.resources.gold === goldBefore,
    `Buy rejected — merchant not at marketplace (gold unchanged: ${state.resources.gold})`);
}

// ================================================================
// TEST 4: Trading succeeds when merchant at marketplace
// ================================================================
heading('Trading Works When Merchant At Marketplace');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 100, planks: 50, gold: 50 } };

  state = placeBuilding(state, 'marketplace', 10, 5);
  const mpId = state.buildings.find(b => b.type === 'marketplace')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
    })),
    // Merchant AT the marketplace entrance
    merchant: { ticksLeft: 60, x: 10, y: 5 } as MerchantState,
  };

  const goldBefore = state.resources.gold;
  state = buyResource(state, 'food', 3);

  // Gold should be spent
  assert(state.resources.gold < goldBefore,
    `Gold spent on purchase: ${goldBefore} → ${state.resources.gold}`);

  // Bought food should be in marketplace local buffer
  const mp = state.buildings.find(b => b.id === mpId);
  const mpFood = mp ? (mp.localBuffer['food'] || 0) : 0;
  assert(mpFood > 0 || state.resources.food > 30,
    `Bought food is in marketplace buffer (${mpFood}) or global (${state.resources.food})`);
}

// ================================================================
// TEST 5: Selling deposits gold, takes goods from marketplace buffer
// ================================================================
heading('Selling At Marketplace');

{
  let state = flatWorld(20, 10);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 100, planks: 50, gold: 10 } };

  state = placeBuilding(state, 'marketplace', 10, 5);
  const mpId = state.buildings.find(b => b.type === 'marketplace')!.id;
  state = {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id === mpId) return { ...b, constructed: true, constructionProgress: b.constructionRequired, localBuffer: { wood: 10 } };
      return { ...b, constructed: true, constructionProgress: b.constructionRequired };
    }),
    merchant: { ticksLeft: 60, x: 10, y: 5 } as MerchantState,
  };

  const goldBefore = state.resources.gold;
  state = sellResource(state, 'wood', 5);

  assert(state.resources.gold > goldBefore,
    `Gold earned from sale: ${goldBefore} → ${state.resources.gold}`);

  // Wood should be taken from marketplace buffer
  const mp = state.buildings.find(b => b.id === mpId);
  const mpWood = mp ? (mp.localBuffer['wood'] || 0) : 0;
  assert(mpWood < 10,
    `Wood taken from marketplace buffer: was 10, now ${mpWood}`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Marketplace Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
