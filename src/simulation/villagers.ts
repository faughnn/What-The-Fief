// villagers.ts — Villager state machine (per-tick processing)

import {
  Villager, Building, Resources, ResourceType, Tile,
  BuildingType, BUILDING_TEMPLATES, FOOD_PRIORITY, FoodEaten,
  Season, WeatherType, ResearchState,
  CARRY_CAPACITY, HOME_DEPARTURE_TICK, OUTDOOR_BUILDINGS,
  SEASON_FARM_MULT, WEATHER_OUTDOOR_MULT,
  TICKS_PER_DAY, NIGHT_TICKS, TechId, TECH_TREE,
  FOOD_CAP, FOOD_EAT_THRESHOLD, FOOD_HUNGRY, FOOD_CRITICAL,
  FOOD_STARVATION_LOSS, RECENT_MEALS_LIMIT,
  TAVERN_MORALE_THRESHOLD, TAVERN_MORALE_BOOST, TAVERN_COOLDOWN_DAYS,
  RESEARCH_TICKS_PER_POINT, INPUT_PICKUP_MULTIPLIER,
} from '../world.js';
import {
  TickState, getBuildingEntrance, addResource, addToBuffer, bufferTotal,
  hasBufferInputs, consumeBufferInputs, ticksPerUnit, productionMultiplier,
  autoEquipTool, degradeTool, gainSkillXp, hasTech, techProductionBonus,
  findStorehouseAt, findNearestStorehouse, findNearestBuilding, findStorehouseWithResource, revealArea, isStorehouse,
  deductFromBuffer, deductFromStorehouseAndGlobal,
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
    deductFromBuffer(job.localBuffer, res as ResourceType, toCarry);
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
  const bestSH = findNearestBuilding(buildings, v.x, v.y, b => {
    if (!isStorehouse(b.type) || !b.constructed) return false;
    return inputTypes.some(res => (b.localBuffer[res as ResourceType] || 0) > 0);
  });
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
  const bestSH = findNearestBuilding(buildings, v.x, v.y, b => {
    if (!isStorehouse(b.type) || !b.constructed) return false;
    return FOOD_PRIORITY.some(({ resource }) => (b.localBuffer[resource] || 0) > 0);
  });
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
  if (v.morale >= TAVERN_MORALE_THRESHOLD || v.tavernVisitCooldown > 0) return false;
  const tavern = buildings.find(b => (b.type === 'tavern' || b.type === 'inn') && b.constructed);
  if (!tavern) return false;
  const entrance = getBuildingEntrance(tavern);
  planPath(v, grid, width, height, entrance.x, entrance.y);
  v.state = 'traveling_to_tavern';
  return true;
}

function trySeekHealing(v: Villager, buildings: Building[], resources: Resources, grid: Tile[][], width: number, height: number): boolean {
  if (!v.sick) return false;
  const sh = findStorehouseWithResource(buildings, 'herbs');
  if (sh && resources.herbs > 0) {
    const entrance = getBuildingEntrance(sh);
    planPath(v, grid, width, height, entrance.x, entrance.y);
    v.state = 'traveling_to_heal';
    return true;
  }
  return false;
}

