// Shared constants, types, and helpers for canvas rendering

import type { GameState, Building, BuildingType } from '../../../world.js';

export interface RenderContext {
  camera: { x: number; y: number; zoom: number };
  animFrame: number;
  hoveredTile: { x: number; y: number } | null;
  selectedEntity: { type: string; id: string } | null;
  mode: 'normal' | 'placing' | 'claiming';
  placingType: string | null;
  placingValid: boolean;
  gridBuildings: Map<string, Building>;
  viewportWidth: number;
  viewportHeight: number;
}

export const TILE = 16;

// === COLOR PALETTE (Cartographer's War Table) ===
export const COLORS = {
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

export function getViewport(ctx: CanvasRenderingContext2D, cam: RenderContext['camera']) {
  const ts = TILE * cam.zoom;
  const startX = Math.floor(cam.x) - 1;
  const startY = Math.floor(cam.y) - 1;
  const endX = Math.ceil(cam.x + ctx.canvas.width / ts) + 1;
  const endY = Math.ceil(cam.y + ctx.canvas.height / ts) + 1;
  return { startX, startY, endX, endY, ts };
}

export function inBounds(x: number, y: number, gs: GameState): boolean {
  return x >= 0 && y >= 0 && x < gs.width && y < gs.height;
}
