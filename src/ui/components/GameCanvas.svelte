<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameState, stateChanged } from '../stores/gameState';
  import { camera, hoveredTile, setupCameraControls, centerOnTile, terrainDirty, worldDirty } from '../canvas/camera';
  import {
    drawTerrain, drawTerritory, drawBuildings, drawResourceDrops,
    drawAnimals, drawEnemies, drawVillagers, drawCaravans,
    drawCamps, drawVillages, drawExpeditions, drawPOIs,
    drawFog, drawPlacementPreview, drawClaimableOverlay,
    drawSelection, drawHover, drawNight, drawWeather, drawMinimap,
    type RenderContext,
  } from '../canvas/draw/index.js';
  import type { Building } from '../../world.js';
  import type { GameState } from '../../world.js';

  interface Props {
    selectedEntity?: { type: string; id: string } | null;
    mode?: 'normal' | 'placing' | 'claiming';
    placingType?: string | null;
    placingValid?: boolean;
    onTileClick?: (tile: { x: number; y: number }, e: MouseEvent) => void;
  }

  let {
    selectedEntity = null,
    mode = 'normal',
    placingType = null,
    placingValid = false,
    onTileClick,
  }: Props = $props();

  let terrainCanvas: HTMLCanvasElement;
  let worldCanvas: HTMLCanvasElement;
  let overlayCanvas: HTMLCanvasElement;
  let minimap: HTMLCanvasElement;
  let animFrame = 0;
  let gridBuildings = new Map<string, Building>();
  let rafId: number;
  let centered = false;
  let cleanupCamera: (() => void) | null = null;
  let lastStateRef: GameState | null = null;

  function rebuildGridBuildings(gs: GameState | null) {
    gridBuildings = new Map();
    if (!gs) return;
    for (const b of gs.buildings) {
      for (let dy = 0; dy < b.height; dy++) {
        for (let dx = 0; dx < b.width; dx++) {
          gridBuildings.set(`${b.x + dx},${b.y + dy}`, b);
        }
      }
    }
  }

  function resizeCanvas(cvs: HTMLCanvasElement): { w: number; h: number } {
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;
    if (cvs.width !== w * dpr || cvs.height !== h * dpr) {
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      const ctx = cvs.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  }

  function render() {
    rafId = requestAnimationFrame(render);
    animFrame++;
    const gs = $gameState;
    if (!terrainCanvas || !worldCanvas || !overlayCanvas || !gs) return;

    // Rebuild gridBuildings reactively on state change
    if (gs !== lastStateRef) {
      lastStateRef = gs;
      rebuildGridBuildings(gs);
    }

    // Capture dirty state before clearing
    const tDirty = $terrainDirty;
    const wDirty = $worldDirty || $stateChanged;

    const cam = $camera;
    const ht = $hoveredTile;
    const { w: displayW, h: displayH } = resizeCanvas(terrainCanvas);
    resizeCanvas(worldCanvas);
    resizeCanvas(overlayCanvas);

    const rc: RenderContext = {
      camera: cam, animFrame, hoveredTile: ht,
      selectedEntity, mode, placingType, placingValid, gridBuildings,
      viewportWidth: terrainCanvas.width, viewportHeight: terrainCanvas.height,
    };

    const ts = 16 * cam.zoom;

    // Terrain layer — only on camera move or territory/fog change
    if (tDirty) {
      const tCtx = terrainCanvas.getContext('2d')!;
      tCtx.clearRect(0, 0, displayW, displayH);
      tCtx.save();
      tCtx.translate(-cam.x * ts, -cam.y * ts);
      drawTerrain(tCtx, gs, rc);
      drawTerritory(tCtx, gs, rc);
      drawFog(tCtx, gs, rc);
      tCtx.restore();
      terrainDirty.set(false);
    }

    // World layer — on state change or camera move
    if (wDirty) {
      const wCtx = worldCanvas.getContext('2d')!;
      wCtx.clearRect(0, 0, displayW, displayH);
      wCtx.save();
      wCtx.translate(-cam.x * ts, -cam.y * ts);
      drawBuildings(wCtx, gs, rc);
      drawResourceDrops(wCtx, gs, rc);
      drawAnimals(wCtx, gs, rc);
      drawEnemies(wCtx, gs, rc);
      drawVillagers(wCtx, gs, rc);
      drawCaravans(wCtx, gs, rc);
      drawCamps(wCtx, gs, rc);
      drawVillages(wCtx, gs, rc);
      drawExpeditions(wCtx, gs, rc);
      drawPOIs(wCtx, gs, rc);
      wCtx.restore();
      worldDirty.set(false);
      stateChanged.set(false);
    }

    // Overlay layer — every frame (night/weather animate)
    const oCtx = overlayCanvas.getContext('2d')!;
    oCtx.clearRect(0, 0, displayW, displayH);
    oCtx.save();
    oCtx.translate(-cam.x * ts, -cam.y * ts);
    drawPlacementPreview(oCtx, gs, rc);
    drawClaimableOverlay(oCtx, gs, rc);
    drawSelection(oCtx, gs, rc);
    drawHover(oCtx, gs, rc);
    drawNight(oCtx, gs, rc);
    drawWeather(oCtx, gs, rc);
    oCtx.restore();

    // Minimap — only when terrain or world changed
    if (minimap && (tDirty || wDirty)) {
      const mctx = minimap.getContext('2d')!;
      drawMinimap(mctx, gs, rc);
    }
  }

  onMount(() => {
    cleanupCamera = setupCameraControls(terrainCanvas, onTileClick);
    rebuildGridBuildings($gameState);
    const unsub = gameState.subscribe(gs => {
      if (gs && gs.villagers.length > 0 && !centered) {
        centered = true;
        const v = gs.villagers[0];
        centerOnTile(v.x, v.y, terrainCanvas.clientWidth, terrainCanvas.clientHeight);
        unsub();
      }
    });
    rafId = requestAnimationFrame(render);
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
    if (cleanupCamera) cleanupCamera();
  });
</script>

<div class="map-container">
  <canvas bind:this={terrainCanvas} class="layer-canvas terrain-canvas"></canvas>
  <canvas bind:this={worldCanvas} class="layer-canvas"></canvas>
  <canvas bind:this={overlayCanvas} class="layer-canvas"></canvas>
  <canvas bind:this={minimap} class="minimap" width="160" height="160"></canvas>
</div>

<style>
  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .layer-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .terrain-canvas {
    pointer-events: auto;
    cursor: default;
    box-shadow: inset 0 0 30px rgba(0,0,0,0.3);
  }
  .minimap {
    position: absolute;
    bottom: 8px;
    left: 8px;
    border: 2px solid #b8964e;
    background: #1e1810;
    z-index: 1;
  }
</style>
