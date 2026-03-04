// villagers.ts — Villager state machine (per-tick processing)

import {
  Villager, Building, Resources, ResourceType, Tile,
  BuildingType, BUILDING_TEMPLATES, FOOD_PRIORITY, FoodEaten,
  Season, WeatherType, ResearchState,
  CARRY_CAPACITY, HOME_DEPARTURE_TICK, OUTDOOR_BUILDINGS,
  SEASON_FARM_MULT, WEATHER_OUTDOOR_MULT,
  TICKS_PER_DAY, NIGHT_TICKS, TechId, TECH_TREE,
} from '../world.js';
import {
  TickState, getBuildingEntrance, addResource, addToBuffer, bufferTotal,
  hasBufferInputs, consumeBufferInputs, ticksPerUnit, productionMultiplier,
  autoEquipTool, degradeTool, gainSkillXp, hasTech, techProductionBonus,
  findStorehouseAt, findNearestStorehouse, revealArea, isStorehouse,
} from './helpers.js';
import { moveOneStep, atDestination, planPath, findPath } from './movement.js';

// --- Helper: plan path to any tile of a multi-tile building (shortest reachable tile) ---
function planPathToBuilding(v: Villager, building: Building, grid: Tile[][], width: number, height: number): void {
  let bestPath: { x: number; y: number }[] | null = null;
  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const tx = building.x + dx;
      const ty = building.y + dy;
      if (v.x === tx && v.y === ty) {
        v.path = [];
        v.pathIndex = 0;
        return;
      }
      const path = findPath(grid, width, height, v.x, v.y, tx, ty);
      if (path.length > 0 && (bestPath === null || path.length < bestPath.length)) {
        bestPath = path;
      }
    }
  }
  if (bestPath) {
    v.path = bestPath;
    v.pathIndex = 0;
  } else {
    // Fall back to entrance
    const entrance = getBuildingEntrance(building);
    planPath(v, grid, width, height, entrance.x, entrance.y);
  }
}

// --- Helper: count only output resources in buffer (for processing buildings) ---
function bufferOutputTotal(buffer: Partial<Record<ResourceType, number>>, buildingType: BuildingType): number {
  const template = BUILDING_TEMPLATES[buildingType];
  const inputKeys = template.production?.inputs ? new Set(Object.keys(template.production.inputs)) : new Set<string>();
  let total = 0;
  for (const [res, amt] of Object.entries(buffer)) {
    if (!inputKeys.has(res)) total += (amt || 0);
  }
  return total;
}

// --- Helper: start hauling from workplace to storage ---
function startHauling(v: Villager, job: Building, buildings: Building[], grid: Tile[][], width: number, height: number): void {
  // Pick up resources from building buffer — for processing buildings, only haul outputs
  const template = BUILDING_TEMPLATES[job.type];
  const inputKeys = template.production?.inputs ? new Set(Object.keys(template.production.inputs)) : new Set<string>();
  let carried = 0;
  v.carrying = {};
  for (const [res, amt] of Object.entries(job.localBuffer)) {
    if (!amt || amt <= 0) continue;
    if (inputKeys.has(res)) continue; // Don't haul inputs away from processing buildings
    const toCarry = Math.min(amt, CARRY_CAPACITY - carried);
    if (toCarry <= 0) break;
    v.carrying[res as ResourceType] = toCarry;
    job.localBuffer[res as ResourceType] = amt - toCarry;
    if ((job.localBuffer[res as ResourceType] || 0) <= 0) delete job.localBuffer[res as ResourceType];
    carried += toCarry;
  }
  v.carryTotal = carried;

  // Find nearest storehouse — try all tiles for best path
  const storehouse = findNearestStorehouse(buildings, grid, width, height, v.x, v.y);
  if (storehouse) {
    planPathToBuilding(v, storehouse, grid, width, height);
    v.state = 'traveling_to_storage';
  } else {
    // No storehouse — deposit at current location into global resources
    // (fallback: resources go to global pool directly)
    v.state = 'working';
  }
}

