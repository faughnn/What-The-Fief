// test-v2-armor.ts — Physical armor: crafted items, equip, defense, durability, degradation

import {
  createWorld, GameState, TICKS_PER_DAY, NIGHT_TICKS, BUILDING_TEMPLATES,
  WEAPON_STATS, createVillager, ARMOR_RESOURCE, ARMOR_STATS, ARMOR_DURABILITY,
  ARMOR_EQUIP_PRIORITY, PRODUCTION_BASE_TICKS, ALL_TECHS,
} from '../world.js';
import { tick, placeBuilding, assignVillager, setGuard } from '../simulation/index.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function makeArmorWorld(): GameState {
  let state = createWorld(20, 20, 2);
  state.research.completed = [...ALL_TECHS];
  state.fog = state.fog.map(row => row.map(() => true));
  state.territory = state.territory.map(row => row.map(() => true));
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      state.grid[y][x] = { terrain: 'grass', building: null, deposit: null };
    }
  }
  state.resources = {
    ...state.resources,
    wood: 200, stone: 200, food: 200, gold: 100,
    leather: 20, ingots: 20, planks: 20, linen: 20,
    leather_armor: 5, iron_armor: 5,
  };
  state = placeBuilding(state, 'storehouse', 5, 5);
  state = {
    ...state,
    buildings: state.buildings.map(b => ({
      ...b, constructed: true, constructionProgress: b.constructionRequired,
      localBuffer: b.type === 'storehouse'
        ? { ...b.localBuffer, food: 200, wood: 200, stone: 200, leather: 20, ingots: 20, linen: 20, leather_armor: 5, iron_armor: 5 }
        : b.localBuffer,
    })),
    grid: state.grid.map(row => row.map(tile =>
      tile.building
        ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
        : tile
    )),
  };
  return state;
}

// ========================
// DATA TYPES
// ========================

console.log('\n=== Armor: types exist ===');
{
  assert(ARMOR_STATS !== undefined, 'ARMOR_STATS exists');
  assert(ARMOR_STATS.none !== undefined, 'none armor type exists');
  assert(ARMOR_STATS.leather_armor !== undefined, 'leather_armor type exists');
  assert(ARMOR_STATS.iron_armor !== undefined, 'iron_armor type exists');
  assert(ARMOR_STATS.none.defense === 0, `none defense = 0 (got ${ARMOR_STATS.none.defense})`);
  assert(ARMOR_STATS.leather_armor.defense > 0, `leather defense > 0 (got ${ARMOR_STATS.leather_armor.defense})`);
  assert(ARMOR_STATS.iron_armor.defense > ARMOR_STATS.leather_armor.defense,
    `iron defense > leather (${ARMOR_STATS.iron_armor.defense} > ${ARMOR_STATS.leather_armor.defense})`);
}

console.log('\n=== Armor: durability values ===');
{
  assert(ARMOR_DURABILITY.leather_armor > 0, `leather durability > 0 (got ${ARMOR_DURABILITY.leather_armor})`);
  assert(ARMOR_DURABILITY.iron_armor > 0, `iron durability > 0 (got ${ARMOR_DURABILITY.iron_armor})`);
}

console.log('\n=== Armor: resource mapping uses crafted items ===');
{
  // Armor equip should consume CRAFTED armor items, not raw materials
  assert(ARMOR_RESOURCE.leather_armor === 'leather_armor', `leather armor uses leather_armor resource (got ${ARMOR_RESOURCE.leather_armor})`);
  assert(ARMOR_RESOURCE.iron_armor === 'iron_armor', `iron armor uses iron_armor resource (got ${ARMOR_RESOURCE.iron_armor})`);
}

// ========================
// CRAFTING BUILDINGS
// ========================

console.log('\n=== Armor: armorer building produces iron_armor ===');
{
  const template = BUILDING_TEMPLATES.armorer;
  assert(template !== undefined, 'armorer building template exists');
  assert(template.production !== null, 'armorer has production');
  assert(template.production!.output === 'iron_armor', `armorer produces iron_armor (got ${template.production!.output})`);
  // Requires ingots and leather
  assert(template.production!.inputs !== null, 'armorer has inputs');
  assert((template.production!.inputs as any).ingots > 0, 'armorer requires ingots');
  assert((template.production!.inputs as any).leather > 0, 'armorer requires leather');
}

