// test-v2-supply-routes.ts — Tests for player-directed supply routes between storehouses/outposts
import {
  createWorld, createVillager, GameState, Building, BuildingType, ResourceType,
  BUILDING_TEMPLATES, TICKS_PER_DAY, NIGHT_TICKS, CARRY_CAPACITY, ALL_TECHS,
} from '../world.js';
import { tick, placeBuilding, assignVillager, createSupplyRoute, cancelSupplyRoute } from '../simulation/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function setupColony(): GameState {
  let state = createWorld(30, 30, 42);
  state.research.completed = [...ALL_TECHS];
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
      state.fog[y][x] = true;
      state.territory[y][x] = true;
    }
  }

  // Add planks for town_hall
  state.resources = { ...state.resources, food: 200, wood: 200, stone: 100, planks: 50 };

  // Main storehouse at (15,15)
  state = placeBuilding(state, 'storehouse', 15, 15);
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  sh.constructed = true; sh.hp = sh.maxHp;
  sh.localBuffer = { food: 200, wood: 100, stone: 50 };
  state.resources = { ...state.resources, food: 200, wood: 100, stone: 50 };

  // Outpost at (5,5)
  state = placeBuilding(state, 'outpost', 5, 5);
  const op = state.buildings.find(b => b.type === 'outpost')!;
  op.constructed = true; op.hp = op.maxHp;

  // Tent for housing
  state = placeBuilding(state, 'tent', 14, 14);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true; tent.hp = tent.maxHp;

  const v1 = createVillager(1, 15, 15);
  v1.food = 8; v1.morale = 80; v1.homeBuildingId = tent.id;
  const v2 = createVillager(2, 15, 15);
  v2.food = 8; v2.morale = 80; v2.homeBuildingId = tent.id;

  state.villagers = [v1, v2];
  state.nextVillagerId = 3;

  return state;
}

console.log('=== Supply Route Tests ===\n');

// --- Command Validation ---
console.log('--- Command Validation ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  // Non-existent villager
  const s1 = createSupplyRoute(state, 'v999', sh.id, op.id);
  assert(s1 === state, 'Rejects non-existent villager');

  // Non-idle villager
  state.villagers[0].role = 'farmer';
  const s2 = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id);
  assert(s2 === state, 'Rejects non-idle villager');
  state.villagers[0].role = 'idle';

  // Non-existent building
  const s3 = createSupplyRoute(state, state.villagers[0].id, 'bXXX', op.id);
  assert(s3 === state, 'Rejects non-existent source building');

  // Non-storehouse source
  const tent = state.buildings.find(b => b.type === 'tent')!;
  const s4 = createSupplyRoute(state, state.villagers[0].id, tent.id, op.id);
  assert(s4 === state, 'Rejects non-storehouse source');

  // Non-storehouse destination
  const s5 = createSupplyRoute(state, state.villagers[0].id, sh.id, tent.id);
  assert(s5 === state, 'Rejects non-storehouse destination');

  // Same source and destination
  const s6 = createSupplyRoute(state, state.villagers[0].id, sh.id, sh.id);
  assert(s6 === state, 'Rejects same source and destination');
}

// --- Route Creation ---
console.log('\n--- Route Creation ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;
  const v = state.villagers[0];

  state = createSupplyRoute(state, v.id, sh.id, op.id, 'wood');
  assert(state.supplyRoutes.length === 1, 'Route created');
  assert(state.supplyRoutes[0].fromBuildingId === sh.id, 'Route source is storehouse');
  assert(state.supplyRoutes[0].toBuildingId === op.id, 'Route destination is outpost');
  assert(state.supplyRoutes[0].resourceType === 'wood', 'Route resource type is wood');
  assert(state.supplyRoutes[0].active === true, 'Route is active');

  const hauler = state.villagers.find(vi => vi.id === v.id)!;
  assert(hauler.role === 'hauler', 'Villager role set to hauler');
  assert(hauler.supplyRouteId === state.supplyRoutes[0].id, 'Villager assigned to route');
  assert(hauler.state === 'supply_traveling_to_source', 'Hauler starts traveling to source');
}

// --- Route Cancellation ---
console.log('\n--- Route Cancellation ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id);
  const routeId = state.supplyRoutes[0].id;
  state = cancelSupplyRoute(state, routeId);

  assert(state.supplyRoutes.length === 0, 'Route removed');
  const v = state.villagers[0];
  assert(v.role === 'idle', 'Villager returned to idle on cancel');
  assert(v.supplyRouteId === null, 'Villager route cleared on cancel');

  // Cancel non-existent route
  const s2 = cancelSupplyRoute(state, 'routeXXX');
  assert(s2 === state, 'Rejects cancelling non-existent route');
}

// --- 'any' resource type (default) ---
console.log('\n--- Default Any Resource ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id);
  assert(state.supplyRoutes[0].resourceType === 'any', 'Default resource type is any');
}