// --- Helper: start picking up inputs from storehouse for a processing building ---
function startPickupInputs(v: Villager, job: Building, buildings: Building[], resources: Resources, grid: Tile[][], width: number, height: number): void {
  // Find nearest storehouse that has at least one needed input in its buffer
  const template = BUILDING_TEMPLATES[job.type];
  const inputTypes = template.production?.inputs ? Object.keys(template.production.inputs) : [];
  let bestSH: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    if (!isStorehouse(b.type) || !b.constructed) continue;
    let hasInput = false;
    for (const res of inputTypes) {
      if ((b.localBuffer[res as ResourceType] || 0) > 0) { hasInput = true; break; }
    }
    if (!hasInput) continue;
    const entrance = getBuildingEntrance(b);
    const dist = Math.abs(entrance.x - v.x) + Math.abs(entrance.y - v.y);
    if (dist < bestDist) { bestDist = dist; bestSH = b; }
  }
  if (bestSH) {
    planPathToBuilding(v, bestSH, grid, width, height);
    v.state = 'traveling_to_storage';
    v.haulingToWork = true;
  } else {
    // No storehouse with inputs — reset progress and keep working
    // Don't go idle: that would let tryIdleTask hijack this worker's jobBuildingId
    v.workProgress = 0;
  }
}

// --- Helper: start traveling to eat (nearest storehouse with food in its buffer) ---
function startEating(v: Villager, buildings: Building[], resources: Resources, grid: Tile[][], width: number, height: number): boolean {
  // Find nearest storehouse that has food in its local buffer
  let bestSH: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    if (!isStorehouse(b.type) || !b.constructed) continue;
    // Check if this storehouse has food in its buffer
    let hasFood = false;
    for (const { resource } of FOOD_PRIORITY) {
      if ((b.localBuffer[resource] || 0) > 0) { hasFood = true; break; }
    }
    if (!hasFood) continue;
    const entrance = getBuildingEntrance(b);
    const dist = Math.abs(entrance.x - v.x) + Math.abs(entrance.y - v.y);
    if (dist < bestDist) { bestDist = dist; bestSH = b; }
  }
  if (bestSH) {
    planPathToBuilding(v, bestSH, grid, width, height);
    // Already at storehouse or path found
    if (v.path.length === 0 && v.x >= bestSH.x && v.x < bestSH.x + bestSH.width
        && v.y >= bestSH.y && v.y < bestSH.y + bestSH.height) {
      v.state = 'traveling_to_eat';
      return true;
    }
    if (v.path.length > 0) {
      v.state = 'traveling_to_eat';
      return true;
    }
    return false;
  }
  return false;
}

// --- Helper: try to visit tavern before going home ---
function tryVisitTavern(v: Villager, buildings: Building[], grid: Tile[][], width: number, height: number): boolean {
  if (v.morale >= 60 || v.tavernVisitCooldown > 0) return false;
  const tavern = buildings.find(b => b.type === 'tavern' && b.constructed);
  if (!tavern) return false;
  const entrance = getBuildingEntrance(tavern);
  planPath(v, grid, width, height, entrance.x, entrance.y);
  v.state = 'traveling_to_tavern';
  return true;
}

function trySeekHealing(v: Villager, buildings: Building[], resources: Resources, grid: Tile[][], width: number, height: number): boolean {
  if (!v.sick) return false;
  // Find storehouse with herbs
  for (const b of buildings) {
    if (!isStorehouse(b.type) || !b.constructed) continue;
    if ((b.localBuffer.herbs || 0) > 0 && resources.herbs > 0) {
      const entrance = getBuildingEntrance(b);
      planPath(v, grid, width, height, entrance.x, entrance.y);
      v.state = 'traveling_to_heal';
      return true;
    }
  }
  return false;
}

// --- Helper: start going home ---
function startGoingHome(v: Villager, buildings: Building[], grid: Tile[][], width: number, height: number): void {
  if (v.homeBuildingId) {
    const home = buildings.find(b => b.id === v.homeBuildingId);
    if (home) {
      // Check if should visit tavern first
      if (tryVisitTavern(v, buildings, grid, width, height)) return;
      const entrance = getBuildingEntrance(home);
      planPath(v, grid, width, height, entrance.x, entrance.y);
      v.state = 'traveling_home';
      return;
    }
  }
  // No home — just stay put
  v.state = 'idle';
}

