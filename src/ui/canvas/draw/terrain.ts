// Terrain and territory rendering

import type { GameState } from '../../../world.js';
import { COLORS, getViewport, inBounds, type RenderContext } from './shared.js';

export function drawTerrain(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (!inBounds(x, y, gs)) continue;
      const tile = gs.grid[y][x];
      const px = x * ts;
      const py = y * ts;

      // Check if road
      if (rc.gridBuildings.has(`${x},${y}`)) {
        const b = rc.gridBuildings.get(`${x},${y}`)!;
        if (b.type === 'road' && b.constructed) {
          ctx.fillStyle = COLORS.road;
          ctx.fillRect(px, py, ts, ts);
          // Dashed trail pattern
          ctx.strokeStyle = COLORS.roadDash;
          ctx.lineWidth = Math.max(1, ts * 0.06);
          ctx.setLineDash([ts * 0.15, ts * 0.1]);
          ctx.beginPath();
          ctx.moveTo(px + ts * 0.5, py);
          ctx.lineTo(px + ts * 0.5, py + ts);
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
      }

      switch (tile.terrain) {
        case 'grass': {
          // Subtle variation based on position
          const variation = ((x * 7 + y * 13) % 3);
          ctx.fillStyle = variation === 0 ? COLORS.grass : variation === 1 ? COLORS.grassAlt : '#8aaa78';
          ctx.fillRect(px, py, ts, ts);
          // Tiny grass marks
          if ((x + y) % 5 === 0 && ts > 6) {
            ctx.strokeStyle = '#7a9a6a';
            ctx.lineWidth = Math.max(0.5, ts * 0.04);
            ctx.beginPath();
            ctx.moveTo(px + ts * 0.3, py + ts * 0.7);
            ctx.lineTo(px + ts * 0.35, py + ts * 0.45);
            ctx.moveTo(px + ts * 0.6, py + ts * 0.8);
            ctx.lineTo(px + ts * 0.65, py + ts * 0.55);
            ctx.stroke();
          }
          break;
        }
        case 'forest': {
          ctx.fillStyle = '#6a8a5a';
          ctx.fillRect(px, py, ts, ts);
          // Stylized tree clusters (2-3 triangles with ink outlines)
          if (ts > 4) {
            const treeX = px + ts * 0.5;
            const treeY = py + ts * 0.3;
            const s = ts * 0.35;
            // Tree canopy (triangle)
            ctx.fillStyle = COLORS.forest;
            ctx.beginPath();
            ctx.moveTo(treeX, treeY - s * 0.6);
            ctx.lineTo(treeX - s * 0.5, treeY + s * 0.4);
            ctx.lineTo(treeX + s * 0.5, treeY + s * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#4a6a3a';
            ctx.lineWidth = Math.max(0.5, ts * 0.04);
            ctx.stroke();
            // Trunk
            ctx.fillStyle = COLORS.forestTrunk;
            ctx.fillRect(treeX - ts * 0.04, treeY + s * 0.4, ts * 0.08, ts * 0.2);
          }
          break;
        }
        case 'water': {
          ctx.fillStyle = COLORS.water;
          ctx.fillRect(px, py, ts, ts);
          // Cartographic wavy ink strokes
          if (ts > 5) {
            ctx.strokeStyle = COLORS.waterDark;
            ctx.lineWidth = Math.max(0.5, ts * 0.03);
            const waveOffset = (rc.animFrame * 0.02 + x * 0.5) % (Math.PI * 2);
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              const baseY = py + ts * (0.25 + i * 0.25);
              for (let wx = 0; wx <= ts; wx += ts * 0.1) {
                const wy = Math.sin(waveOffset + wx * 0.3) * ts * 0.04;
                if (wx === 0) ctx.moveTo(px + wx, baseY + wy);
                else ctx.lineTo(px + wx, baseY + wy);
              }
              ctx.stroke();
            }
          }
          break;
        }
        case 'stone': {
          const sv = ((x * 11 + y * 7) % 2);
          ctx.fillStyle = sv === 0 ? COLORS.stone : COLORS.stoneAlt;
          ctx.fillRect(px, py, ts, ts);
          // Stippled texture
          if (ts > 6) {
            ctx.fillStyle = '#7a7060';
            for (let i = 0; i < 4; i++) {
              const dotX = px + ((x * 3 + i * 7) % 8) / 8 * ts;
              const dotY = py + ((y * 5 + i * 11) % 8) / 8 * ts;
              ctx.fillRect(dotX, dotY, Math.max(1, ts * 0.06), Math.max(1, ts * 0.06));
            }
          }
          break;
        }
        case 'hill': {
          ctx.fillStyle = COLORS.hill;
          ctx.fillRect(px, py, ts, ts);
          // Hatched elevation lines (cartographic style)
          if (ts > 5) {
            ctx.strokeStyle = COLORS.hillLine;
            ctx.lineWidth = Math.max(0.5, ts * 0.03);
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              const cy = py + ts * (0.2 + i * 0.25);
              ctx.moveTo(px + ts * 0.1, cy + ts * 0.05);
              ctx.quadraticCurveTo(px + ts * 0.5, cy - ts * 0.08, px + ts * 0.9, cy + ts * 0.05);
              ctx.stroke();
            }
          }
          break;
        }
      }

      // Deposit indicators
      if (tile.deposit && ts > 6) {
        ctx.fillStyle = tile.deposit === 'iron' ? '#8a6050' : tile.deposit === 'herbs' ? '#5a8a4a' : '#7a8a50';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(px + ts * 0.8, py + ts * 0.8, ts * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

export function drawTerritory(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);
  ctx.strokeStyle = COLORS.territoryBorder;
  ctx.lineWidth = Math.max(1, ts * 0.06);
  ctx.setLineDash([ts * 0.15, ts * 0.1]);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (!inBounds(x, y, gs) || !gs.territory[y][x]) continue;
      const px = x * ts;
      const py = y * ts;
      // Draw border edges where territory meets non-territory
      if (!inBounds(x, y - 1, gs) || !gs.territory[y - 1]?.[x]) {
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + ts, py); ctx.stroke();
      }
      if (!inBounds(x, y + 1, gs) || !gs.territory[y + 1]?.[x]) {
        ctx.beginPath(); ctx.moveTo(px, py + ts); ctx.lineTo(px + ts, py + ts); ctx.stroke();
      }
      if (!inBounds(x - 1, y, gs) || !gs.territory[y]?.[x - 1]) {
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + ts); ctx.stroke();
      }
      if (!inBounds(x + 1, y, gs) || !gs.territory[y]?.[x + 1]) {
        ctx.beginPath(); ctx.moveTo(px + ts, py); ctx.lineTo(px + ts, py + ts); ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
}
