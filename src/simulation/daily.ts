// daily.ts — Day-start checks: morale, housing, clothing, hunger, immigration, auto-assign

import {
  Villager, Building, Resources, ResourceType, BuildingType,
  createVillager, SPOILAGE, FOOD_PRIORITY, BUILDING_TEMPLATES,
  BUILDING_SKILL_MAP, DECORATION_MORALE,
  Season, WeatherType,
  SEASON_MORALE, WEATHER_MORALE, HOUSING_INFO, HOUSING_COMFORT,
  COMFORT_MORALE, FURNITURE_COMFORT_PER_UNIT, FURNITURE_COMFORT_CAP,
  FoodEaten, TICKS_PER_DAY,
  RENOWN_PER_RECRUIT, FREE_SETTLERS,
  CONSTRUCTION_POINT_PER_IMMIGRANT,
  CLOTHING_DURABILITY,
  CHURCH_MORALE_RANGE, DECORATION_RANGE,
  DISEASE_HP_LOSS_PER_DAY,
  GUARD_BASE_HP, GUARD_MORALE_HP_DIVISOR, ARMOR_BONUS_HP,
  VILLAGER_BASE_HP, HP_REGEN_PER_DAY, MEDICINE_REGEN_BONUS,
  FESTIVAL_MORALE_BOOST, FESTIVAL_DURATION,
  FRIENDSHIP_COWORK_THRESHOLD, FRIENDSHIP_MORALE_BONUS,
  FRIENDSHIP_GRIEF_DAYS, FRIENDSHIP_GRIEF_PENALTY, MAX_FRIENDS,
} from '../world.js';
import {
  TickState, findHome, autoEquipTool, autoEquipWeapon, autoEquipArmor, getBuildingEntrance,
  addResource, addToBuffer, findStorehouseWithResource, hasTech, isStorehouse,
  roleForBuilding, deductFromBuffer, deductFromStorehouseAndGlobal,
} from './helpers.js';
import { planPath } from './movement.js';

// New settlement optimism: +20 morale fading to 0 over 40 days (like RimWorld)
const NEW_SETTLEMENT_OPTIMISM_DAYS = 40;
const NEW_SETTLEMENT_OPTIMISM_MAX = 20;

function calculateMorale(v: Villager, housingMorale: number, season: Season, weather: WeatherType, familyNearby: boolean, churchNearby: boolean, decorationBonus: number, day: number, festivalActive: boolean, friendsAlive: number): number {
  let morale = 50;
  morale += housingMorale;
  switch (v.lastAte) {
    case 'bread': morale += 10; break;
    case 'flour': morale += 5; break;
    case 'wheat': case 'food': break;
    case 'nothing': if (v.food <= 0) morale -= 20; break;
  }
  if (v.traits.includes('cheerful')) morale += 10;
  if (v.traits.includes('gloomy')) morale -= 10;
  morale += SEASON_MORALE[season];
  morale += WEATHER_MORALE[weather];
  // New settlement optimism — fades linearly over 40 days
  morale += Math.max(0, NEW_SETTLEMENT_OPTIMISM_MAX - Math.floor(day / 2));
  // Clothing: unclothed in winter = severe penalty
  if (season === 'winter' && !v.clothed) morale -= 15;
  // Grief penalty
  if (v.grief > 0) morale -= 15;
  // Family proximity bonus
  if (familyNearby) morale += 10;
  // Friendship bonus
  morale += friendsAlive * FRIENDSHIP_MORALE_BONUS;
  // Church bonus (passed in)
  if (churchNearby) morale += 10;
  // Decoration bonus (garden, fountain, statue near home)
  morale += decorationBonus;
  // Food variety bonus — unique food types in recent meals
  const uniqueFoods = new Set(v.recentMeals.filter(m => m !== 'nothing'));
  if (uniqueFoods.size >= 3) morale += 10;
  else if (uniqueFoods.size >= 2) morale += 5;
  // Festival boost
  if (festivalActive) morale += FESTIVAL_MORALE_BOOST;
  return Math.max(0, Math.min(100, morale));
}

