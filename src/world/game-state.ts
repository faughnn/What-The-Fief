// world/game-state.ts — Game state factory, quests, festivals, and remaining constants

import type {
  GameState, Terrain, Tile, Deposit, Villager,
  NpcSettlement, ResourceType, Resources,
  PointOfInterest, POIType, POIGuardEnemy, EnemyType,
  QuestDefinition, DynamicQuestType,
} from './types.js';
import { emptyResources, BASE_STORAGE_CAP } from './resources.js';
import { createVillager } from './villagers.js';
import { INITIAL_CONSTRUCTION_POINTS } from './buildings.js';

// --- Quest Definitions ---
export const QUEST_DEFINITIONS: QuestDefinition[] = [
  { id: 'first_steps', name: 'First Steps', desc: 'Have 5 villagers and 3 buildings', renown: 10, gold: 20 },
  { id: 'fortified', name: 'Fortified', desc: 'Survive your first raid', renown: 15, gold: 30 },
  { id: 'prosperous', name: 'Prosperous', desc: 'Reach prosperity 70', renown: 20, gold: 50 },
  { id: 'researcher', name: 'Researcher', desc: 'Research 3 technologies', renown: 15, gold: 25 },
  { id: 'industrious', name: 'Industrious', desc: 'Construct 10 buildings', renown: 15, gold: 30 },
  { id: 'well_fed', name: 'Well Fed', desc: 'Have 3+ food types available', renown: 10, gold: 20 },
  { id: 'armed_forces', name: 'Armed Forces', desc: 'Have 3 guards on duty', renown: 15, gold: 25 },
  { id: 'growing_colony', name: 'Growing Colony', desc: 'Reach 10 villagers', renown: 20, gold: 40 },
  { id: 'liberator', name: 'Liberator', desc: 'Liberate an NPC village', renown: 25, gold: 50 },
  { id: 'master_builder', name: 'Master Builder', desc: 'Construct 20 buildings', renown: 20, gold: 40 },
  { id: 'scholar', name: 'Scholar', desc: 'Research 8 technologies', renown: 25, gold: 50 },
  { id: 'thriving', name: 'Thriving', desc: 'Reach 15 villagers', renown: 25, gold: 50 },
  { id: 'camp_cleared', name: 'Camp Cleared', desc: 'Clear a bandit camp', renown: 20, gold: 40 },
  { id: 'food_empire', name: 'Food Empire', desc: 'Have 5+ food types available', renown: 15, gold: 30 },
  { id: 'explorer', name: 'Explorer', desc: 'Discover 3 points of interest', renown: 20, gold: 35 },
  { id: 'elder_village', name: 'Elder Village', desc: 'Have a villager reach age 60', renown: 15, gold: 25 },
  { id: 'tech_master', name: 'Tech Master', desc: 'Research all technologies', renown: 30, gold: 60 },
  { id: 'fortress', name: 'Fortress', desc: 'Build 10 defensive structures', renown: 20, gold: 40 },
];

// --- Dynamic Quest Constants ---
export const DYNAMIC_QUEST_START_DAY = 20;
export const DYNAMIC_QUEST_MIN_INTERVAL = 10;
export const DYNAMIC_QUEST_MAX_INTERVAL = 15;
export const DYNAMIC_QUEST_MAX_ACTIVE = 2;

export const DYNAMIC_QUEST_WEIGHTS: { type: DynamicQuestType; weight: number }[] = [
  { type: 'defend', weight: 20 },
  { type: 'supply', weight: 25 },
  { type: 'hunt', weight: 25 },
  { type: 'rescue', weight: 15 },
  { type: 'trade', weight: 15 },
];

// --- Festivals ---
export const FESTIVAL_FOOD_COST = 20;
export const FESTIVAL_GOLD_COST = 10;
export const FESTIVAL_MORALE_BOOST = 20;
export const FESTIVAL_DURATION = 3;
export const FESTIVAL_COOLDOWN = 10;

// --- Victory ---
export const VICTORY_MIN_POPULATION = 15;
export const VICTORY_MIN_PROSPERITY = 100;

// --- Expeditions ---
export const EXPEDITION_EXPLORE_TICKS = 10;
export const EXPEDITION_FOG_RADIUS = 3;

// --- POI Generation ---
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generatePOIs(width: number, height: number, cx: number, cy: number, rng: () => number): PointOfInterest[] {
  if (width < 30 || height < 30) return [];
  const pois: PointOfInterest[] = [];
  const POI_TEMPLATES: { type: POIType; rewards: Partial<Resources>; renown: number; guards?: POIGuardEnemy[] }[] = [
    { type: 'ruins', rewards: { stone: 10, iron_ore: 3 }, renown: 5 },
    { type: 'resource_cache', rewards: { gold: 8, wood: 5 }, renown: 2 },
    { type: 'animal_den', rewards: { leather: 4, food: 5 }, renown: 3, guards: [{ type: 'wolf', count: 2 }] },
    { type: 'abandoned_camp', rewards: { gold: 15, wood: 10 }, renown: 8, guards: [{ type: 'bandit', count: 2 }] },
    { type: 'herb_grove', rewards: { herbs: 10 }, renown: 2 },
    { type: 'ruins', rewards: { stone: 5, gold: 5 }, renown: 4 },
    { type: 'resource_cache', rewards: { iron_ore: 5, stone: 8 }, renown: 3 },
    { type: 'abandoned_camp', rewards: { gold: 20 }, renown: 10, guards: [{ type: 'bandit', count: 3 }, { type: 'bandit_archer', count: 1 }] },
  ];
  const margin = 5;
  for (let i = 0; i < POI_TEMPLATES.length; i++) {
    const t = POI_TEMPLATES[i];
    let px = 0, py = 0, attempts = 0;
    do {
      px = margin + Math.floor(rng() * (width - margin * 2));
      py = margin + Math.floor(rng() * (height - margin * 2));
      attempts++;
    } while (Math.abs(px - cx) < 15 && Math.abs(py - cy) < 15 && attempts < 50);
    pois.push({
      id: `poi${i + 1}`, type: t.type, x: px, y: py,
      discovered: false, explored: false,
      rewards: t.rewards, renownReward: t.renown,
      guardEnemies: t.guards,
    });
  }
  return pois;
}

