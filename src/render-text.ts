// render-text.ts — Reads GameState, returns string. No mutation.

import {
  GameState, VillagerRole, BUILDING_TEMPLATES, ResourceType, BuildingType,
  ALL_RESOURCES, FOOD_PRIORITY,
} from './world.js';
import { validateState } from './simulation.js';

const TERRAIN_CHARS: Record<string, string> = {
  grass: '.', forest: 'T', water: '~', stone: '^',
};

const ROLE_CHARS: Record<VillagerRole, string> = {
  idle: 'v', farmer: 'f', woodcutter: 'w', quarrier: 'q',
  herbalist: 'h', flaxer: 'x', hemper: 'p', miner: 'i',
  sawyer: 's', smelter: 'e', miller: 'l', baker: 'b',
  tanner_worker: 'n', weaver_worker: 'a', ropemaker_worker: 'r',
  blacksmith_worker: 'k', toolmaker_worker: 'o', armorer_worker: 'z',
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
  for (const v of state.villagers) villagerMap.set(`${v.x},${v.y}`, ROLE_CHARS[v.role]);

  const colHeader = '   ' + Array.from({ length: state.width }, (_, i) => i.toString().padStart(2)).join('');
  lines.push(colHeader);

  for (let y = 0; y < state.height; y++) {
    let row = y.toString().padStart(2) + ' ';
    for (let x = 0; x < state.width; x++) {
      const tile = state.grid[y][x];
      const vChar = villagerMap.get(`${x},${y}`);
      if (vChar) row += ' ' + vChar;
      else if (tile.building) row += ' ' + BUILDING_TEMPLATES[tile.building.type].mapChar;
      else row += ' ' + TERRAIN_CHARS[tile.terrain];
    }
    lines.push(row);
  }

  return lines.join('\n');
}

export function renderVillagers(state: GameState): string {
  const lines: string[] = ['Villagers:'];
  if (state.villagers.length === 0) { lines.push('  (none)'); return lines.join('\n'); }
  for (const v of state.villagers) {
    const job = v.jobBuildingId ? ` job=${v.jobBuildingId}` : '';
    const home = v.homeBuildingId ? ` home=${v.homeBuildingId}` : ' (homeless)';
    const traits = v.traits.length > 0 ? ` [${v.traits.join(',')}]` : '';
    const topSkills = Object.entries(v.skills).filter(([, lv]) => lv > 0).map(([s, lv]) => `${s}=${lv}`).join(',');
    const skillStr = topSkills ? ` skills={${topSkills}}` : '';
    const toolStr = v.tool !== 'none' ? ` tool=${v.tool}(${v.toolDurability})` : '';
    lines.push(`  ${v.name} (${v.role}) morale=${v.morale} food=${Math.round(v.food)}${toolStr}${traits}${skillStr}${job}${home}`);
  }

  const avgMorale = state.villagers.length > 0
    ? Math.round(state.villagers.reduce((s, v) => s + v.morale, 0) / state.villagers.length)
    : 0;
  lines.push(`  Avg morale: ${avgMorale}`);
  return lines.join('\n');
}

export function renderSummary(state: GameState): string {
  const lines: string[] = [];
  const r = state.resources;

  const parts: string[] = [];
  for (const key of ALL_RESOURCES) {
    if (r[key] > 0 || key === 'wood' || key === 'stone' || key === 'food') {
      parts.push(`${key}=${r[key]}`);
    }
  }
  lines.push(`Resources: ${parts.join(' ')} (cap=${state.storageCap})`);
  lines.push(`Population: ${state.villagers.length}`);

  const counts: Partial<Record<BuildingType, number>> = {};
  for (const b of state.buildings) counts[b.type] = (counts[b.type] || 0) + 1;
  lines.push(state.buildings.length === 0
    ? 'Buildings: (none)'
    : `Buildings: ${Object.entries(counts).map(([t, c]) => `${t}=${c}`).join(' ')}`);

  const errors = validateState(state);
  lines.push(errors.length === 0 ? 'Errors: (none)' : errors.join('\n'));

  return lines.join('\n');
}

export function renderEconomy(state: GameState): string {
  const lines: string[] = ['Economy:'];

  const production: Partial<Record<ResourceType, number>> = {};
  const consumption: Partial<Record<ResourceType, number>> = {};

  for (const v of state.villagers) {
    if (!v.jobBuildingId) continue;
    const b = state.buildings.find(b => b.id === v.jobBuildingId);
    if (!b) continue;
    const t = BUILDING_TEMPLATES[b.type];
    if (!t.production) continue;
    production[t.production.output] = (production[t.production.output] || 0) + t.production.amountPerWorker;
    if (t.production.inputs) {
      for (const [res, amt] of Object.entries(t.production.inputs)) {
        consumption[res as ResourceType] = (consumption[res as ResourceType] || 0) + (amt as number);
      }
    }
  }

  lines.push('  Production/day:');
  const prodEntries = Object.entries(production);
  if (prodEntries.length === 0) lines.push('    (none)');
  else for (const [res, amt] of prodEntries) lines.push(`    +${amt} ${res}`);

  lines.push('  Input consumption/day:');
  const consEntries = Object.entries(consumption);
  if (consEntries.length === 0) lines.push('    (none)');
  else for (const [res, amt] of consEntries) lines.push(`    -${amt} ${res}`);

  const foodProd = FOOD_PRIORITY.reduce((sum, { resource }) => sum + (production[resource] || 0), 0);
  const foodCons = state.villagers.length;
  lines.push(`  Food: +${foodProd} produced, -${foodCons} eaten = ${foodProd - foodCons >= 0 ? '+' : ''}${foodProd - foodCons}/day`);

  return lines.join('\n');
}

export type ViewMode = 'map' | 'summary' | 'all' | 'villagers' | 'economy';

export function renderAll(state: GameState, viewMode: ViewMode): string {
  switch (viewMode) {
    case 'map': return renderMap(state);
    case 'summary': return renderSummary(state);
    case 'villagers': return renderVillagers(state);
    case 'economy': return renderEconomy(state);
    case 'all': return [renderMap(state), renderSummary(state), renderVillagers(state), renderEconomy(state)].join('\n\n');
  }
}
