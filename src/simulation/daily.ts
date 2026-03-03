// daily.ts — Day-start checks, season/weather, merchant, prosperity, events/quests

import {
  Villager, Building, Resources, ResourceType,
  createVillager, SPOILAGE, FOOD_PRIORITY,
  Season, WeatherType, SEASON_NAMES,
  SEASON_MORALE, WEATHER_MORALE, HOUSING_INFO,
  FoodEaten, TICKS_PER_DAY, ALL_RESOURCES,
  MerchantState,
} from '../world.js';
import {
  TickState, findHome, autoEquipTool, getBuildingEntrance,
  addResource, revealArea, hasTech,
} from './helpers.js';
import { findPath, planPath } from './movement.js';

function calculateMorale(v: Villager, housingMorale: number, season: Season, weather: WeatherType): number {
  let morale = 50;
  morale += housingMorale;
  switch (v.lastAte) {
    case 'bread': morale += 10; break;
    case 'flour': morale += 5; break;
    case 'wheat': case 'food': break;
    case 'nothing': morale -= 20; break;
  }
  if (v.traits.includes('cheerful')) morale += 10;
  if (v.traits.includes('gloomy')) morale -= 10;
  morale += SEASON_MORALE[season];
  morale += WEATHER_MORALE[weather];
  // Clothing: unclothed in winter = severe penalty
  if (season === 'winter' && !v.clothed) morale -= 15;
  // Food variety bonus — unique food types in recent meals
  const uniqueFoods = new Set(v.recentMeals.filter(m => m !== 'nothing'));
  if (uniqueFoods.size >= 3) morale += 10;
  else if (uniqueFoods.size >= 2) morale += 5;
  return Math.max(0, Math.min(100, morale));
}