export function processDailyChecks(ts: TickState): void {
  // Auto-assign homeless
  for (const v of ts.villagers) {
    if (!v.homeBuildingId) {
      const homeId = findHome(ts.buildings, ts.villagers);
      if (homeId) v.homeBuildingId = homeId;
    }
  }

  // Tavern visit cooldown — decrement daily
  for (const v of ts.villagers) {
    if (v.tavernVisitCooldown > 0) v.tavernVisitCooldown -= 1;
  }

  // Grief countdown — decrement daily
  for (const v of ts.villagers) {
    if (v.grief > 0) v.grief -= 1;
  }

  // Clothing durability — decrement daily, unclothed when worn out
  for (const v of ts.villagers) {
    if (v.clothed) {
      v.clothingDurability -= 1;
      if (v.clothingDurability <= 0) {
        v.clothed = false;
        v.clothingDurability = 0;
      }
    }
  }

  // Clothing equip — try to clothe unclothed villagers from storehouse linen/leather
  for (const v of ts.villagers) {
    if (!v.clothed) {
      for (const mat of ['linen', 'leather'] as const) {
        const sh = findStorehouseWithResource(ts.buildings, mat);
        if (sh && ts.resources[mat] > 0) {
          deductFromStorehouseAndGlobal(sh.localBuffer, ts.resources, mat, 1);
          v.clothed = true;
          v.clothingDurability = CLOTHING_DURABILITY;
          break;
        }
      }
    }
  }

  // Festival active check
  const festivalActive = ts.newDay - ts.lastFestivalDay < FESTIVAL_DURATION && ts.lastFestivalDay >= 0;

  // Calculate morale
  for (const v of ts.villagers) {
    let housingMorale = 0;
    const home = v.homeBuildingId ? ts.buildingMap.get(v.homeBuildingId) : undefined;
    if (home) housingMorale = HOUSING_INFO[home.type]?.morale ?? 0;
    // Check if any family member shares the same home
    const familyNearby = v.family.length > 0 && v.homeBuildingId !== null &&
      ts.villagers.some(other => other.id !== v.id && v.family.includes(other.id) && other.homeBuildingId === v.homeBuildingId);
    // Check if a constructed church is within 5 tiles of the villager's home
    let churchNearby = false;
    if (home) {
      churchNearby = ts.buildings.some(b =>
        b.type === 'church' && b.constructed &&
        Math.abs(b.x - home.x) + Math.abs(b.y - home.y) <= CHURCH_MORALE_RANGE
      );
    }
    // Decoration bonus — sum of unique decoration types within 5 tiles of home
    let decorationBonus = 0;
    if (home) {
      const seen = new Set<BuildingType>();
      for (const b of ts.buildings) {
        const bonus = DECORATION_MORALE[b.type];
        if (!bonus || !b.constructed || seen.has(b.type)) continue;
        if (Math.abs(b.x - home.x) + Math.abs(b.y - home.y) <= DECORATION_RANGE) {
          decorationBonus += bonus;
          seen.add(b.type);
        }
      }
    }
    // Comfort bonus — based on housing type + furniture in storehouses
    let comfortBonus = 0;
    if (home) {
      const baseComfort = HOUSING_COMFORT[home.type] || 0;
      const furnitureInStorage = ts.resources.furniture || 0;
      const furnitureBonus = Math.min(furnitureInStorage > 0 ? FURNITURE_COMFORT_PER_UNIT : 0, FURNITURE_COMFORT_CAP);
      const totalComfort = Math.min(baseComfort + furnitureBonus, 4);
      comfortBonus = COMFORT_MORALE[totalComfort] ?? COMFORT_MORALE[3] ?? 10;
    }
    // Count living friends
    const friendsAlive = v.friends.filter(fid => ts.villagers.some(other => other.id === fid)).length;
    v.morale = calculateMorale(v, housingMorale + comfortBonus, ts.season, ts.weather, familyNearby, churchNearby, decorationBonus, ts.newDay, festivalActive, friendsAlive);
  }

  // Reset lastAte AFTER morale calculation — so yesterday's meals influence today's morale
  for (const v of ts.villagers) {
    v.lastAte = 'nothing' as FoodEaten;
  }

  // Housing check
  for (const v of ts.villagers) {
    v.homeless = v.homeBuildingId ? 0 : v.homeless + 1;
  }

  // Training ground: guards assigned there gain combat XP daily
  for (const b of ts.buildings) {
    if (b.type !== 'training_ground' || !b.constructed) continue;
    for (const wid of b.assignedWorkers) {
      const guard = ts.villagers.find(v => v.id === wid && v.role === 'guard');
      if (guard) {
        let xp = 2;
        if (guard.traits.includes('fast_learner')) xp = Math.ceil(xp * 1.5);
        const combatCap = guard.skillCaps?.combat ?? 100;
        guard.skills.combat = Math.min(combatCap, guard.skills.combat + xp);
      }
    }
  }

  // Building maintenance decay — 1 HP every 5 days for constructed buildings
  // Exempt: walls, fences, gates, rubble, roads, unconstructed
  const DECAY_EXEMPT: Set<string> = new Set(['wall', 'reinforced_wall', 'fence', 'gate', 'rubble', 'road']);
  if (ts.newDay % 5 === 0) {
    for (const b of ts.buildings) {
      if (!b.constructed || DECAY_EXEMPT.has(b.type) || b.hp <= 0) continue;
      b.hp = Math.max(1, b.hp - 1); // Never decay below 1 HP (rubble happens only from combat)
    }
  }

  // Spoilage — applies to storehouse buffers and global pool
  // Food cellar halves spoilage rate when constructed
  const hasFoodCellar = ts.buildings.some(b => b.type === 'food_cellar' && b.constructed);
  const spoilageMultiplier = hasFoodCellar ? 0.5 : 1;
  for (const [res, baseRate] of Object.entries(SPOILAGE)) {
    const key = res as ResourceType;
    const rate = (baseRate as number) * spoilageMultiplier;
    const loss = Math.floor(ts.resources[key] * rate);
    ts.resources[key] = Math.max(0, ts.resources[key] - loss);
    // Also spoil in storehouse buffers
    for (const b of ts.buildings) {
      if (isStorehouse(b.type) && b.constructed) {
        const bufAmt = b.localBuffer[key] || 0;
        if (bufAmt > 0) {
          const bufLoss = Math.floor(bufAmt * rate);
          deductFromBuffer(b.localBuffer, key, bufLoss);
        }
      }
    }
  }

  // Death from HP=0 (disease, combat overflow, etc.)
  const dead = ts.villagers.filter(v => v.hp <= 0);
  for (const d of dead) {
    for (const b of ts.buildings) b.assignedWorkers = b.assignedWorkers.filter(id => id !== d.id);
    // Apply grief to family members
    for (const other of ts.villagers) {
      if (other.family.includes(d.id)) {
        other.grief = 5; // 5 days of grief
        other.family = other.family.filter(id => id !== d.id);
      }
    }
    // Determine cause of death
    const cause = d.sick ? 'disease' : d.state === 'assaulting_camp' ? 'assault' : 'combat';
    ts.events.push(`${d.name} has died (${cause}).`);
    // Record in graveyard
    ts.graveyard.push({ name: d.name, day: ts.newDay });
  }
  ts.villagers = ts.villagers.filter(v => v.hp > 0);

  // Departure — food<=0 OR homeless>=5 OR morale<=10
  const departing = ts.villagers.filter(v => v.food <= 0 || v.homeless >= 5 || v.morale <= 10);
  for (const d of departing) {
    const reasons: string[] = [];
    if (d.food <= 0) reasons.push(`food=${d.food}`);
    if (d.homeless >= 5) reasons.push(`homeless=${d.homeless}`);
    if (d.morale <= 10) reasons.push(`morale=${d.morale}`);
    ts.events.push(`${d.name} departs (${reasons.join(', ')})`);
    for (const b of ts.buildings) b.assignedWorkers = b.assignedWorkers.filter(id => id !== d.id);
    // Apply grief to family members when someone leaves
    for (const other of ts.villagers) {
      if (other.family.includes(d.id)) {
        other.grief = 3; // 3 days of grief for departure (less than death)
        other.family = other.family.filter(id => id !== d.id);
      }
    }
  }
  ts.villagers = ts.villagers.filter(v => v.food > 0 && v.homeless < 5 && v.morale > 10);

  // Auto-assign idle villagers to understaffed buildings (Bellwright-style auto-fill)
  // Two-pass approach: breadth-first (1 worker per building), then depth (fill to max)
  // This ensures diverse staffing before any building gets extra workers.
  // Reserve at least 1 idle villager for construction if there are unconstructed buildings
  const unconstructedSites = ts.buildings.filter(b => !b.constructed && b.type !== 'rubble').length;
  const minIdleReserve = unconstructedSites > 0 ? 1 : 0;
  const autoAssignOrder: BuildingType[] = [
    'farm', 'large_farm', 'bakery', 'kitchen', 'mill', 'windmill',
    'woodcutter', 'lumber_mill', 'quarry', 'deep_quarry',
    'tanner', 'sawmill', 'smelter', 'advanced_smelter',
    'research_desk', 'hemp_field', 'ropemaker', 'fletcher', 'weaponsmith',
    'foraging_hut', 'fishing_hut', 'chicken_coop', 'livestock_barn', 'apiary',
  ];

  const pickBestIdle = (type: BuildingType, candidates: Villager[]): Villager => {
    const skill = BUILDING_SKILL_MAP[type];
    let best = candidates[0];
    if (skill) {
      for (const v of candidates) {
        if (v.skills[skill] > best.skills[skill]) best = v;
      }
    }
    return best;
  };

  const doAssign = (b: Building, type: BuildingType, v: Villager): void => {
    v.role = roleForBuilding(type);
    v.jobBuildingId = b.id;
    v.state = 'idle';
    b.assignedWorkers.push(v.id);
  };

  const assignOneIdle = (b: Building, type: BuildingType): boolean => {
    // Filter out villagers who have this job type disabled (priority 0)
    const idleVillagers = ts.villagers.filter(v =>
      v.role === 'idle' && v.hp > 0 && v.jobPriorities[type] !== 0
    );
    if (idleVillagers.length <= minIdleReserve) return false;
    // Prefer villagers whose preferredJob matches this building type
    const preferred = idleVillagers.filter(v => v.preferredJob === type);
    const best = preferred.length > 0
      ? pickBestIdle(type, preferred)
      : pickBestIdle(type, idleVillagers);
    doAssign(b, type, best);
    return true;
  };

  // Pass -1: Assign villagers with explicit jobPriorities to their highest-priority building
  for (const v of ts.villagers) {
    if (v.role !== 'idle' || v.hp <= 0) continue;
    const priorities = Object.entries(v.jobPriorities)
      .filter(([_, p]) => p > 0) // Skip disabled (0) entries
      .sort(([, a], [, b]) => a - b); // Sort by priority (1=highest)
    if (priorities.length === 0) continue;
    const idleCount = ts.villagers.filter(vv => vv.role === 'idle' && vv.hp > 0).length;
    if (idleCount <= minIdleReserve) break;
    for (const [type] of priorities) {
      const building = ts.buildings.find(b =>
        b.type === type && b.constructed && b.type !== 'rubble' &&
        b.assignedWorkers.length < (BUILDING_TEMPLATES[type as BuildingType]?.maxWorkers || 0)
      );
      if (building) {
        doAssign(building, type as BuildingType, v);
        break;
      }
    }
  }

  // Pass 0: Assign villagers with preferred jobs to matching buildings (highest priority)
  for (const type of autoAssignOrder) {
    for (const b of ts.buildings) {
      if (b.type !== type || !b.constructed || b.type === 'rubble') continue;
      const maxW = BUILDING_TEMPLATES[type].maxWorkers;
      if (maxW === 0 || b.assignedWorkers.length >= maxW) continue;
      // Only assign preferred villagers in this pass
      const preferred = ts.villagers.filter(v => v.role === 'idle' && v.hp > 0 && v.preferredJob === type);
      if (preferred.length === 0) continue;
      const idleCount = ts.villagers.filter(v => v.role === 'idle' && v.hp > 0).length;
      if (idleCount <= minIdleReserve) break;
      const best = pickBestIdle(type, preferred);
      doAssign(b, type, best);
    }
  }

  // Pass 1: Ensure every building has at least 1 worker (breadth-first)
  for (const type of autoAssignOrder) {
    for (const b of ts.buildings) {
      if (b.type !== type || !b.constructed || b.type === 'rubble') continue;
      const maxW = BUILDING_TEMPLATES[type].maxWorkers;
      if (maxW === 0 || b.assignedWorkers.length > 0) continue;
      if (!assignOneIdle(b, type)) break;
    }
  }

  // Pass 2: Fill buildings to max capacity (depth)
  for (const type of autoAssignOrder) {
    for (const b of ts.buildings) {
      if (b.type !== type || !b.constructed || b.type === 'rubble') continue;
      const maxW = BUILDING_TEMPLATES[type].maxWorkers;
      if (maxW === 0 || b.assignedWorkers.length >= maxW) continue;
      while (b.assignedWorkers.length < maxW) {
        if (!assignOneIdle(b, type)) break;
      }
    }
  }

  // Friendship formation — track cowork days and form friendships
  // Build a map of building → assigned workers
  const coworkerMap = new Map<string, string[]>();
  for (const b of ts.buildings) {
    if (!b.constructed || b.assignedWorkers.length < 2) continue;
    coworkerMap.set(b.id, [...b.assignedWorkers]);
  }
  for (const [, workerIds] of coworkerMap) {
    for (let i = 0; i < workerIds.length; i++) {
      for (let j = i + 1; j < workerIds.length; j++) {
        const v1 = ts.villagers.find(v => v.id === workerIds[i]);
        const v2 = ts.villagers.find(v => v.id === workerIds[j]);
        if (!v1 || !v2) continue;
        // Increment cowork days
        v1.coworkDays[v2.id] = (v1.coworkDays[v2.id] || 0) + 1;
        v2.coworkDays[v1.id] = (v2.coworkDays[v1.id] || 0) + 1;
        // Form friendship at threshold
        if (v1.coworkDays[v2.id] >= FRIENDSHIP_COWORK_THRESHOLD) {
          if (v1.friends.length < MAX_FRIENDS && !v1.friends.includes(v2.id)) {
            v1.friends.push(v2.id);
          }
          if (v2.friends.length < MAX_FRIENDS && !v2.friends.includes(v1.id)) {
            v2.friends.push(v1.id);
          }
        }
      }
    }
  }

  // Hunger decay — AFTER departure check so villagers get one more dawn to eat.
  // Departure uses yesterday's food level. Decay applies for today. Eating at dawn (tick 30) restores food.
  // Note: lastAte is NOT reset here — it's reset AFTER morale calculation
  // so that yesterday's meals correctly influence today's morale.
  for (const v of ts.villagers) {
    const isGlutton = v.traits.includes('glutton');
    const isFrugal = v.traits.includes('frugal');
    const decay = isGlutton ? 2 : (isFrugal ? 0.5 : 1);
    v.food = Math.max(0, v.food - decay);
  }

  // Immigration — new villagers arrive at map edge and walk home
  // Requires: food in storehouse + renown (after first FREE_SETTLERS villagers)
  let storehouseEdible = 0;
  for (const b of ts.buildings) {
    if (!isStorehouse(b.type) || !b.constructed) continue;
    for (const { resource } of FOOD_PRIORITY) {
      storehouseEdible += (b.localBuffer[resource] || 0);
    }
  }
  const totalRecruits = ts.villagers.length;
  const renownCost = totalRecruits >= FREE_SETTLERS ? RENOWN_PER_RECRUIT : 0;
  if (storehouseEdible > ts.villagers.length * 3 && ts.renown >= renownCost) {
    const emptyHome = findHome(ts.buildings, ts.villagers);
    if (emptyHome) {
      const home = ts.buildingMap.get(emptyHome)!;
      const entrance = getBuildingEntrance(home);
      // Spawn at map edge (south or west)
      const edgeX = ts.newDay % 2 === 0 ? 0 : Math.min(ts.width - 1, entrance.x);
      const edgeY = ts.newDay % 2 === 0 ? entrance.y : ts.height - 1;
      const newV = createVillager(ts.nextVillagerId, edgeX, edgeY);
      newV.homeBuildingId = emptyHome;
      // 20% chance new settler has family bond with existing villager
      const famRng = ((ts.newDay * 48271 + ts.nextVillagerId * 16807) & 0x7fffffff) / 0x7fffffff;
      if (famRng < 0.20 && ts.villagers.length > 0) {
        const partner = ts.villagers[ts.nextVillagerId % ts.villagers.length];
        newV.family = [partner.id];
        partner.family = [...partner.family, newV.id];
      }
      // Walk home instead of spawning at home
      planPath(newV, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
      newV.state = 'traveling_home';
      ts.villagers.push(newV);
      ts.nextVillagerId++;
      ts.renown -= renownCost;
      ts.constructionPoints += CONSTRUCTION_POINT_PER_IMMIGRANT;
      ts.events.push(`A new settler, ${newV.name}, arrives!`);
    }
  }

  // Guard equip tools and weapons
  for (const v of ts.villagers) {
    if (v.role === 'guard' && v.tool === 'none') autoEquipTool(v, ts.resources, ts.toolDurBonus, ts.buildings);
    if (v.role === 'guard' && v.weapon === 'none') autoEquipWeapon(v, ts.resources, ts.buildings);
    if (v.role === 'guard' && v.armor === 'none') autoEquipArmor(v, ts.resources, ts.buildings);
  }

  // Disease daily: HP loss and duration countdown (after regen, so net effect is visible)
  // Note: placed before regen so the -2 HP is offset by +2 regen = net 0,
  // but we want net negative, so use 3 HP loss
  for (const v of ts.villagers) {
    if (v.sick) {
      v.hp = Math.max(1, v.hp - DISEASE_HP_LOSS_PER_DAY);
      v.sickDays -= 1;
      if (v.sickDays <= 0) {
        v.sick = false;
        v.sickDays = 0;
      }
    }
  }

  // Bandit ultimatum countdown
  if (ts.banditUltimatum) {
    ts.banditUltimatum.daysLeft -= 1;
    if (ts.banditUltimatum.daysLeft <= 0) {
      // Ultimatum expired — trigger raid
      ts.raidBar = Math.min(100, ts.raidBar + 60);
      ts.events.push('The bandits have lost patience! A raid is imminent!');
      ts.banditUltimatum = null;
    }
  }

  // HP regen (2 HP per day)
  for (const v of ts.villagers) {
    if (v.role === 'guard') {
      const armorBonus = hasTech(ts.research, 'armored_guards') ? ARMOR_BONUS_HP : 0;
      v.maxHp = GUARD_BASE_HP + Math.floor(v.morale / GUARD_MORALE_HP_DIVISOR) + armorBonus;
    } else {
      v.maxHp = VILLAGER_BASE_HP;
    }
    const regenBonus = hasTech(ts.research, 'medicine') ? MEDICINE_REGEN_BONUS : 0;
    if (v.hp < v.maxHp) v.hp = Math.min(v.maxHp, v.hp + HP_REGEN_PER_DAY + regenBonus);
    v.hp = Math.min(v.hp, v.maxHp);
  }

  // Winter cold damage — after regen so effect is observable
  if (ts.season === 'winter') {
    for (const v of ts.villagers) {
      if (!v.clothed) v.hp = Math.max(0, v.hp - 1);
    }
  }

  // Late death cleanup — catch villagers killed by cold damage (above)
  // Cold can reduce HP to 0 after the main death check ran earlier.
  const lateDead = ts.villagers.filter(v => v.hp <= 0);
  if (lateDead.length > 0) {
    for (const d of lateDead) {
      for (const b of ts.buildings) b.assignedWorkers = b.assignedWorkers.filter(id => id !== d.id);
      for (const other of ts.villagers) {
        if (other.family.includes(d.id)) {
          other.grief = 5;
          other.family = other.family.filter(id => id !== d.id);
        }
      }
      ts.events.push(`${d.name} has died (cold).`);
      ts.graveyard.push({ name: d.name, day: ts.newDay });
    }
    ts.villagers = ts.villagers.filter(v => v.hp > 0);
  }
}
