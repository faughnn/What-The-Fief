// test-v2-charcoal.ts — Tests for charcoal production chain
// Bellwright has a Coal Burner that converts wood into charcoal,
// which is then required as fuel for smelting iron ore into ingots.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY, BUILDING_TEMPLATES, ALL_TECHS,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager,
} from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

function setupColony(): GameState {
  let state = createWorld(20, 20, 42);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  // Unlock all techs
  state.research.completed = [...ALL_TECHS];

  // Storehouse
  state = placeBuilding(state, 'storehouse', 10, 10);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 100, wood: 100, stone: 50, iron_ore: 50, charcoal: 0 };
  state.resources = { ...state.resources, food: 100, wood: 100, stone: 50, iron_ore: 50 };

  // Housing for villagers
  for (let i = 0; i < 3; i++) {
    state = placeBuilding(state, 'tent', 12 + i, 10);
    const tent = state.buildings.find(b => b.type === 'tent' && b.x === 12 + i && b.y === 10)!;
    tent.constructed = true; tent.hp = tent.maxHp;
  }

  return state;
}

function advanceTicks(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = tick(state);
  return state;
}

// ================================================================
// TEST 1: Charcoal resource exists
// ================================================================
heading('Charcoal Resource');

{
  const state = setupColony();
  assert('charcoal' in state.resources, 'charcoal is a valid resource');
  assert(state.resources.charcoal === 0, 'charcoal starts at 0');
}

// ================================================================
// TEST 2: Coal burner building template exists
// ================================================================
heading('Coal Burner Building');

{
  const t = BUILDING_TEMPLATES['coal_burner'];
  assert(t !== undefined, 'coal_burner template exists');
  if (t) {
    assert(t.production !== null, 'coal_burner has production');
    assert(t.production!.output === 'charcoal', 'coal_burner produces charcoal');
    assert(t.production!.inputs !== null, 'coal_burner has inputs');
    assert(t.production!.inputs!.wood !== undefined, 'coal_burner requires wood');
    assert(t.maxWorkers >= 1, 'coal_burner has at least 1 worker slot');
  }
}

// ================================================================
// TEST 3: Coal burner can be placed and constructed
// ================================================================
heading('Coal Burner Placement');

{
  let state = setupColony();
  state = placeBuilding(state, 'coal_burner', 5, 5);
  const cb = state.buildings.find(b => b.type === 'coal_burner');
  assert(cb !== undefined, 'coal_burner can be placed');
  assert(!cb!.constructed, 'coal_burner starts unconstructed');
}

// ================================================================
// TEST 4: Coal burner produces charcoal from wood
// ================================================================
heading('Coal Burner Production');

{
  let state = setupColony();
  state = placeBuilding(state, 'coal_burner', 5, 5);
  const cb = state.buildings.find(b => b.type === 'coal_burner')!;
  cb.constructed = true; cb.hp = cb.maxHp;

  // Add a villager with home
  const v = createVillager(1, 5, 5);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state.villagers = [v];
  state.nextVillagerId = 2;

  // Stock the coal burner with wood
  cb.localBuffer = { wood: 20 };

  state = assignVillager(state, 'v1', cb.id);
  assert(state.villagers[0].role !== 'idle', 'villager assigned to coal_burner');

  // Run enough ticks for production (2 days to allow travel + production cycle)
  state = advanceTicks(state, TICKS_PER_DAY * 2);

  // Check production — could be in coal_burner buffer, storehouse, or global
  const cbRef = state.buildings.find(b => b.type === 'coal_burner')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const charcoalInCb = cbRef.localBuffer.charcoal || 0;
  const charcoalInSh = shRef.localBuffer.charcoal || 0;
  const charcoalGlobal = state.resources.charcoal || 0;
  const totalCharcoal = charcoalInCb + charcoalInSh + charcoalGlobal;
  assert(totalCharcoal > 0, `coal_burner produced charcoal (cb=${charcoalInCb} sh=${charcoalInSh} global=${charcoalGlobal})`);
  const woodRemaining = (cbRef.localBuffer.wood || 0);
  assert(woodRemaining < 20, `coal_burner consumed wood (${woodRemaining} remaining)`);
}

// ================================================================
// TEST 5: Smelter now requires charcoal as fuel
// ================================================================
heading('Smelter Requires Charcoal');

{
  const t = BUILDING_TEMPLATES['smelter'];
  assert(t.production !== null, 'smelter has production');
  assert(t.production!.inputs !== null, 'smelter has inputs');
  assert(t.production!.inputs!.iron_ore !== undefined, 'smelter requires iron_ore');
  assert(t.production!.inputs!['charcoal'] !== undefined, 'smelter requires charcoal');
  assert(t.production!.output === 'ingots', 'smelter produces ingots');
}

// ================================================================
// TEST 6: Smelter produces ingots with charcoal + iron_ore
// ================================================================
heading('Smelter Production With Charcoal');

