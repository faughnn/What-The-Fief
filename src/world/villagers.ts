// world/villagers.ts — Villager traits, skills, creation, and related constants

import type {
  BuildingType, SkillType, Trait, Villager, GuardMode, GuardLine,
} from './types.js';

// --- Skills ---
export const ALL_SKILLS: SkillType[] = ['farming', 'mining', 'crafting', 'woodcutting', 'cooking', 'herbalism', 'combat'];

export const BUILDING_SKILL_MAP: Partial<Record<BuildingType, SkillType>> = {
  farm: 'farming', flax_field: 'farming', hemp_field: 'farming', barley_field: 'farming', vegetable_garden: 'farming',
  quarry: 'mining', iron_mine: 'mining',
  sawmill: 'crafting', smelter: 'crafting', coal_burner: 'crafting', carpenter: 'crafting', tanner: 'crafting', weaver: 'crafting', ropemaker: 'crafting',
  woodcutter: 'woodcutting', forester: 'woodcutting', logging_camp: 'woodcutting',
  mill: 'cooking', bakery: 'cooking',
  herb_garden: 'herbalism', well: 'farming',
  butchery: 'cooking', compost_pile: 'farming', drying_rack: 'cooking', smoking_rack: 'cooking', brewery: 'cooking',
  research_desk: 'crafting',
  chicken_coop: 'farming',
  livestock_barn: 'farming',
  apiary: 'herbalism', foraging_hut: 'herbalism', foraging_lodge: 'herbalism', fishing_hut: 'farming',
  weaponsmith: 'crafting', fletcher: 'crafting', leather_workshop: 'crafting', mint: 'crafting',
  large_farm: 'farming', deep_quarry: 'mining',
  lumber_mill: 'crafting', advanced_smelter: 'crafting',
  windmill: 'cooking', kitchen: 'cooking',
  training_ground: 'combat',
  apothecary: 'herbalism',
  stonemason: 'mining',
  trappers_camp: 'herbalism',
};

export function skillMultiplier(level: number): number {
  if (level <= 25) return 0.8;
  if (level <= 50) return 1.0;
  if (level <= 75) return 1.2;
  return 1.5;
}

// --- Traits ---
export const ALL_TRAITS: Trait[] = ['strong', 'lazy', 'skilled_crafter', 'fast_learner', 'glutton', 'frugal', 'cheerful', 'gloomy',
  'brave', 'coward', 'resilient', 'nimble', 'stalwart', 'marksman', 'neurotic', 'porter', 'tough',
  'defender', 'fierce', 'nomad', 'prodigy', 'dullard', 'scholar', 'swordsman'];

// --- Villager Constants ---
export const CARRY_CAPACITY = 5;
export const PORTER_CARRY_BONUS = 3;
export const TOUGH_HP_BONUS = 5;
export const VILLAGER_BASE_HP = 10;
export const GUARD_BASE_HP = 15;
export const GUARD_MORALE_HP_DIVISOR = 10;
export const ARMOR_BONUS_HP = 5;
export const HP_REGEN_PER_DAY = 2;
export const MEDICINE_REGEN_BONUS = 1;

// --- Aging ---
export const ELDER_AGE = 60;
export const OLD_AGE_DEATH_START = 65;
export const OLD_AGE_DEATH_CHANCE = 0.02;
export const ELDER_SPEED_PENALTY = 0.5;
export const MIN_VILLAGER_AGE = 18;
export const MAX_VILLAGER_AGE = 45;

// --- Clothing ---
export const CLOTHING_DURABILITY = 10;

// --- Disease ---
export const DISEASE_DURATION_BASE = 5;
export const DISEASE_DURATION_MEDICINE = 3;
export const DISEASE_HP_LOSS_PER_DAY = 3;

// --- Tavern ---
export const TAVERN_MORALE_THRESHOLD = 60;
export const TAVERN_MORALE_BOOST = 15;
export const TAVERN_COOLDOWN_DAYS = 3;
export const ALE_MORALE_BONUS = 5;

