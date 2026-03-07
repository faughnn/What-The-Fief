// world/types.ts — All type and interface definitions. No runtime values.

// --- Seasons & Weather ---
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherType = 'clear' | 'rain' | 'storm';

export interface SeasonalEvent {
  name: string;
  moraleBonus: number;
  foodThreshold?: number;
  message: string;
}

// --- Terrain ---
export type Terrain = 'grass' | 'forest' | 'water' | 'stone' | 'hill';
export type Deposit = 'iron' | 'fertile' | 'herbs' | null;

export interface Tile {
  terrain: Terrain;
  building: Building | null;
  deposit: Deposit;
}

// --- Building ---
export type BuildingType =
  | 'house' | 'tent' | 'cottage' | 'manor' | 'farm' | 'woodcutter' | 'quarry' | 'storehouse'
  | 'herb_garden' | 'flax_field' | 'hemp_field' | 'iron_mine' | 'barley_field' | 'vegetable_garden'
  | 'sawmill' | 'smelter' | 'mill' | 'bakery' | 'tanner' | 'weaver' | 'ropemaker'
  | 'blacksmith' | 'toolmaker' | 'armorer' | 'coal_burner' | 'carpenter'
  | 'town_hall' | 'wall' | 'fence'
  | 'research_desk'
  | 'chicken_coop' | 'livestock_barn' | 'apiary' | 'marketplace' | 'hunting_lodge' | 'foraging_hut' | 'fishing_hut'
  | 'gate'
  | 'watchtower'
  | 'tavern'
  | 'well'
  | 'church'
  | 'graveyard'
  | 'rubble'
  | 'large_farm' | 'lumber_mill' | 'deep_quarry'
  | 'advanced_smelter' | 'windmill' | 'kitchen'
  | 'large_storehouse'
  | 'inn'
  | 'weaponsmith' | 'fletcher' | 'leather_workshop'
  | 'mint'
  | 'garden' | 'fountain' | 'statue'
  | 'outpost'
  | 'water_collector'
  | 'butchery' | 'compost_pile' | 'drying_rack' | 'smoking_rack'
  | 'food_cellar'
  | 'reinforced_wall'
  | 'barracks' | 'training_ground' | 'spike_trap' | 'weapon_rack'
  | 'forester'
  | 'road'
  | 'apothecary'
  | 'library'
  | 'foraging_lodge'
  | 'village_hall'
  | 'stonemason'
  | 'trappers_camp'
  | 'brewery'
  | 'guard_tower' | 'logging_camp'
  | 'river_dock';

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedWorkers: string[];
  hp: number;
  maxHp: number;
  constructed: boolean;
  constructionProgress: number;
  constructionRequired: number;
  localBuffer: Partial<Record<ResourceType, number>>;
  bufferCapacity: number;
  onFire: boolean;
}

// --- Resources ---
export type ResourceType =
  | 'wood' | 'stone' | 'food' | 'wheat' | 'fish' | 'iron_ore' | 'herbs' | 'flax' | 'hemp'
  | 'planks' | 'charcoal' | 'ingots' | 'flour' | 'bread' | 'leather' | 'linen' | 'rope'
  | 'basic_tools' | 'sturdy_tools' | 'iron_tools'
  | 'sword' | 'bow'
  | 'furniture' | 'water' | 'meat' | 'fertilizer' | 'dried_food' | 'smoked_food'
  | 'leather_armor' | 'iron_armor'
  | 'bandage'
  | 'gold'
  | 'stone_blocks'
  | 'barley' | 'vegetables' | 'ale';

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  wheat: number;
  fish: number;
  iron_ore: number;
  herbs: number;
  flax: number;
  hemp: number;
  planks: number;
  charcoal: number;
  ingots: number;
  flour: number;
  bread: number;
  leather: number;
  linen: number;
  rope: number;
  basic_tools: number;
  sturdy_tools: number;
  iron_tools: number;
  sword: number;
  bow: number;
  furniture: number;
  water: number;
  meat: number;
  fertilizer: number;
  dried_food: number;
  smoked_food: number;
  leather_armor: number;
  iron_armor: number;
  bandage: number;
  gold: number;
  stone_blocks: number;
  barley: number;
  vegetables: number;
  ale: number;
}

