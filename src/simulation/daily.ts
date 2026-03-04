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
  addResource, addToBuffer, findNearestStorehouse, revealArea, hasTech,
} from './helpers.js';
import { findPath, planPath } from './movement.js';

// New settlement optimism: +20 morale fading to 0 over 40 days (like RimWorld)
const NEW_SETTLEMENT_OPTIMISM_DAYS = 40;
const NEW_SETTLEMENT_OPTIMISM_MAX = 20;

function calculateMorale(v: Villager, housingMorale: number, season: Season, weather: WeatherType, familyNearby: boolean, churchNearby: boolean, day: number): number {
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
  // Church bonus (passed in)
  if (churchNearby) morale += 10;
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
    // Check if any family member shares the same home
    const familyNearby = v.family.length > 0 && v.homeBuildingId !== null &&
      ts.villagers.some(other => other.id !== v.id && v.family.includes(other.id) && other.homeBuildingId === v.homeBuildingId);
    // Check if a constructed church is within 5 tiles of the villager's home
    let churchNearby = false;
    if (v.homeBuildingId) {
      const home = ts.buildings.find(b => b.id === v.homeBuildingId);
      if (home) {
        churchNearby = ts.buildings.some(b =>
          b.type === 'church' && b.constructed &&
          Math.abs(b.x - home.x) + Math.abs(b.y - home.y) <= 5
        );
      }
    }
    v.morale = calculateMorale(v, housingMorale, ts.season, ts.weather, familyNearby, churchNearby, ts.newDay);
  }

  // Reset lastAte AFTER morale calculation — so yesterday's meals influence today's morale
  for (const v of ts.villagers) {
    v.lastAte = 'nothing' as FoodEaten;
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
  // Check food in STOREHOUSE BUFFERS (not global) — global includes farm buffers
  // that villagers can't eat from. Only invite settlers when food is physically accessible.
  let storehouseEdible = 0;
  for (const b of ts.buildings) {
    if (b.type !== 'storehouse' || !b.constructed) continue;
    for (const { resource } of FOOD_PRIORITY) {
      storehouseEdible += (b.localBuffer[resource] || 0);
    }
  }
  if (storehouseEdible > ts.villagers.length * 3) {
    const emptyHome = findHome(ts.buildings, ts.villagers);
    if (emptyHome) {
      const home = ts.buildings.find(b => b.id === emptyHome)!;
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
      ts.events.push(`A new settler, ${newV.name}, arrives!`);
    }
  }

  // Guard equip tools
  for (const v of ts.villagers) {
    if (v.role === 'guard' && v.tool === 'none') autoEquipTool(v, ts.resources, ts.toolDurBonus, ts.buildings);
  }

  // Disease daily: HP loss and duration countdown (after regen, so net effect is visible)
  // Note: placed before regen so the -2 HP is offset by +2 regen = net 0,
  // but we want net negative, so use 3 HP loss
  for (const v of ts.villagers) {
    if (v.sick) {
      v.hp = Math.max(1, v.hp - 3); // Lose 3 HP per day from sickness (net -1 after regen)
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
      ts.graveyard.push({ name: d.name, day: ts.newDay });
    }
    ts.villagers = ts.villagers.filter(v => v.hp > 0);
  }
}

export function processDisease(ts: TickState): void {
  // Per-tick: sick villagers spread disease to adjacent healthy villagers (10% per tick)
  for (const v of ts.villagers) {
    if (!v.sick) continue;
    for (const other of ts.villagers) {
      if (other.id === v.id || other.sick) continue;
      // Check adjacency (within 1 tile)
      if (Math.abs(other.x - v.x) <= 1 && Math.abs(other.y - v.y) <= 1) {
        const spreadRng = ((ts.newTick * 1103515245 + v.x * 12345 + other.x * 67890 + v.y * 2654435761) & 0x7fffffff) / 0x7fffffff;
        if (spreadRng < 0.10) {
          other.sick = true;
          other.sickDays = 5;
        }
      }
    }
  }
}