// --- Idle task priorities (Bellwright-style) ---
// When a villager has no job, they pick tasks in priority order:
// 1. Haul resources from any building with a full/near-full buffer
// 2. Build unconstructed buildings (construction sites)
// 3. Clear rubble
// 4. Repair damaged buildings
// Returns true if a task was found.
function tryIdleTask(v: Villager, ts: TickState): boolean {
  // Priority 1: Haul from buildings with full buffers (>= CARRY_CAPACITY)
  // Only haul meaningful amounts — don't constantly distract from construction
  let bestHaul: Building | null = null;
  let bestHaulAmt = 0;
  for (const b of ts.buildings) {
    if (!b.constructed || isStorehouse(b.type) || b.type === 'rubble') continue;
    const total = bufferTotal(b.localBuffer);
    if (total >= CARRY_CAPACITY && total > bestHaulAmt) {
      bestHaul = b;
      bestHaulAmt = total;
    }
  }
  if (bestHaul) {
    const entrance = getBuildingEntrance(bestHaul);
    planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
    v.state = 'traveling_to_work'; // Reuse work travel — will pick up & haul on arrival
    v.jobBuildingId = bestHaul.id; // Temporary assignment for hauling
    return true;
  }

  // Priority 2: Build unconstructed buildings
  const site = ts.buildings.find(b => !b.constructed && b.type !== 'rubble' && b.assignedWorkers.length === 0);
  if (site) {
    const entrance = getBuildingEntrance(site);
    planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
    v.state = 'traveling_to_build';
    v.jobBuildingId = site.id;
    return true;
  }

  // Priority 3: Clear rubble
  const rubble = ts.buildings.find(b => b.type === 'rubble' && b.assignedWorkers.length === 0);
  if (rubble) {
    const entrance = getBuildingEntrance(rubble);
    planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
    v.state = 'traveling_to_build';
    v.jobBuildingId = rubble.id;
    return true;
  }

  // Priority 4: Repair damaged buildings
  let mostDamaged: Building | null = null;
  let worstRatio = 1;
  for (const b of ts.buildings) {
    if (!b.constructed || b.type === 'rubble') continue;
    const ratio = b.hp / b.maxHp;
    if (ratio < 1 && ratio < worstRatio) {
      mostDamaged = b;
      worstRatio = ratio;
    }
  }
  if (mostDamaged) {
    const entrance = getBuildingEntrance(mostDamaged);
    planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
    v.state = 'traveling_to_build'; // Reuse build travel — will repair on arrival
    v.jobBuildingId = mostDamaged.id;
    return true;
  }

  return false;
}

