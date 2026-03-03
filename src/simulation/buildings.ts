// buildings.ts — Building placement and territory claiming

import {
  GameState, BuildingType, Building, Resources, ResourceType, Tile,
  BUILDING_TEMPLATES, BUILDING_MAX_HP, CONSTRUCTION_TICKS,
  DEFAULT_BUFFER_CAP, STOREHOUSE_BUFFER_CAP,
} from '../world.js';
import { computeStorageCap, hasTech, findNearestStorehouse, bufferTotal } from './helpers.js';

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
      const bufAmt = shForCost.localBuffer[key as ResourceType] || 0;
      shForCost.localBuffer[key as ResourceType] = Math.max(0, bufAmt - cost);
      if ((shForCost.localBuffer[key as ResourceType] || 0) <= 0) delete shForCost.localBuffer[key as ResourceType];
    }
  }

  const maxHp = BUILDING_MAX_HP[type] || 50;
  const bufCap = type === 'storehouse' ? STOREHOUSE_BUFFER_CAP : DEFAULT_BUFFER_CAP;

  const constructionReq = CONSTRUCTION_TICKS[type] || 60;
  // Small/simple structures (tent, fence) are instant for early game viability
  const isInstant = type === 'tent' || type === 'fence';

  const building: Building = {
    id: `b${state.nextBuildingId}`, type, x, y, width: bw, height: bh,
    assignedWorkers: [],
    hp: maxHp, maxHp,
    constructed: isInstant,
    constructionProgress: isInstant ? constructionReq : 0,
    constructionRequired: constructionReq,
    localBuffer: {}, bufferCapacity: bufCap,
  };

  const newGrid: Tile[][] = state.grid.map((row, gy) =>
    row.map((tile, gx) => (gx >= x && gx < x + bw && gy >= y && gy < y + bh) ? { ...tile, building } : tile)
  );

  return {
    ...state, grid: newGrid, resources: newResources,
    buildings: [...newBuildings0, building],
    nextBuildingId: state.nextBuildingId + 1,
    storageCap: computeStorageCap([...newBuildings0, building]),
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
