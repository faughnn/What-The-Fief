// animals.ts — Wildlife behavior, hunting, resource drops

import {
  Villager, Building, Tile, ResourceType,
  AnimalEntity, AnimalType, ANIMAL_TEMPLATES, ResourceDrop,
  CARRY_CAPACITY,
} from '../world.js';
import {
  TickState, isAdjacent, addResource, addToBuffer,
  getBuildingEntrance, findStorehouseAt, findNearestStorehouse,
} from './helpers.js';
import { moveOneStep, atDestination, planPath } from './movement.js';

export function processAnimals(ts: TickState): void {
  // Animal spawning — periodically add animals to the map
  if (ts.isNewDay && ts.newDay % 3 === 0 && ts.animals.length < 10) {
    const animalTypes: AnimalType[] = ['deer', 'rabbit', 'wild_wolf', 'wild_boar'];
    const rngAnimal = ((ts.newDay * 48271 + 1) & 0x7fffffff) % animalTypes.length;
    const type = animalTypes[rngAnimal];
    const template = ANIMAL_TEMPLATES[type];
    // Spawn at map edge
    const edge = ((ts.newDay * 16807) & 0x7fffffff) % 4;
    let ax = 0, ay = 0;
    switch (edge) {
      case 0: ax = ((ts.newDay * 7 + 3) % ts.width); ay = 0; break;
      case 1: ax = ((ts.newDay * 7 + 3) % ts.width); ay = ts.height - 1; break;
      case 2: ax = 0; ay = ((ts.newDay * 7 + 3) % ts.height); break;
      default: ax = ts.width - 1; ay = ((ts.newDay * 7 + 3) % ts.height); break;
    }
    if (ts.grid[ay][ax].terrain !== 'water') {
      ts.animals.push({
        id: `a${ts.nextAnimalId}`, type, x: ax, y: ay,
        hp: template.maxHp, maxHp: template.maxHp,
        attack: template.attack, behavior: template.behavior,
      });
      ts.nextAnimalId++;
    }
  }

  // Animal movement per tick
  for (const a of ts.animals) {
    if (a.hp <= 0) continue;

    if (a.behavior === 'passive') {
      // Passive: random roam, flee from nearby entities (within 3 tiles)
      let fleeX = 0, fleeY = 0;
      let fleeing = false;
      for (const v of ts.villagers) {
        const dist = Math.abs(v.x - a.x) + Math.abs(v.y - a.y);
        if (dist <= 3) {
          fleeX += (a.x - v.x);
          fleeY += (a.y - v.y);
          fleeing = true;
        }
      }
      if (fleeing) {
        // Move away from the threat
        const dx = fleeX > 0 ? 1 : fleeX < 0 ? -1 : 0;
        const dy = dx === 0 ? (fleeY > 0 ? 1 : fleeY < 0 ? -1 : 0) : 0;
        const nx = Math.max(0, Math.min(ts.width - 1, a.x + dx));
        const ny = Math.max(0, Math.min(ts.height - 1, a.y + dy));
        if (ts.grid[ny][nx].terrain !== 'water' && !ts.grid[ny][nx].building) {
          a.x = nx; a.y = ny;
        }
      } else if (ts.newTick % 3 === 0) {
        // Occasional random movement
        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        const dir = dirs[(ts.newTick + a.x * 7 + a.y * 13) % 4];
        const nx = Math.max(0, Math.min(ts.width - 1, a.x + dir.dx));
        const ny = Math.max(0, Math.min(ts.height - 1, a.y + dir.dy));
        if (ts.grid[ny][nx].terrain !== 'water' && !ts.grid[ny][nx].building) {
          a.x = nx; a.y = ny;
        }
      }
    } else {
      // Hostile: move toward nearby villagers (within 5 tiles), attack if adjacent
      let target: Villager | null = null;
      let targetDist = Infinity;
      for (const v of ts.villagers) {
        const dist = Math.abs(v.x - a.x) + Math.abs(v.y - a.y);
        if (dist <= 5 && dist < targetDist) { target = v; targetDist = dist; }
      }
      if (target) {
        if (isAdjacent(a.x, a.y, target.x, target.y)) {
          // Attack
          target.hp -= Math.max(1, a.attack);
        } else {
          // Move toward target (1 tile/tick)
          const dx = target.x > a.x ? 1 : target.x < a.x ? -1 : 0;
          const dy = dx === 0 ? (target.y > a.y ? 1 : target.y < a.y ? -1 : 0) : 0;
          const nx = Math.max(0, Math.min(ts.width - 1, a.x + dx));
          const ny = Math.max(0, Math.min(ts.height - 1, a.y + dy));
          if (ts.grid[ny][nx].terrain !== 'water' && !ts.grid[ny][nx].building) {
            a.x = nx; a.y = ny;
          }
        }
      } else if (ts.newTick % 5 === 0) {
        // Random roam when no target
        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        const dir = dirs[(ts.newTick + a.x * 11 + a.y * 17) % 4];
        const nx = Math.max(0, Math.min(ts.width - 1, a.x + dir.dx));
        const ny = Math.max(0, Math.min(ts.height - 1, a.y + dir.dy));
        if (ts.grid[ny][nx].terrain !== 'water' && !ts.grid[ny][nx].building) {
          a.x = nx; a.y = ny;
        }
      }
    }
  }

  // Hunter AI: hunters track and kill animals
  for (const v of ts.villagers) {
    if (v.role !== 'hunter' || v.hp <= 0) continue;
    if (v.state === 'sleeping') continue;

    // Find nearest animal
    let nearestAnimal: AnimalEntity | null = null;
    let nearestDist = Infinity;
    for (const a of ts.animals) {
      if (a.hp <= 0) continue;
      const dist = Math.abs(a.x - v.x) + Math.abs(a.y - v.y);
      if (dist < nearestDist) { nearestAnimal = a; nearestDist = dist; }
    }

    if (!nearestAnimal) continue;

    if (v.state === 'hunting') {
      if (isAdjacent(v.x, v.y, nearestAnimal.x, nearestAnimal.y)) {
        // Attack the animal
        nearestAnimal.hp -= 3; // hunter attack
        if (nearestAnimal.attack > 0) {
          v.hp -= Math.max(1, nearestAnimal.attack - 1); // animal fights back
        }
      } else {
        // Move toward animal
        const dx = nearestAnimal.x > v.x ? 1 : nearestAnimal.x < v.x ? -1 : 0;
        const dy = dx === 0 ? (nearestAnimal.y > v.y ? 1 : nearestAnimal.y < v.y ? -1 : 0) : 0;
        const nx = Math.max(0, Math.min(ts.width - 1, v.x + dx));
        const ny = Math.max(0, Math.min(ts.height - 1, v.y + dy));
        if (ts.grid[ny][nx].terrain !== 'water') {
          v.x = nx; v.y = ny;
        }
      }
      continue; // skip normal state machine
    }

    // If at work and animals exist, start hunting
    if (v.state === 'working' && nearestDist <= 20) {
      v.state = 'hunting';
      continue;
    }

    // Hauling drop: pick up resource drop and carry to storehouse
    if (v.state === 'hauling_drop') {
      if (atDestination(v)) {
        // At storehouse — deposit carried resources into storehouse buffer
        const dropSH = findStorehouseAt(ts.buildings, v.x, v.y);
        for (const [res, amt] of Object.entries(v.carrying)) {
          if (amt && amt > 0) {
            let deposited = 0;
            if (dropSH) deposited = addToBuffer(dropSH.localBuffer, res as ResourceType, amt, dropSH.bufferCapacity);
            if (deposited > 0) addResource(ts.resources, res as ResourceType, deposited, ts.storageCap);
            // Keep undeposited amount in carrying
            const remaining = amt - deposited;
            if (remaining > 0) {
              v.carrying[res as ResourceType] = remaining;
            } else {
              delete v.carrying[res as ResourceType];
            }
          }
        }
        v.carryTotal = Object.values(v.carrying).reduce((s, a) => s + (a || 0), 0);
        // Go back to work or hunt
        v.state = 'working';
        if (v.jobBuildingId) {
          const job = ts.buildings.find(b => b.id === v.jobBuildingId);
          if (job) {
            const entrance = getBuildingEntrance(job);
            planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
            v.state = 'traveling_to_work';
          }
        }
      } else {
        moveOneStep(v);
      }
      continue;
    }
  }

  // Remove dead animals, create resource drops
  for (let i = ts.animals.length - 1; i >= 0; i--) {
    if (ts.animals[i].hp <= 0) {
      const dead = ts.animals[i];
      const template = ANIMAL_TEMPLATES[dead.type];
      if (template.drops && Object.keys(template.drops).length > 0) {
        ts.resourceDrops.push({
          id: `d${ts.nextDropId}`, x: dead.x, y: dead.y,
          resources: { ...template.drops },
        });
        ts.nextDropId++;
      }
      ts.animals.splice(i, 1);
    }
  }

  // Hunters pick up resource drops when adjacent
  for (const v of ts.villagers) {
    if (v.role !== 'hunter' || v.hp <= 0) continue;
    if (v.state !== 'hunting' && v.state !== 'working') continue;

    for (let i = ts.resourceDrops.length - 1; i >= 0; i--) {
      const drop = ts.resourceDrops[i];
      if (isAdjacent(v.x, v.y, drop.x, drop.y) || (v.x === drop.x && v.y === drop.y)) {
        // Pick up resources
        for (const [res, amt] of Object.entries(drop.resources)) {
          if (amt && amt > 0) {
            const canCarry = Math.min(amt, CARRY_CAPACITY - v.carryTotal);
            if (canCarry > 0) {
              v.carrying[res as ResourceType] = (v.carrying[res as ResourceType] || 0) + canCarry;
              v.carryTotal += canCarry;
            }
          }
        }
        ts.resourceDrops.splice(i, 1);

        // Head to storehouse to deposit
        const storehouse = findNearestStorehouse(ts.buildings, ts.grid, ts.width, ts.height, v.x, v.y);
        if (storehouse) {
          const entrance = getBuildingEntrance(storehouse);
          planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
          v.state = 'hauling_drop';
        }
        break; // only pick up one drop per tick
      }
    }
  }

  // Remove dead villagers (from animal attacks)
  const deadFromAnimals = new Set(ts.villagers.filter(v => v.hp <= 0).map(v => v.id));
  if (deadFromAnimals.size > 0) {
    for (const b of ts.buildings) b.assignedWorkers = b.assignedWorkers.filter(id => !deadFromAnimals.has(id));
    ts.villagers = ts.villagers.filter(v => !deadFromAnimals.has(v.id));
  }
}
