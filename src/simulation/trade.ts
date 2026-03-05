// trade.ts — Caravans, merchant, prosperity, events/quests

import {
  ResourceType, createVillager, FOOD_PRIORITY, TICKS_PER_DAY,
  CONSTRUCTION_POINT_MILESTONES,
  DISEASE_DURATION_BASE, DISEASE_DURATION_MEDICINE,
} from '../world.js';
import {
  TickState, getBuildingEntrance, addResource, addToBuffer,
  findHome, isStorehouse, hasTech, revealArea,
} from './helpers.js';
import { findPath } from './movement.js';

// Caravan spawn intervals (in days)
const CARAVAN_INTERVAL_BASE = 10;
const CARAVAN_INTERVAL_TRADE_ROUTES = 7;
const CARAVAN_INTERVAL_LIBERATED = 5;  // liberated villages send caravans more often
const CARAVAN_GOODS_BASE = 8;
const CARAVAN_GOODS_TRADE_ROUTES = 12;
const CARAVAN_GOODS_LIBERATED = 15;    // liberated villages send more goods
const LIBERATED_RENOWN_INTERVAL = 10;  // days between renown from liberated villages
const LIBERATED_RENOWN_PER_VILLAGE = 2; // renown per liberated village per interval
const LIBERATED_PROSPERITY_BONUS = 5;  // prosperity bonus per liberated village

export function processCaravans(ts: TickState): void {
  const marketplace = ts.buildings.find(b => b.type === 'marketplace' && b.constructed);

  // Auto-spawn caravans from NPC settlements
  if (ts.isNewDay && marketplace && ts.npcSettlements.length > 0) {
    // Check each settlement independently — liberated ones have shorter intervals
    for (const settlement of ts.npcSettlements) {
      const isLiberated = settlement.liberated;
      const interval = isLiberated ? CARAVAN_INTERVAL_LIBERATED
        : hasTech(ts.research, 'trade_routes') ? CARAVAN_INTERVAL_TRADE_ROUTES : CARAVAN_INTERVAL_BASE;
      if (ts.newDay > 0 && ts.newDay % interval === 0) {
      // Don't spawn if one from this settlement is already en route
      if (!ts.caravans.some(c => c.settlementId === settlement.id)) {
        const goodsAmount = isLiberated ? CARAVAN_GOODS_LIBERATED
          : hasTech(ts.research, 'trade_routes') ? CARAVAN_GOODS_TRADE_ROUTES : CARAVAN_GOODS_BASE;
        // Spawn at map edge based on settlement direction
        let sx = 0, sy = Math.floor(ts.height / 2);
        if (settlement.direction === 'e') sx = ts.width - 1;
        if (settlement.direction === 'n') { sx = Math.floor(ts.width / 2); sy = 0; }
        if (settlement.direction === 's') { sx = Math.floor(ts.width / 2); sy = ts.height - 1; }
        const goods: Partial<Record<string, number>> = {};
        goods[settlement.specialty] = goodsAmount;
        ts.caravans.push({
          id: `c${ts.newDay}_${settlement.id}`,
          settlementId: settlement.id,
          x: sx, y: sy,
          goods,
          ticksLeft: TICKS_PER_DAY * 5,
        });
        ts.events.push(`A caravan from ${settlement.name} is approaching!`);
      }
      }
    }
  }

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
    // Liberated village bonus
    const liberatedCount = ts.npcSettlements.filter(s => s.liberated).length;
    ts.prosperity += liberatedCount * LIBERATED_PROSPERITY_BONUS;
  }
  ts.prosperity = Math.min(100, ts.prosperity);

  // Award construction points for prosperity milestones
  for (const ms of CONSTRUCTION_POINT_MILESTONES) {
    if (ts.prosperity >= ms.prosperity && !ts.constructionPointsMilestones.includes(ms.prosperity)) {
      ts.constructionPoints += ms.points;
      ts.constructionPointsMilestones.push(ms.prosperity);
    }
  }
}

