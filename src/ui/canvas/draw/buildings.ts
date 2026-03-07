// Building rendering

import type { GameState, Building, BuildingType } from '../../../world.js';
import { COLORS, getViewport, TILE, type RenderContext } from './shared.js';

const BUILDING_COLORS: Partial<Record<BuildingType, string>> = {
  farm: '#7a9a5a', large_farm: '#7a9a5a', woodcutter: '#8a7a50', quarry: '#8a8070',
  storehouse: '#b89858', large_storehouse: '#b89858', outpost: '#a89060',
  house: '#c4a878', tent: '#c8b888', cottage: '#c4a878', manor: '#d4b488', inn: '#c4a070',
  barracks: '#8a7060',
  wall: '#8a8070', fence: '#9a8a6a', gate: '#a09070', reinforced_wall: '#7a7a70',
  watchtower: '#8a7a60', spike_trap: '#7a6a50', training_ground: '#8a7060',
  town_hall: '#b8964e', marketplace: '#c4a060',
  tavern: '#a07a50', church: '#b0a080', graveyard: '#7a7a6a',
  well: '#6a8a8a', water_collector: '#6a8a8a',
  garden: '#6a9a5a', fountain: '#5a8a8a', statue: '#a09a80',
  research_desk: '#7a7a90', library: '#7a7a90',
  weapon_rack: '#8a7060', weaponsmith: '#8a6a50', fletcher: '#8a7a50',
  road: '#b8a888',
};

const BUILDING_ICONS: Partial<Record<BuildingType, string>> = {
  town_hall: '\u2605', // star
  house: '\u2302', cottage: '\u2302', manor: '\u2302', tent: '\u25B3',
  farm: '\u2618', large_farm: '\u2618', // shamrock
  woodcutter: '\u2042', forester: '\u2042', // asterism
  quarry: '\u25C7', deep_quarry: '\u25C7', stonemason: '\u25C7', // diamond
  storehouse: '\u25A3', large_storehouse: '\u25A3', outpost: '\u25A3',
  wall: '\u2588', fence: '\u2502', gate: '\u2503', reinforced_wall: '\u2588',
  watchtower: '\u25CE', // bullseye
  tavern: '\u265B', inn: '\u265B', // queen
  church: '\u271D', // cross
  well: '\u25CB', water_collector: '\u25CB',
  marketplace: '\u2696', // scales
  research_desk: '\u2710', library: '\u2710', // pencil
  graveyard: '\u271D',
  sawmill: '\u2692', lumber_mill: '\u2692', // hammer/pick
  smelter: '\u2668', advanced_smelter: '\u2668', // hot springs
  mill: '\u2699', windmill: '\u2699', // gear
  bakery: '\u25D5', kitchen: '\u25D5',
  blacksmith: '\u2692', toolmaker: '\u2692',
  weaponsmith: '\u2694', fletcher: '\u2694', // swords
  garden: '\u2740', fountain: '\u2740', statue: '\u2740', // flower
  barracks: '\u2694', training_ground: '\u2694',
  spike_trap: '\u25B2', // triangle
  weapon_rack: '\u2694',
  fishing_hut: '\u223D', // sine
  hunting_lodge: '\u25C9',
  apothecary: '\u2695', // staff
  mint: '\u25C9',
};

function getBuildingColor(type: BuildingType): string {
  return BUILDING_COLORS[type] || COLORS.buildingFill;
}

