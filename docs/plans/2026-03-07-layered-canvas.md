# Layered Canvas Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split single-canvas rendering into three stacked layers (terrain/world/overlay) with per-layer dirty tracking to skip unnecessary redraws.

**Architecture:** Three absolutely-positioned `<canvas>` elements. Each layer only redraws when its dirty flag is set. Terrain redraws on camera move only. World redraws on state change or camera move. Overlay redraws every frame.

**Tech Stack:** Svelte 5, Canvas 2D API, existing draw modules unchanged.

---

## Task 1: Fix minimap DOM query via RenderContext

**Files:**
- Modify: `src/ui/canvas/draw/shared.ts` (RenderContext interface)
- Modify: `src/ui/canvas/draw/minimap.ts:54-55` (querySelector removal)
- Modify: `src/ui/components/GameCanvas.svelte:83-86` (pass new fields)

**Step 1:** Add `viewportWidth` and `viewportHeight` to `RenderContext` in `shared.ts`:

```ts
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
```

**Step 2:** In `minimap.ts`, replace the querySelector hack (lines 54-55) with RenderContext fields:

```ts
  // Replace:
  const vw = (ctx.canvas.parentElement?.parentElement?.querySelector('.game-canvas') as HTMLCanvasElement)?.width ?? 800;
  const vh = (ctx.canvas.parentElement?.parentElement?.querySelector('.game-canvas') as HTMLCanvasElement)?.height ?? 600;
  // With:
  const vw = rc.viewportWidth;
  const vh = rc.viewportHeight;
```

**Step 3:** In `GameCanvas.svelte`, add the new fields when building `rc`:

```ts
    const rc: RenderContext = {
      camera: cam, animFrame, hoveredTile: ht,
      selectedEntity, mode, placingType, placingValid, gridBuildings,
      viewportWidth: canvas.width, viewportHeight: canvas.height,
    };
```

**Step 4:** Verify: `npx vite build`

---

## Task 2: Extract DPR resize helper

**Files:**
- Modify: `src/ui/components/GameCanvas.svelte`

**Step 1:** Add a `resizeCanvas` helper function at the top of the `<script>` block (after variable declarations). It returns the context and the display dimensions, and only resizes if needed:

```ts
  function resizeCanvas(cvs: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
    const ctx = cvs.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;
    if (cvs.width !== w * dpr || cvs.height !== h * dpr) {
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      ctx.scale(dpr, dpr);
    }
    return { ctx, w, h };
  }
```

**Step 2:** Replace the inline DPR logic in `render()` (lines 63-72) with a call:

```ts
    const { ctx, w: displayW, h: displayH } = resizeCanvas(canvas);
    ctx.clearRect(0, 0, displayW, displayH);
```

**Step 3:** Verify: `npx vite build`

---

## Task 3: Three stacked canvases

**Files:**
- Modify: `src/ui/components/GameCanvas.svelte` (template, CSS, script)

**Step 1:** Update template — replace single game canvas with three stacked canvases:

```svelte
<div class="map-container">
  <canvas bind:this={terrainCanvas} class="layer-canvas terrain-canvas"></canvas>
  <canvas bind:this={worldCanvas} class="layer-canvas"></canvas>
  <canvas bind:this={overlayCanvas} class="layer-canvas"></canvas>
  <canvas bind:this={minimap} class="minimap" width="160" height="160"></canvas>
</div>
```

**Step 2:** Update CSS — stack layers with absolute positioning:

```css
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
```

**Step 3:** Update script variables — replace `let canvas` with three refs:

```ts
  let terrainCanvas: HTMLCanvasElement;
  let worldCanvas: HTMLCanvasElement;
  let overlayCanvas: HTMLCanvasElement;
```

**Step 4:** Update `onMount` — attach camera controls to `terrainCanvas` (bottom layer, has pointer-events). Update `centerOnTile` call to use `terrainCanvas`:

```ts
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
```