// --- Friendships ---
export const FRIENDSHIP_COWORK_THRESHOLD = 10;
export const FRIENDSHIP_MORALE_BONUS = 3;
export const FRIENDSHIP_GRIEF_DAYS = 3;
export const FRIENDSHIP_GRIEF_PENALTY = 5;
export const MAX_FRIENDS = 2;

// --- Recruitment ---
export const RENOWN_PER_RECRUIT = 5;
export const FREE_SETTLERS = 4;

// --- Villager Names ---
const VILLAGER_NAMES = [
  'Edric', 'Mara', 'Aldric', 'Blythe', 'Cedric', 'Delia', 'Emory', 'Fern',
  'Gareth', 'Hilda', 'Ivo', 'Jocelyn', 'Kendrick', 'Lena', 'Magnus', 'Nell',
  'Osric', 'Petra', 'Quinn', 'Rowena', 'Silas', 'Thea', 'Ulric', 'Vera',
  'Wynn', 'Xara', 'Yoren', 'Zelda', 'Bryn', 'Cora',
];

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function emptySkills(): Record<SkillType, number> {
  return { farming: 0, mining: 0, crafting: 0, woodcutting: 0, cooking: 0, herbalism: 0, combat: 0 };
}

function rollStartingSkills(id: number): Record<SkillType, number> {
  const skills = emptySkills();
  const rng = seededRng(id * 3571);
  const numAptitudes = rng() < 0.4 ? 1 : 2;
  const pool = ALL_SKILLS.filter(s => s !== 'combat');
  for (let i = 0; i < numAptitudes && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const skill = pool[idx];
    skills[skill] = 10 + Math.floor(rng() * 21);
    pool.splice(idx, 1);
  }
  return skills;
}

function rollSkillCaps(id: number): Record<SkillType, number> {
  const caps = emptySkills();
  const rng = seededRng(id * 4729);
  for (const s of ALL_SKILLS) {
    caps[s] = 40 + Math.floor(rng() * 61);
  }
  return caps;
}

function rollTraits(id: number): Trait[] {
  const rng = seededRng(id * 7919);
  const numTraits = rng() < 0.3 ? 0 : rng() < 0.5 ? 1 : 2;
  const traits: Trait[] = [];
  const pool = [...ALL_TRAITS];
  for (let i = 0; i < numTraits && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    traits.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return traits;
}

export function createVillager(id: number, x: number, y: number): Villager {
  const skillCaps = rollSkillCaps(id);
  const skills = rollStartingSkills(id);
  for (const s of ALL_SKILLS) {
    if (skills[s] > skillCaps[s]) skills[s] = skillCaps[s];
  }
  const traits = rollTraits(id);
  const baseHp = 10;
  const maxHp = baseHp + (traits.includes('tough') ? TOUGH_HP_BONUS : 0);
  const ageRange = MAX_VILLAGER_AGE - MIN_VILLAGER_AGE;
  const age = MIN_VILLAGER_AGE + ((id * 17 + 11) % (ageRange + 1));
  return {
    id: `v${id}`,
    name: VILLAGER_NAMES[(id - 1) % VILLAGER_NAMES.length],
    x, y, role: 'idle', jobBuildingId: null, homeBuildingId: null,
    state: 'idle', food: 8, homeless: 0,
    skills, skillCaps, traits, morale: 50, lastAte: 'nothing',
    tool: 'none', toolDurability: 0,
    weapon: 'none', weaponDurability: 0,
    armor: 'none', armorDurability: 0,
    scoutDirection: null, scoutTicksLeft: 0,
    hp: maxHp, maxHp,
    path: [], pathIndex: 0,
    carrying: {}, carryTotal: 0,
    workProgress: 0,
    haulingToWork: false,
    patrolRoute: [],
    patrolIndex: 0,
    guardMode: 'patrol' as GuardMode,
    guardLine: 'front' as GuardLine,
    clothed: false,
    clothingDurability: 0,
    recentMeals: [],
    tavernVisitCooldown: 0,
    sick: false,
    sickDays: 0,
    family: [],
    grief: 0,
    assaultTargetId: null,
    preferredJob: null,
    jobPriorities: {},
    supplyRouteId: null,
    previousRole: null,
    expeditionId: null,
    friends: [],
    coworkDays: {},
    age,
  };
}
