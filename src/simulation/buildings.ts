// buildings.ts — Building placement and territory claiming

import {
  GameState, BuildingType, Building, Resources, ResourceType, Tile,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, CONSTRUCTION_TICKS,
  DEFAULT_BUFFER_CAP, STOREHOUSE_BUFFER_CAP, OUTPOST_BUFFER_CAP,
  FREE_CONSTRUCTION,
  FIRE_DAMAGE_PER_TICK, FIRE_SPREAD_CHANCE, WELL_FIRE_PROTECTION_RANGE,
} from '../world.js';
import { TickState, computeStorageCap, hasTech, findNearestStorehouse, bufferTotal, isAdjacent, getBuildingEntrance, isStorehouse, deductFromBuffer, destroyBuildingAndCreateRubble, rebuildBuildingMap } from './helpers.js';
import { findPath } from './movement.js';

export function placeBuilding(state: GameState, type: BuildingType, x: number, y: number): GameState {
  const template = BUILDING_TEMPLATES[type];
  if (!template) { console.log(`ERROR: Unknown building type '${type}'`); return state; }
  const { width: bw, height: bh } = template;

  if (x < 0 || y < 0 || x + bw > state.width || y + bh > state.height) {
    console.log(`ERROR: Building ${type} at (${x},${y}) out of bounds`); return state;
  }

  for (let dy = 0; dy < bh; dy++) {
    for (let dx = 0; dx < bw; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      const tile = state.grid[ty][tx];
      if (!state.fog[ty][tx]) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) not revealed`); return state;
      }
      if (!state.territory[ty][tx]) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) not in territory`); return state;
      }
      if (!template.allowedTerrain.includes(tile.terrain)) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) is ${tile.terrain}`); return state;
      }
      if (tile.building) {
        console.log(`ERROR: Cannot place ${type} at (${x},${y}) — (${tx},${ty}) occupied`); return state;
      }
    }
  }

  // Defensive structures (wall, fence, gate) skip the accessibility check —
  // their purpose is to restrict movement, and allies path through gates
  if (type === 'wall' || type === 'fence' || type === 'gate' || type === 'road') {
    // Skip accessibility check for defensive structures
  } else {

  // Check that placing this building wouldn't block access to existing building entrances
  // Simulate the grid with the new building placed, then verify paths to key buildings
  const testGrid: Tile[][] = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      if (gx >= x && gx < x + bw && gy >= y && gy < y + bh) {
        return { ...tile, building: { type, x, y, width: bw, height: bh } as any };
      }
      return tile;
    })
  );
  // Check that placing this building wouldn't block ALL access to existing building entrances
  for (const existing of state.buildings) {
    if (!existing.constructed) continue;
    if (existing.type === 'wall' || existing.type === 'fence' || existing.type === 'gate') continue;
    const entrance = getBuildingEntrance(existing);
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    let hasAccess = false;
    for (const { dx, dy } of dirs) {
      const ax = entrance.x + dx;
      const ay = entrance.y + dy;
      if (ax < 0 || ay < 0 || ax >= state.width || ay >= state.height) continue;
      const adjTile = testGrid[ay][ax];
      if (adjTile.terrain !== 'water' && (!adjTile.building || adjTile.building.type === 'gate' || adjTile.building.type === 'rubble' || adjTile.building.type === 'road')) {
        hasAccess = true;
        break;
      }
    }
    if (!hasAccess) {
      console.log(`ERROR: Cannot place ${type} at (${x},${y}) — would block access to ${existing.type} at (${existing.x},${existing.y})`);
      return state;
    }
  }

  } // end of non-defensive accessibility check

  const costReduction = hasTech(state.research, 'civil_engineering') ? 0.25 : 0;
  const newResources: Resources = { ...state.resources };
  // Deduct costs from global AND nearest storehouse buffer
  const nearestSH = findNearestStorehouse(state.buildings, state.grid, state.width, state.height, x, y);
  const newBuildings0 = state.buildings.map(b => ({ ...b, localBuffer: { ...b.localBuffer } }));
  const shForCost = nearestSH ? newBuildings0.find(b => b.id === nearestSH.id) : null;
  for (const [res, amount] of Object.entries(template.cost)) {
    const key = res as keyof Resources;
    const cost = Math.max(1, Math.floor((amount as number) * (1 - costReduction)));
    if (newResources[key] < cost) {
      console.log(`ERROR: Cannot place ${type} — need ${cost} ${res}, have ${newResources[key]}`); return state;
    }
    newResources[key] -= cost;
    if (shForCost) {
      deductFromBuffer(shForCost.localBuffer, key as ResourceType, cost);
    }
  }

  // Construction points check
  if (!FREE_CONSTRUCTION.includes(type) && state.constructionPoints <= 0) {
    console.log(`ERROR: No construction points remaining (need prosperity milestones)`);
    return state;
  }

  const archBonus = hasTech(state.research, 'architecture') ? 1.5 : 1.0;
  const siegeBonus = hasTech(state.research, 'siege_engineering') && (type === 'wall' || type === 'gate') ? 1.5 : 1.0;
  const maxHp = Math.floor((BUILDING_MAX_HP[type] || 50) * archBonus * siegeBonus);
  const bufCap = type === 'outpost' ? OUTPOST_BUFFER_CAP
    : isStorehouse(type) ? STOREHOUSE_BUFFER_CAP : DEFAULT_BUFFER_CAP;

  const constructionReq = CONSTRUCTION_TICKS[type] || 60;
  // Small/simple structures (tent, fence) are instant for early game viability
  const isInstant = type === 'tent' || type === 'fence' || type === 'road';

  const building: Building = {
    id: `b${state.nextBuildingId}`, type, x, y, width: bw, height: bh,
    assignedWorkers: [],
    hp: maxHp, maxHp,
    constructed: isInstant,
    constructionProgress: isInstant ? constructionReq : 0,
    constructionRequired: constructionReq,
    localBuffer: {}, bufferCapacity: bufCap,
    onFire: false,
  };

  const newGrid: Tile[][] = state.grid.map((row, gy) =>
    row.map((tile, gx) => (gx >= x && gx < x + bw && gy >= y && gy < y + bh) ? { ...tile, building } : tile)
  );

  const pointCost = FREE_CONSTRUCTION.includes(type) ? 0 : 1;
  return {
    ...state, grid: newGrid, resources: newResources,
    buildings: [...newBuildings0, building],
    nextBuildingId: state.nextBuildingId + 1,
    storageCap: computeStorageCap([...newBuildings0, building]),
    constructionPoints: state.constructionPoints - pointCost,
  };
}

export function claimTerritory(state: GameState, x: number, y: number): GameState {
  if (!state.buildings.some(b => b.type === 'town_hall')) {
    console.log('ERROR: Need town_hall to claim territory'); return state;
  }

  const cost = { wood: 5, stone: 2 };
  if (state.resources.wood < cost.wood || state.resources.stone < cost.stone) {
    console.log(`ERROR: Need ${cost.wood} wood, ${cost.stone} stone to claim territory`); return state;
  }

  const newResources = { ...state.resources };
  newResources.wood -= cost.wood;
  newResources.stone -= cost.stone;

  const newTerritory = state.territory.map(row => [...row]);
  for (let ty = Math.max(0, y - 2); ty <= Math.min(state.height - 1, y + 2); ty++) {
    for (let tx = Math.max(0, x - 2); tx <= Math.min(state.width - 1, x + 2); tx++) {
      if (state.fog[ty][tx]) newTerritory[ty][tx] = true;
    }
  }

  return { ...state, territory: newTerritory, resources: newResources };
}

export function processFire(ts: TickState): void {
  const toRemove: string[] = [];

  for (const b of ts.buildings) {
    if (!b.onFire || !b.constructed) continue;

    b.hp -= FIRE_DAMAGE_PER_TICK;

    // Villager at building extinguishes fire (5 ticks of presence = out)
    const villagerAtBuilding = ts.villagers.some(v =>
      v.x >= b.x && v.x < b.x + b.width && v.y >= b.y && v.y < b.y + b.height
    );
    if (villagerAtBuilding) {
      // Extinguish faster when villager present
      b.onFire = false;
    }

    // Building destroyed by fire → rubble
    if (b.hp <= 0) {
      b.hp = 0;
      b.onFire = false;
      toRemove.push(b.id);
    }

    // Fire spread to adjacent buildings (small chance per tick)
    if (b.onFire) {
      const spreadRng = ((ts.newTick * 2246822519 + b.x * 374761393 + b.y * 668265263) & 0x7fffffff) / 0x7fffffff;
      if (spreadRng < FIRE_SPREAD_CHANCE) {
        for (const other of ts.buildings) {
          if (other.id === b.id || other.onFire || !other.constructed) continue;
          if (other.type === 'well' || other.type === 'fountain' || other.type === 'rubble') continue;
          // Check adjacency
          const adj = (
            Math.abs(other.x - b.x) <= 1 && Math.abs(other.y - b.y) <= 1 &&
            !(other.x === b.x && other.y === b.y)
          );
          if (adj) {
            // Well nearby reduces spread chance
            const hasWell = ts.buildings.some(w =>
              (w.type === 'well' || w.type === 'fountain') && w.constructed &&
              Math.abs(w.x - other.x) <= WELL_FIRE_PROTECTION_RANGE && Math.abs(w.y - other.y) <= WELL_FIRE_PROTECTION_RANGE
            );
            if (!hasWell) {
              other.onFire = true;
              break; // Only spread to one building per tick
            }
          }
        }
      }
    }
  }

  // Replace destroyed buildings with rubble
  const nextBldIdRef = { value: ts.nextBuildingId };
  for (const id of toRemove) {
    const building = ts.buildingMap.get(id);
    if (building) {
      destroyBuildingAndCreateRubble(building, ts.buildings, ts.grid, ts.villagers, ts.width, ts.height, nextBldIdRef);
    }
  }
  ts.nextBuildingId = nextBldIdRef.value;
  if (toRemove.length > 0) rebuildBuildingMap(ts);
}