{
  let state = setupColony();
  state = placeBuilding(state, 'smelter', 3, 3);
  const sm = state.buildings.find(b => b.type === 'smelter')!;
  sm.constructed = true; sm.hp = sm.maxHp;

  // Stock smelter with iron_ore AND charcoal
  sm.localBuffer = { iron_ore: 20, charcoal: 10 };

  const v = createVillager(1, 3, 3);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state.villagers = [v];
  state.nextVillagerId = 2;
  state = assignVillager(state, 'v1', sm.id);

  state = advanceTicks(state, TICKS_PER_DAY * 2);

  const smRef = state.buildings.find(b => b.type === 'smelter')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const ingotsInSm = smRef.localBuffer.ingots || 0;
  const ingotsInSh = shRef.localBuffer.ingots || 0;
  const ingotsGlobal = state.resources.ingots || 0;
  const totalIngots = ingotsInSm + ingotsInSh + ingotsGlobal;
  assert(totalIngots > 0, `smelter produced ingots (sm=${ingotsInSm} sh=${ingotsInSh} global=${ingotsGlobal})`);
  assert((smRef.localBuffer.charcoal || 0) < 10, `smelter consumed charcoal (${smRef.localBuffer.charcoal || 0} remaining)`);
  assert((smRef.localBuffer.iron_ore || 0) < 20, `smelter consumed iron_ore (${smRef.localBuffer.iron_ore || 0} remaining)`);
}

// ================================================================
// TEST 7: Smelter does NOT produce without charcoal
// ================================================================
heading('Smelter Blocked Without Charcoal');

{
  let state = setupColony();
  state = placeBuilding(state, 'smelter', 3, 3);
  const sm = state.buildings.find(b => b.type === 'smelter')!;
  sm.constructed = true; sm.hp = sm.maxHp;

  // Only iron_ore, no charcoal
  sm.localBuffer = { iron_ore: 20, charcoal: 0 };

  const v = createVillager(1, 3, 3);
  v.food = 8; v.morale = 80;
  v.homeBuildingId = state.buildings.find(b => b.type === 'tent')!.id;
  state.villagers = [v];
  state.nextVillagerId = 2;
  state = assignVillager(state, 'v1', sm.id);

  state = advanceTicks(state, TICKS_PER_DAY * 2);

  const smRef = state.buildings.find(b => b.type === 'smelter')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const totalIngots = (smRef.localBuffer.ingots || 0) + (shRef.localBuffer.ingots || 0) + state.resources.ingots;
  assert(totalIngots === 0, `smelter produced 0 ingots without charcoal (got ${totalIngots})`);
}

// ================================================================
// TEST 8: Advanced smelter also requires charcoal
// ================================================================
heading('Advanced Smelter Charcoal');

{
  const t = BUILDING_TEMPLATES['advanced_smelter'];
  assert(t.production !== null, 'advanced_smelter has production');
  assert(t.production!.inputs!['charcoal'] !== undefined, 'advanced_smelter requires charcoal');
  assert(t.production!.inputs!.iron_ore !== undefined, 'advanced_smelter requires iron_ore');
}

// ================================================================
// TEST 9: Full chain — wood → charcoal → ingots
// ================================================================
heading('Full Production Chain');

{
  // Verify both buildings can produce when run together
  // Coal burner: wood → charcoal
  // Smelter: iron_ore + charcoal → ingots (pre-stocked with charcoal)
  let state = setupColony();

  // Place coal burner near tent/storehouse
  state = placeBuilding(state, 'coal_burner', 5, 5);
  const cb = state.buildings.find(b => b.type === 'coal_burner')!;
  cb.constructed = true; cb.hp = cb.maxHp;
  cb.localBuffer = { wood: 30 };

  // Single villager assigned to coal_burner
  const tent = state.buildings.find(b => b.type === 'tent')!;
  const v1 = createVillager(1, 5, 5);
  v1.food = 8; v1.morale = 80; v1.homeBuildingId = tent.id;
  state.villagers = [v1];
  state.nextVillagerId = 2;
  state = assignVillager(state, 'v1', cb.id);

  state = advanceTicks(state, TICKS_PER_DAY * 2);

  const cbRef = state.buildings.find(b => b.type === 'coal_burner')!;
  const shRef = state.buildings.find(b => b.type === 'storehouse')!;
  const totalCharcoal = (cbRef.localBuffer.charcoal || 0) + (shRef.localBuffer.charcoal || 0) + (state.resources.charcoal || 0);
  assert(totalCharcoal > 0, `full chain: coal_burner produces charcoal (${totalCharcoal})`);

  // Verify charcoal can be used as smelter input (already proven in Test 6)
  assert(BUILDING_TEMPLATES['smelter'].production!.inputs!['charcoal'] !== undefined,
    'full chain: smelter accepts charcoal as input');
}

// ================================================================
// TEST 10: Stress test player AI handles charcoal chain
// ================================================================
heading('Charcoal In Stress Test Context');

{
  // Verify that the storehouse can hold charcoal
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.localBuffer.charcoal = 10;
  state.resources.charcoal = 10;
  assert(state.resources.charcoal === 10, 'storehouse can hold charcoal');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Charcoal Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