export function processSeasonAndWeather(ts: TickState): void {
  ts.season = SEASON_NAMES[Math.floor((ts.newDay % 40) / 10)];
  const weatherRng = ((ts.newDay * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
  const weatherThresholds: Record<Season, [number, number]> = {
    spring: [0.6, 0.9], summer: [0.7, 0.9], autumn: [0.4, 0.8], winter: [0.5, 0.8],
  };
  const [clearThresh, rainThresh] = weatherThresholds[ts.season];
  ts.weather = weatherRng < clearThresh ? 'clear' : weatherRng < rainThresh ? 'rain' : 'storm';
}

export function processDailyChecks(ts: TickState): void {
  // Auto-assign homeless
  for (const v of ts.villagers) {
    if (!v.homeBuildingId) {
      const homeId = findHome(ts.buildings, ts.villagers);
      if (homeId) v.homeBuildingId = homeId;
    }
  }

  // Hunger decay — villagers get hungrier each day (eating is now physical)
  for (const v of ts.villagers) {
    const isGlutton = v.traits.includes('glutton');
    const isFrugal = v.traits.includes('frugal');
    const decay = isGlutton ? 2 : (isFrugal ? 0.5 : 1);
    v.food = Math.max(0, v.food - decay);
    v.lastAte = 'nothing' as FoodEaten;
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
      for (const b of ts.buildings) {
        if (b.type !== 'storehouse' || !b.constructed) continue;
        // Prefer linen, fall back to leather
        for (const mat of ['linen', 'leather'] as const) {
          if ((b.localBuffer[mat] || 0) > 0 && ts.resources[mat] > 0) {
            b.localBuffer[mat] = (b.localBuffer[mat] || 0) - 1;
            if ((b.localBuffer[mat] || 0) <= 0) delete b.localBuffer[mat];
            ts.resources[mat] -= 1;
            v.clothed = true;
            v.clothingDurability = 10;
            break;
          }
        }
        if (v.clothed) break;
      }
    }
  }

  // Calculate morale
  for (const v of ts.villagers) {
    let housingMorale = 0;
    if (v.homeBuildingId) {
      const home = ts.buildings.find(b => b.id === v.homeBuildingId);
      if (home) housingMorale = HOUSING_INFO[home.type]?.morale ?? 0;
    }
    v.morale = calculateMorale(v, housingMorale, ts.season, ts.weather);
  }

  // Housing check
  for (const v of ts.villagers) {
    v.homeless = v.homeBuildingId ? 0 : v.homeless + 1;
  }

  // Spoilage — applies to storehouse buffers and global pool
  for (const [res, rate] of Object.entries(SPOILAGE)) {
    const key = res as ResourceType;
    const loss = Math.floor(ts.resources[key] * (rate as number));
    ts.resources[key] = Math.max(0, ts.resources[key] - loss);
    // Also spoil in storehouse buffers
    for (const b of ts.buildings) {
      if (b.type === 'storehouse' && b.constructed) {
        const bufAmt = b.localBuffer[key] || 0;
        if (bufAmt > 0) {
          const bufLoss = Math.floor(bufAmt * (rate as number));
          b.localBuffer[key] = Math.max(0, bufAmt - bufLoss);
          if ((b.localBuffer[key] || 0) <= 0) delete b.localBuffer[key];
        }
      }
    }
  }

  // Departure — food<=0 OR homeless>=5 OR morale<=10
  const departing = ts.villagers.filter(v => v.food <= 0 || v.homeless >= 5 || v.morale <= 10);
  for (const d of departing) {
    for (const b of ts.buildings) b.assignedWorkers = b.assignedWorkers.filter(id => id !== d.id);
  }
  ts.villagers = ts.villagers.filter(v => v.food > 0 && v.homeless < 5 && v.morale > 10);

  // Immigration — new villagers arrive at map edge and walk home
  let totalEdible = 0;
  for (const { resource } of FOOD_PRIORITY) totalEdible += ts.resources[resource];
  if (totalEdible > ts.villagers.length * 3) {
    const emptyHome = findHome(ts.buildings, ts.villagers);
    if (emptyHome) {
      const home = ts.buildings.find(b => b.id === emptyHome)!;
      const entrance = getBuildingEntrance(home);
      // Spawn at map edge (south or west)
      const edgeX = ts.newDay % 2 === 0 ? 0 : Math.min(ts.width - 1, entrance.x);
      const edgeY = ts.newDay % 2 === 0 ? entrance.y : ts.height - 1;
      const newV = createVillager(ts.nextVillagerId, edgeX, edgeY);
      newV.homeBuildingId = emptyHome;
      // Walk home instead of spawning at home
      planPath(newV, ts.grid, ts.width, ts.height, entrance.x, entrance.y);
      newV.state = 'traveling_home';
      ts.villagers.push(newV);
      ts.events.push(`A new settler, ${newV.name}, arrives!`);
    }
  }

  // Guard equip tools
  for (const v of ts.villagers) {
    if (v.role === 'guard' && v.tool === 'none') autoEquipTool(v, ts.resources, ts.toolDurBonus, ts.buildings);
  }

  // HP regen (2 HP per day)
  for (const v of ts.villagers) {
    if (v.role === 'guard') {
      v.maxHp = 15 + Math.floor(v.morale / 10);
    } else {
      v.maxHp = 10;
    }
    if (v.hp < v.maxHp) v.hp = Math.min(v.maxHp, v.hp + 2);
    v.hp = Math.min(v.hp, v.maxHp);
  }

  // Winter cold damage — after regen so effect is observable
  if (ts.season === 'winter') {
    for (const v of ts.villagers) {
      if (!v.clothed) v.hp = Math.max(0, v.hp - 1);
    }
  }
}

export function processMerchant(ts: TickState): void {
  if (ts.isNewDay) {
    const marketplace = ts.buildings.find(b => b.type === 'marketplace' && b.constructed);
    if (ts.merchant) {
      ts.merchant.ticksLeft -= 1;
      if (ts.merchant.ticksLeft <= 0) ts.merchant = null;
    }
    if (!ts.merchant && marketplace) {
      ts.merchantTimer -= 1;
      if (ts.merchantTimer <= 0) {
        // Spawn merchant at map edge, heading toward marketplace
        const edge = ts.newDay % 2 === 0 ? 0 : ts.width - 1;
        ts.merchant = { ticksLeft: TICKS_PER_DAY * 3, x: edge, y: marketplace.y };
        ts.merchantTimer = 15;
        ts.events.push(`A merchant arrives from the ${edge === 0 ? 'west' : 'east'}!`);
      }
    }
  }
  // Per-tick: merchant walks toward marketplace (1 tile/tick)
  if (ts.merchant) {
    const marketplace = ts.buildings.find(b => b.type === 'marketplace' && b.constructed);
    if (marketplace) {
      const mpEntrance = getBuildingEntrance(marketplace);
      if (ts.merchant.x !== mpEntrance.x || ts.merchant.y !== mpEntrance.y) {
        // Move one step toward marketplace
        const path = findPath(ts.grid, ts.width, ts.height, ts.merchant.x, ts.merchant.y, mpEntrance.x, mpEntrance.y);
        if (path.length > 0) {
          ts.merchant.x = path[0].x;
          ts.merchant.y = path[0].y;
        }
      }
    }
  }
}

export function processProsperity(ts: TickState): void {
  ts.prosperity = 0;
  if (ts.villagers.length > 0) {
    const avgFood = ts.villagers.reduce((s, v) => s + v.food, 0) / ts.villagers.length;
    if (avgFood > 3) ts.prosperity += 10;
    if (ts.villagers.every(v => v.homeBuildingId !== null)) ts.prosperity += 10;
    const avgMorale = ts.villagers.reduce((s, v) => s + v.morale, 0) / ts.villagers.length;
    if (avgMorale > 60) ts.prosperity += 10;
    const foodTypes = ['bread', 'wheat', 'food'] as const;
    for (const ft of foodTypes) { if (ts.resources[ft] > 0) ts.prosperity += 5; }
    const uniqueBuildings = new Set(ts.buildings.map(b => b.type));
    ts.prosperity += Math.min(30, uniqueBuildings.size * 5);
    if (ts.villagers.some(v => v.role === 'guard')) ts.prosperity += 10;
    if (ts.research.completed.length > 0) ts.prosperity += 10;
  }
  ts.prosperity = Math.min(100, ts.prosperity);
}

export function processEventsAndQuests(ts: TickState): void {
  let nextVId = ts.nextVillagerId;
  if (ts.villagers.length > ts.originalVillagerCount) {
    nextVId = Math.max(nextVId, ts.nextVillagerId + (ts.villagers.length - ts.originalVillagerCount));
  }

  if (ts.isNewDay) {
    if (ts.prosperity > 70) ts.renown += 1;

    const eventRng = ((ts.newDay * 2654435761 + 374761393) & 0x7fffffff) / 0x7fffffff;
    if (eventRng < 0.10 && ts.villagers.length > 0) {
      const eventSeed = ((ts.newDay * 6364136 + 1442695) & 0x7fffffff) / 0x7fffffff;

      if (eventSeed < 0.15) {
        ts.resources.gold += 5;
        const bonusRes: ResourceType[] = ['wood', 'stone', 'food'];
        const pick = bonusRes[ts.newDay % bonusRes.length];
        addResource(ts.resources, pick, 3, ts.storageCap);
        ts.events.push(`A wandering trader passed through, leaving 5 gold and 3 ${pick}.`);
        ts.renown += 1;
      } else if (eventSeed < 0.25 && (ts.season === 'spring' || ts.season === 'summer')) {
        addResource(ts.resources, 'wheat', 5, ts.storageCap);
        ts.events.push('A bountiful harvest! +5 wheat.');
      } else if (eventSeed < 0.40) {
        ts.raidBar = Math.min(100, ts.raidBar + 15);
        ts.events.push('Bandits spotted near the settlement! Raid threat increased.');
      } else if (eventSeed < 0.50) {
        const home = findHome(ts.buildings, ts.villagers);
        if (home) {
          const homeB = ts.buildings.find(b => b.id === home)!;
          const entrance = getBuildingEntrance(homeB);
          const newV = createVillager(nextVId, entrance.x, entrance.y);
          newV.homeBuildingId = home;
          newV.state = 'sleeping';
          ts.villagers.push(newV);
          nextVId++;
          ts.events.push(`A lost traveler named ${newV.name} joined the colony!`);
        }
      } else if (eventSeed < 0.55) {
        for (const v of ts.villagers) v.food = Math.max(0, v.food - 2);
        ts.events.push('A mild plague swept through the colony. All villagers lost food.');
      } else if (eventSeed < 0.65) {
        for (const v of ts.villagers) v.morale = Math.min(100, v.morale + 10);
        ts.events.push('The villagers held a festival! Morale boosted.');
        ts.renown += 1;
      } else if (eventSeed < 0.75) {
        const edgeX = Math.min(ts.width - 1, Math.max(0, 5 + (ts.newDay % (ts.width - 10))));
        const edgeY = Math.min(ts.height - 1, Math.max(0, 5 + (ts.newDay % (ts.height - 10))));
        revealArea(ts.fog, ts.width, ts.height, edgeX, edgeY, 2);
        ts.events.push(`Scouts discovered new territory near (${edgeX},${edgeY}).`);
      } else if (eventSeed < 0.85 && ts.season === 'summer') {
        ts.events.push('A dry spell threatens the crops.');
      } else if (eventSeed < 0.90) {
        ts.prosperity = Math.min(100, ts.prosperity + 3);
        ts.events.push('A traveling priest blessed the settlement. +3 prosperity.');
      } else {
        const target = ts.villagers[ts.newDay % ts.villagers.length];
        target.hp = Math.max(1, target.hp - 3);
        ts.events.push(`A wolf attacked ${target.name}! (-3 HP)`);
      }
    }
  }

  // Quest checks (daily)
  if (ts.isNewDay) {
    if (!ts.completedQuests.includes('first_steps') && ts.villagers.length >= 5 && ts.buildings.length >= 3) {
      ts.completedQuests.push('first_steps');
      ts.renown += 10;
      ts.resources.gold += 20;
      ts.events.push('Quest complete: "First Steps" — 5 villagers, 3 buildings. +10 renown, +20 gold.');
    }
    if (!ts.completedQuests.includes('prosperous') && ts.prosperity >= 70) {
      ts.completedQuests.push('prosperous');
      ts.renown += 20;
      ts.resources.gold += 50;
      ts.events.push('Quest complete: "Prosperous" — Settlement thriving! +20 renown, +50 gold.');
    }
  }

  ts.nextVillagerId = nextVId;
}