// --- Production ---
export interface ProductionRule {
  output: ResourceType;
  amountPerWorker: number;
  inputs: Partial<Record<ResourceType, number>> | null;
  byproduct?: { resource: ResourceType; amount: number };
}

export interface BuildingTemplate {
  type: BuildingType;
  width: number;
  height: number;
  allowedTerrain: Terrain[];
  cost: Partial<Resources>;
  description: string;
  maxWorkers: number;
  production: ProductionRule | null;
  mapChar: string;
}

// --- Equipment ---
export type ToolTier = 'none' | 'basic' | 'sturdy' | 'iron';
export type WeaponType = 'none' | 'sword' | 'bow';
export type ArmorType = 'none' | 'leather_armor' | 'iron_armor';

// --- Skills ---
export type SkillType = 'farming' | 'mining' | 'crafting' | 'woodcutting' | 'cooking' | 'herbalism' | 'combat';

// --- Traits ---
export type Trait = 'strong' | 'lazy' | 'skilled_crafter' | 'fast_learner' | 'glutton' | 'frugal' | 'cheerful' | 'gloomy'
  | 'brave' | 'coward' | 'resilient' | 'nimble'
  | 'stalwart' | 'marksman' | 'neurotic' | 'porter' | 'tough'
  | 'defender' | 'fierce' | 'nomad' | 'prodigy' | 'dullard' | 'scholar' | 'swordsman';

// --- Villager ---
export type VillagerRole =
  | 'idle' | 'farmer' | 'woodcutter' | 'quarrier' | 'herbalist'
  | 'flaxer' | 'hemper' | 'miner' | 'sawyer' | 'smelter'
  | 'miller' | 'baker' | 'tanner_worker' | 'weaver_worker' | 'ropemaker_worker'
  | 'blacksmith_worker' | 'toolmaker_worker' | 'armorer_worker' | 'charcoal_burner' | 'carpenter_worker'
  | 'weaponsmith_worker' | 'fletcher_worker' | 'leather_workshop_worker'
  | 'scout' | 'guard' | 'researcher' | 'hunter' | 'forager'
  | 'chicken_keeper' | 'rancher' | 'beekeeper' | 'trader'
  | 'fisher' | 'hauler' | 'militia' | 'well_worker'
  | 'butcher' | 'composter' | 'dryer' | 'smoker' | 'minter'
  | 'forester_worker'
  | 'stonemason_worker' | 'trapper'
  | 'healer'
  | 'barley_farmer' | 'gardener' | 'brewer';

export type VillagerState =
  | 'sleeping'
  | 'traveling_to_work'
  | 'working'
  | 'traveling_to_storage'
  | 'traveling_to_eat'
  | 'eating'
  | 'traveling_home'
  | 'idle'
  | 'scouting'
  | 'traveling_to_build'
  | 'constructing'
  | 'hunting'
  | 'hauling_drop'
  | 'traveling_to_tavern'
  | 'relaxing'
  | 'traveling_to_heal'
  | 'healing'
  | 'assaulting_camp'
  | 'supply_traveling_to_source'
  | 'supply_loading'
  | 'supply_traveling_to_dest'
  | 'supply_unloading'
  | 'on_expedition';

export type FoodEaten = 'bread' | 'flour' | 'wheat' | 'food' | 'nothing';
export type Direction = 'n' | 's' | 'e' | 'w';
export type GuardMode = 'patrol' | 'charge' | 'hold';
export type GuardLine = 'front' | 'back';

