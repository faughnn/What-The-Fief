// Minimap rendering

import type { GameState } from '../../../world.js';
import { COLORS, TILE, type RenderContext } from './shared.js';

export function drawMinimap(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const scale = Math.min(w / gs.width, h / gs.height);

  ctx.fillStyle = COLORS.darkWood;
  ctx.fillRect(0, 0, w, h);

  // Terrain
  for (let y = 0; y < gs.height; y++) {
    for (let x = 0; x < gs.width; x++) {
      if (!gs.fog[y][x]) continue;
      const tile = gs.grid[y][x];
      switch (tile.terrain) {
        case 'grass': ctx.fillStyle = '#6a8a5a'; break;
        case 'forest': ctx.fillStyle = '#4a6a3a'; break;
        case 'water': ctx.fillStyle = '#4a6a7a'; break;
        case 'stone': ctx.fillStyle = '#7a7060'; break;
        case 'hill': ctx.fillStyle = '#6a7a4a'; break;
      }
      ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }

  // Buildings
  ctx.fillStyle = COLORS.buildingFill;
  for (const b of gs.buildings) {
    if (b.type === 'road') continue;
    ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.width * scale), Math.max(1, b.height * scale));
  }

  // Enemies
  ctx.fillStyle = COLORS.enemy;
  for (const e of gs.enemies) {
    ctx.fillRect(e.x * scale - 1, e.y * scale - 1, 2, 2);
  }

  // Villagers
  ctx.fillStyle = COLORS.villager;
  for (const v of gs.villagers) {
    ctx.fillRect(v.x * scale, v.y * scale, 1, 1);
  }

  // Camera viewport
  const cam = rc.camera;
  const ts = TILE * cam.zoom;
  const vx = cam.x * scale;
  const vy = cam.y * scale;
  const vw = rc.viewportWidth;
  const vh = rc.viewportHeight;
  ctx.strokeStyle = COLORS.brass;
  ctx.lineWidth = 1;
  ctx.strokeRect(vx, vy, (vw / ts) * scale, (vh / ts) * scale);

  // Border (compass rose style — simple brass border)
  ctx.strokeStyle = COLORS.brass;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
}