export function processEventsAndQuests(ts: TickState): void {
  let nextVId = ts.nextVillagerId;
  if (ts.villagers.length > ts.originalVillagerCount) {
    nextVId = Math.max(nextVId, ts.nextVillagerId + (ts.villagers.length - ts.originalVillagerCount));
  }

  if (ts.isNewDay) {
    if (ts.prosperity > 70) ts.renown += 1;

    // Liberated villages provide ongoing renown
    if (ts.newDay > 0 && ts.newDay % LIBERATED_RENOWN_INTERVAL === 0) {
      const liberatedCount = ts.npcSettlements.filter(s => s.liberated).length;
      if (liberatedCount > 0) {
        ts.renown += liberatedCount * LIBERATED_RENOWN_PER_VILLAGE;
      }
    }

    const eventRng = ((ts.newDay * 2654435761 + 374761393) & 0x7fffffff) / 0x7fffffff;
    if (eventRng < 0.10 && ts.villagers.length > 0) {
      const eventSeed = ((ts.newDay * 6364136 + 1442695) & 0x7fffffff) / 0x7fffffff;

      if (eventSeed < 0.15) {
        // Wandering trader — deposit into storehouse buffer AND global
        const traderSH = ts.buildings.find(b => isStorehouse(b.type) && b.constructed);
        if (traderSH) addToBuffer(traderSH.localBuffer, 'gold', 5, traderSH.bufferCapacity);
        ts.resources.gold += 5;
        const bonusRes: ResourceType[] = ['wood', 'stone', 'food'];
        const pick = bonusRes[ts.newDay % bonusRes.length];
        const deposited = traderSH ? addToBuffer(traderSH.localBuffer, pick, 3, traderSH.bufferCapacity) : 0;
        addResource(ts.resources, pick, deposited, ts.storageCap);
        ts.events.push(`A wandering trader passed through, leaving 5 gold and 3 ${pick}.`);
        ts.renown += 1;
      } else if (eventSeed < 0.25 && (ts.season === 'spring' || ts.season === 'summer')) {
        const harvestSH = ts.buildings.find(b => isStorehouse(b.type) && b.constructed);
        const wheatAdded = harvestSH ? addToBuffer(harvestSH.localBuffer, 'wheat', 5, harvestSH.bufferCapacity) : 0;
        addResource(ts.resources, 'wheat', wheatAdded, ts.storageCap);
        ts.events.push('A bountiful harvest! +5 wheat.');
      } else if (eventSeed < 0.40) {
        ts.raidBar = Math.min(100, ts.raidBar + 15);
        ts.events.push('Bandits spotted near the settlement! Raid threat increased.');
      } else if (eventSeed < 0.50) {
        const home = findHome(ts.buildings, ts.villagers);
        if (home) {
          const homeB = ts.buildingMap.get(home)!;
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
          target.sickDays = hasTech(ts.research, 'medicine') ? DISEASE_DURATION_MEDICINE : DISEASE_DURATION_BASE;
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
      const qSH1 = ts.buildings.find(b => isStorehouse(b.type) && b.constructed);
      if (qSH1) addToBuffer(qSH1.localBuffer, 'gold', 20, qSH1.bufferCapacity);
      ts.events.push('Quest complete: "First Steps" — 5 villagers, 3 buildings. +10 renown, +20 gold.');
    }
    if (!ts.completedQuests.includes('prosperous') && ts.prosperity >= 70) {
      ts.completedQuests.push('prosperous');
      ts.renown += 20;
      ts.resources.gold += 50;
      const qSH2 = ts.buildings.find(b => isStorehouse(b.type) && b.constructed);
      if (qSH2) addToBuffer(qSH2.localBuffer, 'gold', 50, qSH2.bufferCapacity);
      ts.events.push('Quest complete: "Prosperous" — Settlement thriving! +20 renown, +50 gold.');
    }
  }

  ts.nextVillagerId = nextVId;
}
