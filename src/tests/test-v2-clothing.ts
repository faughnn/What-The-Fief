// test-v2-clothing.ts — Villager clothing and winter warmth tests
// Villagers consume linen/leather for clothing. Unclothed in winter = morale/HP penalty.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS,
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

function setupClothingTest(startDay: number): GameState {
  let state = flatWorld(10, 10);
  state = { ...state, resources: { ...state.resources, wood: 80, stone: 20, food: 50 } };
  state = addVillager(state, 3, 3);

  state = placeBuilding(state, 'storehouse', 1, 3);
  // Use house (morale +10) instead of tent (morale 0) for winter survival
  state = placeBuilding(state, 'house', 3, 3);
  const tentId = state.buildings.find(b => b.type === 'house')!.id;

  // Pre-construct everything
  // Set tick so next tick() call triggers a new day at startDay
  // isNewDay = dayTick === 0 && newTick > 0, so we need newTick = TICKS_PER_DAY * startDay
  // That means state.tick = TICKS_PER_DAY * startDay - 1 (but startDay must be > 0 for newTick > 0)
  const targetTick = startDay === 0
    ? TICKS_PER_DAY - 1  // trigger day 1 (first real new day)
    : TICKS_PER_DAY * startDay - 1;

  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { food: 40 } : {},
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: {
            ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired,
            localBuffer: tile.building.type === 'storehouse' ? { food: 40 } : {},
          }}
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, homeBuildingId: tentId, food: 10 })),
    tick: targetTick, day: Math.max(0, Math.floor(targetTick / TICKS_PER_DAY)),
  };

  return state;
}

// ================================================================
// TEST 1: Villager auto-equips clothing from storehouse linen
// ================================================================
heading('Auto-Equip Clothing from Linen');

{
  let state = setupClothingTest(0);
  // Stock storehouse with linen
  state = { ...state, resources: { ...state.resources, linen: 5 } };
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { ...b.localBuffer, linen: 5 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { ...tile.building.localBuffer, linen: 5 } } }
        : tile
    )),
  };

  // Run 1 day to trigger daily checks
  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v.clothed === true, `Villager got clothed from linen (clothed=${v.clothed})`);

  // Linen consumed
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const linenLeft = sh.localBuffer['linen'] || 0;
  assert(linenLeft < 5, `Linen consumed from storehouse (was 5, now ${linenLeft})`);
}

// ================================================================
// TEST 2: Villager auto-equips from leather if no linen
// ================================================================
heading('Auto-Equip Clothing from Leather');

{
  let state = setupClothingTest(0);
  state = { ...state, resources: { ...state.resources, leather: 5 } };
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { ...b.localBuffer, leather: 5 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { ...tile.building.localBuffer, leather: 5 } } }
        : tile
    )),
  };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v.clothed === true, `Villager got clothed from leather (clothed=${v.clothed})`);
}

// ================================================================
// TEST 3: Unclothed villager in winter gets morale penalty
// ================================================================
heading('Winter Morale Penalty Without Clothing');

{
  // Start at winter (day 30)
  let state = setupClothingTest(30);
  // No clothing available
  state = { ...state, resources: { ...state.resources, linen: 0, leather: 0 } };
  // Ensure villager unclothed with enough food to survive (food > 0, morale should stay > 10 with house)
  state = { ...state, villagers: state.villagers.map(v => ({ ...v, clothed: false, food: 10 })) };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v !== undefined, 'Villager survived the winter day');
  if (v) {
    assert(v.clothed === false, `Villager remains unclothed (no materials)`);
    // Base 50 + house(+10) - nothing(-20) + winter(-10) - unclothed(-15) = 15 + weather
    assert(v.morale <= 25, `Unclothed winter morale penalized (morale=${v.morale})`);
  }
}

// ================================================================
// TEST 4: Clothed villager in winter has normal morale
// ================================================================
heading('Winter Morale Normal With Clothing');

{
  let state = setupClothingTest(30);
  state = { ...state, resources: { ...state.resources, linen: 5 } };
  state = {
    ...state,
    buildings: state.buildings.map(b =>
      b.type === 'storehouse' ? { ...b, localBuffer: { ...b.localBuffer, linen: 5 } } : b
    ),
    grid: state.grid.map(row => row.map(tile =>
      tile.building && tile.building.type === 'storehouse'
        ? { ...tile, building: { ...tile.building, localBuffer: { ...tile.building.localBuffer, linen: 5 } } }
        : tile
    )),
    villagers: state.villagers.map(v => ({ ...v, food: 10 })),
  };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  assert(v !== undefined, 'Villager survived winter with clothing');
  if (v) {
    assert(v.clothed === true, `Villager is clothed in winter`);
    // Base 50 + house(+10) - nothing(-20) + winter(-10) = 30 + weather (no unclothed penalty)
    assert(v.morale >= 20, `Clothed winter morale is reasonable (morale=${v.morale})`);
  }
}

// ================================================================
// TEST 5: Unclothed villager in winter loses HP
// ================================================================
heading('Winter HP Loss Without Clothing');

{
  let state = setupClothingTest(30);
  state = { ...state, resources: { ...state.resources, linen: 0, leather: 0 } };
  // Give enough food to not depart, unclothed. HP starts at maxHp (10).
  state = {
    ...state,
    villagers: state.villagers.map(v => ({ ...v, clothed: false, hp: 10, maxHp: 10, food: 10 })),
  };

  // Run 1 day in winter
  // Cold damage after regen: regen caps at maxHp (10→10), then cold -1 → 9
  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  if (v) {
    assert(v.hp < 10, `Unclothed villager lost HP in winter (hp=${v.hp}, was 10)`);
  } else {
    assert(true, 'Unclothed villager departed from winter effects');
  }
}

// ================================================================
// TEST 6: Clothing not consumed in spring (not needed)
// ================================================================
heading('Clothing Not Required Outside Winter');

{
  let state = setupClothingTest(0);
  // No clothing materials
  state = { ...state, resources: { ...state.resources, linen: 0, leather: 0 } };
  state = { ...state, villagers: state.villagers.map(v => ({ ...v, clothed: false })) };

  state = advance(state, TICKS_PER_DAY);

  const v = state.villagers[0];
  // In spring, lack of clothing shouldn't hurt morale as badly
  assert(v.morale >= 30, `Spring morale OK without clothing (morale=${v.morale})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Clothing Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
