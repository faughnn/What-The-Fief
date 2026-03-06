// combat.ts — Raid spawning, enemy movement, guard AI, melee combat

import {
  Building, BuildingType, Villager, Tile,
  EnemyEntity, EnemyType, ENEMY_TEMPLATES, GUARD_COMBAT,
  CONSTRUCTION_TICKS, BUILDING_MAX_HP, ALL_RESOURCES,
  WATCHTOWER_RANGE, WATCHTOWER_DAMAGE,
  WEAPON_STATS, ARMOR_STATS,
  BanditCamp, CAMP_BASE_HP, CAMP_HP_PER_LEVEL, CAMP_RAID_INTERVAL,
  CAMP_SPAWN_DAY, CAMP_SPAWN_INTERVAL, CAMP_MAX_COUNT,
  CAMP_CLEAR_GOLD, CAMP_CLEAR_RENOWN,
  WOLF_SPAWN_THRESHOLD, RAM_SPAWN_THRESHOLD, MAX_RAMS,
  SIEGE_TOWER_THRESHOLD, WOLF_STRENGTH_OFFSET,
  ARCHER_RAID_THRESHOLD, BRUTE_RAID_THRESHOLD,
  TRUST_KILL_BANDIT, TRUST_VILLAGE_RADIUS, TRUST_THRESHOLDS, TrustRank,
  LIBERATION_RENOWN_REWARD,
} from '../world.js';
import { TickState, isAdjacent, hasTech, degradeWeapon, degradeArmor, addToBuffer, isStorehouse, destroyBuildingAndCreateRubble, buildBuildingMap } from './helpers.js';
import { findPath, findPathEnemy } from './movement.js';

// --- Find settlement center (average building position) ---
function findSettlementCenter(buildings: Building[]): { x: number; y: number } {
  if (buildings.length === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const b of buildings) { sx += b.x; sy += b.y; }
  return { x: Math.round(sx / buildings.length), y: Math.round(sy / buildings.length) };
}

// --- Find adjacent wall/building for enemy to attack ---
function findAdjacentTarget(
  x: number, y: number, grid: Tile[][], width: number, height: number, buildingMap: Map<string, Building>,
): Building | null {
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  // Priority: walls first, then fences, then other buildings
  for (const prio of ['wall', 'fence', null] as (BuildingType | null)[]) {
    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const tile = grid[ny][nx];
      if (tile.building) {
        if (prio === null || tile.building.type === prio) {
          return buildingMap.get(tile.building!.id) ?? null;
        }
      }
    }
  }
  return null;
}

// --- Camp spawning: pick a position at the map edge ---
function pickCampPosition(ts: TickState, side: number): { x: number; y: number } {
  const offset = ((ts.newDay * 7919 + side * 104729) & 0x7fffffff) % Math.max(1, Math.min(ts.width, ts.height) - 4);
  switch (side % 4) {
    case 0: return { x: Math.min(ts.width - 1, 2 + offset), y: 0 }; // north
    case 1: return { x: Math.min(ts.width - 1, 2 + offset), y: ts.height - 1 }; // south
    case 2: return { x: 0, y: Math.min(ts.height - 1, 2 + offset) }; // west
    default: return { x: ts.width - 1, y: Math.min(ts.height - 1, 2 + offset) }; // east
  }
}

// --- Determine enemy type for a slot in a raid based on camp strength ---
function pickRaidEnemyType(index: number, totalBandits: number, strength: number): EnemyType {
  // At strength >= BRUTE_RAID_THRESHOLD: ~20% brutes (every 5th enemy)
  if (strength >= BRUTE_RAID_THRESHOLD && index > 0 && index % 5 === 0) return 'bandit_brute';
  // At strength >= ARCHER_RAID_THRESHOLD: ~30% archers (every 3rd enemy, not already brute)
  if (strength >= ARCHER_RAID_THRESHOLD && index > 0 && index % 3 === 0) return 'bandit_archer';
  return 'bandit';
}

