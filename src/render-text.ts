// render-text.ts — Reads GameState, returns string. No mutation.

import { GameState, Terrain, BuildingType, VillagerRole } from './world.js';
import { validateState } from './simulation.js';

const TERRAIN_CHARS: Record<Terrain, string> = {
  grass: '.',
  forest: 'T',
  water: '~',
  stone: '^',
};

const BUILDING_CHARS: Record<BuildingType, string> = {
  house: 'H',
  farm: 'F',
  woodcutter: 'W',
  quarry: 'Q',
  storehouse: 'S',
};

const ROLE_CHARS: Record<VillagerRole, string> = {
  idle: 'v',
  farmer: 'f',
  woodcutter: 'w',
  quarrier: 'q',
};

export function renderMap(state: GameState): string {
  const lines: string[] = [];
  lines.push(`=== Colony State [day ${state.day}] ===`);
  lines.push('');

  if (state.width > 20 || state.height > 20) {
    lines.push(`(Map omitted — grid is ${state.width}x${state.height})`);
    return lines.join('\n');
  }

  // Build villager position map
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
        row += ' ' + BUILDING_CHARS[tile.building.type];
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
    const dest = v.destX !== null ? ` -> (${v.destX},${v.destY})` : '';
    const job = v.jobBuildingId ? ` job=${v.jobBuildingId}` : '';
    const home = v.homeBuildingId ? ` home=${v.homeBuildingId}` : ' (homeless)';
    lines.push(`  ${v.name} (${v.role}) pos=(${v.x},${v.y})${dest} [${v.state}]${job}${home} food=${v.food}`);
  }
  return lines.join('\n');
}

export function renderSummary(state: GameState): string {
  const lines: string[] = [];

  lines.push(`Resources: wood=${state.resources.wood} food=${state.resources.food} stone=${state.resources.stone}`);
  lines.push(`Population: ${state.villagers.length}`);

  const counts: Partial<Record<BuildingType, number>> = {};
  for (const b of state.buildings) {
    counts[b.type] = (counts[b.type] || 0) + 1;
  }
  if (state.buildings.length === 0) {
    lines.push('Buildings: (none)');
  } else {
    const parts = Object.entries(counts).map(([t, c]) => `${t}=${c}`);
    lines.push(`Buildings: ${parts.join(' ')}`);
  }

  const errors = validateState(state);
  if (errors.length === 0) {
    lines.push('Errors: (none)');
  } else {
    for (const err of errors) {
      lines.push(err);
    }
  }

  return lines.join('\n');
}

export type ViewMode = 'map' | 'summary' | 'all' | 'villagers';

export function renderAll(state: GameState, viewMode: ViewMode): string {
  switch (viewMode) {
    case 'map':
      return renderMap(state);
    case 'summary':
      return renderSummary(state);
    case 'villagers':
      return renderVillagers(state);
    case 'all':
      return renderMap(state) + '\n\n' + renderSummary(state) + '\n\n' + renderVillagers(state);
  }
}
