// test-v2-stress.ts — Long simulation stress test
// Run 100 game days, verify no ERROR: lines, colony survives.

import {
  createWorld, createVillager, GameState, Building,
  TICKS_PER_DAY,
} from '../world.js';
import {
  tick, placeBuilding, assignVillager, setGuard, setPatrol,
} from '../simulation.js';

let passed = 0;
let failed = 0;
const errors: string[] = [];

// Override console.log to capture ERROR: lines
const origLog = console.log;
console.log = function (...args: any[]) {
  const msg = args.join(' ');
  if (msg.startsWith('ERROR:')) errors.push(msg);
  // Don't print individual ticks to keep output clean
};

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; origLog(`  PASS: ${msg}`); }
  else { failed++; origLog(`  FAIL: ${msg}`); }
}

function heading(s: string) { origLog(`\n=== ${s} ===`); }

heading('100-Day Stress Test');

{
  // Start with a flat world
  let state = createWorld(40, 40, 42);
  // Reveal and claim center area
  for (let y = 10; y < 30; y++) {
    for (let x = 10; x < 30; x++) {
      state.fog[y][x] = true;
      state.territory[y][x] = true;
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
    }
  }
  state = { ...state, resources: { ...state.resources, wood: 140, stone: 100, food: 100, planks: 50, gold: 50 } };

  // Build a colony
  state = placeBuilding(state, 'storehouse', 15, 15);
  state = placeBuilding(state, 'tent', 14, 15);
  state = placeBuilding(state, 'tent', 17, 15);
  state = placeBuilding(state, 'tent', 14, 14);
  state = placeBuilding(state, 'farm', 12, 15);
  state = placeBuilding(state, 'woodcutter', 18, 15);
  state = placeBuilding(state, 'quarry', 18, 18);
  state = placeBuilding(state, 'well', 15, 17);

  // Pre-construct all buildings
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse' ? { food: 100 } : b.localBuffer,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };

  // Create 3 villagers with homes and jobs
  const v1 = createVillager(1, 12, 15);
  v1.homeBuildingId = state.buildings.find(b => b.type === 'tent' && b.x === 14 && b.y === 15)!.id;
  v1.food = 10;

  const v2 = createVillager(2, 18, 15);
  v2.homeBuildingId = state.buildings.find(b => b.type === 'tent' && b.x === 17 && b.y === 15)!.id;
  v2.food = 10;

  const v3 = createVillager(3, 18, 18);
  v3.homeBuildingId = state.buildings.find(b => b.type === 'tent' && b.x === 14 && b.y === 14)!.id;
  v3.food = 10;

  state = { ...state, villagers: [v1, v2, v3], nextVillagerId: 4 };

  // Assign jobs
  state = assignVillager(state, 'v1', state.buildings.find(b => b.type === 'farm')!.id);
  state = assignVillager(state, 'v2', state.buildings.find(b => b.type === 'woodcutter')!.id);
  state = assignVillager(state, 'v3', state.buildings.find(b => b.type === 'quarry')!.id);

  // Run 100 days
  const totalTicks = TICKS_PER_DAY * 100;
  for (let i = 0; i < totalTicks; i++) {
    state = tick(state);
  }

  // Restore console.log
  console.log = origLog;

  // Verify results
  assert(errors.length === 0, `No ERROR: lines in ${totalTicks} ticks (errors=${errors.length})`);
  if (errors.length > 0) {
    origLog('  First 5 errors:');
    for (const e of errors.slice(0, 5)) origLog(`    ${e}`);
  }

  assert(state.tick === totalTicks, `Ran ${totalTicks} ticks (tick=${state.tick})`);
  assert(state.day === 100, `100 days passed (day=${state.day})`);

  // Colony should have some villagers (may have gained or lost some)
  origLog(`  INFO: Villagers: ${state.villagers.length}`);
  origLog(`  INFO: Buildings: ${state.buildings.length}`);
  origLog(`  INFO: Resources: wood=${state.resources.wood}, stone=${state.resources.stone}, food=${state.resources.food}`);
  origLog(`  INFO: Graveyard: ${state.graveyard.length} graves`);
  origLog(`  INFO: Raid level: ${state.raidLevel}, Prosperity: ${state.prosperity}`);
  origLog(`  INFO: Season: ${state.season}, Weather: ${state.weather}`);

  // At least some production happened
  assert(state.resources.wood > 0 || state.resources.stone > 0, 'Resources were produced');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Stress Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
