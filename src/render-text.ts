// render-text.ts — Reads GameState, returns string. No mutation.

import { GameState, BuildingType, VillagerRole, BUILDING_TEMPLATES, ResourceType } from './world.js';
import { validateState } from './simulation.js';

const TERRAIN_CHARS: Record<string, string> = {
  grass: '.', forest: 'T', water: '~', stone: '^',
};

const ROLE_CHARS: Record<VillagerRole, string> = {
  idle: 'v', farmer: 'f', woodcutter: 'w', quarrier: 'q',
  herbalist: 'h', flaxer: 'x', hemper: 'p', miner: 'i',
};

export function renderMap(state: GameState): string {
  const lines: string[] = [];
  lines.push(`=== Colony State [day ${state.day}] ===`);
  lines.push('');

  if (state.width > 20 || state.height > 20) {
    lines.push(`(Map omitted — grid is ${state.width}x${state.height})`);
    return lines.join('\n');
  }

  const villagerMap = new Map<string, string>();
  for (const v of state.villagers) {
    villagerMap.set(`${v.x},${v.y}`, ROLE_CHARS[v.role]);
  }

  const colHeader = '   ' + Array.from({ length: state.width }, (_, i) =>
    i.toString().padStart(2)
  ).join('');
  lines.push(colHeader);

  for (let y = 0; y < state.height; y++) {
    let row = y.toString().padStart(2) + ' ';
    for (let x = 0; x < state.width; x++) {
      const tile = state.grid[y][x];
      const vChar = villagerMap.get(`${x},${y}`);
      if (vChar) {
        row += ' ' + vChar;
      } else if (tile.building) {
        row += ' ' + BUILDING_TEMPLATES[tile.building.type].mapChar;
      } else {
        row += ' ' + TERRAIN_CHARS[tile.terrain];
      }
    }
    lines.push(row);
  }

  return lines.join('\n');
}

export function renderVillagers(state: GameState): string {
  const lines: string[] = [];
  lines.push('Villagers:');
  if (state.villagers.length === 0) {
    lines.push('  (none)');
    return lines.join('\n');
  }
  for (const v of state.villagers) {
    const job = v.jobBuildingId ? ` job=${v.jobBuildingId}` : '';
    const home = v.homeBuildingId ? ` home=${v.homeBuildingId}` : ' (homeless)';
    lines.push(`  ${v.name} (${v.role}) pos=(${v.x},${v.y}) [${v.state}]${job}${home} food=${v.food}`);
  }
  return lines.join('\n');
}

export function renderSummary(state: GameState): string {
  const lines: string[] = [];
  const r = state.resources;

  // Show non-zero resources plus core ones
  const parts: string[] = [];
  const show: ResourceType[] = ['wood', 'stone', 'food', 'wheat', 'iron_ore', 'herbs', 'flax', 'hemp'];
  for (const key of show) {
    if (r[key] > 0 || key === 'wood' || key === 'stone' || key === 'food') {
      parts.push(`${key}=${r[key]}`);
    }
  }
  lines.push(`Resources: ${parts.join(' ')} (cap=${state.storageCap})`);
  lines.push(`Population: ${state.villagers.length}`);

  const counts: Partial<Record<BuildingType, number>> = {};
  for (const b of state.buildings) counts[b.type] = (counts[b.type] || 0) + 1;
  if (state.buildings.length === 0) {
    lines.push('Buildings: (none)');
  } else {
    lines.push(`Buildings: ${Object.entries(counts).map(([t, c]) => `${t}=${c}`).join(' ')}`);
  }

  const errors = validateState(state);
  if (errors.length === 0) {
    lines.push('Errors: (none)');
  } else {
    for (const err of errors) lines.push(err);
  }

  return lines.join('\n');
}

export function renderEconomy(state: GameState): string {
  const lines: string[] = [];
  lines.push('Economy:');

  // Calculate production per day
  const production: Partial<Record<ResourceType, number>> = {};
  for (const v of state.villagers) {
    if (v.jobBuildingId) {
      const b = state.buildings.find(b => b.id === v.jobBuildingId);
      if (b) {
        const t = BUILDING_TEMPLATES[b.type];
        if (t.production) {
          production[t.production.output] = (production[t.production.output] || 0) + t.production.amountPerWorker;
        }
      }
    }
  }

  // Consumption
  const consumption = state.villagers.length; // 1 food/wheat per villager

  lines.push('  Production/day:');
  if (Object.keys(production).length === 0) {
    lines.push('    (none)');
  } else {
    for (const [res, amt] of Object.entries(production)) {
      lines.push(`    +${amt} ${res}`);
    }
  }
  lines.push(`  Consumption/day: -${consumption} food/wheat`);
  const foodProd = (production.wheat || 0) + (production.food || 0);
  lines.push(`  Net food: ${foodProd - consumption >= 0 ? '+' : ''}${foodProd - consumption}/day`);

  return lines.join('\n');
}

export type ViewMode = 'map' | 'summary' | 'all' | 'villagers' | 'economy';

export function renderAll(state: GameState, viewMode: ViewMode): string {
  switch (viewMode) {
    case 'map': return renderMap(state);
    case 'summary': return renderSummary(state);
    case 'villagers': return renderVillagers(state);
    case 'economy': return renderEconomy(state);
    case 'all':
      return [renderMap(state), renderSummary(state), renderVillagers(state), renderEconomy(state)].join('\n\n');
  }
}
