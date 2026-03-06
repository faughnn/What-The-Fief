// expeditions.ts — Expedition/exploration system
// Squads physically walk to targets, discover POIs, fight enemies, collect rewards, return home.

import {
  EXPEDITION_FOG_RADIUS, ENEMY_TEMPLATES, EnemyEntity, EnemyType,
} from '../world.js';
import { TickState, addResource, isStorehouse } from './helpers.js';

type TSExp = TickState['expeditions'][number];
type TSPOI = TickState['pointsOfInterest'][number];

// Move expedition members toward a target (x,y), return true when arrived
function moveSquadToward(ts: TickState, exp: TSExp, tx: number, ty: number): boolean {
  const leader = ts.villagers.find(v => v.id === exp.memberIds[0]);
  if (!leader) return true;

  const dx = tx - leader.x;
  const dy = ty - leader.y;
  if (dx === 0 && dy === 0) return true;

  let mx = 0, my = 0;
  if (Math.abs(dx) >= Math.abs(dy)) {
    mx = dx > 0 ? 1 : -1;
  } else {
    my = dy > 0 ? 1 : -1;
  }

  const nx = leader.x + mx;
  const ny = leader.y + my;

  if (nx < 0 || nx >= ts.width || ny < 0 || ny >= ts.height) return true;
  const tile = ts.grid[ny][nx];
  if (tile.terrain === 'water') {
    if (mx !== 0 && dy !== 0) { mx = 0; my = dy > 0 ? 1 : -1; }
    else if (my !== 0 && dx !== 0) { my = 0; mx = dx > 0 ? 1 : -1; }
    else return true;
    const ax = leader.x + mx, ay = leader.y + my;
    if (ax < 0 || ax >= ts.width || ay < 0 || ay >= ts.height) return true;
    if (ts.grid[ay][ax].terrain === 'water') return false;
    for (const id of exp.memberIds) {
      const v = ts.villagers.find(vi => vi.id === id);
      if (v) { v.x = ax; v.y = ay; }
    }
  } else {
    for (const id of exp.memberIds) {
      const v = ts.villagers.find(vi => vi.id === id);
      if (v) { v.x = nx; v.y = ny; }
    }
  }

  return false;
}

function revealFog(ts: TickState, x: number, y: number): void {
  const r = EXPEDITION_FOG_RADIUS;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const fx = x + dx, fy = y + dy;
      if (fx >= 0 && fx < ts.width && fy >= 0 && fy < ts.height) {
        ts.fog[fy][fx] = true;
      }
    }
  }
}

function checkPOIDiscovery(ts: TickState, exp: TSExp): void {
  const leader = ts.villagers.find(v => v.id === exp.memberIds[0]);
  if (!leader) return;

  for (const poi of ts.pointsOfInterest) {
    if (poi.discovered) continue;
    const d = Math.abs(poi.x - leader.x) + Math.abs(poi.y - leader.y);
    if (d <= 2) {
      poi.discovered = true;
      ts.events.push(`Expedition discovered ${poi.type.replace('_', ' ')} at (${poi.x}, ${poi.y})!`);
      if (!exp.targetPOIId) {
        exp.targetPOIId = poi.id;
      }
    }
  }
}

function spawnPOIGuards(ts: TickState, poi: TSPOI): void {
  if (!poi.guardEnemies || poi.guardEnemies.length === 0) return;
  for (const g of poi.guardEnemies) {
    const template = ENEMY_TEMPLATES[g.type as EnemyType];
    if (!template) continue;
    for (let i = 0; i < g.count; i++) {
      const enemy: EnemyEntity = {
        id: `e${ts.nextEnemyId}`,
        type: g.type as EnemyType,
        x: poi.x + (i % 2 === 0 ? 0 : 1),
        y: poi.y + (i < 2 ? 0 : 1),
        hp: template.maxHp,
        maxHp: template.maxHp,
        attack: template.attack,
        defense: template.defense,
        range: template.range,
      };
      ts.enemies.push(enemy);
      ts.nextEnemyId++;
    }
  }
  poi.guardEnemies = [];
}

function awardPOIRewards(ts: TickState, poi: TSPOI): void {
  poi.explored = true;
  const sh = ts.buildings.find(b => isStorehouse(b.type) && b.constructed);
  for (const [res, amount] of Object.entries(poi.rewards)) {
    if (amount && amount > 0) {
      addResource(ts.resources, res as any, amount, ts.storageCap);
      if (sh) {
        sh.localBuffer[res as any] = (sh.localBuffer[res as any] || 0) + amount;
      }
    }
  }
  ts.renown += poi.renownReward;
  ts.events.push(`Expedition explored ${poi.type.replace('_', ' ')} — gained ${Object.entries(poi.rewards).map(([r, a]) => `${a} ${r}`).join(', ')} and ${poi.renownReward} renown!`);
}

function completeExpedition(ts: TickState, exp: TSExp): void {
  for (const id of exp.memberIds) {
    const v = ts.villagers.find(vi => vi.id === id);
    if (v) {
      v.state = 'idle';
      v.expeditionId = null;
      v.role = 'idle';
    }
  }
  const idx = ts.expeditions.indexOf(exp);
  if (idx >= 0) ts.expeditions.splice(idx, 1);
}

export function processExpeditions(ts: TickState): void {
  const exps = [...ts.expeditions];
  for (const exp of exps) {
    const leader = ts.villagers.find(v => v.id === exp.memberIds[0]);
    if (!leader) { completeExpedition(ts, exp); continue; }

    revealFog(ts, leader.x, leader.y);
    checkPOIDiscovery(ts, exp);

    if (exp.state === 'traveling_out') {
      const arrived = moveSquadToward(ts, exp, exp.targetX, exp.targetY);
      if (arrived) {
        const poi = exp.targetPOIId
          ? ts.pointsOfInterest.find(p => p.id === exp.targetPOIId)
          : null;
        if (poi && !poi.explored) {
          if (poi.guardEnemies && poi.guardEnemies.length > 0) {
            spawnPOIGuards(ts, poi);
            exp.state = 'fighting';
          } else {
            exp.state = 'exploring';
            exp.exploreProgress = 0;
          }
        } else {
          exp.state = 'traveling_back';
        }
      }
    } else if (exp.state === 'fighting') {
      const nearbyEnemies = ts.enemies.filter(e => {
        const d = Math.abs(e.x - leader.x) + Math.abs(e.y - leader.y);
        return d <= 5;
      });
      if (nearbyEnemies.length === 0) {
        const poi = ts.pointsOfInterest.find(p => p.id === exp.targetPOIId);
        if (poi && !poi.explored) {
          exp.state = 'exploring';
          exp.exploreProgress = 0;
        } else {
          exp.state = 'traveling_back';
        }
      }
    } else if (exp.state === 'exploring') {
      exp.exploreProgress++;
      if (exp.exploreProgress >= exp.exploreTicks) {
        const poi = ts.pointsOfInterest.find(p => p.id === exp.targetPOIId);
        if (poi && !poi.explored) {
          awardPOIRewards(ts, poi);
        }
        exp.state = 'traveling_back';
      }
    } else if (exp.state === 'traveling_back') {
      const arrived = moveSquadToward(ts, exp, exp.homeX, exp.homeY);
      if (arrived) {
        completeExpedition(ts, exp);
      }
    }
  }
}