console.log('\n=== Armor: leather_workshop building produces leather_armor ===');
{
  const template = (BUILDING_TEMPLATES as any).leather_workshop;
  assert(template !== undefined, 'leather_workshop building template exists');
  if (template) {
    assert(template.production !== null, 'leather_workshop has production');
    assert(template.production!.output === 'leather_armor', `leather_workshop produces leather_armor (got ${template.production!.output})`);
    assert(template.production!.inputs !== null, 'leather_workshop has inputs');
    assert((template.production!.inputs as any).leather > 0, 'leather_workshop requires leather');
    assert((template.production!.inputs as any).linen > 0, 'leather_workshop requires linen');
  }
}

console.log('\n=== Armor: armorer physically produces iron_armor ===');
{
  let state = makeArmorWorld();
  // Place armorer with pre-stocked inputs (like weaponsmith test pattern)
  state = placeBuilding(state, 'armorer', 7, 5);
  const armorerB = state.buildings.find(b => b.type === 'armorer')!;
  armorerB.constructed = true;
  armorerB.constructionProgress = armorerB.constructionRequired;
  armorerB.localBuffer = { ingots: 6, leather: 2 }; // Enough for 2 production cycles

  // Create worker already at workplace in working state
  const worker = createVillager(state.nextVillagerId, armorerB.x, armorerB.y);
  worker.jobBuildingId = armorerB.id;
  worker.role = 'armorer_worker' as any;
  worker.state = 'working';
  worker.food = 8;
  state.nextVillagerId++;
  state.villagers = [worker];

  // Give home
  state = placeBuilding(state, 'tent', 7, 3);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true;
  tent.constructionProgress = tent.constructionRequired;
  worker.homeBuildingId = tent.id;

  // Sync grid construction
  state.grid = state.grid.map(row => row.map(tile =>
    tile.building
      ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
      : tile
  ));

  // Run 5 days (like weaponsmith test)
  for (let i = 0; i < TICKS_PER_DAY * 5; i++) {
    state = tick(state);
  }

  const totalArmor = state.resources.iron_armor;
  const bufferArmor = state.buildings
    .filter(b => b.type === 'armorer' || b.type === 'storehouse' || b.type === 'large_storehouse')
    .reduce((sum, b) => sum + (b.localBuffer.iron_armor || 0), 0);
  assert(totalArmor > 0 || bufferArmor > 0, `Iron armor produced: global=${totalArmor}, buffers=${bufferArmor}`);
}

console.log('\n=== Armor: leather_workshop physically produces leather_armor ===');
{
  let state = makeArmorWorld();
  state = placeBuilding(state, 'leather_workshop', 6, 4);
  const workshop = state.buildings.find(b => b.type === 'leather_workshop')!;
  workshop.constructed = true;
  workshop.constructionProgress = workshop.constructionRequired;
  workshop.localBuffer = { leather: 4, linen: 2 };

  const worker = createVillager(state.nextVillagerId, workshop.x, workshop.y);
  worker.jobBuildingId = workshop.id;
  worker.role = 'leather_workshop_worker' as any;
  worker.state = 'working';
  worker.food = 8;
  state.nextVillagerId++;
  state.villagers = [worker];

  state = placeBuilding(state, 'tent', 6, 3);
  const tent = state.buildings.find(b => b.type === 'tent')!;
  tent.constructed = true;
  tent.constructionProgress = tent.constructionRequired;
  worker.homeBuildingId = tent.id;

  state.grid = state.grid.map(row => row.map(tile =>
    tile.building
      ? { ...tile, building: { ...tile.building, constructed: true, constructionProgress: tile.building.constructionRequired } }
      : tile
  ));

  for (let i = 0; i < TICKS_PER_DAY * 5; i++) {
    state = tick(state);
  }

  const totalArmor = state.resources.leather_armor;
  const bufferArmor = state.buildings
    .filter(b => b.type === 'leather_workshop' || b.type === 'storehouse' || b.type === 'large_storehouse')
    .reduce((sum, b) => sum + (b.localBuffer.leather_armor || 0), 0);
  assert(totalArmor > 0 || bufferArmor > 0, `Leather armor produced: global=${totalArmor}, buffers=${bufferArmor}`);
}

// ========================
// VILLAGER FIELDS
// ========================

