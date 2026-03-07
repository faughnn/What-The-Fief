// Canvas rendering — Cartographer's War Table aesthetic
// All procedural drawing, no sprites. Warm parchment, ink outlines, brass accents.

import type { GameState, Building, Villager, EnemyEntity, AnimalEntity, ResourceDrop, BanditCamp, NpcSettlement, Caravan, Expedition, PointOfInterest, Terrain, BuildingType } from '../../world.js';
import { TICKS_PER_DAY, NIGHT_TICKS } from '../../world.js';

export interface RenderContext {
  camera: { x: number; y: number; zoom: number };
  animFrame: number;
  hoveredTile: { x: number; y: number } | null;
  selectedEntity: { type: string; id: string } | null;
  mode: 'normal' | 'placing' | 'claiming';
  placingType: string | null;
  placingValid: boolean;
  gridBuildings: Map<string, Building>;
}

const TILE = 16;

// === COLOR PALETTE (Cartographer's War Table) ===
const COLORS = {
  // Terrain
  grass: '#8fa87a',
  grassAlt: '#95ad82',
  forest: '#5a7a4a',
  forestTrunk: '#6b5a42',
  water: '#5a7a8a',
  waterDark: '#4a6a7a',
  stone: '#9a9080',
  stoneAlt: '#8a8070',
  hill: '#7a8a5a',
  hillLine: '#6a7a4a',
  road: '#b8a888',
  roadDash: '#a89878',

  // UI
  parchment: '#f0e6d0',
  ink: '#3a3025',
  brass: '#b8964e',
  waxRed: '#a83a2a',
  forestGreen: '#4a7a42',
  fadedBlue: '#5a7a8a',
  darkWood: '#2a2118',

  // Entities
  villager: '#e8d4a0',
  villagerOutline: '#6b5a42',
  enemy: '#c04030',
  enemyGlow: '#ff6050',
  animal: '#8a7a5a',
  animalHostile: '#a84030',
  resourceDrop: '#d4b06a',

  // Buildings
  buildingFill: '#d4c4a4',
  buildingOutline: '#5a4a30',
  constructionHatch: '#a09070',
  damageCrack: '#6a3020',
  firePrimary: '#e86820',
  fireSecondary: '#ffaa30',

  // Territory
  territoryBorder: '#b8964e',
  fog: '#3a3025',
  fogEdge: '#5a4a35',

  // Night
  nightOverlay: 'rgba(20, 25, 50, 0.45)',
  candleGlow: 'rgba(255, 180, 80, 0.15)',
};

// === BUILDING CATEGORY COLORS ===
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

function getBuildingColor(type: BuildingType): string {
  return BUILDING_COLORS[type] || COLORS.buildingFill;
}

// === VIEWPORT HELPERS ===
function getViewport(ctx: CanvasRenderingContext2D, cam: RenderContext['camera']) {
  const ts = TILE * cam.zoom;
  const startX = Math.floor(cam.x) - 1;
  const startY = Math.floor(cam.y) - 1;
  const endX = Math.ceil(cam.x + ctx.canvas.width / ts) + 1;
  const endY = Math.ceil(cam.y + ctx.canvas.height / ts) + 1;
  return { startX, startY, endX, endY, ts };
}

function inBounds(x: number, y: number, gs: GameState): boolean {
  return x >= 0 && y >= 0 && x < gs.width && y < gs.height;
}

// === TERRAIN ===
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

// === TERRITORY ===
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

// === BUILDINGS ===
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

// === RESOURCE DROPS ===
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

// === VILLAGERS ===
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
  const s = ts * 0.15;
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

// === ENEMIES ===
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

// === ANIMALS ===
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

// === CARAVANS ===
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

// === BANDIT CAMPS ===
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

// === NPC VILLAGES ===
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

// === EXPEDITIONS (on-map squad banners) ===
export function drawExpeditions(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  // Expeditions are represented by their member villagers,
  // but we draw a banner at the expedition target/current position
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

// === POINTS OF INTEREST ===
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

// === FOG OF WAR ===
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

// === PLACEMENT PREVIEW ===
export function drawPlacementPreview(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  if (rc.mode !== 'placing' || !rc.hoveredTile || !rc.placingType) return;

  const { x, y } = rc.hoveredTile;
  const ts = TILE * rc.camera.zoom;
  const px = x * ts;
  const py = y * ts;

  // TODO: look up building template for width/height
  const bw = ts; // default 1x1
  const bh = ts;

  ctx.fillStyle = rc.placingValid ? 'rgba(74, 122, 66, 0.4)' : 'rgba(168, 58, 42, 0.4)';
  ctx.fillRect(px, py, bw, bh);
  ctx.strokeStyle = rc.placingValid ? COLORS.forestGreen : COLORS.waxRed;
  ctx.lineWidth = Math.max(1, ts * 0.06);
  ctx.setLineDash([ts * 0.1, ts * 0.08]);
  ctx.strokeRect(px, py, bw, bh);
  ctx.setLineDash([]);
}

// === CLAIM OVERLAY ===
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

// === SELECTION HIGHLIGHT ===
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

// === HOVER HIGHLIGHT ===
export function drawHover(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext) {
  if (!rc.hoveredTile || rc.mode !== 'normal') return;
  const { x, y } = rc.hoveredTile;
  if (!inBounds(x, y, gs)) return;

  const ts = TILE * rc.camera.zoom;
  ctx.strokeStyle = 'rgba(240, 230, 208, 0.5)';
  ctx.lineWidth = Math.max(1, ts * 0.04);
  ctx.strokeRect(x * ts, y * ts, ts, ts);
}

// === NIGHT OVERLAY ===
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

// === WEATHER OVERLAY ===
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

// === MINIMAP ===
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
  const vw = (ctx.canvas.parentElement?.parentElement?.querySelector('.game-canvas') as HTMLCanvasElement)?.width ?? 800;
  const vh = (ctx.canvas.parentElement?.parentElement?.querySelector('.game-canvas') as HTMLCanvasElement)?.height ?? 600;
  ctx.strokeStyle = COLORS.brass;
  ctx.lineWidth = 1;
  ctx.strokeRect(vx, vy, (vw / ts) * scale, (vh / ts) * scale);

  // Border (compass rose style — simple brass border)
  ctx.strokeStyle = COLORS.brass;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
}
