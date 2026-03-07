// Overlay rendering — fog, night, weather, placement preview, claim overlay, selection, hover

import type { GameState, BuildingType } from '../../../world.js';
import { TICKS_PER_DAY, NIGHT_TICKS, BUILDING_TEMPLATES } from '../../../world.js';
import { COLORS, TILE, getViewport, inBounds, type RenderContext } from './shared.js';

export function drawFog(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (!inBounds(x, y, gs)) continue;
      if (gs.fog[y][x]) continue; // revealed

      const px = x * ts;
      const py = y * ts;

      // Check if adjacent to revealed tile (edge)
      let isEdge = false;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny, gs) && gs.fog[ny][nx]) { isEdge = true; break; }
      }

      ctx.fillStyle = isEdge ? COLORS.fogEdge : COLORS.fog;
      ctx.fillRect(px, py, ts, ts);
    }
  }
}

export function drawNight(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  const dayTick = gs.tick % TICKS_PER_DAY;
  if (dayTick >= NIGHT_TICKS) return; // daytime

  const nightProgress = dayTick / NIGHT_TICKS;
  // Stronger at midnight (0.5 progress), lighter at dawn/dusk
  const intensity = nightProgress < 0.5
    ? 0.3 + nightProgress * 0.4  // getting darker toward midnight
    : 0.5 - (nightProgress - 0.5) * 0.4;  // getting lighter toward dawn

  // Blue-purple overlay with vignette
  ctx.fillStyle = `rgba(20, 25, 50, ${intensity})`;
  const cam = rc.camera;
  const ts = TILE * cam.zoom;
  ctx.fillRect(cam.x * ts, cam.y * ts, ctx.canvas.width, ctx.canvas.height);

  // Candlelight glow from occupied buildings
  if (intensity > 0.2) {
    for (const b of gs.buildings) {
      if (!b.constructed || b.type === 'wall' || b.type === 'fence' || b.type === 'road' || b.type === 'gate') continue;
      // Check if any villager is here (sleeping or working)
      const hasOccupant = gs.villagers.some(v =>
        (v.state === 'sleeping' || v.state === 'working') &&
        v.x >= b.x && v.x < b.x + b.width && v.y >= b.y && v.y < b.y + b.height
      );
      if (!hasOccupant) continue;

      const bx = (b.x + b.width / 2) * ts;
      const by = (b.y + b.height / 2) * ts;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, ts * 2);
      grad.addColorStop(0, `rgba(255, 180, 80, ${intensity * 0.3})`);
      grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(bx - ts * 2, by - ts * 2, ts * 4, ts * 4);
    }
  }
}

export function drawWeather(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  if (gs.weather === 'clear') return;

  const cam = rc.camera;
  const ts = TILE * cam.zoom;
  const vx = cam.x * ts;
  const vy = cam.y * ts;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  const isStorm = gs.weather === 'storm';
  const density = isStorm ? 60 : 30;
  const alpha = isStorm ? 0.3 : 0.15;

  ctx.strokeStyle = `rgba(200, 210, 230, ${alpha})`;
  ctx.lineWidth = isStorm ? 2 : 1;

  for (let i = 0; i < density; i++) {
    const seed = (i * 7919 + rc.animFrame * 3) % 10000;
    const rx = vx + (seed % w);
    const ry = vy + ((seed * 7 + rc.animFrame * 8) % h);
    const len = isStorm ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - len * 0.3, ry + len);
    ctx.stroke();
  }

  // Storm flash
  if (isStorm && rc.animFrame % 120 < 3) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(vx, vy, w, h);
  }
}

export function drawPlacementPreview(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  if (rc.mode !== 'placing' || !rc.hoveredTile || !rc.placingType) return;

  const { x, y } = rc.hoveredTile;
  const ts = TILE * rc.camera.zoom;
  const px = x * ts;
  const py = y * ts;

  const template = BUILDING_TEMPLATES[rc.placingType as BuildingType];
  const bw = (template?.width ?? 1) * ts;
  const bh = (template?.height ?? 1) * ts;

  ctx.fillStyle = rc.placingValid ? 'rgba(74, 122, 66, 0.4)' : 'rgba(168, 58, 42, 0.4)';
  ctx.fillRect(px, py, bw, bh);
  ctx.strokeStyle = rc.placingValid ? COLORS.forestGreen : COLORS.waxRed;
  ctx.lineWidth = Math.max(1, ts * 0.06);
  ctx.setLineDash([ts * 0.1, ts * 0.08]);
  ctx.strokeRect(px, py, bw, bh);
  ctx.setLineDash([]);
}

export function drawClaimableOverlay(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  if (rc.mode !== 'claiming') return;
  const { startX, startY, endX, endY, ts } = getViewport(ctx, rc.camera);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (!inBounds(x, y, gs) || gs.territory[y][x]) continue;
      // Check if adjacent to territory
      let adj = false;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny, gs) && gs.territory[ny][nx]) { adj = true; break; }
      }
      if (!adj) continue;

      ctx.fillStyle = 'rgba(184, 150, 78, 0.2)';
      ctx.fillRect(x * ts, y * ts, ts, ts);
      ctx.strokeStyle = 'rgba(184, 150, 78, 0.5)';
      ctx.lineWidth = Math.max(0.5, ts * 0.03);
      ctx.strokeRect(x * ts, y * ts, ts, ts);
    }
  }
}

export function drawSelection(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  if (!rc.selectedEntity) return;
  const { type, id } = rc.selectedEntity;

  if (type === 'building') {
    const b = gs.buildings.find(b => b.id === id);
    if (!b) return;
    const ts = TILE * rc.camera.zoom;
    ctx.strokeStyle = COLORS.brass;
    ctx.lineWidth = Math.max(2, ts * 0.1);
    ctx.strokeRect(b.x * ts - 1, b.y * ts - 1, b.width * ts + 2, b.height * ts + 2);
  }
  // Villager/enemy/animal selection rings drawn in their respective draw functions
}

export function drawHover(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  if (!rc.hoveredTile || rc.mode !== 'normal') return;
  const { x, y } = rc.hoveredTile;
  if (!inBounds(x, y, gs)) return;

  const ts = TILE * rc.camera.zoom;
  ctx.strokeStyle = 'rgba(240, 230, 208, 0.5)';
  ctx.lineWidth = Math.max(1, ts * 0.04);
  ctx.strokeRect(x * ts, y * ts, ts, ts);
}
