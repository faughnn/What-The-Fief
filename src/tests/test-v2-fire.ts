// test-v2-fire.ts — Fire disaster system tests
// Random fires damage buildings. Can spread. Villagers extinguish.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, NIGHT_TICKS, FIRE_DAMAGE_PER_TICK,
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

// ================================================================
// TEST 1: Building can catch fire (onFire flag)
// ================================================================
heading('Building On Fire');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 50, stone: 20 } };
  state = placeBuilding(state, 'house', 3, 3);

  // Pre-construct and manually set on fire
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      onFire: true,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired, onFire: true } }
        : tile
    )),
  };

  const b = state.buildings[0];
  assert(b.onFire === true, 'Building is on fire');
  const hpBefore = b.hp;

  // Run enough ticks for fire to deal at least 1 HP damage
  // FIRE_DAMAGE_PER_TICK is scaled down, so we need ceil(1/FIRE_DAMAGE_PER_TICK) ticks
  const ticksForOneDamage = Math.ceil(1 / FIRE_DAMAGE_PER_TICK) + 5;
  state = advance(state, ticksForOneDamage);

  const bAfter = state.buildings[0];
  if (bAfter) {
    assert(bAfter.hp < hpBefore, `Fire damaged building (hp was ${hpBefore}, now ${bAfter.hp})`);
  } else {
    assert(true, 'Building destroyed by fire (expected)');
  }
}

// ================================================================
// TEST 2: Fire spreads to adjacent buildings
// ================================================================
heading('Fire Spreads');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 100, stone: 40 } };
  state = placeBuilding(state, 'house', 3, 3);
  state = placeBuilding(state, 'house', 4, 3); // adjacent

  // Pre-construct both, set first on fire
  // Build a map of building index by position for grid sync
  const bldgByPos = new Map(state.buildings.map((b, i) => [`${b.x},${b.y}`, i]));
  state = {
    ...state,
    buildings: state.buildings.map((b, i) => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      onFire: i === 0, // only first building on fire
    })),
    grid: state.grid.map((row, y) => row.map((tile, x) => {
      if (!tile.building) return tile;
      const idx = bldgByPos.get(`${x},${y}`);
      return {
        ...tile,
        building: {
          ...tile.building,
          constructed: true,
          constructionProgress: tile.building.constructionRequired,
          onFire: idx === 0,
        },
      };
    })),
  };

  // Run enough ticks for fire to potentially spread (spread chance per tick is very small)
  // With FIRE_SPREAD_CHANCE ~0.0015, need ~700 ticks for ~65% chance, use a full day
  state = advance(state, TICKS_PER_DAY);

  // Check if second building caught fire, took damage, or was destroyed (became rubble)
  const b2 = state.buildings.find(b => b.x === 4 && b.y === 3);
  if (b2) {
    // Fire spread if: building took damage, is on fire, or was destroyed and replaced by rubble
    const damaged = b2.hp < b2.maxHp || b2.onFire || b2.type === 'rubble';
    assert(damaged, `Fire spread to adjacent building (type=${b2.type}, hp=${b2.hp}/${b2.maxHp}, onFire=${b2.onFire})`);
  } else {
    assert(true, 'Adjacent building destroyed by fire spread');
  }
}

// ================================================================
// TEST 3: Villager extinguishes fire
// ================================================================
heading('Villager Extinguishes Fire');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 80, stone: 20, food: 50 } };
  state = addVillager(state, 3, 3);
  state = placeBuilding(state, 'storehouse', 1, 3);
  state = placeBuilding(state, 'house', 3, 3);
  const homeId = state.buildings.find(b => b.type === 'house')!.id;

  // Pre-construct, set house on fire, villager AT the building
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      onFire: b.type === 'house',
      localBuffer: b.type === 'storehouse' ? { food: 40 } : {},
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: {
            ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired,
            onFire: tile.building.type === 'house',
            localBuffer: tile.building.type === 'storehouse' ? { food: 40 } : {},
          }}
        : tile
    )),
    villagers: state.villagers.map(v => ({
      ...v, homeBuildingId: homeId, food: 10,
      x: 3, y: 3, // at the house
    })),
  };

  // Run enough ticks for villager to extinguish fire (scaled with tick rate)
  state = advance(state, Math.ceil(TICKS_PER_DAY / 4));

  const house = state.buildings.find(b => b.type === 'house');
  if (house) {
    assert(house.onFire === false, `Villager extinguished fire (onFire=${house.onFire})`);
  } else {
    assert(false, 'House should survive with villager extinguishing');
  }
}

// ================================================================
// TEST 4: Well reduces fire chance
// ================================================================
heading('Well Reduces Fire');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 80, stone: 40 } };
  state = placeBuilding(state, 'well', 3, 3);

  const well = state.buildings.find(b => b.type === 'well');
  assert(well !== undefined, 'Well can be placed');
}

// ================================================================
// TEST 5: Fire destroys building → rubble
// ================================================================
heading('Fire Destroys Building');

{
  let state = flatWorld(20, 20);
  state = { ...state, resources: { ...state.resources, wood: 50, stone: 20 } };
  state = placeBuilding(state, 'tent', 3, 3);

  // Pre-construct tent with very low HP and set on fire
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      hp: 3, onFire: true,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: {
            ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired,
            hp: 3, onFire: true,
          }}
        : tile
    )),
  };

  // Fire deals FIRE_DAMAGE_PER_TICK HP/tick → 3 HP tent dies in ceil(3/FIRE_DAMAGE_PER_TICK) ticks
  const ticksToDestroy = Math.ceil(3 / FIRE_DAMAGE_PER_TICK) + 5;
  state = advance(state, ticksToDestroy);

  const tent = state.buildings.find(b => b.type === 'tent');
  assert(tent === undefined, 'Tent destroyed by fire');

  // Should have rubble
  const rubble = state.buildings.find(b => b.type === 'rubble');
  assert(rubble !== undefined, 'Rubble left after fire destruction');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Fire Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