// --- Helper: start going home ---
function startGoingHome(v: Villager, buildings: Building[], grid: Tile[][], width: number, height: number, buildingMap?: Map<string, Building>): void {
  if (v.homeBuildingId) {
    const home = buildingMap ? buildingMap.get(v.homeBuildingId) : buildings.find(b => b.id === v.homeBuildingId);
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

// --- Helper: eat from a storehouse until satisfied or storehouse empty ---
// Shared by guards and regular villagers to eliminate duplication.
function eatAtStorehouse(v: Villager, eatSH: Building | null, ts: TickState): void {
  let fed = false;
  while (v.food < FOOD_EAT_THRESHOLD) {
    let ateThisRound = false;
    for (const { resource, satisfaction } of FOOD_PRIORITY) {
      const bufAmt = eatSH ? (eatSH.localBuffer[resource] || 0) : 0;
      if (bufAmt > 0) {
        deductFromStorehouseAndGlobal(eatSH!.localBuffer, ts.resources, resource, 1);
        v.food = Math.min(FOOD_CAP, v.food + satisfaction);
        v.lastAte = resource as FoodEaten;
        v.recentMeals.push(resource as FoodEaten);
        if (v.recentMeals.length > RECENT_MEALS_LIMIT) v.recentMeals.shift();
        fed = true;
        ateThisRound = true;
        break;
      }
    }
    if (!ateThisRound) break;
  }
  if (!fed) {
    v.food = Math.max(0, v.food - FOOD_STARVATION_LOSS);
    v.lastAte = 'nothing' as FoodEaten;
    v.recentMeals.push('nothing' as FoodEaten);
    if (v.recentMeals.length > RECENT_MEALS_LIMIT) v.recentMeals.shift();
  }
}

// --- Helper: resume work or go home after an interruption (eating, healing) ---
function resumeWorkOrGoHome(v: Villager, ts: TickState): void {
  if (ts.dayTick >= HOME_DEPARTURE_TICK) {
    startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap);
  } else if (v.jobBuildingId) {
    const job = ts.buildingMap.get(v.jobBuildingId);
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
}

// =====================================================================
// State handlers — one function per state or logical group
// =====================================================================

// Returns true if the guard was handled (caller should continue to next villager)
function handleGuard(v: Villager, ts: TickState): boolean {
  if (v.state === 'traveling_to_eat') {
    if (atDestination(v)) { v.state = 'eating'; } else { moveOneStep(v, ts.grid); }
    return true;
  }
  if (v.state === 'eating') {
    const eatSH = findStorehouseAt(ts.buildings, v.x, v.y);
    eatAtStorehouse(v, eatSH, ts);
    v.state = 'idle'; // Return to patrol (combat system takes over)
    return true;
  }
  // Dawn: guards eat at dawn just like regular villagers
  if (ts.isDawn && v.food < FOOD_EAT_THRESHOLD) {
    startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
    return true;
  }
  // Mid-day: if hungry, go eat before patrolling
  if (v.food <= FOOD_HUNGRY) {
    startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
    return true;
  }
  // All other guard behavior (patrol, fight) handled in combat section
  return true;
}

function handleSleeping(v: Villager, ts: TickState): void {
  // Shouldn't be sleeping during day — wake up
  if (v.jobBuildingId) {
    const job = ts.buildingMap.get(v.jobBuildingId);
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
}

function handleTravelingToWork(v: Villager, ts: TickState): void {
  if (atDestination(v)) {
    // Arrived at workplace — deposit any carried inputs into building's local buffer
    if (v.carryTotal > 0 && v.jobBuildingId) {
      const job = ts.buildingMap.get(v.jobBuildingId);
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
    moveOneStep(v, ts.grid);
    if (ts.dayTick >= HOME_DEPARTURE_TICK) {
      startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap);
    }
  }
}

function handleWorking(v: Villager, ts: TickState): void {
  if (!v.jobBuildingId) { v.state = 'idle'; return; }
  const job = ts.buildingMap.get(v.jobBuildingId);
  if (!job) { v.state = 'idle'; return; }

  // Mid-day hunger check: interrupt work to eat if dangerously hungry
  if (v.food <= FOOD_HUNGRY) {
    if (startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) return;
  }

  // Repair: if building is damaged, repair HP/tick before producing
  if (job.hp < job.maxHp) {
    const repairRate = ts.research.completed.includes('architecture' as TechId) ? 2 : 1;
    job.hp = Math.min(job.maxHp, job.hp + repairRate);
    return; // spent this tick repairing
  }

  // Idle helpers: haul buffer contents then release job — don't produce
  if (v.role === 'idle') {
    if (bufferTotal(job.localBuffer) > 0) {
      startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
    } else {
      v.jobBuildingId = null;
      v.state = 'idle';
    }
    return;
  }

  // Hunger interrupt — very hungry workers stop to eat
  if (v.food <= FOOD_CRITICAL) {
    if (startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) return;
  }

  const template = BUILDING_TEMPLATES[job.type];
  if (!template.production) {
    handleNonProductionWork(v, job, ts);
    return;
  }

  // Haul when output buffer has a full carry load (not just when completely full)
  if (bufferOutputTotal(job.localBuffer, job.type) >= CARRY_CAPACITY) {
    startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
    return;
  }

  // Work: accumulate progress
  v.workProgress++;
  const tpu = ticksPerUnit(job.type);
  const mult = productionMultiplier(v, job.type, ts.research, ts.season, ts.weather);
  const effectiveTpu = Math.max(1, Math.round(tpu / mult));

  if (v.workProgress >= effectiveTpu) {
    produceAtWorkplace(v, job, template, ts);
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
    if (outputCount > 0) {
      startHauling(v, job, ts.buildings, ts.grid, ts.width, ts.height);
    } else {
      startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap);
    }
  }
}

function handleNonProductionWork(v: Villager, job: Building, ts: TickState): void {
  // Research desk
  if (job.type === 'research_desk' && ts.research.current) {
    v.workProgress++;
    if (v.workProgress >= RESEARCH_TICKS_PER_POINT) {
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
}

function produceAtWorkplace(v: Villager, job: Building, template: typeof BUILDING_TEMPLATES[BuildingType], ts: TickState): void {
  const prod = template.production!;
  if (prod.inputs) {
    // Processing building: needs inputs in building's local buffer
    if (hasBufferInputs(job.localBuffer, prod.inputs)) {
      consumeBufferInputs(job.localBuffer, prod.inputs);
      const bonus = techProductionBonus(ts.research, job.type);
      addToBuffer(job.localBuffer, prod.output, 1 + bonus, job.bufferCapacity);
    } else {
      // No inputs in local buffer — go pick them up from storehouse
      startPickupInputs(v, job, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
      return;
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
        if (ts.season === 'autumn' && ts.research.completed.includes('irrigation' as TechId)) farmMult = 1.0;
        if (farmMult === 0) { v.workProgress = 0; return; } // No farming in winter
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

function handleTravelingToStorage(v: Villager, ts: TickState): void {
  if (atDestination(v)) {
    if (v.haulingToWork) {
      handlePickupFromStorehouse(v, ts);
    } else {
      handleDropoffAtStorehouse(v, ts);
    }
  } else {
    moveOneStep(v, ts.grid);
  }
}

function handlePickupFromStorehouse(v: Villager, ts: TickState): void {
  if (!v.jobBuildingId) { v.state = 'idle'; v.haulingToWork = false; return; }
  const job = ts.buildingMap.get(v.jobBuildingId);
  if (!job) { v.state = 'idle'; v.haulingToWork = false; return; }

  const template = BUILDING_TEMPLATES[job.type];
  if (template.production?.inputs) {
    const pickupSH = findStorehouseAt(ts.buildings, v.x, v.y);
    for (const [res, amt] of Object.entries(template.production.inputs)) {
      const needed = amt as number;
      const shAmt = pickupSH ? (pickupSH.localBuffer[res as ResourceType] || 0) : 0;
      const available = Math.min(needed * INPUT_PICKUP_MULTIPLIER, shAmt);
      const canCarry = Math.min(available, CARRY_CAPACITY - v.carryTotal);
      if (canCarry > 0) {
        if (pickupSH) {
          deductFromStorehouseAndGlobal(pickupSH.localBuffer, ts.resources, res as ResourceType, canCarry);
        }
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
}

function handleDropoffAtStorehouse(v: Villager, ts: TickState): void {
  const targetSH = findStorehouseAt(ts.buildings, v.x, v.y);
  for (const [res, amt] of Object.entries(v.carrying)) {
    if (amt && amt > 0) {
      let deposited = 0;
      if (targetSH) {
        deposited = addToBuffer(targetSH.localBuffer, res as ResourceType, amt, targetSH.bufferCapacity);
      }
      if (deposited > 0) {
        addResource(ts.resources, res as ResourceType, deposited, ts.storageCap);
      }
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
    return;
  }

  resumeWorkOrGoHome(v, ts);
}

function handleRelaxing(v: Villager, ts: TickState): void {
  // At tavern — consume 1 food from nearest storehouse, gain morale, set cooldown
  const nearestSH = findNearestStorehouse(ts.buildings, ts.grid, ts.width, ts.height, v.x, v.y);
  let consumed = false;
  if (nearestSH) {
    for (const { resource } of FOOD_PRIORITY) {
      const bufAmt = nearestSH.localBuffer[resource] || 0;
      if (bufAmt > 0 && ts.resources[resource] > 0) {
        deductFromStorehouseAndGlobal(nearestSH.localBuffer, ts.resources, resource, 1);
        consumed = true;
        break;
      }
    }
  }
  if (consumed) {
    v.morale = Math.min(100, v.morale + TAVERN_MORALE_BOOST);
    v.tavernVisitCooldown = TAVERN_COOLDOWN_DAYS;
  }
  startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap);
}

function handleHealing(v: Villager, ts: TickState): void {
  // At storehouse — consume 1 herb to cure disease
  const sh = findStorehouseAt(ts.buildings, v.x, v.y);
  if (sh && (sh.localBuffer.herbs || 0) > 0 && ts.resources.herbs > 0) {
    deductFromStorehouseAndGlobal(sh.localBuffer, ts.resources, 'herbs', 1);
    v.sick = false;
    v.sickDays = 0;
  }
  resumeWorkOrGoHome(v, ts);
}

function handleConstructing(v: Villager, ts: TickState): void {
  if (!v.jobBuildingId) { v.state = 'idle'; return; }
  const job = ts.buildingMap.get(v.jobBuildingId);
  if (!job) { v.state = 'idle'; return; }
  if (job.constructed) {
    v.state = 'working';
    v.workProgress = 0;
    return;
  }
  // Build: increment construction progress
  job.constructionProgress++;
  if (job.constructionProgress >= job.constructionRequired) {
    if (job.type === 'rubble') {
      // Rubble cleared — remove it entirely
      const ridx = ts.buildings.findIndex(b => b.id === job.id);
      if (ridx >= 0) { ts.buildings.splice(ridx, 1); ts.buildingMap.delete(job.id); }
      if (job.y < ts.height && job.x < ts.width) {
        ts.grid[job.y][job.x].building = null;
      }
      v.jobBuildingId = null;
      v.role = 'idle';
      v.state = 'idle';
    } else {
      job.constructed = true;
      if (v.role === 'idle') {
        v.jobBuildingId = null;
        v.state = 'idle';
      } else {
        v.state = 'working';
        v.workProgress = 0;
      }
    }
  }
  if (ts.dayTick >= HOME_DEPARTURE_TICK) {
    startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap);
  }
}

function handleEating(v: Villager, ts: TickState): void {
  const eatSH = findStorehouseAt(ts.buildings, v.x, v.y);
  eatAtStorehouse(v, eatSH, ts);
  resumeWorkOrGoHome(v, ts);
}

// --- Supply route state handlers ---

function handleSupplyTravelingToSource(v: Villager, ts: TickState): void {
  if (!moveOneStep(v, ts.grid)) {
    const route = v.supplyRouteId ? ts.supplyRoutes.find(r => r.id === v.supplyRouteId) : null;
    const source = route ? ts.buildingMap.get(route.fromBuildingId) : null;
    if (!route || !source) { v.state = 'idle'; v.role = 'idle'; v.supplyRouteId = null; return; }
    planPathToBuilding(v, source, ts.grid, ts.width, ts.height);
    if (v.path.length === 0) v.state = 'supply_loading'; // Already at source
  } else if (atDestination(v)) {
    v.state = 'supply_loading';
  }
}

function handleSupplyLoading(v: Villager, ts: TickState): void {
  const route = v.supplyRouteId ? ts.supplyRoutes.find(r => r.id === v.supplyRouteId) : null;
  const source = route ? ts.buildingMap.get(route.fromBuildingId) : null;
  if (!route || !source) { v.state = 'idle'; v.role = 'idle'; v.supplyRouteId = null; return; }

  // Check we're at the source building
  const atSource = v.x >= source.x && v.x < source.x + source.width &&
                    v.y >= source.y && v.y < source.y + source.height;
  if (!atSource) { v.state = 'supply_traveling_to_source'; return; }

  // Load resources from source buffer
  let carried = 0;
  v.carrying = {};
  if (route.resourceType === 'any') {
    for (const [res, amt] of Object.entries(source.localBuffer)) {
      if (!amt || amt <= 0) continue;
      const toCarry = Math.min(amt, CARRY_CAPACITY - carried);
      if (toCarry <= 0) break;
      deductFromStorehouseAndGlobal(source.localBuffer, ts.resources, res as ResourceType, toCarry);
      v.carrying[res as ResourceType] = toCarry;
      carried += toCarry;
    }
  } else {
    const res = route.resourceType as ResourceType;
    const available = source.localBuffer[res] || 0;
    if (available > 0) {
      const toCarry = Math.min(available, CARRY_CAPACITY);
      deductFromStorehouseAndGlobal(source.localBuffer, ts.resources, res, toCarry);
      v.carrying[res] = toCarry;
      carried = toCarry;
    }
  }
  v.carryTotal = carried;

  if (carried > 0) {
    const dest = ts.buildingMap.get(route.toBuildingId);
    if (dest) {
      planPathToBuilding(v, dest, ts.grid, ts.width, ts.height);
      v.state = 'supply_traveling_to_dest';
    } else {
      // Destination destroyed — drop carrying back into source
      for (const [res, amt] of Object.entries(v.carrying)) {
        if (amt && amt > 0) {
          addToBuffer(source.localBuffer, res as ResourceType, amt, source.bufferCapacity);
          addResource(ts.resources, res as ResourceType, amt, ts.storageCap);
        }
      }
      v.carrying = {}; v.carryTotal = 0;
      v.state = 'idle'; v.role = 'idle'; v.supplyRouteId = null;
    }
  }
  // If carried === 0, stay at source and retry next tick
}

function handleSupplyTravelingToDest(v: Villager, ts: TickState): void {
  if (!moveOneStep(v, ts.grid)) {
    const route = v.supplyRouteId ? ts.supplyRoutes.find(r => r.id === v.supplyRouteId) : null;
    const dest = route ? ts.buildingMap.get(route.toBuildingId) : null;
    if (!route || !dest) { v.state = 'idle'; v.role = 'idle'; v.supplyRouteId = null; return; }
    planPathToBuilding(v, dest, ts.grid, ts.width, ts.height);
    if (v.path.length === 0) v.state = 'supply_unloading';
  } else if (atDestination(v)) {
    v.state = 'supply_unloading';
  }
}

function handleSupplyUnloading(v: Villager, ts: TickState): void {
  const route = v.supplyRouteId ? ts.supplyRoutes.find(r => r.id === v.supplyRouteId) : null;
  const dest = route ? ts.buildingMap.get(route.toBuildingId) : null;
  if (!route || !dest) { v.state = 'idle'; v.role = 'idle'; v.supplyRouteId = null; return; }

  for (const [res, amt] of Object.entries(v.carrying)) {
    if (!amt || amt <= 0) continue;
    const deposited = addToBuffer(dest.localBuffer, res as ResourceType, amt, dest.bufferCapacity);
    if (deposited > 0) addResource(ts.resources, res as ResourceType, deposited, ts.storageCap);
  }
  v.carrying = {};
  v.carryTotal = 0;

  // Head back to source for next load
  const source = ts.buildingMap.get(route.fromBuildingId);
  if (source) {
    planPathToBuilding(v, source, ts.grid, ts.width, ts.height);
    v.state = 'supply_traveling_to_source';
  } else {
    v.state = 'idle'; v.role = 'idle'; v.supplyRouteId = null;
  }
}

function handleIdle(v: Villager, ts: TickState): void {
  if (v.food <= FOOD_HUNGRY) {
    startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height);
  } else if (ts.dayTick >= HOME_DEPARTURE_TICK && v.homeBuildingId) {
    startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap);
  } else {
    tryIdleTask(v, ts);
  }
}

// =====================================================================
// Main entry point — dispatches to state handlers
// =====================================================================

export function processVillagerStateMachine(ts: TickState): void {
  for (const v of ts.villagers) {
    // Guards: handle eating/sleeping here, combat behavior in combat.ts
    if (v.role === 'guard') {
      handleGuard(v, ts);
      continue;
    }

    // Orphaned job cleanup: if assigned building no longer exists, go idle
    if (v.jobBuildingId && !ts.buildingMap.has(v.jobBuildingId)) {
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
        if (v.homeBuildingId) {
          const home = ts.buildingMap.get(v.homeBuildingId);
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
      if (v.sick && trySeekHealing(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) {
        continue;
      }
      if (v.food < FOOD_EAT_THRESHOLD) {
        if (startEating(v, ts.buildings, ts.resources, ts.grid, ts.width, ts.height)) {
          continue;
        }
      }
      if (v.role === 'hauler' && v.supplyRouteId) {
        const route = ts.supplyRoutes.find(r => r.id === v.supplyRouteId);
        const source = route ? ts.buildingMap.get(route.fromBuildingId) : null;
        if (route && source) {
          planPathToBuilding(v, source, ts.grid, ts.width, ts.height);
          v.state = 'supply_traveling_to_source';
        } else {
          v.state = 'idle'; v.role = 'idle'; v.supplyRouteId = null;
        }
      } else if (v.jobBuildingId) {
        const job = ts.buildingMap.get(v.jobBuildingId);
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
        if (!tryIdleTask(v, ts)) {
          v.state = 'idle';
        }
      }
      continue;
    }

    // DAYTIME STATE MACHINE — dispatch to handlers
    switch (v.state) {
      case 'sleeping':                   handleSleeping(v, ts); break;
      case 'traveling_to_work':          handleTravelingToWork(v, ts); break;
      case 'working':                    handleWorking(v, ts); break;
      case 'traveling_to_storage':       handleTravelingToStorage(v, ts); break;
      case 'traveling_home':             if (atDestination(v)) { v.state = 'sleeping'; } else { moveOneStep(v, ts.grid); } break;
      case 'traveling_to_tavern':        if (atDestination(v)) { v.state = 'relaxing'; } else { moveOneStep(v, ts.grid); } break;
      case 'relaxing':                   handleRelaxing(v, ts); break;
      case 'traveling_to_heal':          if (atDestination(v)) { v.state = 'healing'; } else { moveOneStep(v, ts.grid); } break;
      case 'healing':                    handleHealing(v, ts); break;
      case 'traveling_to_build':         if (atDestination(v)) { v.state = 'constructing'; } else { moveOneStep(v, ts.grid); if (ts.dayTick >= HOME_DEPARTURE_TICK) startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap); } break;
      case 'constructing':              handleConstructing(v, ts); break;
      case 'traveling_to_eat':           if (atDestination(v)) { v.state = 'eating'; } else { moveOneStep(v, ts.grid); if (ts.dayTick >= HOME_DEPARTURE_TICK) startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap); } break;
      case 'eating':                     handleEating(v, ts); break;
      case 'supply_traveling_to_source': handleSupplyTravelingToSource(v, ts); break;
      case 'supply_loading':             handleSupplyLoading(v, ts); break;
      case 'supply_traveling_to_dest':   handleSupplyTravelingToDest(v, ts); break;
      case 'supply_unloading':           handleSupplyUnloading(v, ts); break;
      case 'idle':                       handleIdle(v, ts); break;
    }
  }

  // Force late-stayers home near end of day
  if (ts.dayTick >= TICKS_PER_DAY - 5 && !ts.isNight) {
    for (const v of ts.villagers) {
      if (v.state !== 'sleeping' && v.state !== 'traveling_home' && v.state !== 'scouting') {
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
        startGoingHome(v, ts.buildings, ts.grid, ts.width, ts.height, ts.buildingMap);
      }
    }
  }
}