export function processLightning(ts: TickState): void {
  // Per-tick: during storms, small chance (0.5%) to strike a random constructed building
  if (ts.weather !== 'storm') return;
  const constructed = ts.buildings.filter(b => b.constructed && !b.onFire && b.type !== 'well' && b.type !== 'rubble');
  if (constructed.length === 0) return;

  const lightningRng = ((ts.newTick * 48271 + 3) & 0x7fffffff) / 0x7fffffff;
  if (lightningRng < 0.005) {
    const target = constructed[ts.newTick % constructed.length];
    target.onFire = true;
    ts.events.push(`Lightning struck the ${target.type} at (${target.x},${target.y})!`);
  }
}

export function processCaravans(ts: TickState): void {
  const marketplace = ts.buildings.find(b => b.type === 'marketplace' && b.constructed);

  for (const c of ts.caravans) {
    c.ticksLeft -= 1;

    // Move toward marketplace (1 tile/tick)
    if (marketplace) {
      const mpEntrance = getBuildingEntrance(marketplace);
      if (c.x !== mpEntrance.x || c.y !== mpEntrance.y) {
        const path = findPath(ts.grid, ts.width, ts.height, c.x, c.y, mpEntrance.x, mpEntrance.y);
        if (path.length > 0) {
          c.x = path[0].x;
          c.y = path[0].y;
        }
      } else {
        // At marketplace — deposit goods into marketplace buffer
        for (const [res, amount] of Object.entries(c.goods)) {
          if (amount && amount > 0) {
            const key = res as keyof typeof marketplace.localBuffer;
            const space = Math.max(0, marketplace.bufferCapacity - Object.values(marketplace.localBuffer).reduce((a, b) => a + (b || 0), 0));
            const deposited = Math.min(amount, space);
            marketplace.localBuffer[key] = (marketplace.localBuffer[key] || 0) + deposited;
            (c.goods as any)[res] = amount - deposited;
          }
        }
      }
    }
  }

  // Remove expired caravans
  ts.caravans = ts.caravans.filter(c => c.ticksLeft > 0);
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
        // Wandering trader — deposit into storehouse buffer AND global
        const traderSH = ts.buildings.find(b => b.type === 'storehouse' && b.constructed);
        if (traderSH) addToBuffer(traderSH.localBuffer, 'gold', 5, traderSH.bufferCapacity);
        ts.resources.gold += 5;
        const bonusRes: ResourceType[] = ['wood', 'stone', 'food'];
        const pick = bonusRes[ts.newDay % bonusRes.length];
        const deposited = traderSH ? addToBuffer(traderSH.localBuffer, pick, 3, traderSH.bufferCapacity) : 0;
        addResource(ts.resources, pick, deposited, ts.storageCap);
        ts.events.push(`A wandering trader passed through, leaving 5 gold and 3 ${pick}.`);
        ts.renown += 1;
      } else if (eventSeed < 0.25 && (ts.season === 'spring' || ts.season === 'summer')) {
        const harvestSH = ts.buildings.find(b => b.type === 'storehouse' && b.constructed);
        const wheatAdded = harvestSH ? addToBuffer(harvestSH.localBuffer, 'wheat', 5, harvestSH.bufferCapacity) : 0;
        addResource(ts.resources, 'wheat', wheatAdded, ts.storageCap);
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
        // Plague: infect a random villager (disease spreads physically per-tick)
        const target = ts.villagers[ts.newDay % ts.villagers.length];
        if (!target.sick) {
          target.sick = true;
          target.sickDays = 5;
          ts.events.push(`${target.name} has fallen ill with a plague!`);
        }
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
      const qSH1 = ts.buildings.find(b => b.type === 'storehouse' && b.constructed);
      if (qSH1) addToBuffer(qSH1.localBuffer, 'gold', 20, qSH1.bufferCapacity);
      ts.events.push('Quest complete: "First Steps" — 5 villagers, 3 buildings. +10 renown, +20 gold.');
    }
    if (!ts.completedQuests.includes('prosperous') && ts.prosperity >= 70) {
      ts.completedQuests.push('prosperous');
      ts.renown += 20;
      ts.resources.gold += 50;
      const qSH2 = ts.buildings.find(b => b.type === 'storehouse' && b.constructed);
      if (qSH2) addToBuffer(qSH2.localBuffer, 'gold', 50, qSH2.bufferCapacity);
      ts.events.push('Quest complete: "Prosperous" — Settlement thriving! +20 renown, +50 gold.');
    }
  }

  ts.nextVillagerId = nextVId;
}