// --- Physical Hauling: walks to source, loads, walks to dest, unloads ---
console.log('\n--- Physical Hauling ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  // Put wood in storehouse buffer
  sh.localBuffer.wood = 50;
  state.resources.wood = 50;

  // Place hauler at storehouse
  state.villagers[0].x = 15;
  state.villagers[0].y = 15;

  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id, 'wood');
  const routeId = state.supplyRoutes[0].id;

  // Skip to dawn (tick 30) so the hauler starts working
  while (state.tick % TICKS_PER_DAY < NIGHT_TICKS) state = tick(state);

  const hauler = state.villagers.find(v => v.supplyRouteId === routeId)!;
  assert(hauler.role === 'hauler', 'Hauler has hauler role');

  // Run ticks until hauler reaches source and loads (may need time to arrive + load)
  let loaded = false;
  for (let i = 0; i < 120; i++) {
    state = tick(state);
    const h = state.villagers.find(v => v.supplyRouteId === routeId)!;
    if (h.state === 'supply_traveling_to_dest' && h.carryTotal > 0) {
      loaded = true;
      assert(h.carryTotal <= CARRY_CAPACITY, `Hauler carries <= ${CARRY_CAPACITY} items`);
      assert((h.carrying.wood || 0) > 0, 'Hauler carrying wood');
      break;
    }
  }
  assert(loaded, 'Hauler loaded resources from source');

  // Continue until hauler reaches destination and unloads (~20 tiles travel + unload)
  let unloaded = false;
  for (let i = 0; i < 120; i++) {
    state = tick(state);
    const h = state.villagers.find(v => v.supplyRouteId === routeId)!;
    if (h.state === 'supply_traveling_to_source' && h.carryTotal === 0) {
      unloaded = true;
      break;
    }
  }
  assert(unloaded, 'Hauler unloaded at destination and headed back');

  // Check that outpost received resources
  const outpost = state.buildings.find(b => b.type === 'outpost')!;
  assert((outpost.localBuffer.wood || 0) > 0, 'Outpost received wood from hauler');
}

// --- Physical Travel: hauler moves 1 tile per tick ---
console.log('\n--- Travel Speed ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  // Place hauler at storehouse, create route to outpost (distance ~20 tiles)
  state.villagers[0].x = 15;
  state.villagers[0].y = 15;

  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id, 'wood');

  // Skip to dawn
  while (state.tick % TICKS_PER_DAY < NIGHT_TICKS) state = tick(state);

  // Track positions over multiple ticks
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    state = tick(state);
    const h = state.villagers.find(v => v.role === 'hauler')!;
    positions.push({ x: h.x, y: h.y });
  }

  // Verify max 1 tile movement per tick
  let maxMove = 0;
  for (let i = 1; i < positions.length; i++) {
    const dist = Math.abs(positions[i].x - positions[i - 1].x) + Math.abs(positions[i].y - positions[i - 1].y);
    maxMove = Math.max(maxMove, dist);
  }
  assert(maxMove <= 1, 'Hauler moves at most 1 tile per tick');
}

// --- Multiple Routes ---
console.log('\n--- Multiple Routes ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  // Create two routes with different villagers
  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id, 'wood');
  state = createSupplyRoute(state, state.villagers[1].id, op.id, sh.id, 'stone');

  assert(state.supplyRoutes.length === 2, 'Two routes created');
  assert(state.villagers[0].role === 'hauler', 'First villager is hauler');
  assert(state.villagers[1].role === 'hauler', 'Second villager is hauler');
  assert(state.supplyRoutes[0].id !== state.supplyRoutes[1].id, 'Routes have unique IDs');
}

// --- Hauler handles empty source ---
console.log('\n--- Empty Source ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  // Empty the storehouse buffer
  sh.localBuffer = { food: 10 };
  state.resources = { ...state.resources, food: 10, wood: 0, stone: 0 };

  state.villagers[0].x = 15;
  state.villagers[0].y = 15;

  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id, 'wood');

  // Skip to dawn and run a few ticks
  while (state.tick % TICKS_PER_DAY < NIGHT_TICKS) state = tick(state);
  for (let i = 0; i < 30; i++) state = tick(state);

  // Hauler should still be a hauler (waiting at source)
  const h = state.villagers.find(v => v.role === 'hauler')!;
  assert(h !== undefined, 'Hauler still assigned even with empty source');
  assert(h.carryTotal === 0, 'Hauler not carrying anything from empty source');
}

// --- Route IDs increment ---
console.log('\n--- Route ID Increment ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id);
  const firstId = state.supplyRoutes[0].id;
  assert(firstId === 'route1', 'First route ID is route1');
  assert(state.nextRouteId === 2, 'Next route ID incremented');
}

// --- Routes persist across ticks ---
console.log('\n--- Route Persistence ---');

{
  let state = setupColony();
  const sh = state.buildings.find(b => b.type === 'storehouse')!;
  const op = state.buildings.find(b => b.type === 'outpost')!;

  state = createSupplyRoute(state, state.villagers[0].id, sh.id, op.id);
  const routeId = state.supplyRoutes[0].id;

  for (let i = 0; i < 10; i++) state = tick(state);
  assert(state.supplyRoutes.length === 1, 'Route persists across ticks');
  assert(state.supplyRoutes[0].id === routeId, 'Route ID unchanged');
}

// --- Storehouse to storehouse route ---
console.log('\n--- Storehouse to Storehouse ---');

{
  let state = setupColony();
  // Add a second storehouse
  state = placeBuilding(state, 'storehouse', 3, 3);
  const sh2 = state.buildings.find(b => b.type === 'storehouse' && b.x === 3)!;
  sh2.constructed = true; sh2.hp = sh2.maxHp;

  const sh1 = state.buildings.find(b => b.type === 'storehouse' && b.x === 15)!;

  state = createSupplyRoute(state, state.villagers[0].id, sh1.id, sh2.id, 'food');
  assert(state.supplyRoutes.length === 1, 'Storehouse-to-storehouse route created');
  assert(state.supplyRoutes[0].fromBuildingId === sh1.id, 'Source is first storehouse');
  assert(state.supplyRoutes[0].toBuildingId === sh2.id, 'Dest is second storehouse');
}

console.log(`\n=== Supply Routes: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