// --- Spawn enemies at a camp's location ---
function spawnRaidFromCamp(ts: TickState, camp: BanditCamp): void {
  const numBandits = camp.strength + 1;
  const numWolves = camp.strength >= WOLF_SPAWN_THRESHOLD ? camp.strength - WOLF_STRENGTH_OFFSET : 0;
  for (let i = 0; i < numBandits + numWolves; i++) {
    const type: EnemyType = i < numBandits ? pickRaidEnemyType(i, numBandits, camp.strength) : 'wolf';
    const t = ENEMY_TEMPLATES[type];
    // Spread enemies around camp position
    const ex = Math.max(0, Math.min(ts.width - 1, camp.x + (i % 3) - 1));
    const ey = Math.max(0, Math.min(ts.height - 1, camp.y + Math.floor(i / 3) - 1));
    ts.enemies.push({
      id: `e${ts.nextEnemyId}`, type, x: ex, y: ey,
      hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
      range: t.range || 0, siege: 'none', ticksAlive: 0,
    });
    ts.nextEnemyId++;
  }
  // Siege equipment at higher strength
  if (camp.strength >= RAM_SPAWN_THRESHOLD) {
    const numRams = Math.min(camp.strength - WOLF_STRENGTH_OFFSET, MAX_RAMS);
    for (let i = 0; i < numRams; i++) {
      ts.enemies.push({
        id: `e${ts.nextEnemyId}`, type: 'bandit',
        x: Math.max(0, Math.min(ts.width - 1, camp.x + i)),
        y: Math.max(0, Math.min(ts.height - 1, camp.y + 1)),
        hp: 25, maxHp: 25, attack: 5, defense: 3,
        range: 0, siege: 'battering_ram', ticksAlive: 0,
      });
      ts.nextEnemyId++;
    }
  }
  if (camp.strength >= SIEGE_TOWER_THRESHOLD) {
    ts.enemies.push({
      id: `e${ts.nextEnemyId}`, type: 'bandit',
      x: Math.max(0, Math.min(ts.width - 1, camp.x - 1)),
      y: Math.max(0, Math.min(ts.height - 1, camp.y + 1)),
      hp: 20, maxHp: 20, attack: 2, defense: 2,
      range: 0, siege: 'siege_tower', ticksAlive: 0,
    });
    ts.nextEnemyId++;
  }
  camp.lastRaidDay = ts.newDay;
  const dirLabels = camp.y === 0 ? 'north' : camp.y >= ts.height - 1 ? 'south' : camp.x === 0 ? 'west' : 'east';
  ts.events.push(`A raid of ${numBandits} bandits${numWolves > 0 ? ` and ${numWolves} wolves` : ''}${camp.strength >= RAM_SPAWN_THRESHOLD ? ' with siege equipment' : ''} attacks from the bandit camp to the ${dirLabels}!`);
}

