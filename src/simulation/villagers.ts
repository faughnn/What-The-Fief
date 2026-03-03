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
  findStorehouseAt, findNearestStorehouse, revealArea,
} from './helpers.js';
import { moveOneStep, atDestination, planPath } from './movement.js';

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

  // Find nearest storehouse
  const storehouse = findNearestStorehouse(buildings, grid, width, height, v.x, v.y);
  if (storehouse) {
    const entrance = getBuildingEntrance(storehouse);
    planPath(v, grid, width, height, entrance.x, entrance.y);
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
    if (b.type !== 'storehouse' || !b.constructed) continue;
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
    const entrance = getBuildingEntrance(bestSH);
    planPath(v, grid, width, height, entrance.x, entrance.y);
    v.state = 'traveling_to_storage';
    v.haulingToWork = true;
  } else {
    // No storehouse with inputs — stay idle
    v.state = 'idle';
  }
}

// --- Helper: start traveling to eat (nearest storehouse with food in its buffer) ---
function startEating(v: Villager, buildings: Building[], resources: Resources, grid: Tile[][], width: number, height: number): boolean {
  // Find nearest storehouse that has food in its local buffer
  let bestSH: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    if (b.type !== 'storehouse' || !b.constructed) continue;
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
    const entrance = getBuildingEntrance(bestSH);
    planPath(v, grid, width, height, entrance.x, entrance.y);
    v.state = 'traveling_to_eat';
    return true;
  }
  return false;
}

// --- Helper: start going home ---
function startGoingHome(v: Villager, buildings: Building[], grid: Tile[][], width: number, height: number): void {
  if (v.homeBuildingId) {
    const home = buildings.find(b => b.id === v.homeBuildingId);
    if (home) {
      const entrance = getBuildingEntrance(home);
      planPath(v, grid, width, height, entrance.x, entrance.y);
      v.state = 'traveling_home';
      return;
    }
  }
  // No home — just stay put
  v.state = 'idle';
}

export function processVillagerStateMachine(ts: TickState): void {
  for (const v of ts.villagers) {
    // Guards handled in combat section
    if (v.role === 'guard') continue;

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

    // DAWN: wake up — eat first if hungry, then go to work
    if (ts.isDawn) {
      // Hungry villagers eat before work (food <= 5)
      if (v.food <= 5) {
        if (startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) {
          continue;
        }
        // No food available — go to work anyway (will starve)
      }

      if (v.jobBuildingId) {
        const job = ts.buildings.find(b => b.id === v.jobBuildingId);
        if (job) {
          const entrance = getBuildingEntrance(job);
          planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
          if (job.constructed) {
            v.state = 'traveling_to_work';
            v.workProgress = 0;
            if (v.tool === 'none') autoEquipTool(v, ts.resources, ts.toolDurBonus);
          } else {
            v.state = 'traveling_to_build';
          }
        } else {
          v.state = 'idle';
        }
      } else {
        // No job — check if any unconstructed buildings need a builder
        const site = ts.buildings.find(b => !b.constructed && b.assignedWorkers.length === 0);
        if (site) {
          const entrance = getBuildingEntrance(site);
          planPath(v, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
          v.state = 'traveling_to_build';
          v.jobBuildingId = site.id;
        } else {
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

        // Repair: if building is damaged, repair 1 HP/tick before producing
        if (job.hp < job.maxHp) {
          job.hp = Math.min(job.maxHp, job.hp + 1);
          break; // spent this tick repairing
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
            const tpu = ticksPerUnit(job.type) || 80;
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
          break;
        }

        // Check if buffer is full
        if (bufferTotal(job.localBuffer) >= job.bufferCapacity) {
          // Buffer full — start hauling
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
              const isFarm = ['farm', 'flax_field', 'hemp_field', 'chicken_coop'].includes(job.type);
              if (isFarm) amount = Math.max(1, Math.floor(amount * SEASON_FARM_MULT[ts.season]));
              amount = Math.max(1, Math.floor(amount * WEATHER_OUTDOOR_MULT[ts.weather]));
            }
            addToBuffer(job.localBuffer, prod.output, amount, job.bufferCapacity);
          }
          v.workProgress = 0;

          // Tool wear & skill XP
          degradeTool(v, ts.resources, ts.toolDurBonus);
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
                if (targetSH) {
                  addToBuffer(targetSH.localBuffer, res as ResourceType, amt, targetSH.bufferCapacity);
                }
                // Also keep global resources in sync
                addResource(ts.resources, res as ResourceType, amt, ts.storageCap);
              }
            }
            v.carrying = {};
            v.carryTotal = 0;

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
            // Switch to production on next tick
            v.state = 'working';
            v.workProgress = 0;
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
        // At a storehouse — consume food from storehouse local buffer
        const eatSH = findStorehouseAt(ts.buildings, v.x, v.y);
        let fed = false;
        for (const { resource, satisfaction } of FOOD_PRIORITY) {
          const bufAmt = eatSH ? (eatSH.localBuffer[resource] || 0) : 0;
          if (bufAmt > 0) {
            eatSH!.localBuffer[resource] = bufAmt - 1;
            if ((eatSH!.localBuffer[resource] || 0) <= 0) delete eatSH!.localBuffer[resource];
            // Keep global in sync
            ts.resources[resource] = Math.max(0, ts.resources[resource] - 1);
            v.food = Math.min(10, v.food + satisfaction);
            v.lastAte = resource as FoodEaten;
            fed = true;
            break;
          }
        }
        if (!fed) {
          v.food = Math.max(0, v.food - 0.5);
          v.lastAte = 'nothing' as FoodEaten;
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
        // Idle villagers check if hungry, otherwise do nothing
        if (v.food <= 3) {
          startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
        }
        if (ts.dayTick >= HOME_DEPARTURE_TICK && v.homeBuildingId) {
          startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
        }
        break;
      }
    }
  }

  // Force late-stayers home near end of day
  if (ts.dayTick >= TICKS_PER_DAY - 5 && !ts.isNight) {
    for (const v of ts.villagers) {
      if (v.state !== 'sleeping' && v.state !== 'traveling_home' && v.state !== 'scouting') {
        // Drop any carrying into global storage (convenience)
        for (const [res, amt] of Object.entries(v.carrying)) {
          if (amt && amt > 0) addResource(ts.resources, res as ResourceType, amt, ts.storageCap);
        }
        v.carrying = {};
        v.carryTotal = 0;
        startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height);
      }
    }
  }
}