export interface Villager {
  id: string;
  name: string;
  x: number;
  y: number;
  role: VillagerRole;
  jobBuildingId: string | null;
  homeBuildingId: string | null;
  state: VillagerState;
  food: number;
  homeless: number;
  skills: Record<SkillType, number>;
  skillCaps: Record<SkillType, number>;
  traits: Trait[];
  morale: number;
  lastAte: FoodEaten;
  tool: ToolTier;
  toolDurability: number;
  weapon: WeaponType;
  weaponDurability: number;
  armor: ArmorType;
  armorDurability: number;
  scoutDirection: Direction | null;
  scoutTicksLeft: number;
  hp: number;
  maxHp: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  carrying: Partial<Record<ResourceType, number>>;
  carryTotal: number;
  workProgress: number;
  haulingToWork: boolean;
  patrolRoute: { x: number; y: number }[];
  patrolIndex: number;
  guardMode: GuardMode;
  guardLine: GuardLine;
  clothed: boolean;
  clothingDurability: number;
  recentMeals: FoodEaten[];
  tavernVisitCooldown: number;
  sick: boolean;
  sickDays: number;
  family: string[];
  grief: number;
  assaultTargetId: string | null;
  preferredJob: BuildingType | null;
  jobPriorities: Partial<Record<BuildingType, number>>;
  supplyRouteId: string | null;
  previousRole: VillagerRole | null;
  expeditionId: string | null;
  friends: string[];
  coworkDays: Record<string, number>;
  age: number;
}

// --- Combat ---
export type EnemyType = 'bandit' | 'bandit_archer' | 'bandit_brute' | 'bandit_warlord' | 'wolf' | 'boar' | 'elite_beast';

export interface Enemy {
  type: EnemyType;
  hp: number;
  attack: number;
  defense: number;
}

export interface ActiveRaid {
  enemies: Enemy[];
  resolved: boolean;
}

export interface LootDrop {
  resource: ResourceType;
  amount: number;
}

export interface BanditCamp {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  strength: number;
  lastRaidDay: number;
  raidInterval: number;
}

export type SiegeType = 'none' | 'battering_ram' | 'siege_tower';

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  range: number;
  siege: SiegeType;
  ticksAlive: number;
}

// --- Animals ---
export type AnimalType = 'deer' | 'rabbit' | 'wild_wolf' | 'wild_boar';

export interface AnimalEntity {
  id: string;
  type: AnimalType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  behavior: 'passive' | 'hostile';
}

export interface AnimalTemplate {
  type: AnimalType;
  maxHp: number;
  attack: number;
  behavior: 'passive' | 'hostile';
  drops: Partial<Record<ResourceType, number>>;
}

export interface ResourceDrop {
  id: string;
  x: number;
  y: number;
  resources: Partial<Record<ResourceType, number>>;
}

// --- Research ---
export type TechId =
  | 'crop_rotation' | 'masonry' | 'herbalism_lore' | 'improved_tools'
  | 'fortification' | 'animal_husbandry' | 'basic_cooking'
  | 'metallurgy' | 'military_tactics' | 'civil_engineering' | 'advanced_farming'
  | 'archery' | 'medicine' | 'trade_routes'
  | 'steel_forging' | 'siege_engineering' | 'master_crafting' | 'armored_guards'
  | 'irrigation' | 'architecture';

export type TechTier = 1 | 2 | 3;

export interface TechDefinition {
  id: TechId;
  name: string;
  tier: TechTier;
  cost: number;
  prerequisites: TechId[];
  description: string;
}

export interface ResearchState {
  completed: TechId[];
  current: TechId | null;
  progress: number;
}

// --- Trade & Economy ---
export interface MerchantState {
  ticksLeft: number;
  x: number;
  y: number;
}

export type TrustRank = 'stranger' | 'associate' | 'friend' | 'protector' | 'leader';

export interface NpcSettlement {
  id: string;
  name: string;
  direction: 'n' | 's' | 'e' | 'w';
  specialty: ResourceType;
  x: number;
  y: number;
  trust: number;
  trustRank: TrustRank;
  liberated: boolean;
  liberationInProgress: boolean;
}

