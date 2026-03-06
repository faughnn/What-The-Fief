// render-text.ts — Reads GameState, returns string. No mutation.

import {
  GameState, VillagerRole, BUILDING_TEMPLATES, ResourceType, BuildingType,
  ALL_RESOURCES, FOOD_PRIORITY, ALL_TECHS, TECH_TREE,
  TICKS_PER_DAY, NIGHT_TICKS, QUEST_DEFINITIONS,
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
  charcoal_burner: 'C', carpenter_worker: 'P', weaponsmith_worker: 'W',
  fletcher_worker: 'F', leather_workshop_worker: 'L',
  scout: 'c', guard: 'g', researcher: 'd', hunter: 'H', forager: 'G',
  chicken_keeper: 'j', rancher: 'u', beekeeper: 'y', trader: 'T',
  fisher: '$', hauler: '!', militia: 'M', well_worker: 'O',
};

export function renderMap(state: GameState): string {
  const lines: string[] = [];
  const dayTick = state.tick % TICKS_PER_DAY;
  const timeOfDay = dayTick < NIGHT_TICKS ? 'night' : 'day';
  lines.push(`=== Colony State [day ${state.day} tick ${dayTick}/${TICKS_PER_DAY} ${timeOfDay}] ${state.season} / ${state.weather} ===`);
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
      if (!state.fog[y][x]) {
        row += ' ?';
      } else {
        const vChar = villagerMap.get(`${x},${y}`);
        if (vChar) row += ' ' + vChar;
        else if (tile.building) row += ' ' + BUILDING_TEMPLATES[tile.building.type].mapChar;
        else if (tile.deposit) row += ' ' + (tile.deposit === 'iron' ? '*' : tile.deposit === 'fertile' ? '+' : '&');
        else row += ' ' + TERRAIN_CHARS[tile.terrain];
      }
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
    const posStr = ` @(${v.x},${v.y})`;
    const carryStr = v.carryTotal > 0 ? ` carrying=${v.carryTotal}` : '';
    lines.push(`  ${v.name} (${v.role}/${v.state}) morale=${v.morale} food=${Math.round(v.food)}${posStr}${carryStr}${toolStr}${traits}${skillStr}${job}${home}`);
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

  lines.push(`Prosperity: ${state.prosperity}/100`);
  if (state.merchant) {
    lines.push(`Merchant: visiting (${state.merchant.ticksLeft} days left)`);
  } else if (state.buildings.some(b => b.type === 'marketplace')) {
    lines.push(`Merchant: arrives in ${state.merchantTimer} days`);
  }

  lines.push(`Renown: ${state.renown}`);

  if (state.events.length > 0) {
    lines.push('Events:');
    for (const e of state.events) lines.push(`  * ${e}`);
  }

  const errors = validateState(state);
  lines.push(errors.length === 0 ? 'Errors: (none)' : errors.join('\n'));

  return lines.join('\n');
}

export function renderEvents(state: GameState): string {
  const lines: string[] = ['Events & Quests:'];
  lines.push(`  Renown: ${state.renown}`);
  lines.push('  Quests:');
  for (const q of QUEST_DEFINITIONS) {
    const done = state.completedQuests.includes(q.id);
    lines.push(`    ${done ? '[x]' : '[ ]'} ${q.name} — ${q.desc}`);
  }
  lines.push('  Recent events:');
  if (state.events.length === 0) {
    lines.push('    (none this tick)');
  } else {
    for (const e of state.events) lines.push(`    * ${e}`);
  }
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

export function renderCombat(state: GameState): string {
  const lines: string[] = ['Combat:'];
  lines.push(`  Raid bar: ${Math.floor(state.raidBar)}/100`);
  lines.push(`  Raid level: ${state.raidLevel}`);
  const guards = state.villagers.filter(v => v.role === 'guard');
  lines.push(`  Guards: ${guards.length}`);
  if (guards.length > 0) {
    for (const g of guards) {
      lines.push(`    ${g.name} hp=${g.hp}/${g.maxHp} tool=${g.tool}`);
    }
  }
  if (state.activeRaid) {
    const alive = state.activeRaid.enemies.filter(e => e.hp > 0);
    lines.push(`  Active raid: ${alive.length} enemies remaining`);
  }
  return lines.join('\n');
}

export function renderResearch(state: GameState): string {
  const lines: string[] = ['Research:'];
  const r = state.research;
  if (r.current) {
    const tech = TECH_TREE[r.current];
    lines.push(`  Researching: ${tech.name} (${Math.floor(r.progress)}/${tech.cost})`);
  } else {
    lines.push('  Researching: (none)');
  }
  lines.push('  Completed:');
  if (r.completed.length === 0) {
    lines.push('    (none)');
  } else {
    for (const id of r.completed) lines.push(`    [x] ${TECH_TREE[id].name} — ${TECH_TREE[id].description}`);
  }
  lines.push('  Available:');
  const available = ALL_TECHS.filter(id => !r.completed.includes(id));
  if (available.length === 0) {
    lines.push('    (all researched)');
  } else {
    for (const id of available) {
      const marker = id === r.current ? '>' : ' ';
      lines.push(`   ${marker} ${TECH_TREE[id].name} (${TECH_TREE[id].cost}) — ${TECH_TREE[id].description}`);
    }
  }
  return lines.join('\n');
}

export type ViewMode = 'map' | 'summary' | 'all' | 'villagers' | 'economy' | 'combat' | 'research' | 'events';

export function renderAll(state: GameState, viewMode: ViewMode): string {
  switch (viewMode) {
    case 'map': return renderMap(state);
    case 'summary': return renderSummary(state);
    case 'villagers': return renderVillagers(state);
    case 'economy': return renderEconomy(state);
    case 'combat': return renderCombat(state);
    case 'research': return renderResearch(state);
    case 'events': return renderEvents(state);
    case 'all': return [renderMap(state), renderSummary(state), renderVillagers(state), renderEconomy(state), renderCombat(state), renderResearch(state), renderEvents(state)].join('\n\n');
  }
}
