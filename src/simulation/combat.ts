// combat.ts — Raid spawning, enemy movement, guard AI, melee combat

import {
  Building, BuildingType, Villager, Tile,
  EnemyEntity, EnemyType, ENEMY_TEMPLATES, GUARD_COMBAT,
  CONSTRUCTION_TICKS, BUILDING_MAX_HP, ALL_RESOURCES,
  WATCHTOWER_RANGE, WATCHTOWER_DAMAGE,
} from '../world.js';
import { TickState, isAdjacent, hasTech } from './helpers.js';
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
  x: number, y: number, grid: Tile[][], width: number, height: number, buildings: Building[],
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
          return buildings.find(b => b.id === tile.building!.id) || null;
        }
      }
    }
  }
  return null;
}

// --- Helper: destroy a building ---
function destroyBuilding(
  building: Building, buildings: Building[], grid: Tile[][],
  villagers: Villager[], width: number, height: number,
  nextBuildingIdRef: { value: number },
): void {
  // Unassign workers/residents
  for (const v of villagers) {
    if (v.jobBuildingId === building.id) { v.jobBuildingId = null; v.role = 'idle'; v.state = 'idle'; }
    if (v.homeBuildingId === building.id) v.homeBuildingId = null;
  }
  // Remove original building from array
  const idx = buildings.findIndex(b => b.id === building.id);
  if (idx >= 0) buildings.splice(idx, 1);
  // Create rubble at each tile the building occupied
  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const gy = building.y + dy;
      const gx = building.x + dx;
      if (gy < height && gx < width) {
        const rubble: Building = {
          id: `b${nextBuildingIdRef.value++}`,
          type: 'rubble', x: gx, y: gy, width: 1, height: 1,
          assignedWorkers: [],
          hp: 1, maxHp: 1,
          constructed: false,
          constructionProgress: 0,
          constructionRequired: CONSTRUCTION_TICKS['rubble'] || 30,
          localBuffer: {}, bufferCapacity: 0,
          onFire: false,
        };
        buildings.push(rubble);
        grid[gy][gx].building = rubble;
      }
    }
  }
}

