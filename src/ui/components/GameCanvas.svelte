<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameState, stateChanged } from '../stores/gameState';
  import { camera, hoveredTile, setupCameraControls, centerOnTile, cameraDirty } from '../canvas/camera';
  import {
    drawTerrain, drawTerritory, drawBuildings, drawResourceDrops,
    drawAnimals, drawEnemies, drawVillagers, drawCaravans,
    drawCamps, drawVillages, drawExpeditions, drawPOIs,
    drawFog, drawPlacementPreview, drawClaimableOverlay,
    drawSelection, drawHover, drawNight, drawWeather, drawMinimap,
    type RenderContext,
  } from '../canvas/draw/index.js';
  import type { Building } from '../../world.js';

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

  let canvas: HTMLCanvasElement;
  let minimap: HTMLCanvasElement;
  let animFrame = 0;
  let gridBuildings = new Map<string, Building>();
  let rafId: number;
  let centered = false;
  let cleanupCamera: (() => void) | null = null;

  function rebuildGridBuildings(gs: any) {
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

  function render() {
    rafId = requestAnimationFrame(render);
    animFrame++;
    const gs = $gameState;
    if (!gs || !canvas) return;

    const isDirty = $cameraDirty || $stateChanged;
    // Skip full redraw if nothing changed (still redraw every 4th frame for animations)
    if (!isDirty && animFrame % 4 !== 0) return;
    cameraDirty.set(false);
    stateChanged.set(false);

    const ctx = canvas.getContext('2d')!;
    // Match canvas pixel size to display size
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
      canvas.width = displayW * dpr;
      canvas.height = displayH * dpr;
      ctx.scale(dpr, dpr);
    }
    ctx.clearRect(0, 0, displayW, displayH);

    // Rebuild grid buildings periodically (not every frame)
    if (animFrame % 10 === 0) {
      rebuildGridBuildings(gs);
    }

    const cam = $camera;
    const ht = $hoveredTile;

    const rc: RenderContext = {
      camera: cam, animFrame, hoveredTile: ht,
      selectedEntity, mode, placingType, placingValid, gridBuildings,
    };

    const ts = 16 * cam.zoom;
    ctx.save();
    ctx.translate(-cam.x * ts, -cam.y * ts);

    drawTerrain(ctx, gs, rc);
    drawTerritory(ctx, gs, rc);
    drawBuildings(ctx, gs, rc);
    drawResourceDrops(ctx, gs, rc);
    drawAnimals(ctx, gs, rc);
    drawEnemies(ctx, gs, rc);
    drawVillagers(ctx, gs, rc);
    drawCaravans(ctx, gs, rc);
    drawCamps(ctx, gs, rc);
    drawVillages(ctx, gs, rc);
    drawExpeditions(ctx, gs, rc);
    drawPOIs(ctx, gs, rc);
    drawFog(ctx, gs, rc);
    drawPlacementPreview(ctx, gs, rc);
    drawClaimableOverlay(ctx, gs, rc);
    drawSelection(ctx, gs, rc);
    drawHover(ctx, gs, rc);
    drawNight(ctx, gs, rc);
    drawWeather(ctx, gs, rc);

    ctx.restore();

    // Minimap
    if (minimap) {
      const mctx = minimap.getContext('2d')!;
      drawMinimap(mctx, gs, rc);
    }
  }

  onMount(() => {
    cleanupCamera = setupCameraControls(canvas, onTileClick);
    rebuildGridBuildings($gameState);

    // Center on first villager once game starts
    const unsub = gameState.subscribe(gs => {
      if (gs && gs.villagers.length > 0 && !centered) {
        centered = true;
        const v = gs.villagers[0];
        centerOnTile(v.x, v.y, canvas.clientWidth, canvas.clientHeight);
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
  <canvas bind:this={canvas} class="game-canvas"></canvas>
  <canvas bind:this={minimap} class="minimap" width="160" height="160"></canvas>
</div>

<style>
  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .game-canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: default;
    box-shadow: inset 0 0 30px rgba(0,0,0,0.3);
  }
  .minimap {
    position: absolute;
    bottom: 8px;
    left: 8px;
    border: 2px solid #b8964e;
    background: #1e1810;
  }
</style>