export function processVillagerStateMachine(ts: TickState): void {
  for (const v of ts.villagers) {
    // Guards: handle eating/sleeping here, combat behavior in combat.ts
    if (v.role === 'guard') {
      // Guards need to eat — check hunger and process eating states
      if (v.state === 'traveling_to_eat') {
        if (atDestination(v)) { v.state = 'eating'; } else { moveOneStep(v); }
        continue;
      }
      if (v.state === 'eating') {
        const eatSH = findStorehouseAt(ts.buildings, v.x, v.y);
        let fed = false;
        while (v.food < 8) {
          let ateThisRound = false;
          for (const { resource, satisfaction } of FOOD_PRIORITY) {
            const bufAmt = eatSH ? (eatSH.localBuffer[resource] || 0) : 0;
            if (bufAmt > 0) {
              eatSH!.localBuffer[resource] = bufAmt - 1;
              if ((eatSH!.localBuffer[resource] || 0) <= 0) delete eatSH!.localBuffer[resource];
              ts.resources[resource] = Math.max(0, ts.resources[resource] - 1);
              v.food = Math.min(10, v.food + satisfaction);
              v.lastAte = resource as FoodEaten;
              v.recentMeals.push(resource as FoodEaten);
              if (v.recentMeals.length > 5) v.recentMeals.shift();
              fed = true;
              ateThisRound = true;
              break;
            }
          }
          if (!ateThisRound) break;
        }
        if (!fed) {
          v.food = Math.max(0, v.food - 0.5);
          v.lastAte = 'nothing' as FoodEaten;
          v.recentMeals.push('nothing' as FoodEaten);
          if (v.recentMeals.length > 5) v.recentMeals.shift();
        }
        v.state = 'idle'; // Return to patrol (combat system takes over)
        continue;
      }
      // Dawn: guards eat at dawn just like regular villagers (food < 8)
      if (ts.isDawn && v.food < 8) {
        startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
        continue;
      }
      // Mid-day: if hungry, go eat before patrolling
      if (v.food <= 3) {
        startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
        continue;
      }
      // All other guard behavior (patrol, fight) handled in combat section
      continue;
    }

    // Orphaned job cleanup: if assigned building no longer exists, go idle
    if (v.jobBuildingId && !ts.buildings.find(b => b.id === v.jobBuildingId)) {
      v.jobBuildingId = null;
      if (v.role !== 'guard') v.role = 'idle';
      v.state = 'idle';
    }

    // Scout movement: 1 tile per tick in the scout direction
    if (v.role === 'scout' && v.state === 'scouting' && v.scoutDirection) {
      const dir = v.scoutDirection;
      const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0;
      const dy = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
      const nx = Math.max(0, Math.min(ts.width - 1, v.x + dx));
      const ny = Math.max(0, Math.min(ts.height - 1, v.y + dy));
      // Check passability
      if (ts.grid[ny][nx].terrain !== 'water') {
        v.x = nx;
        v.y = ny;
      }
      revealArea(ts.fog, ts.width, ts.height, v.x, v.y, 5);
      v.scoutTicksLeft -= 1;
      if (v.scoutTicksLeft <= 0 || v.x === 0 || v.y === 0 || v.x === ts.width - 1 || v.y === ts.height - 1) {
        v.scoutDirection = null;
        v.scoutTicksLeft = 0;
        v.state = 'idle';
        v.role = 'idle';
      }
      continue;
    }

    // NIGHT: everyone sleeps
    if (ts.isNight) {
      if (v.state !== 'sleeping') {
        // Try to get home
        if (v.homeBuildingId) {
          const home = ts.buildings.find(b => b.id === v.homeBuildingId);
          if (home) {
            const entrance = getBuildingEntrance(home);
            v.x = entrance.x;
            v.y = entrance.y;
          }
        }
        v.state = 'sleeping';
        v.path = [];
        v.pathIndex = 0;
      }
      continue;
    }

    // DAWN: wake up — heal first if sick, eat if hungry, then go to work
    if (ts.isDawn) {
      // Sick villagers seek healing at storehouse with herbs
      if (v.sick && trySeekHealing(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) {
        continue;
      }

      // Villagers eat a meal every morning (unless already full)
      if (v.food < 8) {
        if (startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) {
          continue;
        }
      }

      if (v.jobBuildingId) {
        const job = ts.buildings.find(b => b.id === v.jobBuildingId);
        if (job) {
          const entrance = getBuildingEntrance(job);
          planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
          if (job.constructed) {
            v.state = 'traveling_to_work';
            v.workProgress = 0;
            if (v.tool === 'none') autoEquipTool(v, ts.resources, ts.toolDurBonus, ts.buildings);
          } else {
            v.state = 'traveling_to_build';
          }
        } else {
          v.state = 'idle';
        }
      } else {
        // No job — check idle task priorities (haul, build, clear rubble, repair)
        if (!tryIdleTask(v, ts)) {
          v.state = 'idle';
        }
      }
      continue;
    }

    // DAYTIME STATE MACHINE
    switch (v.state) {
      case 'sleeping': {
        // Shouldn't be sleeping during day — wake up
        if (v.jobBuildingId) {
          const job = ts.buildings.find(b => b.id === v.jobBuildingId);
          if (job) {
            const entrance = getBuildingEntrance(job);
            planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
            v.state = job.constructed ? 'traveling_to_work' : 'traveling_to_build';
          } else {
            v.state = 'idle';
          }
        } else {
          v.state = 'idle';
        }
        break;
      }

      case 'traveling_to_work': {
        if (atDestination(v)) {
          // Arrived at workplace — deposit any carried inputs into building's local buffer
          if (v.carryTotal > 0 && v.jobBuildingId) {
            const job = ts.buildings.find(b => b.id === v.jobBuildingId);
            if (job) {
              for (const [res, amt] of Object.entries(v.carrying)) {
                if (amt && amt > 0) {
                  addToBuffer(job.localBuffer, res as ResourceType, amt, job.bufferCapacity);
                }
              }
              v.carrying = {};
              v.carryTotal = 0;
            }
          }
          v.state = 'working';
          v.workProgress = 0;
        } else {
          moveOneStep(v);
          // Check if we should head home instead
          if (ts.dayTick >= HOME_DEPARTURE_TICK) {
            startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
          }
        }
        break;
      }

      case 'working': {
        if (!v.jobBuildingId) { v.state = 'idle'; break; }
        const job = ts.buildings.find(b => b.id === v.jobBuildingId);
        if (!job) { v.state = 'idle'; break; }

        // Mid-day hunger check: interrupt work to eat if dangerously hungry
        if (v.food <= 3) {
          if (startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) break;
        }

        // Repair: if building is damaged, repair HP/tick before producing
        if (job.hp < job.maxHp) {
          const repairRate = ts.research.completed.includes('architecture' as TechId) ? 2 : 1;
          job.hp = Math.min(job.maxHp, job.hp + repairRate);
          break; // spent this tick repairing
        }

        // Idle helpers: haul buffer contents then release job — don't produce
        if (v.role === 'idle') {
          if (bufferTotal(job.localBuffer) > 0) {
            startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
          } else {
            v.jobBuildingId = null;
            v.state = 'idle';
          }
          break;
        }

        // Hunger interrupt — very hungry workers stop to eat
        if (v.food <= 2) {
          if (startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) break;
        }

        const template = BUILDING_TEMPLATES[job.type];
        if (!template.production) {
          // Non-production building (research desk handled here)
          if (job.type === 'research_desk' && ts.research.current) {
            v.workProgress++;
            const RESEARCH_TICKS_PER_POINT = 30; // 30 ticks per knowledge point
            const tpu = RESEARCH_TICKS_PER_POINT;
            if (v.workProgress >= tpu) {
              ts.research.progress += 1;
              const tech = TECH_TREE[ts.research.current];
              if (ts.research.progress >= tech.cost) {
                ts.research.completed.push(ts.research.current);
                ts.research.current = null;
                ts.research.progress = 0;
              }
              v.workProgress = 0;
            }
            gainSkillXp(v, job.type);
          }
          // Marketplace trader: haul goods from marketplace buffer to storehouse
          if (job.type === 'marketplace' && bufferTotal(job.localBuffer) > 0) {
            startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
          }
          break;
        }

        // Haul when output buffer has a full carry load (not just when completely full)
        // This ensures resources reach the storehouse before villagers starve
        if (bufferOutputTotal(job.localBuffer, job.type) >= CARRY_CAPACITY) {
          startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
          break;
        }

        // Work: accumulate progress
        v.workProgress++;
        const tpu = ticksPerUnit(job.type);

        // Apply production multiplier to reduce ticks needed
        const mult = productionMultiplier(v, job.type, ts.research, ts.season, ts.weather);
        const effectiveTpu = Math.max(1, Math.round(tpu / mult));

        if (v.workProgress >= effectiveTpu) {
          const prod = template.production;
          if (prod.inputs) {
            // Processing building: needs inputs in building's local buffer
            if (hasBufferInputs(job.localBuffer, prod.inputs)) {
              consumeBufferInputs(job.localBuffer, prod.inputs);
              const bonus = techProductionBonus(ts.research, job.type);
              addToBuffer(job.localBuffer, prod.output, 1 + bonus, job.bufferCapacity);
            } else {
              // No inputs in local buffer — go pick them up from storehouse
              startPickupInputs(v, job, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
              break;
            }
          } else {
            // Primary production: no inputs needed
            const bonus = techProductionBonus(ts.research, job.type);
            let amount = 1 + bonus;
            // Season/weather multipliers for outdoor buildings
            if (OUTDOOR_BUILDINGS.includes(job.type)) {
              const isFarm = ['farm', 'large_farm', 'flax_field', 'hemp_field', 'chicken_coop'].includes(job.type);
              if (isFarm) {
                let farmMult = SEASON_FARM_MULT[ts.season];
                // Irrigation tech: autumn gets full output
                if (ts.season === 'autumn' && ts.research.completed.includes('irrigation' as TechId)) farmMult = 1.0;
                if (farmMult === 0) { v.workProgress = 0; break; } // No farming in winter
                amount = Math.max(1, Math.floor(amount * farmMult));
              }
              amount = Math.max(1, Math.floor(amount * WEATHER_OUTDOOR_MULT[ts.weather]));
            }
            addToBuffer(job.localBuffer, prod.output, amount, job.bufferCapacity);
          }
          v.workProgress = 0;

          // Tool wear & skill XP
          degradeTool(v, ts.resources, ts.toolDurBonus, ts.buildings);
          gainSkillXp(v, job.type);
        }

        // Check if should start hauling (buffer has output items and enough to carry)
        const outputCount = template.production?.inputs
          ? bufferOutputTotal(job.localBuffer, job.type)
          : bufferTotal(job.localBuffer);
        if (outputCount >= CARRY_CAPACITY) {
          startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
        }

        // Check if should head home
        if (ts.dayTick >= HOME_DEPARTURE_TICK) {
          // Pick up whatever output is in the buffer before leaving
          if (outputCount > 0) {
            startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
          } else {
            startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
          }
        }
        break;
      }

      case 'traveling_to_storage': {
        if (atDestination(v)) {
          if (v.haulingToWork) {
            // Picking up inputs from storehouse for processing building
            if (v.jobBuildingId) {
              const job = ts.buildings.find(b => b.id === v.jobBuildingId);
              if (job) {
                const template = BUILDING_TEMPLATES[job.type];
                if (template.production?.inputs) {
                  // Pick up needed inputs from storehouse local buffer
                  const pickupSH = findStorehouseAt(ts.buildings, v.x, v.y);
                  for (const [res, amt] of Object.entries(template.production.inputs)) {
                    const needed = amt as number;
                    const shAmt = pickupSH ? (pickupSH.localBuffer[res as ResourceType] || 0) : 0;
                    const available = Math.min(needed * 3, shAmt);
                    const canCarry = Math.min(available, CARRY_CAPACITY - v.carryTotal);
                    if (canCarry > 0) {
                      if (pickupSH) {
                        pickupSH.localBuffer[res as ResourceType] = (pickupSH.localBuffer[res as ResourceType] || 0) - canCarry;
                        if ((pickupSH.localBuffer[res as ResourceType] || 0) <= 0) delete pickupSH.localBuffer[res as ResourceType];
                      }
                      // Keep global in sync
                      ts.resources[res as ResourceType] = Math.max(0, ts.resources[res as ResourceType] - canCarry);
                      v.carrying[res as ResourceType] = (v.carrying[res as ResourceType] || 0) + canCarry;
                      v.carryTotal += canCarry;
                    }
                  }
                }
                // Head back to workplace
                const entrance = getBuildingEntrance(job);
                planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
                v.state = 'traveling_to_work';
                v.haulingToWork = false;
              } else {
                v.state = 'idle';
                v.haulingToWork = false;
              }
            } else {
              v.state = 'idle';
              v.haulingToWork = false;
            }
          } else {
            // Dropping off: deposit carried resources into storehouse local buffer
            const targetSH = findStorehouseAt(ts.buildings, v.x, v.y);
            for (const [res, amt] of Object.entries(v.carrying)) {
              if (amt && amt > 0) {
                let deposited = 0;
                if (targetSH) {
                  deposited = addToBuffer(targetSH.localBuffer, res as ResourceType, amt, targetSH.bufferCapacity);
                }
                // Only add to global what was actually deposited — prevents resource inflation
                if (deposited > 0) {
                  addResource(ts.resources, res as ResourceType, deposited, ts.storageCap);
                }
                // Keep undeposited amount in carrying — will go back to workplace buffer
                const remaining = amt - deposited;
                if (remaining > 0) {
                  v.carrying[res as ResourceType] = remaining;
                } else {
                  delete v.carrying[res as ResourceType];
                }
              }
            }
            v.carryTotal = Object.values(v.carrying).reduce((s, a) => s + (a || 0), 0);

            // Idle helpers: release temp job and go back to idle task search
            if (v.role === 'idle') {
              v.jobBuildingId = null;
              v.state = 'idle';
              break;
            }

            // Should we go back to work or head home?
            if (ts.dayTick >= HOME_DEPARTURE_TICK) {
              startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
            } else if (v.jobBuildingId) {
              const job = ts.buildings.find(b => b.id === v.jobBuildingId);
              if (job) {
                const entrance = getBuildingEntrance(job);
                planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
                v.state = 'traveling_to_work';
              } else {
                v.state = 'idle';
              }
            } else {
              v.state = 'idle';
            }
          }
        } else {
          moveOneStep(v);
        }
        break;
      }

      case 'traveling_home': {
        if (atDestination(v)) {
          v.state = 'sleeping';
        } else {
          moveOneStep(v);
        }
        break;
      }

      case 'traveling_to_tavern': {
        if (atDestination(v)) {
          v.state = 'relaxing';
        } else {
          moveOneStep(v);
        }
        break;
      }

      case 'relaxing': {
        // At tavern — consume 1 food from nearest storehouse, gain morale, set cooldown
        const nearestSH = findNearestStorehouse(ts.buildings, ts.grid, ts.width, ts.height, v.x, v.y);
        let consumed = false;
        if (nearestSH) {
          for (const { resource } of FOOD_PRIORITY) {
            const bufAmt = nearestSH.localBuffer[resource] || 0;
            if (bufAmt > 0 && ts.resources[resource] > 0) {
              nearestSH.localBuffer[resource] = bufAmt - 1;
              if ((nearestSH.localBuffer[resource] || 0) <= 0) delete nearestSH.localBuffer[resource];
              ts.resources[resource] = Math.max(0, ts.resources[resource] - 1);
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          v.morale = Math.min(100, v.morale + 15);
          v.tavernVisitCooldown = 3;
        }
        // Head home after tavern visit
        startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
        break;
      }

      case 'traveling_to_heal': {
        if (atDestination(v)) {
          v.state = 'healing';
        } else {
          moveOneStep(v);
        }
        break;
      }

      case 'healing': {
        // At storehouse — consume 1 herb to cure disease
        const sh = findStorehouseAt(ts.buildings, v.x, v.y);
        if (sh && (sh.localBuffer.herbs || 0) > 0 && ts.resources.herbs > 0) {
          sh.localBuffer.herbs = (sh.localBuffer.herbs || 0) - 1;
          if ((sh.localBuffer.herbs || 0) <= 0) delete sh.localBuffer.herbs;
          ts.resources.herbs = Math.max(0, ts.resources.herbs - 1);
          v.sick = false;
          v.sickDays = 0;
        }
        // Go to work or home after healing attempt
        if (v.jobBuildingId) {
          const job = ts.buildings.find(b => b.id === v.jobBuildingId);
          if (job) {
            const entrance = getBuildingEntrance(job);
            planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
            v.state = job.constructed ? 'traveling_to_work' : 'traveling_to_build';
          } else {
            v.state = 'idle';
          }
        } else {
          v.state = 'idle';
        }
        break;
      }

      case 'traveling_to_build': {
        if (atDestination(v)) {
          v.state = 'constructing';
        } else {
          moveOneStep(v);
          if (ts.dayTick >= HOME_DEPARTURE_TICK) {
            startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
          }
        }
        break;
      }

      case 'constructing': {
        if (!v.jobBuildingId) { v.state = 'idle'; break; }
        const job = ts.buildings.find(b => b.id === v.jobBuildingId);
        if (!job) { v.state = 'idle'; break; }
        if (job.constructed) {
          // Building finished — switch to production
          v.state = 'working';
          v.workProgress = 0;
          break;
        }
        // Build: increment construction progress
        job.constructionProgress++;
        if (job.constructionProgress >= job.constructionRequired) {
          if (job.type === 'rubble') {
            // Rubble cleared — remove it entirely
            const ridx = ts.buildings.findIndex(b => b.id === job.id);
            if (ridx >= 0) ts.buildings.splice(ridx, 1);
            if (job.y < ts.height && job.x < ts.width) {
              ts.grid[job.y][job.x].building = null;
            }
            v.jobBuildingId = null;
            v.role = 'idle';
            v.state = 'idle';
          } else {
            job.constructed = true;
            // Idle helpers: release job after construction, don't start producing
            if (v.role === 'idle') {
              v.jobBuildingId = null;
              v.state = 'idle';
            } else {
              // Switch to production on next tick
              v.state = 'working';
              v.workProgress = 0;
            }
          }
        }
        // Head home when needed
        if (ts.dayTick >= HOME_DEPARTURE_TICK) {
          startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
        }
        break;
      }

      case 'traveling_to_eat': {
        if (atDestination(v)) {
          v.state = 'eating';
        } else {
          moveOneStep(v);
          if (ts.dayTick >= HOME_DEPARTURE_TICK) {
            startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
          }
        }
        break;
      }

      case 'eating': {
        // At a storehouse — eat until satisfied (food >= 6) or storehouse empty
        const eatSH = findStorehouseAt(ts.buildings, v.x, v.y);
        let fed = false;
        while (v.food < 8) {
          let ateThisRound = false;
          for (const { resource, satisfaction } of FOOD_PRIORITY) {
            const bufAmt = eatSH ? (eatSH.localBuffer[resource] || 0) : 0;
            if (bufAmt > 0) {
              eatSH!.localBuffer[resource] = bufAmt - 1;
              if ((eatSH!.localBuffer[resource] || 0) <= 0) delete eatSH!.localBuffer[resource];
              ts.resources[resource] = Math.max(0, ts.resources[resource] - 1);
              v.food = Math.min(10, v.food + satisfaction);
              v.lastAte = resource as FoodEaten;
              v.recentMeals.push(resource as FoodEaten);
              if (v.recentMeals.length > 5) v.recentMeals.shift();
              fed = true;
              ateThisRound = true;
              break;
            }
          }
          if (!ateThisRound) break; // No food left in storehouse
        }
        if (!fed) {
          v.food = Math.max(0, v.food - 0.5);
          v.lastAte = 'nothing' as FoodEaten;
          v.recentMeals.push('nothing' as FoodEaten);
          if (v.recentMeals.length > 5) v.recentMeals.shift();
        }

        // Done eating — resume work or go home
        if (ts.dayTick >= HOME_DEPARTURE_TICK) {
          startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
        } else if (v.jobBuildingId) {
          const job = ts.buildings.find(b => b.id === v.jobBuildingId);
          if (job) {
            const entrance = getBuildingEntrance(job);
            planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
            v.state = job.constructed ? 'traveling_to_work' : 'traveling_to_build';
          } else {
            v.state = 'idle';
          }
        } else {
          v.state = 'idle';
        }
        break;
      }

      case 'idle': {
        // Idle villagers: check hunger first, then try idle task priorities
        if (v.food <= 3) {
          startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
        } else if (ts.dayTick >= HOME_DEPARTURE_TICK && v.homeBuildingId) {
          startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
        } else {
          // Try to find useful work (haul, build, clear, repair)
          tryIdleTask(v, ts);
        }
        break;
      }
    }
  }

  // Force late-stayers home near end of day
  if (ts.dayTick >= TICKS_PER_DAY - 5 && !ts.isNight) {
    for (const v of ts.villagers) {
      if (v.state !== 'sleeping' && v.state !== 'traveling_home' && v.state !== 'scouting') {
        // Drop any carrying into nearest storehouse buffer (if reachable)
        const dropSH = findNearestStorehouse(ts.buildings, ts.grid, ts.width, ts.height, v.x, v.y);
        for (const [res, amt] of Object.entries(v.carrying)) {
          if (amt && amt > 0) {
            let deposited = 0;
            if (dropSH) deposited = addToBuffer(dropSH.localBuffer, res as ResourceType, amt, dropSH.bufferCapacity);
            if (deposited > 0) addResource(ts.resources, res as ResourceType, deposited, ts.storageCap);
          }
        }
        v.carrying = {};
        v.carryTotal = 0;
        startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
      }
    }
  }
}
