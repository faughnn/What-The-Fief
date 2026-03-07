# Layered Canvas Rendering Design

## Problem

The current renderer redraws all 18 draw calls on a single canvas every frame. Terrain iteration (procedural drawing of trees, water, stones across thousands of visible tiles) dominates frame cost. When the camera is stationary — the common case during gameplay — this work is entirely wasted.

## Solution: Three-Layer Canvas Stack

Three `<canvas>` elements stacked via absolute positioning inside `.map-container`:

| Layer | Position | Draws | Redraws when |
|-------|----------|-------|-------------|
| Terrain | Bottom | drawTerrain, drawTerritory, drawFog | Camera move, territory/fog change |
| World | Middle | drawBuildings, drawResourceDrops, drawAnimals, drawEnemies, drawVillagers, drawCaravans, drawCamps, drawVillages, drawExpeditions, drawPOIs | Camera move, state change |
| Overlay | Top | drawPlacementPreview, drawClaimableOverlay, drawSelection, drawHover, drawNight, drawWeather | Every frame |

Mouse events on bottom canvas only. Upper canvases: `pointer-events: none`.

## Dirty Tracking

Per-layer dirty flags replace the single binary `cameraDirty`/`stateChanged`:

- `terrainDirty` — camera change, territory claim, fog reveal, building place/destroy
- `worldDirty` — camera change, state change (any tick)
- Overlay always redraws (night/weather animate continuously, hover changes)

## Render Loop

Single RAF loop, checks each layer's flag:

```
render():
  if terrainDirty:
    clear terrain canvas
    drawTerrain, drawTerritory, drawFog
    terrainDirty = false

  if worldDirty:
    clear world canvas
    drawBuildings, drawResourceDrops, drawAnimals, drawEnemies,
    drawVillagers, drawCaravans, drawCamps, drawVillages,
    drawExpeditions, drawPOIs
    worldDirty = false

  clear overlay canvas
  drawPlacementPreview, drawClaimableOverlay, drawSelection,
  drawHover, drawNight, drawWeather
```

Typical frame costs:
- Camera stationary, game running: world + overlay (terrain skipped)
- Camera stationary, game paused: overlay only
- Camera panning: all three

## Implementation Details

- **DPR helper:** Extract `resizeCanvas(canvas, dpr)` — shared across all three canvases, only resizes if dimensions changed.
- **Camera translate:** Each layer applies `ctx.translate(-cam.x * ts, -cam.y * ts)` independently (separate context state).
- **gridBuildings:** Rebuild reactively on state change, not every 10 frames.
- **Minimap:** Redraw only when terrain or world dirty. Replace DOM `querySelector` hack with `viewportWidth`/`viewportHeight` fields on `RenderContext`.
- **Water animation:** Waves stop animating when camera stationary. Acceptable trade-off (subtle effect).
- **Draw functions unchanged:** Still receive `(ctx, gs, rc)` — no API changes.

## File Changes

- `GameCanvas.svelte` — 3 canvas elements, new render loop, DPR helper
- `shared.ts` — add `viewportWidth`/`viewportHeight` to RenderContext
- `minimap.ts` — use RenderContext viewport fields instead of DOM query
- `camera.ts` — dirty flags become more granular
- `gameState.ts` — `stateChanged` stays as-is