export function processRaidAndCombat(ts: TickState): void {
  // Track original enemy count (before raid spawning) for cleared check
  const enemyCountBefore = ts.enemies.length;

  // --- BANDIT CAMP SPAWNING ---
  // Camps appear at map edges once colony is established
  const constructedBuildings = ts.buildings.filter(b => b.constructed && b.type !== 'rubble').length;
  if (ts.isNewDay && ts.villagers.length >= 6 && constructedBuildings >= 8) {
    // Spawn first camp after CAMP_SPAWN_DAY, then new camps every CAMP_SPAWN_INTERVAL from last spawn
    const activeCamps = ts.banditCamps.length;
    if (activeCamps < CAMP_MAX_COUNT) {
      const daysSinceLastSpawn = ts.newDay - ts.lastCampSpawnDay;
      const shouldSpawn = activeCamps === 0 && ts.lastCampSpawnDay < 0
        ? ts.newDay >= CAMP_SPAWN_DAY
        : daysSinceLastSpawn >= CAMP_SPAWN_INTERVAL;
      if (shouldSpawn) {
        const side = activeCamps; // rotate sides: 0=N, 1=S, 2=W, 3=E
        const pos = pickCampPosition(ts, side);
        const campHp = CAMP_BASE_HP + ts.raidLevel * CAMP_HP_PER_LEVEL;
        ts.banditCamps.push({
          id: `camp${ts.nextCampId}`,
          x: pos.x, y: pos.y,
          hp: campHp, maxHp: campHp,
          strength: Math.max(1, ts.raidLevel),
          lastRaidDay: ts.newDay,
          raidInterval: CAMP_RAID_INTERVAL,
        });
        ts.nextCampId++;
        ts.lastCampSpawnDay = ts.newDay;
        ts.events.push(`A bandit camp has been spotted at (${pos.x},${pos.y})!`);
      }
    }
  }

  // --- RAIDS FROM CAMPS ---
  // Each camp sends raids on its own interval (replaces raidBar-based spawning when camps exist)
  if (ts.isNewDay && ts.banditCamps.length > 0 && ts.enemies.length === 0) {
    for (const camp of ts.banditCamps) {
      if (ts.newDay - camp.lastRaidDay >= camp.raidInterval) {
        spawnRaidFromCamp(ts, camp);
        ts.raidLevel = Math.max(ts.raidLevel, camp.strength);
        break; // One raid at a time
      }
    }
  }

  // --- FALLBACK: raidBar-based spawning (when no camps exist) ---
  if (ts.banditCamps.length === 0) {
    if (ts.isNewDay && ts.villagers.length >= 6 && constructedBuildings >= 8) {
      let totalRes = 0;
      for (const key of ALL_RESOURCES) totalRes += ts.resources[key];
      const raidProsperity = totalRes / 50 + ts.buildings.length + ts.villagers.length;
      ts.raidBar += raidProsperity * 0.08;
    }
    // Raid level decay — weak colonies don't face escalating raids
    if (ts.isNewDay && ts.raidLevel > 0 && ts.villagers.length <= 3 && ts.enemies.length === 0) {
      ts.raidLevel = Math.max(0, ts.raidLevel - 1);
      ts.raidBar = 0;
    }
    // Trigger fallback raid — spawn enemies at map edge
    if (ts.raidBar >= 100 && ts.enemies.length === 0 && ts.isNewDay) {
      ts.raidLevel += 1;
      ts.raidBar = 0;
      const numBandits = ts.raidLevel + 1;
      const numWolves = ts.raidLevel >= (WOLF_SPAWN_THRESHOLD + 1) ? ts.raidLevel - WOLF_STRENGTH_OFFSET : 0;
      const edgeSide = ts.newDay % 4;
      for (let i = 0; i < numBandits + numWolves; i++) {
        const type: EnemyType = i < numBandits ? pickRaidEnemyType(i, numBandits, ts.raidLevel) : 'wolf';
        const t = ENEMY_TEMPLATES[type];
        let ex: number, ey: number;
        switch (edgeSide) {
          case 0: ex = Math.min(ts.width - 1, (i * 3) % ts.width); ey = 0; break;
          case 1: ex = Math.min(ts.width - 1, (i * 3) % ts.width); ey = ts.height - 1; break;
          case 2: ex = 0; ey = Math.min(ts.height - 1, (i * 3) % ts.height); break;
          default: ex = ts.width - 1; ey = Math.min(ts.height - 1, (i * 3) % ts.height); break;
        }
        ts.enemies.push({
          id: `e${ts.nextEnemyId}`, type, x: ex, y: ey,
          hp: t.maxHp, maxHp: t.maxHp, attack: t.attack, defense: t.defense,
          range: t.range || 0, siege: 'none', ticksAlive: 0,
        });
        ts.nextEnemyId++;
      }
      if (ts.raidLevel >= RAM_SPAWN_THRESHOLD) {
        const numRams = Math.min(ts.raidLevel - WOLF_STRENGTH_OFFSET, MAX_RAMS);
        for (let i = 0; i < numRams; i++) {
          let ex: number, ey: number;
          switch (edgeSide) {
            case 0: ex = Math.min(ts.width - 1, ((numBandits + numWolves + i) * 3) % ts.width); ey = 0; break;
            case 1: ex = Math.min(ts.width - 1, ((numBandits + numWolves + i) * 3) % ts.width); ey = ts.height - 1; break;
            case 2: ex = 0; ey = Math.min(ts.height - 1, ((numBandits + numWolves + i) * 3) % ts.height); break;
            default: ex = ts.width - 1; ey = Math.min(ts.height - 1, ((numBandits + numWolves + i) * 3) % ts.height); break;
          }
          ts.enemies.push({
            id: `e${ts.nextEnemyId}`, type: 'bandit', x: ex, y: ey,
            hp: 25, maxHp: 25, attack: 5, defense: 3,
            range: 0, siege: 'battering_ram', ticksAlive: 0,
          });
          ts.nextEnemyId++;
        }
      }
      if (ts.raidLevel >= SIEGE_TOWER_THRESHOLD) {
        let ex: number, ey: number;
        switch (edgeSide) {
          case 0: ex = Math.min(ts.width - 1, ((numBandits + numWolves + 5) * 3) % ts.width); ey = 0; break;
          case 1: ex = Math.min(ts.width - 1, ((numBandits + numWolves + 5) * 3) % ts.width); ey = ts.height - 1; break;
          case 2: ex = 0; ey = Math.min(ts.height - 1, ((numBandits + numWolves + 5) * 3) % ts.height); break;
          default: ex = ts.width - 1; ey = Math.min(ts.height - 1, ((numBandits + numWolves + 5) * 3) % ts.height); break;
        }
        ts.enemies.push({
          id: `e${ts.nextEnemyId}`, type: 'bandit', x: ex, y: ey,
          hp: 20, maxHp: 20, attack: 2, defense: 2,
          range: 0, siege: 'siege_tower', ticksAlive: 0,
        });
        ts.nextEnemyId++;
      }
      ts.events.push(`A raid of ${numBandits} bandits${numWolves > 0 ? ` and ${numWolves} wolves` : ''}${ts.raidLevel >= RAM_SPAWN_THRESHOLD ? ' with siege equipment' : ''} attacks from the ${['north', 'south', 'west', 'east'][edgeSide]}!`);
    }
  }

  // SPATIAL COMBAT (per-tick)
  const nextBldIdRef = { value: ts.nextBuildingId };

  // Enemy lifespan: raiders don't siege forever — despawn after 2 days (240 ticks)
  const ENEMY_MAX_LIFESPAN = 240;
  for (const e of ts.enemies) {
    if (e.hp <= 0) continue;
    e.ticksAlive++;
    if (e.ticksAlive >= ENEMY_MAX_LIFESPAN) {
      e.hp = 0; // Will be cleaned up by dead enemy removal
    }
  }

  // Enemy movement: 1 tile/tick toward settlement
  const center = findSettlementCenter(ts.buildings);
  for (const e of ts.enemies) {
    if (e.hp <= 0) continue;

    // Check if adjacent to a guard — if so, fight instead of moving
    const adjacentGuard = ts.villagers.find(v =>
      v.role === 'guard' && v.hp > 0 && isAdjacent(e.x, e.y, v.x, v.y)
    );
    if (adjacentGuard) continue; // will fight below

    // Ranged enemy (archer): shoot at nearest guard/villager in range instead of moving
    if (e.range > 0) {
      // Find nearest target (guard first, then any villager) within range
      let rangedTarget: { hp: number } | null = null;
      let rangedDist = Infinity;
      for (const v of ts.villagers) {
        if (v.hp <= 0) continue;
        const dist = Math.abs(e.x - v.x) + Math.abs(e.y - v.y);
        if (dist <= e.range && dist < rangedDist) {
          // Prefer guards as targets
          if (!rangedTarget || v.role === 'guard') {
            rangedDist = dist;
            rangedTarget = v;
          }
        }
      }
      if (rangedTarget) {
        // Shoot — deal attack damage at range, no retaliation
        rangedTarget.hp -= Math.max(1, e.attack);
        continue;
      }
      // No target in range — fall through to normal movement
    }

    // Siege tower: can bypass walls — use normal pathfinding instead of enemy pathfinding
    if (e.siege === 'siege_tower') {
      const path = findPath(ts.grid, ts.width, ts.height, e.x, e.y, center.x, center.y);
      if (path.length > 0) {
        e.x = path[0].x;
        e.y = path[0].y;
      }
      continue;
    }

    // Check if adjacent to a wall/building — attack it
    const adjTarget = findAdjacentTarget(e.x, e.y, ts.grid, ts.width, ts.height, ts.buildingMap);
    if (adjTarget && (adjTarget.type === 'wall' || adjTarget.type === 'fence' || adjTarget.type === 'gate')) {
      // Battering ram deals 5 damage to structures
      const siegeDmg = e.siege === 'battering_ram' ? 5 : Math.max(1, e.attack);
      adjTarget.hp -= siegeDmg;
      if (adjTarget.hp <= 0) {
        destroyBuildingAndCreateRubble(adjTarget, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef);
      }
      continue;
    }

    // Move toward settlement center
    const path = findPathEnemy(ts.grid, ts.width, ts.height, e.x, e.y, center.x, center.y);
    if (path.length > 0) {
      e.x = path[0].x;
      e.y = path[0].y;
    } else if (adjTarget) {
      // Can't reach center — attack nearest adjacent building
      adjTarget.hp -= Math.max(1, e.attack);
      if (adjTarget.hp <= 0) {
        destroyBuildingAndCreateRubble(adjTarget, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef);
      }
    } else {
      // No path AND no adjacent target — retreat toward nearest map edge
      const edgeX = e.x < ts.width / 2 ? 0 : ts.width - 1;
      const edgeY = e.y < ts.height / 2 ? 0 : ts.height - 1;
      // Pick closest edge axis
      const dxEdge = Math.abs(e.x - edgeX);
      const dyEdge = Math.abs(e.y - edgeY);
      if (dxEdge <= dyEdge) {
        e.x += e.x < edgeX ? 1 : e.x > edgeX ? -1 : 0;
      } else {
        e.y += e.y < edgeY ? 1 : e.y > edgeY ? -1 : 0;
      }
      // Despawn at map edge
      if (e.x <= 0 || e.x >= ts.width - 1 || e.y <= 0 || e.y >= ts.height - 1) {
        e.hp = 0; // Will be cleaned up by dead enemy removal
      }
    }
  }

  // --- GUARD ASSAULT CAMP: guards ordered to attack a bandit camp ---
  for (const v of ts.villagers) {
    if (v.role !== 'guard' || v.hp <= 0 || !v.assaultTargetId) continue;
    const camp = ts.banditCamps.find(c => c.id === v.assaultTargetId);
    if (!camp) {
      // Camp already destroyed — clear order
      v.assaultTargetId = null;
      v.state = 'idle';
      continue;
    }
    // If adjacent to camp — attack it
    if (isAdjacent(v.x, v.y, camp.x, camp.y)) {
      const baseStats = v.weapon !== 'none'
        ? { attack: WEAPON_STATS[v.weapon].attack, defense: WEAPON_STATS[v.weapon].defense }
        : GUARD_COMBAT[v.tool];
      const atkBonus = hasTech(ts.research, 'military_tactics') ? 2 : 0;
      camp.hp -= Math.max(1, baseStats.attack + atkBonus);
      if (v.weapon !== 'none') degradeWeapon(v, ts.resources, ts.buildings);
      v.state = 'assaulting_camp';
      // Camp fights back — guards near the camp take damage
      v.hp -= Math.max(1, Math.floor(camp.strength * 1.5));
      continue;
    }
    // Not adjacent — pathfind toward camp
    v.state = 'assaulting_camp';
    const campPath = findPath(ts.grid, ts.width, ts.height, v.x, v.y, camp.x, camp.y);
    if (campPath.length > 0) {
      v.x = campPath[0].x;
      v.y = campPath[0].y;
    }
  }

  // --- CAMP CLEARING: reward for destroying a camp ---
  for (let i = ts.banditCamps.length - 1; i >= 0; i--) {
    const camp = ts.banditCamps[i];
    if (camp.hp <= 0) {
      ts.events.push(`The bandit camp at (${camp.x},${camp.y}) has been destroyed! +${CAMP_CLEAR_GOLD} gold, +${CAMP_CLEAR_RENOWN} renown.`);
      ts.renown += CAMP_CLEAR_RENOWN;
      ts.resources.gold += CAMP_CLEAR_GOLD;
      // Deposit gold into storehouse
      const sh = ts.buildings.find(b => isStorehouse(b.type) && b.constructed);
      if (sh) addToBuffer(sh.localBuffer, 'gold', CAMP_CLEAR_GOLD, sh.bufferCapacity);
      // Clear assault orders referencing this camp
      for (const v of ts.villagers) {
        if (v.assaultTargetId === camp.id) {
          v.assaultTargetId = null;
          v.state = 'idle';
        }
      }
      ts.banditCamps.splice(i, 1);
    }
  }

  // Guard AI: detect enemies, move to intercept, fight adjacent
  // Watchtower guards: stay at tower, shoot enemies within range
  const watchtowerRange = WATCHTOWER_RANGE + (hasTech(ts.research, 'archery') ? 2 : 0);
  let attackBonus = hasTech(ts.research, 'military_tactics') ? 2 : 0;
  let defenseBonus = hasTech(ts.research, 'fortification') ? 1 : 0;
  if (hasTech(ts.research, 'steel_forging')) attackBonus += 1;
  if (hasTech(ts.research, 'armored_guards')) defenseBonus += 3;
  const GUARD_DETECT_RANGE = 10;

  for (const v of ts.villagers) {
    if (v.role !== 'guard' || v.hp <= 0) continue;
    // Skip guards on assault orders (already handled above)
    if (v.assaultTargetId) continue;

    // Check if guard is assigned to a watchtower
    const towerJobCandidate = v.jobBuildingId ? ts.buildingMap.get(v.jobBuildingId) : null;
    const towerJob = towerJobCandidate && towerJobCandidate.type === 'watchtower' && towerJobCandidate.constructed
      ? towerJobCandidate : null;

    if (towerJob) {
      // WATCHTOWER GUARD: stay at tower, shoot at range
      // Move to tower if not there
      if (v.x !== towerJob.x || v.y !== towerJob.y) {
        const towerPath = findPath(ts.grid, ts.width, ts.height, v.x, v.y, towerJob.x, towerJob.y);
        if (towerPath.length > 0) {
          v.x = towerPath[0].x;
          v.y = towerPath[0].y;
        }
        continue;
      }

      // At tower — shoot nearest enemy within range
      let nearestEnemy: EnemyEntity | null = null;
      let nearestDist = Infinity;
      for (const e of ts.enemies) {
        if (e.hp <= 0) continue;
        const dist = Math.abs(e.x - v.x) + Math.abs(e.y - v.y);
        if (dist <= watchtowerRange && dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = e;
        }
      }

      if (nearestEnemy) {
        // Ranged attack — flat damage, enemy can't retaliate
        // Bow-equipped tower guard gets bonus damage
        const bowBonus = v.weapon === 'bow' ? WEAPON_STATS.bow.attack : 0;
        nearestEnemy.hp -= WATCHTOWER_DAMAGE + bowBonus;
        if (bowBonus > 0) degradeWeapon(v, ts.resources, ts.buildings);
      }
      continue;
    }

    // NON-TOWER GUARD: behavior depends on guardMode and guardLine
    // guardMode: 'charge' = aggressive (infinite detect range), 'hold' = defensive (3-tile range), 'patrol' = default (10-tile)
    // guardLine: 'front' = close to melee, 'back' = stay at range when possible

    // Determine detect range based on mode
    const detectRange = v.guardMode === 'charge' ? Infinity
      : v.guardMode === 'hold' ? 3
      : GUARD_DETECT_RANGE;

    // Find nearest enemy within detect range
    let nearestEnemy: EnemyEntity | null = null;
    let nearestDist = Infinity;
    for (const e of ts.enemies) {
      if (e.hp <= 0) continue;
      const dist = Math.abs(e.x - v.x) + Math.abs(e.y - v.y);
      if (dist < nearestDist) { nearestDist = dist; nearestEnemy = e; }
    }

    // Back-line guard with bow: prioritize ranged attacks, avoid closing to melee
    if (nearestEnemy && v.guardLine === 'back' && v.weapon === 'bow' && nearestDist <= WEAPON_STATS.bow.range && nearestDist > 1) {
      nearestEnemy.hp -= Math.max(1, WEAPON_STATS.bow.attack + attackBonus - nearestEnemy.defense);
      degradeWeapon(v, ts.resources, ts.buildings);
      continue;
    }

    // Front-line bow guard: also shoot at range if able (same as before)
    if (nearestEnemy && v.guardLine === 'front' && v.weapon === 'bow' && nearestDist <= WEAPON_STATS.bow.range && nearestDist > 1) {
      nearestEnemy.hp -= Math.max(1, WEAPON_STATS.bow.attack + attackBonus - nearestEnemy.defense);
      degradeWeapon(v, ts.resources, ts.buildings);
      continue;
    }

    // No enemies or out of detect range — patrol/hold behavior
    if (!nearestEnemy || nearestDist > detectRange) {
      // Hold mode: stay in position (no patrol movement, just stand ground)
      if (v.guardMode === 'hold') continue;

      // Patrol/charge: walk patrol route
      if (v.patrolRoute.length > 0 && !ts.isNight) {
        const waypoint = v.patrolRoute[v.patrolIndex % v.patrolRoute.length];
        if (v.x === waypoint.x && v.y === waypoint.y) {
          v.patrolIndex = (v.patrolIndex + 1) % v.patrolRoute.length;
        } else {
          const patrolPath = findPath(ts.grid, ts.width, ts.height, v.x, v.y, waypoint.x, waypoint.y);
          if (patrolPath.length > 0) {
            v.x = patrolPath[0].x;
            v.y = patrolPath[0].y;
          }
        }
      }
      continue;
    }

    // If adjacent — fight (both front and back line fight when cornered)
    if (isAdjacent(v.x, v.y, nearestEnemy.x, nearestEnemy.y)) {
      const baseStats = v.weapon !== 'none'
        ? { attack: WEAPON_STATS[v.weapon].attack, defense: WEAPON_STATS[v.weapon].defense }
        : GUARD_COMBAT[v.tool];
      nearestEnemy.hp -= Math.max(1, baseStats.attack + attackBonus - nearestEnemy.defense);
      const armorDef = ARMOR_STATS[v.armor]?.defense || 0;
      const guardDef = baseStats.defense + defenseBonus + armorDef;
      v.hp -= Math.max(1, nearestEnemy.attack - guardDef);
      if (v.weapon !== 'none') degradeWeapon(v, ts.resources, ts.buildings);
      if (v.armor !== 'none') degradeArmor(v, ts.resources, ts.buildings);
      continue;
    }

    // Back-line guard: try to maintain distance instead of closing
    if (v.guardLine === 'back' && v.weapon === 'bow' && nearestDist <= WEAPON_STATS.bow.range) {
      // Already in bow range but not adjacent — just shoot (handled above)
      // If closer than range 2, try to retreat 1 tile away from enemy
      if (nearestDist <= 1) {
        const retreatX = v.x + (v.x > nearestEnemy.x ? 1 : v.x < nearestEnemy.x ? -1 : 0);
        const retreatY = v.y + (v.y > nearestEnemy.y ? 1 : v.y < nearestEnemy.y ? -1 : 0);
        if (retreatX >= 0 && retreatX < ts.width && retreatY >= 0 && retreatY < ts.height) {
          const tile = ts.grid[retreatY][retreatX];
          if (tile.terrain !== 'water' && !tile.building) {
            v.x = retreatX;
            v.y = retreatY;
            continue;
          }
        }
      }
      continue;
    }

    // Hold mode: don't move toward enemy, wait for them to come
    if (v.guardMode === 'hold') continue;

    // Front-line / charge / patrol: move toward enemy
    const guardPath = findPath(ts.grid, ts.width, ts.height, v.x, v.y, nearestEnemy.x, nearestEnemy.y);
    if (guardPath.length > 0) {
      v.x = guardPath[0].x;
      v.y = guardPath[0].y;
    }
  }

  // Enemies attack adjacent non-guard villagers (after guards/walls/buildings)
  for (const e of ts.enemies) {
    if (e.hp <= 0) continue;
    // Already fighting a guard? Skip
    const fightingGuard = ts.villagers.some(v =>
      v.role === 'guard' && v.hp > 0 && isAdjacent(e.x, e.y, v.x, v.y)
    );
    if (fightingGuard) continue;
    // Attack adjacent non-guard villager
    const adjacentVillager = ts.villagers.find(v =>
      v.role !== 'guard' && v.hp > 0 && isAdjacent(e.x, e.y, v.x, v.y)
    );
    if (adjacentVillager) {
      adjacentVillager.hp -= Math.max(1, e.attack);
    }
  }

  // Remove dead enemies + award trust to nearby NPC villages
  for (let i = ts.enemies.length - 1; i >= 0; i--) {
    if (ts.enemies[i].hp <= 0) {
      const deadE = ts.enemies[i];
      // Award trust to nearby NPC villages
      for (const village of ts.npcSettlements) {
        if (village.liberated) continue;
        const dist = Math.abs(deadE.x - village.x) + Math.abs(deadE.y - village.y);
        if (dist <= TRUST_VILLAGE_RADIUS) {
          village.trust += TRUST_KILL_BANDIT;
          // Update trust rank
          let newRank: TrustRank = 'stranger';
          for (const t of TRUST_THRESHOLDS) {
            if (village.trust >= t.trust) newRank = t.rank;
          }
          village.trustRank = newRank;
        }
      }
      ts.enemies.splice(i, 1);
    }
  }

  // Check liberation completion — if a village has liberationInProgress and no enemies remain nearby
  for (const village of ts.npcSettlements) {
    if (!village.liberationInProgress) continue;
    const nearbyEnemies = ts.enemies.filter(e => {
      const dist = Math.abs(e.x - village.x) + Math.abs(e.y - village.y);
      return dist <= TRUST_VILLAGE_RADIUS;
    });
    if (nearbyEnemies.length === 0) {
      village.liberationInProgress = false;
      village.liberated = true;
      village.trustRank = 'leader';
      ts.renown += LIBERATION_RENOWN_REWARD;
      ts.events.push(`${village.name} has been liberated! The villagers hail you as their leader!`);
    }
  }

  // Remove dead villagers (guards and non-guards)
  const deadVillagers = ts.villagers.filter(v => v.hp <= 0);
  const deadVillagerIds = new Set(deadVillagers.map(v => v.id));
  if (deadVillagerIds.size > 0) {
    for (const b of ts.buildings) b.assignedWorkers = b.assignedWorkers.filter(id => !deadVillagerIds.has(id));
    // Apply grief to family members + record in graveyard
    for (const dead of deadVillagers) {
      for (const v of ts.villagers) {
        if (v.hp > 0 && v.family.includes(dead.id)) {
          v.grief = 5;
          v.family = v.family.filter(id => id !== dead.id);
        }
      }
      ts.graveyard.push({ name: dead.name, day: ts.newDay });
    }
    ts.villagers = ts.villagers.filter(v => !deadVillagerIds.has(v.id));
  }

  // If all enemies cleared, reduce raid bar
  if (enemyCountBefore > 0 && ts.enemies.length === 0) {
    ts.raidBar = Math.max(0, ts.raidBar - 20);
  }
  ts.nextBuildingId = nextBldIdRef.value;

  // Convert any 0-hp buildings to rubble (handles externally-damaged buildings)
  const nextBldIdRef2 = { value: ts.nextBuildingId };
  for (let i = ts.buildings.length - 1; i >= 0; i--) {
    const b = ts.buildings[i];
    if (b.hp <= 0 && b.type !== 'rubble') {
      destroyBuildingAndCreateRubble(b, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef2);
    }
  }
  ts.nextBuildingId = nextBldIdRef2.value;

  // Final orphaned job cleanup: any villager whose job building was destroyed this tick
  // Rebuild map after building mutations (destroyBuildingAndCreateRubble)
  ts.buildingMap = buildBuildingMap(ts.buildings);
  for (const v of ts.villagers) {
    if (v.jobBuildingId && !ts.buildingMap.has(v.jobBuildingId)) {
      v.jobBuildingId = null;
      if (v.role !== 'guard') v.role = 'idle';
      v.state = 'idle';
    }
  }
}
