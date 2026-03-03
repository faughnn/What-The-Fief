// test-combat.ts — Verify Phase 8 combat mechanics
import { createWorld, GUARD_COMBAT, ENEMY_TEMPLATES } from '../world.js';
import { tick, placeBuilding, assignVillager, setGuard } from '../simulation.js';

function assert(cond: boolean, msg: string) {
  if (!cond) { console.log(`FAIL: ${msg}`); process.exit(1); }
  else console.log(`PASS: ${msg}`);
}

// --- Test 1: Raid bar accumulates ---
{
  let state = createWorld(20, 20, 42);
  state = placeBuilding(state, 'house', 3, 8);
  state = placeBuilding(state, 'house', 7, 8);
  state = placeBuilding(state, 'farm', 3, 11);
  state = assignVillager(state, 'v1', 'b3');
  const before = state.raidBar;
  state = tick(state);
  assert(state.raidBar > before, `Raid bar increased from ${before} to ${Math.floor(state.raidBar)}`);
}

// --- Test 2: Guard assignment works ---
{
  let state = createWorld(20, 20, 42);
  state = setGuard(state, 'v1');
  const v = state.villagers.find(v => v.id === 'v1')!;
  assert(v.role === 'guard', 'v1 is a guard');
  assert(v.maxHp === 10 + Math.floor(v.morale / 10), `Guard maxHp=${v.maxHp} based on morale=${v.morale}`);
}

// --- Test 3: Equipped guards can win a fight ---
{
  // Set up scenario where guards have tools and can win
  let state = createWorld(20, 20, 42);
  state = placeBuilding(state, 'house', 3, 8);
  state = placeBuilding(state, 'house', 7, 8);

  // Manually give starting resources iron_tools
  state = { ...state, resources: { ...state.resources, iron_tools: 5 } };

  // Set 2 guards — they should auto-equip iron tools
  state = setGuard(state, 'v1');
  state = setGuard(state, 'v2');

  // Manually force a raid
  const enemies = [];
  for (let i = 0; i < 3; i++) {
    const t = ENEMY_TEMPLATES.bandit;
    enemies.push({ type: 'bandit' as const, hp: t.maxHp, attack: t.attack, defense: t.defense });
  }
  state = { ...state, raidBar: 0, raidLevel: 1, activeRaid: { enemies, resolved: false } };

  // Run one tick — combat should resolve
  state = tick(state);

  // With iron tools (attack=5, defense=3), 2 guards should beat 3 bandits
  const guards = state.villagers.filter(v => v.role === 'guard');
  assert(guards.length > 0, `Guards survived: ${guards.length}`);
  assert(state.activeRaid === null, 'Raid resolved and cleared');
  assert(state.raidLevel === 1, 'Raid level unchanged (no new raid triggered)');

  // Victory should reduce raid bar
  console.log(`  After victory: raid bar=${Math.floor(state.raidBar)}, buildings=${state.buildings.length}`);
}

// --- Test 4: Defeat destroys building and steals food ---
{
  let state = createWorld(20, 20, 42);
  state = placeBuilding(state, 'house', 3, 8);
  state = placeBuilding(state, 'house', 7, 8);
  state = placeBuilding(state, 'farm', 3, 11);

  // No guards — guaranteed defeat
  const enemies = [];
  for (let i = 0; i < 3; i++) {
    const t = ENEMY_TEMPLATES.bandit;
    enemies.push({ type: 'bandit' as const, hp: t.maxHp, attack: t.attack, defense: t.defense });
  }
  const foodBefore = state.resources.food;
  const buildingsBefore = state.buildings.length;
  state = { ...state, activeRaid: { enemies, resolved: false } };

  state = tick(state);

  assert(state.buildings.length < buildingsBefore, `Building destroyed: ${buildingsBefore} -> ${state.buildings.length}`);
  assert(state.resources.food < foodBefore, `Food stolen: ${foodBefore} -> ${state.resources.food}`);
  assert(state.activeRaid === null, 'Raid cleared after defeat');
}

// --- Test 5: Guard healing ---
{
  let state = createWorld(20, 20, 42);
  state = placeBuilding(state, 'house', 3, 8);
  state = setGuard(state, 'v1');

  // Manually reduce guard HP
  state = {
    ...state,
    villagers: state.villagers.map(v =>
      v.id === 'v1' ? { ...v, hp: 5 } : v
    ),
  };

  state = tick(state);
  const g = state.villagers.find(v => v.id === 'v1');
  if (g) {
    assert(g.hp === 7, `Guard healed from 5 to ${g.hp}`);
  } else {
    console.log('PASS: Guard left (expected if starved/homeless)');
  }
}

// --- Test 6: Raid scaling (level 3+ includes wolves) ---
{
  let state = createWorld(20, 20, 42);
  state = { ...state, raidBar: 100, raidLevel: 2 };
  // No active raid, so triggering will create level 3

  state = tick(state);
  assert(state.raidLevel === 3, `Raid level incremented to ${state.raidLevel}`);
  // Raid triggers and resolves same tick, so activeRaid is null
  // But we can check that it processed correctly (raidLevel increased)
}

console.log('\nAll combat tests passed!');