console.log('\n=== Armor: villager default state ===');
{
  const state = makeArmorWorld();
  const v = state.villagers[0];
  assert(v.armor === 'none', `New villager armor = none (got ${v.armor})`);
  assert(v.armorDurability === 0, `New villager armor durability = 0 (got ${v.armorDurability})`);
}

// ========================
// AUTO-EQUIP (from crafted items)
// ========================

console.log('\n=== Armor: guard auto-equips armor from crafted items at dawn ===');
{
  let state = makeArmorWorld();
  state = placeBuilding(state, 'tent', 3, 3);
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
  };
  const tent = state.buildings.find(b => b.type === 'tent')!;
  state.villagers[0].homeBuildingId = tent.id;
  state.villagers[0].x = 3;
  state.villagers[0].y = 3;
  state = setGuard(state, state.villagers[0].id);

  // Crafted armor items available
  state.resources.iron_armor = 5;
  state.resources.leather_armor = 5;
  for (const b of state.buildings) {
    if (b.type === 'storehouse') {
      b.localBuffer.iron_armor = 5;
      b.localBuffer.leather_armor = 5;
    }
  }

  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);

  const guard = state.villagers[0];
  assert(guard.armor !== 'none', `Guard equipped armor (got ${guard.armor})`);
  assert(guard.armor === 'iron_armor', `Guard prefers iron armor (got ${guard.armor})`);
  assert(guard.armorDurability > 0, `Armor has durability (got ${guard.armorDurability})`);
}

console.log('\n=== Armor: auto-equip consumes crafted armor resource ===');
{
  let state = makeArmorWorld();
  state = placeBuilding(state, 'tent', 3, 3);
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
  };
  const tent = state.buildings.find(b => b.type === 'tent')!;
  state.villagers[0].homeBuildingId = tent.id;
  state.villagers[0].x = 3;
  state.villagers[0].y = 3;
  state = setGuard(state, state.villagers[0].id);

  for (const v of state.villagers) { v.clothed = true; v.clothingDurability = 50; }

  // Only leather_armor available (no iron_armor)
  state.resources.leather_armor = 3;
  state.resources.iron_armor = 0;
  for (const b of state.buildings) {
    if (b.type === 'storehouse') {
      b.localBuffer.iron_armor = 0;
      b.localBuffer.leather_armor = 3;
    }
  }
  const armorBefore = state.resources.leather_armor;

  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);

  const guard = state.villagers[0];
  assert(guard.armor === 'leather_armor', `Guard equipped leather armor (got ${guard.armor})`);
  assert(state.resources.leather_armor < armorBefore, `Crafted armor resource consumed (${armorBefore} -> ${state.resources.leather_armor})`);
}

console.log('\n=== Armor: no crafted armor = no armor ===');
{
  let state = makeArmorWorld();
  state = placeBuilding(state, 'tent', 3, 3);
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
  };
  const tent = state.buildings.find(b => b.type === 'tent')!;
  state.villagers[0].homeBuildingId = tent.id;
  state.villagers[0].x = 3;
  state.villagers[0].y = 3;
  state = setGuard(state, state.villagers[0].id);

  // No crafted armor available (raw materials don't count)
  state.resources.leather_armor = 0;
  state.resources.iron_armor = 0;
  state.resources.leather = 50; // raw leather shouldn't help
  state.resources.ingots = 50;  // raw ingots shouldn't help

  state.tick = TICKS_PER_DAY - 1;
  state = tick(state);

  assert(state.villagers[0].armor === 'none', `Guard has no armor without crafted items (got ${state.villagers[0].armor})`);
}

// ========================
// DEFENSE IN COMBAT
// ========================

console.log('\n=== Armor: reduces damage taken in combat ===');
{
  let state = makeArmorWorld();
  state.villagers[0].x = 10;
  state.villagers[0].y = 10;
  state.villagers[0].hp = 100;
  state.villagers[0].maxHp = 100;
  state.villagers[0].role = 'guard' as any;
  state.villagers[0].armor = 'iron_armor' as any;
  state.villagers[0].armorDurability = 50;
  state.villagers[0].weapon = 'sword';
  state.villagers[0].weaponDurability = 40;
  state.villagers[0].guardMode = 'charge' as any;

  state.enemies.push({
    id: 'e1', x: 11, y: 10, hp: 100, maxHp: 100,
    attack: 10, defense: 0, speed: 1,
    type: 'bandit', origin: 'raid',
    campId: null, path: [],
  });

  state.tick = NIGHT_TICKS;
  const hpBefore = state.villagers[0].hp;
  state = tick(state);

  const guard = state.villagers[0];
  const hpLost = hpBefore - guard.hp;
  // Without armor: damage = max(1, 10 - swordDef(2)) = 8
  // With iron armor (def 4): damage = max(1, 10 - 2 - 4) = 4
  assert(hpLost < 8, `Armor reduced damage (lost ${hpLost} HP instead of 8)`);
  assert(hpLost >= 1, `Still takes minimum 1 damage (lost ${hpLost})`);
}