**Step 5:** Temporarily update `render()` to draw all layers to their respective canvases (same content split, no dirty optimization yet — that's Task 4):

```ts
  function render() {
    rafId = requestAnimationFrame(render);
    animFrame++;
    const gs = $gameState;
    if (!terrainCanvas || !worldCanvas || !overlayCanvas || !gs) return;

    const isDirty = $cameraDirty || $stateChanged;
    if (!isDirty && animFrame % 4 !== 0) return;
    cameraDirty.set(false);
    stateChanged.set(false);

    if (animFrame % 10 === 0) rebuildGridBuildings(gs);

    const cam = $camera;
    const ht = $hoveredTile;
    const { ctx: tCtx, w: displayW, h: displayH } = resizeCanvas(terrainCanvas);
    const { ctx: wCtx } = resizeCanvas(worldCanvas);
    const { ctx: oCtx } = resizeCanvas(overlayCanvas);

    const rc: RenderContext = {
      camera: cam, animFrame, hoveredTile: ht,
      selectedEntity, mode, placingType, placingValid, gridBuildings,
      viewportWidth: terrainCanvas.width, viewportHeight: terrainCanvas.height,
    };

    const ts = 16 * cam.zoom;

    // Terrain layer
    tCtx.clearRect(0, 0, displayW, displayH);
    tCtx.save();
    tCtx.translate(-cam.x * ts, -cam.y * ts);
    drawTerrain(tCtx, gs, rc);
    drawTerritory(tCtx, gs, rc);
    drawFog(tCtx, gs, rc);
    tCtx.restore();

    // World layer
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

    // Overlay layer
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

    // Minimap
    if (minimap) {
      const mctx = minimap.getContext('2d')!;
      drawMinimap(mctx, gs, rc);
    }
  }
```

**Step 6:** Verify: `npx vite build` — then `npm run dev` and visually confirm all layers render correctly (terrain visible, buildings on top, overlays working).

---

## Task 4: Per-layer dirty flags

**Files:**
- Modify: `src/ui/canvas/camera.ts` (replace single cameraDirty with terrainDirty + worldDirty)
- Modify: `src/ui/components/GameCanvas.svelte` (per-layer skip logic, reactive gridBuildings)
- Modify: `src/ui/stores/gameState.ts` (stateChanged stays as-is)

**Step 1:** In `camera.ts`, replace `cameraDirty` with `terrainDirty` and `worldDirty`. Camera changes dirty both:

```ts
export const terrainDirty = writable(true);
export const worldDirty = writable(true);

// Camera changes dirty both terrain and world
camera.subscribe(() => {
  terrainDirty.set(true);
  worldDirty.set(true);
});
```

Remove the old `cameraDirty` export.

**Step 2:** In `GameCanvas.svelte`, update imports:

```ts
  import { camera, hoveredTile, setupCameraControls, centerOnTile, terrainDirty, worldDirty } from '../canvas/camera';
```

**Step 3:** Replace the render function with per-layer dirty logic. Also make gridBuildings reactive to stateChanged instead of polling:

```ts
  let lastStateRef: GameState | null = null;

  function render() {
    rafId = requestAnimationFrame(render);
    animFrame++;
    const gs = $gameState;
    if (!terrainCanvas || !worldCanvas || !overlayCanvas || !gs) return;

    // Rebuild gridBuildings on state change (not polling)
    if (gs !== lastStateRef) {
      lastStateRef = gs;
      rebuildGridBuildings(gs);
    }

    const cam = $camera;
    const ht = $hoveredTile;
    const { ctx: tCtx, w: displayW, h: displayH } = resizeCanvas(terrainCanvas);
    const { ctx: wCtx } = resizeCanvas(worldCanvas);
    const { ctx: oCtx } = resizeCanvas(overlayCanvas);

    const rc: RenderContext = {
      camera: cam, animFrame, hoveredTile: ht,
      selectedEntity, mode, placingType, placingValid, gridBuildings,
      viewportWidth: terrainCanvas.width, viewportHeight: terrainCanvas.height,
    };

    const ts = 16 * cam.zoom;

    // Terrain layer — only on camera move or territory/fog change
    if ($terrainDirty) {
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
    if ($worldDirty || $stateChanged) {
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
    if (minimap && ($terrainDirty || $worldDirty || $stateChanged || animFrame % 30 === 0)) {
      const mctx = minimap.getContext('2d')!;
      drawMinimap(mctx, gs, rc);
    }
  }
```

Note: The minimap check uses a fallback `animFrame % 30` to ensure it still updates periodically even if dirty flags were already cleared above. Alternatively, capture dirty state before clearing:

```ts
    const tDirty = $terrainDirty;
    const wDirty = $worldDirty || $stateChanged;
    // ... use tDirty/wDirty for layer checks and minimap ...
```

Use this captured-flag pattern instead — it's cleaner. The full render becomes:

```ts
    const tDirty = $terrainDirty;
    const wDirty = $worldDirty || $stateChanged;

    if (tDirty) {
      // ... terrain draw ...
      terrainDirty.set(false);
    }

    if (wDirty) {
      // ... world draw ...
      worldDirty.set(false);
      stateChanged.set(false);
    }

    // ... overlay always draws ...

    if (minimap && (tDirty || wDirty)) {
      const mctx = minimap.getContext('2d')!;
      drawMinimap(mctx, gs, rc);
    }
```

**Step 4:** Verify: `npx vite build`

**Step 5:** Verify visually: `npm run dev` — confirm:
- Terrain stays cached when camera is still and game is running
- Entities update with game ticks
- Night/weather/hover overlay always animates
- Panning redraws all layers
- Minimap updates with game state

---

## Task 5: Final verification and commit

**Step 1:** Run: `npx vite build` — expect clean build

**Step 2:** Run: `npx tsx src/tests/run-all.ts -q` — expect all tests pass (UI changes don't affect simulation tests)

**Step 3:** Commit:

```bash
git add src/ui/canvas/camera.ts src/ui/canvas/draw/shared.ts src/ui/canvas/draw/minimap.ts src/ui/components/GameCanvas.svelte
git commit -m "feat: layered canvas rendering with per-layer dirty tracking

Split single canvas into three stacked layers (terrain/world/overlay).
Terrain only redraws on camera move. World redraws on state change.
Overlay redraws every frame. Fixes minimap DOM querySelector hack."
```