export function processRaidAndCombat(ts: TickState): void {
  // Track original enemy count (before raid spawning) for cleared check
  const enemyCountBefore = ts.enemies.length;

  // RAID CHECK — raids only start once the colony is established
  // Milestone gate: population >= 6 AND at least 8 constructed buildings
  const constructedBuildings = ts.buildings.filter(b => b.constructed && b.type !== 'rubble').length;
  if (ts.isNewDay && ts.villagers.length >= 6 && constructedBuildings >= 8) {
    let totalRes = 0;
    for (const key of ALL_RESOURCES) totalRes += ts.resources[key];
    const raidProsperity = totalRes / 50 + ts.buildings.length + ts.villagers.length;
    ts.raidBar += raidProsperity * 0.15;
  }
  // Raid level decay — weak colonies don't face escalating raids
  if (ts.isNewDay && ts.raidLevel > 0 && ts.villagers.length <= 3 && ts.enemies.length === 0) {
    ts.raidLevel = Math.max(0, ts.raidLevel - 1);
    ts.raidBar = 0;
  }

  // Trigger raid — spawn enemies at map edge
  if (ts.raidBar >= 100 && ts.enemies.length === 0 && ts.isNewDay) {
    ts.raidLevel += 1;
    ts.raidBar = 0;
    const numBandits = ts.raidLevel + 1;
    const numWolves = ts.raidLevel >= 4 ? ts.raidLevel - 2 : 0;
    // Spawn at random edge based on day
    const edgeSide = ts.newDay % 4; // 0=north, 1=south, 2=west, 3=east
    for (let i = 0; i < numBandits + numWolves; i++) {
      const type: EnemyType = i < numBandits ? 'bandit' : 'wolf';
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
        siege: 'none', ticksAlive: 0,
      });
      ts.nextEnemyId++;
    }
    // Siege equipment at higher raid levels
    if (ts.raidLevel >= 3) {
      const numRams = Math.min(ts.raidLevel - 2, 2);
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
          siege: 'battering_ram', ticksAlive: 0,
        });
        ts.nextEnemyId++;
      }
    }
    if (ts.raidLevel >= 5) {
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
        siege: 'siege_tower', ticksAlive: 0,
      });
      ts.nextEnemyId++;
    }
    ts.events.push(`A raid of ${numBandits} bandits${numWolves > 0 ? ` and ${numWolves} wolves` : ''}${ts.raidLevel >= 3 ? ' with siege equipment' : ''} attacks from the ${['north', 'south', 'west', 'east'][edgeSide]}!`);
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
    const adjTarget = findAdjacentTarget(e.x, e.y, ts.grid, ts.width, ts.height, ts.buildings);
    if (adjTarget && (adjTarget.type === 'wall' || adjTarget.type === 'fence' || adjTarget.type === 'gate')) {
      // Battering ram deals 5 damage to structures
      const siegeDmg = e.siege === 'battering_ram' ? 5 : Math.max(1, e.attack);
      adjTarget.hp -= siegeDmg;
      if (adjTarget.hp <= 0) {
        destroyBuilding(adjTarget, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef);
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
        destroyBuilding(adjTarget, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef);
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

  // Guard AI: detect enemies, move to intercept, fight adjacent
  // Watchtower guards: stay at tower, shoot enemies within WATCHTOWER_RANGE
  const attackBonus = hasTech(ts.research, 'military_tactics') ? 2 : 0;
  const defenseBonus = hasTech(ts.research, 'fortification') ? 1 : 0;
  const GUARD_DETECT_RANGE = 10;

  for (const v of ts.villagers) {
    if (v.role !== 'guard' || v.hp <= 0) continue;

    // Check if guard is assigned to a watchtower
    const towerJob = v.jobBuildingId
      ? ts.buildings.find(b => b.id === v.jobBuildingId && b.type === 'watchtower' && b.constructed)
      : null;

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
        if (dist <= WATCHTOWER_RANGE && dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = e;
        }
      }

      if (nearestEnemy) {
        // Ranged attack — flat damage, enemy can't retaliate
        nearestEnemy.hp -= WATCHTOWER_DAMAGE;
      }
      continue;
    }

    // NON-TOWER GUARD: standard melee behavior
    // Find nearest enemy
    let nearestEnemy: EnemyEntity | null = null;
    let nearestDist = Infinity;
    for (const e of ts.enemies) {
      if (e.hp <= 0) continue;
      const dist = Math.abs(e.x - v.x) + Math.abs(e.y - v.y);
      if (dist < nearestDist) { nearestDist = dist; nearestEnemy = e; }
    }

    // No enemies or too far — patrol
    if (!nearestEnemy || nearestDist > GUARD_DETECT_RANGE) {
      if (v.patrolRoute.length > 0 && !ts.isNight) {
        const waypoint = v.patrolRoute[v.patrolIndex % v.patrolRoute.length];
        if (v.x === waypoint.x && v.y === waypoint.y) {
          // Reached waypoint — advance to next
          v.patrolIndex = (v.patrolIndex + 1) % v.patrolRoute.length;
        } else {
          // Move toward current waypoint (1 tile/tick)
          const patrolPath = findPath(ts.grid, ts.width, ts.height, v.x, v.y, waypoint.x, waypoint.y);
          if (patrolPath.length > 0) {
            v.x = patrolPath[0].x;
            v.y = patrolPath[0].y;
          }
        }
      }
      continue;
    }

    // If adjacent — fight
    if (isAdjacent(v.x, v.y, nearestEnemy.x, nearestEnemy.y)) {
      const stats = GUARD_COMBAT[v.tool];
      // Guard attacks enemy
      nearestEnemy.hp -= Math.max(1, stats.attack + attackBonus - nearestEnemy.defense);
      // Enemy attacks guard
      const guardDef = stats.defense + defenseBonus;
      v.hp -= Math.max(1, nearestEnemy.attack - guardDef);
      continue;
    }

    // Move toward enemy (1 tile/tick)
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

  // Remove dead enemies
  for (let i = ts.enemies.length - 1; i >= 0; i--) {
    if (ts.enemies[i].hp <= 0) ts.enemies.splice(i, 1);
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
  for (let i = ts.buildings.length - 1; i >= 0; i--) {
    const b = ts.buildings[i];
    if (b.hp <= 0 && b.type !== 'rubble') {
      // Unassign workers/residents
      for (const v of ts.villagers) {
        if (v.jobBuildingId === b.id) { v.jobBuildingId = null; v.role = 'idle'; v.state = 'idle'; }
        if (v.homeBuildingId === b.id) v.homeBuildingId = null;
      }
      ts.buildings.splice(i, 1);
      for (let dy = 0; dy < b.height; dy++) {
        for (let dx = 0; dx < b.width; dx++) {
          const gy = b.y + dy;
          const gx = b.x + dx;
          if (gy < ts.height && gx < ts.width) {
            const rubble: Building = {
              id: `b${ts.nextBuildingId++}`,
              type: 'rubble', x: gx, y: gy, width: 1, height: 1,
              assignedWorkers: [],
              hp: 1, maxHp: 1,
              constructed: false,
              constructionProgress: 0,
              constructionRequired: CONSTRUCTION_TICKS['rubble'] || 30,
              localBuffer: {}, bufferCapacity: 0,
            };
            ts.buildings.push(rubble);
            ts.grid[gy][gx].building = rubble;
          }
        }
      }
    }
  }

  // Final orphaned job cleanup: any villager whose job building was destroyed this tick
  for (const v of ts.villagers) {
    if (v.jobBuildingId && !ts.buildings.find(b => b.id === v.jobBuildingId)) {
      v.jobBuildingId = null;
      if (v.role !== 'guard') v.role = 'idle';
      v.state = 'idle';
    }
  }
}