// ========================
// DURABILITY
// ========================

console.log('\n=== Armor: durability degrades in combat ===');
{
  let state = makeArmorWorld();
  state.villagers[0].x = 10;
  state.villagers[0].y = 10;
  state.villagers[0].hp = 100;
  state.villagers[0].maxHp = 100;
  state.villagers[0].role = 'guard' as any;
  state.villagers[0].armor = 'leather_armor' as any;
  state.villagers[0].armorDurability = 30;
  state.villagers[0].weapon = 'sword';
  state.villagers[0].weaponDurability = 40;
  state.villagers[0].guardMode = 'charge' as any;

  state.enemies.push({
    id: 'e2', x: 11, y: 10, hp: 100, maxHp: 100,
    attack: 5, defense: 0, speed: 1,
    type: 'bandit', origin: 'raid',
    campId: null, path: [],
  });

  state.tick = NIGHT_TICKS;
  const durBefore = state.villagers[0].armorDurability;
  state = tick(state);

  const guard = state.villagers[0];
  assert(guard.armorDurability < durBefore, `Armor durability decreased (${durBefore} -> ${guard.armorDurability})`);
}

console.log('\n=== Armor: breaks when durability hits 0 ===');
{
  let state = makeArmorWorld();
  state.villagers[0].x = 10;
  state.villagers[0].y = 10;
  state.villagers[0].hp = 100;
  state.villagers[0].maxHp = 100;
  state.villagers[0].role = 'guard' as any;
  state.villagers[0].armor = 'leather_armor' as any;
  state.villagers[0].armorDurability = 1;
  state.villagers[0].weapon = 'sword';
  state.villagers[0].weaponDurability = 40;
  state.villagers[0].guardMode = 'charge' as any;

  // No crafted armor available for re-equip
  state.resources.leather_armor = 0;
  state.resources.iron_armor = 0;

  state.enemies.push({
    id: 'e3', x: 11, y: 10, hp: 100, maxHp: 100,
    attack: 5, defense: 0, speed: 1,
    type: 'bandit', origin: 'raid',
    campId: null, path: [],
  });

  state.tick = NIGHT_TICKS;
  state = tick(state);

  const guard = state.villagers[0];
  assert(guard.armor === 'none', `Armor broke and was removed (got ${guard.armor})`);
  assert(guard.armorDurability === 0, `Durability is 0 (got ${guard.armorDurability})`);
}

console.log('\n=== Armor: re-equips from crafted resources when broken ===');
{
  let state = makeArmorWorld();
  state.villagers[0].x = 10;
  state.villagers[0].y = 10;
  state.villagers[0].hp = 100;
  state.villagers[0].maxHp = 100;
  state.villagers[0].role = 'guard' as any;
  state.villagers[0].armor = 'leather_armor' as any;
  state.villagers[0].armorDurability = 1;
  state.villagers[0].weapon = 'sword';
  state.villagers[0].weaponDurability = 40;
  state.villagers[0].guardMode = 'charge' as any;

  // Crafted leather armor available for re-equip
  state.resources.leather_armor = 5;
  state.resources.iron_armor = 0;

  state.enemies.push({
    id: 'e4', x: 11, y: 10, hp: 100, maxHp: 100,
    attack: 5, defense: 0, speed: 1,
    type: 'bandit', origin: 'raid',
    campId: null, path: [],
  });

  state.tick = NIGHT_TICKS;
  state = tick(state);

  const guard = state.villagers[0];
  assert(guard.armor === 'leather_armor', `Re-equipped leather armor (got ${guard.armor})`);
  assert(guard.armorDurability > 0, `Re-equipped with fresh durability (got ${guard.armorDurability})`);
}

// ========================
// SUMMARY
// ========================

console.log(`\n=== Armor: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
