# UI Refactor Plan

## Task 1: Split draw.ts into modules
- Create `src/ui/canvas/draw/terrain.ts` — drawTerrain, drawTerritory
- Create `src/ui/canvas/draw/buildings.ts` — drawBuildings, drawFire, drawBuildingIcon, BUILDING_ICONS, BUILDING_COLORS
- Create `src/ui/canvas/draw/entities.ts` — drawVillagers, drawEnemies, drawAnimals, drawCaravans, drawCamps, drawVillages, drawExpeditions, drawPOIs, drawResourceDrops
- Create `src/ui/canvas/draw/overlays.ts` — drawFog, drawNight, drawWeather, drawPlacementPreview, drawClaimableOverlay, drawSelection, drawHover
- Create `src/ui/canvas/draw/minimap.ts` — drawMinimap
- Create `src/ui/canvas/draw/shared.ts` — COLORS, RenderContext, TILE, getViewport, inBounds
- Create `src/ui/canvas/draw/index.ts` — barrel re-export
- Update `GameCanvas.svelte` imports to use `../canvas/draw` (same path, barrel handles it)
- Delete `src/ui/canvas/draw.ts`
- Verify: `npx vite build`

## Task 2: Camera cleanup + dirty-flag rendering
- In `camera.ts`: `setupCameraControls` returns a cleanup function that removes all event listeners and cancels the keyPan RAF loop
- In `GameCanvas.svelte`: call cleanup in `onDestroy`
- Add dirty-flag: `export const cameraDirty = writable(true)` — set true on camera changes
- In `gameState.ts`: track whether state actually changed (reference equality on gameState.set)
- In `GameCanvas.svelte` render loop: skip full redraw if !cameraDirty && !stateChanged && animFrame % 4 !== 0 (still redraw for animations every 4th frame)
- Verify: `npx vite build`

## Task 3: Extract shared CSS
- Move repeated patterns from components into `src/ui/styles/theme.css`:
  - `.section`, `.section-title`, `.label`
  - `.cmd-btn`, `.cmd-btn:hover`, `.cmd-btn.active`, `.cmd-btn.danger`, `.cmd-btn.small`
  - `.stat-row`, `.bar-bg`, `.bar-fill`, `.bar-text`, `.stat-section`, `.stat-label`
  - `.entity-row`, `.entity-row:hover`
  - `.muted`
  - `h3` sidebar heading style
- Remove duplicated styles from each component's `<style>` block
- Verify: `npx vite build`

## Task 4: Reduce commands.ts boilerplate
- Replace all individual command functions with a generic `cmd()` helper
- Keep named exports for type safety but implement via generic
- Verify: `npx vite build`

## Task 5: Fix placement preview size + spatial entity lookup
- In `drawPlacementPreview`: look up `BUILDING_TEMPLATES[type]` for width/height
- In `App.svelte`: build spatial index Map<string, entity> for villagers/enemies/animals on gameState change, use in handleTileClick
- Verify: `npx vite build`

## Task 6: Derive building categories from data
- In `BuildBar.svelte`: derive categories from BUILDING_TEMPLATES using a `category` field or heuristic grouping, instead of hardcoded arrays
- Fallback: keep current approach but extract the data to a separate `src/ui/data/buildCategories.ts` file
- Verify: `npx vite build`

## After all tasks: final verification
- `npx vite build` clean
- `npx tsx src/tests/run-all.ts -q` still passes
- `npm run dev` launches successfully
- Commit
