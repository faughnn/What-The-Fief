// Entity rendering — villagers, enemies, animals, caravans, camps, villages, expeditions, POIs, resource drops

import type { GameState, Villager } from '../../../world.js';
import { COLORS, TILE, getViewport, inBounds, type RenderContext } from './shared.js';

export function drawResourceDrops(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const drop of gs.resourceDrops) {
    if (drop.x < startX || drop.x > endX || drop.y < startY || drop.y > endY) continue;
    const px = drop.x * ts + ts * 0.3;
    const py = drop.y * ts + ts * 0.3;
    const s = ts * 0.4;
    // Small sack shape
    ctx.fillStyle = COLORS.resourceDrop;
    ctx.beginPath();
    ctx.ellipse(px + s / 2, py + s * 0.6, s * 0.4, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a7040';
    ctx.lineWidth = Math.max(0.5, ts * 0.03);
    ctx.stroke();
    // Glint
    if (rc.animFrame % 60 < 15) {
      ctx.fillStyle = 'rgba(255,255,200,0.5)';
      ctx.beginPath();
      ctx.arc(px + s * 0.3, py + s * 0.3, ts * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawVillagers(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const v of gs.villagers) {
    if (v.x < startX - 1 || v.x > endX + 1 || v.y < startY - 1 || v.y > endY + 1) continue;

    const px = v.x * ts + ts * 0.5;
    const py = v.y * ts + ts * 0.5;
    const r = ts * 0.28;

    // Body
    ctx.fillStyle = COLORS.villager;
    ctx.beginPath();
    ctx.arc(px, py + r * 0.15, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.villagerOutline;
    ctx.lineWidth = Math.max(1, ts * 0.06);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#e8d0a0';
    ctx.beginPath();
    ctx.arc(px, py - r * 0.4, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.villagerOutline;
    ctx.lineWidth = Math.max(0.5, ts * 0.04);
    ctx.stroke();

    // Guard shield pip
    if (v.role === 'guard' || v.role === 'militia') {
      ctx.fillStyle = v.role === 'guard' ? COLORS.brass : '#8a8a8a';
      ctx.fillRect(px + r * 0.5, py - r * 0.6, r * 0.5, r * 0.5);
      ctx.strokeStyle = COLORS.buildingOutline;
      ctx.lineWidth = Math.max(0.5, ts * 0.03);
      ctx.strokeRect(px + r * 0.5, py - r * 0.6, r * 0.5, r * 0.5);
    }

    // Activity icon above head
    if (ts >= 12) {
      drawActivityIcon(ctx, v, px, py - r * 1.2, ts);
    }

    // Carrying indicator (satchel)
    if (v.carryTotal > 0) {
      ctx.fillStyle = '#8a6a40';
      ctx.fillRect(px + r * 0.3, py + r * 0.1, r * 0.4, r * 0.3);
    }

    // Name at high zoom
    if (ts >= 22) {
      ctx.fillStyle = COLORS.parchment;
      ctx.font = `${Math.max(6, ts * 0.22)}px 'Crimson Text', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(v.name.split(' ')[0], px, py + r * 1.2);
    }

    // HP bar (only when damaged)
    if (v.hp < v.maxHp) {
      const barW = ts * 0.6;
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(px - barW / 2, py - r * 1.6, barW, ts * 0.1);
      const hpPct = v.hp / v.maxHp;
      ctx.fillStyle = hpPct > 0.5 ? COLORS.forestGreen : COLORS.waxRed;
      ctx.fillRect(px - barW / 2, py - r * 1.6, barW * hpPct, ts * 0.1);
    }

    // Selection ring
    if (rc.selectedEntity?.type === 'villager' && rc.selectedEntity.id === v.id) {
      ctx.strokeStyle = COLORS.brass;
      ctx.lineWidth = Math.max(1, ts * 0.08);
      ctx.beginPath();
      ctx.arc(px, py, r * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawActivityIcon(ctx: CanvasRenderingContext2D, v: Villager, x: number, y: number, ts: number) {
  ctx.fillStyle = COLORS.parchment;
  ctx.font = `${Math.max(6, ts * 0.25)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  switch (v.state) {
    case 'sleeping': ctx.fillText('z', x, y); break;
    case 'working': case 'constructing': ctx.fillText('\u2692', x, y); break;
    case 'eating': ctx.fillText('\u2615', x, y); break;
    case 'traveling_to_work': case 'traveling_to_storage': case 'traveling_home':
    case 'traveling_to_eat': case 'traveling_to_build': case 'traveling_to_tavern':
    case 'traveling_to_heal':
      ctx.fillText('\u2022', x, y); break;
    case 'hunting': ctx.fillText('\u25C9', x, y); break;
    case 'scouting': ctx.fillText('\u25CE', x, y); break;
    case 'assaulting_camp': ctx.fillText('\u2694', x, y); break;
    case 'on_expedition': ctx.fillText('\u2690', x, y); break;
    case 'healing': ctx.fillText('+', x, y); break;
    case 'relaxing': ctx.fillText('\u266A', x, y); break;
  }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const e of gs.enemies) {
    if (e.x < startX - 1 || e.x > endX + 1 || e.y < startY - 1 || e.y > endY + 1) continue;

    const px = e.x * ts + ts * 0.5;
    const py = e.y * ts + ts * 0.5;
    const r = ts * 0.3;
    const sizeMultiplier = e.type === 'bandit_brute' ? 1.3 : e.type === 'bandit_warlord' ? 1.5 : 1;
    const er = r * sizeMultiplier;

    // Glow ring
    ctx.strokeStyle = COLORS.enemyGlow;
    ctx.lineWidth = Math.max(1, ts * 0.04);
    ctx.globalAlpha = 0.3 + Math.sin(rc.animFrame * 0.1) * 0.15;
    ctx.beginPath();
    ctx.arc(px, py, er * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Red banner/pennant shape
    ctx.fillStyle = COLORS.enemy;
    ctx.beginPath();
    ctx.moveTo(px, py - er);
    ctx.lineTo(px + er * 0.7, py);
    ctx.lineTo(px, py + er * 0.5);
    ctx.lineTo(px - er * 0.7, py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6a2010';
    ctx.lineWidth = Math.max(1, ts * 0.05);
    ctx.stroke();

    // Type indicator
    if (ts >= 14) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(6, ts * 0.25)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const typeChar = e.type === 'bandit_archer' ? '\u2191' : e.type === 'bandit_brute' ? 'B' : e.type === 'bandit_warlord' ? 'W' : '\u2694';
      ctx.fillText(typeChar, px, py - er * 0.2);
    }

    // HP bar
    const barW = ts * 0.7;
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(px - barW / 2, py - er * 1.5, barW, ts * 0.1);
    const hpPct = e.hp / e.maxHp;
    ctx.fillStyle = COLORS.waxRed;
    ctx.fillRect(px - barW / 2, py - er * 1.5, barW * hpPct, ts * 0.1);

    // Selection ring
    if (rc.selectedEntity?.type === 'enemy' && rc.selectedEntity.id === e.id) {
      ctx.strokeStyle = COLORS.waxRed;
      ctx.lineWidth = Math.max(1, ts * 0.08);
      ctx.beginPath();
      ctx.arc(px, py, er * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function drawAnimals(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const a of gs.animals) {
    if (a.x < startX - 1 || a.x > endX + 1 || a.y < startY - 1 || a.y > endY + 1) continue;

    const px = a.x * ts + ts * 0.5;
    const py = a.y * ts + ts * 0.5;
    const r = ts * 0.2;

    ctx.fillStyle = a.behavior === 'hostile' ? COLORS.animalHostile : COLORS.animal;
    // Simple silhouette (oval body)
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = a.behavior === 'hostile' ? '#6a2020' : '#5a4a3a';
    ctx.lineWidth = Math.max(0.5, ts * 0.04);
    ctx.stroke();

    // Type indicator at zoom
    if (ts >= 16) {
      ctx.fillStyle = COLORS.parchment;
      ctx.font = `${Math.max(5, ts * 0.2)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = a.type === 'deer' ? 'D' : a.type === 'rabbit' ? 'r' : a.type === 'wild_wolf' ? 'W' : 'B';
      ctx.fillText(icon, px, py);
    }

    // Selection ring
    if (rc.selectedEntity?.type === 'animal' && rc.selectedEntity.id === a.id) {
      ctx.strokeStyle = COLORS.brass;
      ctx.lineWidth = Math.max(1, ts * 0.08);
      ctx.beginPath();
      ctx.arc(px, py, r * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function drawCaravans(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const c of gs.caravans) {
    if (c.x < startX - 1 || c.x > endX + 1 || c.y < startY - 1 || c.y > endY + 1) continue;

    const px = c.x * ts + ts * 0.5;
    const py = c.y * ts + ts * 0.5;
    const s = ts * 0.35;

    // Cart body
    ctx.fillStyle = '#a08050';
    ctx.fillRect(px - s, py - s * 0.3, s * 2, s * 0.8);
    ctx.strokeStyle = '#5a4020';
    ctx.lineWidth = Math.max(1, ts * 0.04);
    ctx.strokeRect(px - s, py - s * 0.3, s * 2, s * 0.8);

    // Wheels
    ctx.fillStyle = '#5a4020';
    ctx.beginPath();
    ctx.arc(px - s * 0.6, py + s * 0.6, s * 0.2, 0, Math.PI * 2);
    ctx.arc(px + s * 0.6, py + s * 0.6, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCamps(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const camp of gs.banditCamps) {
    if (camp.x < startX - 2 || camp.x > endX + 2 || camp.y < startY - 2 || camp.y > endY + 2) continue;

    const px = camp.x * ts + ts * 0.5;
    const py = camp.y * ts + ts * 0.5;
    const s = ts * 0.4;

    // Skull shape
    ctx.fillStyle = '#d0c0a0';
    ctx.beginPath();
    ctx.arc(px, py - s * 0.2, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a2010';
    ctx.lineWidth = Math.max(1, ts * 0.06);
    ctx.stroke();

    // Tent cluster
    for (let i = -1; i <= 1; i++) {
      const tx = px + i * s * 0.8;
      const ty = py + s * 0.5;
      ctx.fillStyle = '#7a3020';
      ctx.beginPath();
      ctx.moveTo(tx, ty - s * 0.4);
      ctx.lineTo(tx - s * 0.3, ty + s * 0.2);
      ctx.lineTo(tx + s * 0.3, ty + s * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    // Strength indicator
    if (ts >= 12) {
      ctx.fillStyle = COLORS.waxRed;
      ctx.font = `bold ${Math.max(6, ts * 0.25)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${camp.strength}`, px, py - s);
    }

    // HP bar
    const barW = ts * 0.8;
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(px - barW / 2, py - s * 1.5, barW, ts * 0.1);
    const hpPct = camp.hp / camp.maxHp;
    ctx.fillStyle = COLORS.waxRed;
    ctx.fillRect(px - barW / 2, py - s * 1.5, barW * hpPct, ts * 0.1);
  }
}

export function drawVillages(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const v of gs.npcSettlements) {
    if (v.x < startX - 2 || v.x > endX + 2 || v.y < startY - 2 || v.y > endY + 2) continue;

    const px = v.x * ts + ts * 0.5;
    const py = v.y * ts + ts * 0.5;
    const s = ts * 0.4;

    // Trust-based color
    const trustColor = v.liberated ? COLORS.forestGreen : v.trustRank === 'friend' || v.trustRank === 'protector' ? COLORS.fadedBlue : v.trustRank === 'associate' ? '#a09060' : '#8a7a6a';

    // House cluster
    for (let i = -1; i <= 1; i++) {
      const hx = px + i * s * 0.8;
      ctx.fillStyle = trustColor;
      ctx.fillRect(hx - s * 0.25, py - s * 0.2, s * 0.5, s * 0.4);
      ctx.strokeStyle = '#4a3a20';
      ctx.lineWidth = Math.max(0.5, ts * 0.03);
      ctx.strokeRect(hx - s * 0.25, py - s * 0.2, s * 0.5, s * 0.4);
      // Roof
      ctx.fillStyle = '#6a4a30';
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.3, py - s * 0.2);
      ctx.lineTo(hx, py - s * 0.5);
      ctx.lineTo(hx + s * 0.3, py - s * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    // Name at zoom
    if (ts >= 14) {
      ctx.fillStyle = COLORS.parchment;
      ctx.font = `${Math.max(6, ts * 0.22)}px 'Crimson Text', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(v.name, px, py + s * 0.8);
    }
  }
}

export function drawExpeditions(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  for (const exp of gs.expeditions) {
    // Find first member to get current position
    const member = gs.villagers.find(v => v.expeditionId === exp.id);
    if (!member) continue;

    const px = member.x * rc.camera.zoom * TILE + TILE * rc.camera.zoom * 0.5;
    const py = member.y * rc.camera.zoom * TILE + TILE * rc.camera.zoom * 0.3;
    const ts = TILE * rc.camera.zoom;

    // Banner on pole
    ctx.strokeStyle = '#6a5a40';
    ctx.lineWidth = Math.max(1, ts * 0.05);
    ctx.beginPath();
    ctx.moveTo(px, py + ts * 0.3);
    ctx.lineTo(px, py - ts * 0.2);
    ctx.stroke();

    ctx.fillStyle = COLORS.brass;
    ctx.beginPath();
    ctx.moveTo(px, py - ts * 0.2);
    ctx.lineTo(px + ts * 0.25, py - ts * 0.1);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawPOIs(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const poi of gs.pointsOfInterest) {
    if (!poi.discovered || poi.explored) continue;
    if (poi.x < startX - 1 || poi.x > endX + 1 || poi.y < startY - 1 || poi.y > endY + 1) continue;

    const px = poi.x * ts + ts * 0.5;
    const py = poi.y * ts + ts * 0.5;

    // Pulsing question mark
    ctx.fillStyle = COLORS.brass;
    ctx.globalAlpha = 0.7 + Math.sin(rc.animFrame * 0.08) * 0.3;
    ctx.font = `bold ${Math.max(8, ts * 0.5)}px 'Cinzel', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', px, py);
    ctx.globalAlpha = 1;
  }
}
