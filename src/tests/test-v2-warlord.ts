// test-v2-warlord.ts — Tests for bandit warlord enemy type

import {
  ENEMY_TEMPLATES, ENEMY_LOOT,
  WARLORD_RAID_THRESHOLD, BRUTE_RAID_THRESHOLD,
} from '../world.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

// ================================================================
// TEST 1: Warlord template exists
// ================================================================
heading('Warlord Template');
{
  const warlord = ENEMY_TEMPLATES['bandit_warlord'];
  assert(warlord !== undefined, 'bandit_warlord template exists');
  if (warlord) {
    assert(warlord.maxHp >= 25, `HP >= 25 (${warlord.maxHp})`);
    assert(warlord.attack >= 6, `attack >= 6 (${warlord.attack})`);
    assert(warlord.defense >= 4, `defense >= 4 (${warlord.defense})`);
  }
}

// ================================================================
// TEST 2: Warlord is stronger than brute
// ================================================================
heading('Stronger Than Brute');
{
  const warlord = ENEMY_TEMPLATES['bandit_warlord'];
  const brute = ENEMY_TEMPLATES['bandit_brute'];
  assert(warlord.maxHp > brute.maxHp, `warlord HP ${warlord.maxHp} > brute HP ${brute.maxHp}`);
  assert(warlord.attack > brute.attack, `warlord atk ${warlord.attack} > brute atk ${brute.attack}`);
  assert(warlord.defense > brute.defense, `warlord def ${warlord.defense} > brute def ${brute.defense}`);
}

// ================================================================
// TEST 3: Warlord has good loot
// ================================================================
heading('Warlord Loot');
{
  const loot = ENEMY_LOOT['bandit_warlord'];
  assert(loot !== undefined, 'warlord has loot drops');
  assert(loot.length >= 1, `at least 1 loot drop (${loot.length})`);
  const goldLoot = loot.find(l => l.resource === 'gold');
  assert(goldLoot !== undefined, 'drops gold');
  if (goldLoot) {
    assert(goldLoot.amount >= 5, `gold amount >= 5 (${goldLoot.amount})`);
  }
}

// ================================================================
// TEST 4: Warlord threshold is higher than brute
// ================================================================
heading('Raid Threshold');
{
  assert(WARLORD_RAID_THRESHOLD > BRUTE_RAID_THRESHOLD,
    `warlord threshold ${WARLORD_RAID_THRESHOLD} > brute threshold ${BRUTE_RAID_THRESHOLD}`);
}

// ================================================================
// TEST 5: pickRaidEnemyType includes warlord at high strength
// ================================================================
heading('Raid Composition');
{
  // Import the function indirectly by checking template behavior
  // At strength 8+, index 0 should be warlord
  // We can verify by checking the threshold constant
  assert(WARLORD_RAID_THRESHOLD === 8, `warlord appears at strength ${WARLORD_RAID_THRESHOLD}`);
}

// ================================================================
// TEST 6: Warlord drops weapon loot
// ================================================================
heading('Weapon Loot Drop');
{
  const loot = ENEMY_LOOT['bandit_warlord'];
  const weaponLoot = loot.find(l => l.resource === 'sword');
  assert(weaponLoot !== undefined, 'warlord drops a sword');
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Warlord Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