export interface Caravan {
  id: string;
  settlementId: string;
  x: number;
  y: number;
  goods: Partial<Record<ResourceType, number>>;
  ticksLeft: number;
}

export interface SupplyRoute {
  id: string;
  fromBuildingId: string;
  toBuildingId: string;
  resourceType: ResourceType | 'any';
  active: boolean;
}

// --- Quests ---
export interface QuestDefinition {
  id: string;
  name: string;
  desc: string;
  renown: number;
  gold: number;
}

export type DynamicQuestType = 'defend' | 'supply' | 'hunt' | 'rescue' | 'trade';
export type DynamicQuestStatus = 'active' | 'completed' | 'expired';

export interface DynamicQuest {
  id: string;
  type: DynamicQuestType;
  name: string;
  description: string;
  startDay: number;
  deadline: number;
  status: DynamicQuestStatus;
  target?: { x: number; y: number };
  requirements?: Partial<Record<ResourceType, number>>;
  villageId?: string;
  reward: { gold: number; renown: number; trust?: number; villager?: boolean };
  spawnedEntityId?: string;
  raidSpawned?: boolean;
  tradeMultiplier?: number;
}

// --- Exploration ---
export type POIType = 'ruins' | 'resource_cache' | 'animal_den' | 'abandoned_camp' | 'herb_grove';

export interface POIGuardEnemy {
  type: EnemyType;
  count: number;
}

export interface PointOfInterest {
  id: string;
  type: POIType;
  x: number;
  y: number;
  discovered: boolean;
  explored: boolean;
  rewards: Partial<Resources>;
  renownReward: number;
  guardEnemies?: POIGuardEnemy[];
}

export type ExpeditionState = 'traveling_out' | 'exploring' | 'fighting' | 'traveling_back';

export interface Expedition {
  id: string;
  memberIds: string[];
  targetX: number;
  targetY: number;
  homeX: number;
  homeY: number;
  state: ExpeditionState;
  exploreProgress: number;
  exploreTicks: number;
  targetPOIId: string | null;
}

// --- Raids ---
export interface PendingRaidWave {
  campId: string;
  day: number;
  strength: number;
  x: number;
  y: number;
  isReclamation?: boolean;
}

// --- Game State ---
export interface GameState {
  tick: number;
  day: number;
  grid: Tile[][];
  width: number;
  height: number;
  resources: Resources;
  storageCap: number;
  buildings: Building[];
  nextBuildingId: number;
  villagers: Villager[];
  nextVillagerId: number;
  enemies: EnemyEntity[];
  nextEnemyId: number;
  animals: AnimalEntity[];
  nextAnimalId: number;
  resourceDrops: ResourceDrop[];
  nextDropId: number;
  fog: boolean[][];
  territory: boolean[][];
  raidBar: number;
  raidLevel: number;
  activeRaid: ActiveRaid | null;
  research: ResearchState;
  merchant: MerchantState | null;
  merchantTimer: number;
  prosperity: number;
  season: Season;
  weather: WeatherType;
  renown: number;
  events: string[];
  completedQuests: string[];
  banditUltimatum: { goldDemand: number; daysLeft: number } | null;
  graveyard: { name: string; day: number }[];
  npcSettlements: NpcSettlement[];
  caravans: Caravan[];
  banditCamps: BanditCamp[];
  nextCampId: number;
  lastCampSpawnDay: number;
  constructionPoints: number;
  constructionPointsMilestones: number[];
  supplyRoutes: SupplyRoute[];
  nextRouteId: number;
  lastFestivalDay: number;
  callToArms: boolean;
  pointsOfInterest: PointOfInterest[];
  expeditions: Expedition[];
  nextExpeditionId: number;
  dynamicQuests: DynamicQuest[];
  lastDynamicQuestDay: number;
  nextDynamicQuestId: number;
  victory: boolean;
  pendingRaidWaves: PendingRaidWave[];
  forceNightRaid: boolean;
  lastLiberationDay: number;
}