export function drawBuildings(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (const b of gs.buildings) {
    if (b.type === 'road') continue; // Roads drawn with terrain
    if (b.x + b.width < startX || b.x > endX || b.y + b.height < startY || b.y > endY) continue;

    const px = b.x * ts;
    const py = b.y * ts;
    const bw = b.width * ts;
    const bh = b.height * ts;

    const color = getBuildingColor(b.type);

    if (!b.constructed) {
      // Construction site — dashed outline with cross-hatch
      ctx.strokeStyle = COLORS.constructionHatch;
      ctx.lineWidth = Math.max(1, ts * 0.06);
      ctx.setLineDash([ts * 0.1, ts * 0.08]);
      ctx.strokeRect(px + 1, py + 1, bw - 2, bh - 2);
      ctx.setLineDash([]);
      // Cross-hatch pattern
      ctx.strokeStyle = COLORS.constructionHatch;
      ctx.lineWidth = Math.max(0.5, ts * 0.02);
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < bw + bh; i += ts * 0.2) {
        ctx.beginPath();
        ctx.moveTo(px + Math.min(i, bw), py + Math.max(0, i - bw));
        ctx.lineTo(px + Math.max(0, i - bh), py + Math.min(i, bh));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Construction progress bar
      if (b.constructionRequired > 0) {
        const pct = b.constructionProgress / b.constructionRequired;
        ctx.fillStyle = COLORS.brass;
        ctx.fillRect(px + 1, py + bh - ts * 0.15, (bw - 2) * pct, ts * 0.12);
      }
    } else {
      // Built building
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, bw - 2, bh - 2);

      // Ink outline
      ctx.strokeStyle = COLORS.buildingOutline;
      ctx.lineWidth = Math.max(1, ts * 0.06);
      ctx.strokeRect(px + 1, py + 1, bw - 2, bh - 2);

      // Building type icon/label at high zoom
      if (ts >= 14) {
        drawBuildingIcon(ctx, b, px, py, bw, bh, ts, rc);
      }

      // Damage cracks
      if (b.hp < b.maxHp) {
        const dmgPct = 1 - b.hp / b.maxHp;
        if (dmgPct > 0.1) {
          ctx.strokeStyle = COLORS.damageCrack;
          ctx.lineWidth = Math.max(1, ts * 0.04);
          ctx.globalAlpha = dmgPct;
          ctx.beginPath();
          ctx.moveTo(px + bw * 0.2, py + bh * 0.3);
          ctx.lineTo(px + bw * 0.4, py + bh * 0.5);
          ctx.lineTo(px + bw * 0.35, py + bh * 0.7);
          ctx.stroke();
          if (dmgPct > 0.5) {
            ctx.beginPath();
            ctx.moveTo(px + bw * 0.6, py + bh * 0.2);
            ctx.lineTo(px + bw * 0.7, py + bh * 0.5);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        // HP bar
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(px, py - ts * 0.18, bw, ts * 0.12);
        const hpPct = b.hp / b.maxHp;
        ctx.fillStyle = hpPct > 0.5 ? COLORS.forestGreen : hpPct > 0.25 ? '#c4a030' : COLORS.waxRed;
        ctx.fillRect(px, py - ts * 0.18, bw * hpPct, ts * 0.12);
      }
    }

    // Fire overlay
    if (b.onFire) {
      drawFire(ctx, px, py, bw, bh, ts, rc.animFrame);
    }
  }
}

function drawBuildingIcon(ctx: CanvasRenderingContext2D, b: Building, px: number, py: number, bw: number, bh: number, ts: number, rc: RenderContext) {
  ctx.fillStyle = COLORS.ink;
  ctx.font = `${Math.max(6, ts * 0.35)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const icon = BUILDING_ICONS[b.type] || b.type.charAt(0).toUpperCase();
  ctx.fillText(icon, px + bw / 2, py + bh / 2);

  // Workers count indicator
  if (b.assignedWorkers.length > 0 && ts >= 18) {
    ctx.fillStyle = COLORS.brass;
    ctx.font = `${Math.max(5, ts * 0.22)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${b.assignedWorkers.length}`, px + bw - 1, py + 1);
  }
}

function drawFire(ctx: CanvasRenderingContext2D, px: number, py: number, bw: number, bh: number, ts: number, frame: number) {
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) {
    const fx = px + bw * (0.2 + i * 0.3) + Math.sin(frame * 0.3 + i) * ts * 0.1;
    const fy = py + bh * 0.5 - Math.abs(Math.sin(frame * 0.2 + i * 2)) * ts * 0.3;
    const fs = ts * (0.15 + Math.sin(frame * 0.15 + i) * 0.05);
    ctx.fillStyle = i === 1 ? COLORS.fireSecondary : COLORS.firePrimary;
    ctx.beginPath();
    ctx.moveTo(fx, fy + fs);
    ctx.quadraticCurveTo(fx - fs * 0.5, fy, fx, fy - fs);
    ctx.quadraticCurveTo(fx + fs * 0.5, fy, fx, fy + fs);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