// --- NPC Village Data ---
const NPC_VILLAGE_DATA: { name: string; direction: 'n' | 's' | 'e' | 'w'; specialty: ResourceType }[] = [
  { name: 'Thornfield', direction: 'n', specialty: 'wood' },
  { name: 'Millhaven', direction: 'e', specialty: 'wheat' },
  { name: 'Ironhollow', direction: 's', specialty: 'stone' },
  { name: 'Greenwater', direction: 'w', specialty: 'food' },
];

export function createWorld(width: number, height: number, seed: number = 42): GameState {
  const rng = seededRng(seed);
  const grid: Tile[][] = [];
  const riverStart = Math.floor(width / 3) + Math.floor(rng() * Math.floor(width / 3));

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      let terrain: Terrain = 'grass';
      if ((x === riverStart || x === riverStart + 1) && y % 4 !== 0) {
        terrain = 'water';
      } else if (rng() < 0.15) {
        terrain = 'forest';
      } else if (rng() < 0.05) {
        terrain = 'stone';
      } else if (rng() < 0.05) {
        terrain = 'hill';
      }
      let deposit: Deposit = null;
      if (terrain === 'stone' && rng() < 0.3) deposit = 'iron';
      else if (terrain === 'grass' && rng() < 0.08) deposit = 'fertile';
      else if (terrain === 'grass' && rng() < 0.05) deposit = 'herbs';

      row.push({ terrain, building: null, deposit });
    }
    grid.push(row);
  }

  const cx = Math.floor(width / 4);
  const cy = Math.floor(height / 2);

  const fog: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  for (let fy = Math.max(0, cy - 5); fy < Math.min(height, cy + 5); fy++) {
    for (let fx = Math.max(0, cx - 5); fx < Math.min(width, cx + 5); fx++) {
      fog[fy][fx] = true;
    }
  }

  const territory: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  for (let ty = Math.max(0, cy - 10); ty <= Math.min(height - 1, cy + 9); ty++) {
    for (let tx = Math.max(0, cx - 10); tx <= Math.min(width - 1, cx + 9); tx++) {
      territory[ty][tx] = true;
    }
  }

  const villagers: Villager[] = [];
  let placed = 0;
  for (let dy = 0; dy < height && placed < 3; dy++) {
    for (let dx = 0; dx < width && placed < 3; dx++) {
      const vy = (cy + dy) % height;
      const vx = (cx + dx) % width;
      if (grid[vy][vx].terrain === 'grass') {
        villagers.push(createVillager(placed + 1, vx, vy));
        placed++;
      }
    }
  }

  const npcSettlements: NpcSettlement[] = [];
  if (width >= 30 && height >= 30) {
    for (let i = 0; i < NPC_VILLAGE_DATA.length; i++) {
      const v = NPC_VILLAGE_DATA[i];
      let vx = Math.floor(width / 2), vy = Math.floor(height / 2);
      if (v.direction === 'n') { vx = Math.floor(width * 0.3 + i * 3); vy = 2; }
      else if (v.direction === 's') { vx = Math.floor(width * 0.7 - i * 2); vy = height - 3; }
      else if (v.direction === 'e') { vx = width - 3; vy = Math.floor(height * 0.3 + i * 3); }
      else if (v.direction === 'w') { vx = 2; vy = Math.floor(height * 0.7 - i * 2); }
      if (grid[vy][vx].terrain !== 'grass') grid[vy][vx] = { terrain: 'grass', building: null, deposit: null };
      npcSettlements.push({
        id: `village${i + 1}`, name: v.name, direction: v.direction, specialty: v.specialty,
        x: vx, y: vy, trust: 0, trustRank: 'stranger', liberated: false, liberationInProgress: false,
      });
    }
  }

  return {
    tick: 0, day: 0, grid, width, height,
    resources: { ...emptyResources(), wood: 50, stone: 20, food: 30 },
    storageCap: BASE_STORAGE_CAP,
    buildings: [], nextBuildingId: 1,
    villagers, nextVillagerId: placed + 1,
    enemies: [], nextEnemyId: 1,
    animals: [], nextAnimalId: 1,
    resourceDrops: [], nextDropId: 1,
    fog, territory,
    raidBar: 0, raidLevel: 0, activeRaid: null,
    research: { completed: [], current: null, progress: 0 },
    merchant: null, merchantTimer: 15, prosperity: 0,
    season: 'spring', weather: 'clear',
    renown: 0, events: [], completedQuests: [], banditUltimatum: null, graveyard: [],
    npcSettlements, caravans: [],
    banditCamps: [], nextCampId: 1, lastCampSpawnDay: -999,
    constructionPoints: INITIAL_CONSTRUCTION_POINTS,
    constructionPointsMilestones: [],
    supplyRoutes: [],
    nextRouteId: 1,
    lastFestivalDay: -100,
    callToArms: false,
    pointsOfInterest: generatePOIs(width, height, cx, cy, rng),
    expeditions: [],
    nextExpeditionId: 1,
    dynamicQuests: [],
    lastDynamicQuestDay: -100,
    nextDynamicQuestId: 1,
    victory: false,
    pendingRaidWaves: [],
    forceNightRaid: false,
    lastLiberationDay: -100,
  };
}
