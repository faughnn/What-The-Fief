# Electron + Vite + Svelte Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the ColonySim renderer from a hacky `file://` HTML page with IIFE bundling to a production-grade Electron + Vite + Svelte desktop app, suitable for eventual Steam release.

**Architecture:** Electron hosts a Vite-built Svelte app. The simulation engine (`src/simulation/`, `src/world.ts`, `src/timing.ts`) is untouched — it remains pure TypeScript with no DOM/browser dependencies. The Svelte app owns the game loop and GameState (via a Svelte store). UI panels (TopBar, Sidebar, BuildBar, DetailPanel) become Svelte components with reactive state. The game map stays as Canvas 2D drawing functions, called from a Svelte component that owns the `<canvas>` element. Pixi.js migration is a future task — Canvas 2D is kept for now to limit scope.

**Tech Stack:** Electron 36+, Vite 6+, Svelte 5+, TypeScript 5+

**Important context for the implementer:**
- The simulation code in `src/simulation/` and `src/world.ts` MUST NOT be modified. It has 1600+ passing tests.
- The current renderer has ~5000 lines across 5 files. Most logic is reusable — it just needs to be restructured into Svelte components.
- The current `renderer.html`, `renderer.css`, `src/renderer/`, `src/browser-entry.ts`, `log-server.js`, and `dist/renderer.js` will be replaced.
- The existing test runner (`src/tests/run-all.ts`) uses `npx tsx` and must continue to work unchanged.
- Platform: Windows 11, Git Bash. Run `export PATH="/c/Program Files/nodejs:$PATH"` before any npm/node commands.

---

## Task 1: Scaffold Electron + Vite + Svelte project

**Goal:** Set up the project skeleton so `npm run dev` opens an Electron window showing "Hello ColonySim".

**Files:**
- Create: `electron/main.ts` (Electron main process)
- Create: `electron/preload.ts` (context bridge, empty for now)
- Create: `src/ui/App.svelte` (root Svelte component)
- Create: `src/ui/main.ts` (Svelte mount point)
- Create: `index.html` (Vite entry HTML)
- Create: `vite.config.ts` (Vite config)
- Create: `svelte.config.js` (Svelte config)
- Modify: `package.json` (add deps, scripts)
- Modify: `tsconfig.json` (adjust for Svelte)

**Step 1: Install dependencies**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
npm install --save electron electron-builder @sveltejs/vite-plugin-svelte svelte vite
npm install --save-dev svelte-check
```

Note: `electron` goes in regular deps for electron-builder. `typescript`, `tsx` are already installed.

**Step 2: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  root: '.',
  resolve: {
    alias: {
      '$sim': path.resolve(__dirname, 'src/simulation'),
      '$world': path.resolve(__dirname, 'src/world.ts'),
    },
  },
  build: {
    outDir: 'dist-app',
    emptyOutDir: true,
  },
});
```

**Step 3: Create `svelte.config.js`**

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

**Step 4: Create `index.html`** (Vite entry point, project root)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ColonySim</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/ui/main.ts"></script>
</body>
</html>
```

**Step 5: Create `src/ui/main.ts`**

```ts
import App from './App.svelte';

const app = new App({
  target: document.getElementById('app')!,
});

export default app;
```

**Step 6: Create `src/ui/App.svelte`**

```svelte
<h1>ColonySim</h1>
<p>Electron + Vite + Svelte — scaffold working.</p>

<style>
  h1 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
  }
  :global(body) {
    margin: 0;
    background: #2a2118;
    color: #f0e6d0;
  }
</style>
```

**Step 7: Create `electron/main.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load Vite dev server; in prod, load built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-app/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

**Step 8: Create `electron/preload.ts`**

```ts
// Preload script — context bridge for main/renderer IPC.
// Empty for now. Will add save/load file dialogs later.
```

**Step 9: Update `package.json`**

Add these scripts (keep existing `test` script):

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "node scripts/dev.js",
    "build": "vite build && tsc -p tsconfig.electron.json",
    "build:electron": "npm run build && electron-builder",
    "test": "echo \"Error: no test specified\" && exit 1",
    "bundle": "esbuild src/browser-entry.ts --bundle --format=esm --outfile=dist/colonysim.js"
  }
}
```

**Step 10: Create `scripts/dev.js`** (dev launch script)

```js
const { spawn } = require('child_process');
const { createServer } = require('vite');

async function start() {
  const server = await createServer({ configFile: 'vite.config.ts' });
  await server.listen(5173);
  const url = `http://localhost:${server.config.server.port}`;
  console.log(`Vite dev server: ${url}`);

  // Build electron main process
  const { execSync } = require('child_process');
  execSync('npx tsc -p tsconfig.electron.json', { stdio: 'inherit' });

  // Launch Electron
  const electron = spawn(
    require('electron'),
    ['.'],
    { env: { ...process.env, VITE_DEV_SERVER_URL: url }, stdio: 'inherit' }
  );
  electron.on('close', () => { server.close(); process.exit(); });
}

start();
```

**Step 11: Create `tsconfig.electron.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist-electron",
    "rootDir": "electron",
    "skipLibCheck": true
  },
  "include": ["electron/**/*"]
}
```

**Step 12: Update main `tsconfig.json`**

Add Svelte file support and exclude electron dir:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "types": ["svelte"]
  },
  "include": ["src/**/*", "src/**/*.svelte"],
  "exclude": ["electron", "src/tests"]
}
```

**Step 13: Test the scaffold**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
npm run dev
```

Expected: An Electron window opens showing "ColonySim" in gold Cinzel font on a dark wood background. Vite dev server runs on localhost:5173.

**Step 14: Verify simulation tests still pass**

```bash
npx tsx src/tests/run-all.ts -q
```

Expected: All 1600+ tests pass. We didn't touch simulation code.

**Step 15: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.electron.json vite.config.ts svelte.config.js index.html scripts/dev.js electron/ src/ui/
git commit -m "feat: scaffold Electron + Vite + Svelte app shell"
```

---

## Task 2: Game state store and game loop

**Goal:** Create a Svelte store that holds GameState, wire up the game loop with tick(), and display basic stats to prove the simulation runs inside the Electron app.

**Files:**
- Create: `src/ui/stores/gameState.ts` (Svelte writable store + game loop)
- Modify: `src/ui/App.svelte` (subscribe to store, show day/pop/season)

**Step 1: Create `src/ui/stores/gameState.ts`**

```ts
import { writable, derived, get } from 'svelte/store';
import type { GameState } from '../../world.js';
import { createWorld, RENDER_TICKS_PER_SEC, TICKS_PER_DAY, NIGHT_TICKS } from '../../world.js';
import { tick } from '../../simulation/index.js';

// Core game state
export const gameState = writable<GameState | null>(null);
export const speed = writable(1);
export const paused = writable(false);

// Derived stores for UI reactivity
export const day = derived(gameState, $gs => $gs?.day ?? 0);
export const season = derived(gameState, $gs => $gs?.season ?? 'spring');
export const population = derived(gameState, $gs => $gs?.villagers.length ?? 0);
export const resources = derived(gameState, $gs => $gs?.resources ?? null);
export const prosperity = derived(gameState, $gs => Math.round($gs?.prosperity ?? 0));
export const weather = derived(gameState, $gs => $gs?.weather ?? 'clear');

// Game loop
const TICK_INTERVAL = 1000 / RENDER_TICKS_PER_SEC;
let lastTickTime = 0;
let animFrameId: number | null = null;
let lastEventCount = 0;

export const events = writable<string[]>([]);

function gameLoop(timestamp: number) {
  animFrameId = requestAnimationFrame(gameLoop);
  const gs = get(gameState);
  const spd = get(speed);
  if (!gs || spd === 0) {
    lastTickTime = timestamp;
    return;
  }

  const elapsed = timestamp - lastTickTime;
  const ticksToRun = Math.floor(elapsed / (TICK_INTERVAL / spd));
  if (ticksToRun > 0) {
    lastTickTime = timestamp;
    const maxTicks = Math.min(ticksToRun, spd * 2);
    let state = gs;
    for (let i = 0; i < maxTicks; i++) {
      state = tick(state);
    }
    // Collect new events
    const newEvents = state.events.slice(lastEventCount);
    lastEventCount = state.events.length;
    if (newEvents.length > 0) {
      events.update(e => [...e.slice(-50), ...newEvents]);
    }
    gameState.set(state);
  }
}

export function startGame() {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  lastTickTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

export function stopGame() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

export function newGame() {
  const gs = createWorld(200, 200, Date.now());
  // Fast-forward past night so villagers start awake at dawn
  let state = gs;
  for (let i = 0; i < NIGHT_TICKS + 1; i++) {
    state = tick(state);
  }
  lastEventCount = state.events.length;
  gameState.set(state);
  startGame();
}
```

**Step 2: Update `src/ui/App.svelte`**

```svelte
<script lang="ts">
  import { gameState, day, season, population, prosperity, speed, newGame } from './stores/gameState';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

{#if !$gameState}
  <div class="loading-screen">
    <h1>ColonySim</h1>
    <p>A colony grows from a single tent</p>
    <button on:click={newGame}>New Game</button>
  </div>
{:else}
  <div class="topbar">
    <span>Day {$day}</span>
    <span>{formatType($season)}</span>
    <span>Pop: {$population}</span>
    <span>Prosperity: {$prosperity}</span>
    <span>Speed: {$speed}x</span>
  </div>
  <p style="color:#f0e6d0; padding: 1rem;">Game running. Simulation is ticking.</p>
{/if}

<style>
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: 'Cinzel', serif;
  }
  h1 { color: #b8964e; font-size: 3rem; }
  p { color: #c8c0a8; font-family: 'Crimson Text', serif; }
  button {
    background: #b8964e;
    border: none;
    color: #2a2118;
    padding: 0.75rem 2rem;
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    cursor: pointer;
    margin-top: 1rem;
  }
  button:hover { background: #d4b06a; }
  .topbar {
    display: flex;
    gap: 2rem;
    padding: 0.5rem 1rem;
    background: #1e1810;
    border-bottom: 2px solid #b8964e;
    color: #f0e6d0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
  }
  :global(body) {
    margin: 0;
    background: #2a2118;
    color: #f0e6d0;
  }
</style>
```

**Step 3: Test**

```bash
npm run dev
```

Expected: Loading screen appears. Click "New Game". Topbar shows Day incrementing, season, population (3), prosperity climbing. The simulation is running inside Electron.

**Step 4: Verify simulation tests**

```bash
npx tsx src/tests/run-all.ts -q
```

**Step 5: Commit**

```bash
git add src/ui/stores/gameState.ts src/ui/App.svelte
git commit -m "feat: wire simulation game loop into Svelte store"
```

---

## Task 3: Canvas game map component

**Goal:** Port the canvas rendering into a Svelte component. The game map draws terrain, buildings, entities, fog, weather, night cycle — everything the current `canvas.ts` does.

**Files:**
- Create: `src/ui/components/GameCanvas.svelte` (canvas wrapper component)
- Move: `src/renderer/canvas.ts` → `src/ui/canvas/draw.ts` (clean up imports, remove getter hacks)
- Create: `src/ui/canvas/camera.ts` (camera state and input handling)
- Modify: `src/ui/App.svelte` (add GameCanvas component)

**Step 1: Create `src/ui/canvas/camera.ts`**

Extract camera state and input handling from `src/renderer/main.ts` lines 42-44, 140-146, 248-311. The camera is a plain reactive object:

```ts
import { writable, get } from 'svelte/store';

export const camera = writable({ x: 0, y: 0, zoom: 1.5 });
export const hoveredTile = writable<{ x: number; y: number } | null>(null);

const TILE = 16;

export function screenToTile(sx: number, sy: number, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cam = get(camera);
  const tileSize = TILE * cam.zoom;
  return {
    x: Math.floor((sx - rect.left + cam.x * tileSize) / tileSize),
    y: Math.floor((sy - rect.top + cam.y * tileSize) / tileSize),
  };
}

export function centerOnTile(x: number, y: number, canvasWidth: number, canvasHeight: number) {
  camera.update(cam => {
    const ts = TILE * cam.zoom;
    return {
      ...cam,
      x: x - canvasWidth / ts / 2,
      y: y - canvasHeight / ts / 2,
    };
  });
}

export function setupCameraControls(canvas: HTMLCanvasElement) {
  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let cameraStartX = 0, cameraStartY = 0;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      dragging = true;
      const cam = get(camera);
      dragStartX = e.clientX; dragStartY = e.clientY;
      cameraStartX = cam.x; cameraStartY = cam.y;
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      const cam = get(camera);
      const tileSize = TILE * cam.zoom;
      camera.set({
        ...cam,
        x: cameraStartX - (e.clientX - dragStartX) / tileSize,
        y: cameraStartY - (e.clientY - dragStartY) / tileSize,
      });
    }
    const rect = canvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      hoveredTile.set(screenToTile(e.clientX, e.clientY, canvas));
    } else {
      hoveredTile.set(null);
    }
  });

  window.addEventListener('mouseup', () => { dragging = false; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.update(cam => {
      const oldZoom = cam.zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(4, cam.zoom * delta));
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / (TILE * oldZoom) + cam.x;
      const my = (e.clientY - rect.top) / (TILE * oldZoom) + cam.y;
      return {
        zoom: newZoom,
        x: mx - (e.clientX - rect.left) / (TILE * newZoom),
        y: my - (e.clientY - rect.top) / (TILE * newZoom),
      };
    });
  });
}
```

**Step 2: Copy and clean up `src/ui/canvas/draw.ts`**

Copy the entire content of `src/renderer/canvas.ts` to `src/ui/canvas/draw.ts`. Then make these changes:

1. Remove all getter imports from `./main.js` — functions now receive camera/state as parameters.
2. Change the import path for world/simulation:
   - `from '../world.js'` → `from '../../world.js'`
3. Every `draw*` function already takes `(ctx, gs)`. Add `camera` and other needed state as additional parameters where used.
4. Remove the `getAnimFrame()`, `getHoveredTile()`, `getSelectedEntity()`, `getMode()`, `getPlacingType()`, `getPlacingValid()`, `getGridBuildings()` calls. Instead, pass these values in from the component.

The key signature changes:
- `drawTerrain(ctx, gs)` → `drawTerrain(ctx, gs, cam, gridBuildings)` (needs camera for viewport culling, gridBuildings for road check)
- `drawPlacementPreview(ctx, gs)` → `drawPlacementPreview(ctx, gs, cam, mode, hoveredTile, placingType, placingValid)`
- `drawHover(ctx, gs)` → `drawHover(ctx, gs, cam, hoveredTile, mode)`
- `drawSelection(ctx, gs)` → `drawSelection(ctx, gs, cam, selectedEntity)`
- `drawClaimableOverlay(ctx, gs)` → `drawClaimableOverlay(ctx, gs, cam, mode)`
- Functions that use `animFrame` → add `animFrame: number` parameter
- `drawMinimap(ctx, gs)` → `drawMinimap(ctx, gs, cam, canvasWidth, canvasHeight)`

Create a single `RenderContext` type to bundle these:

```ts
export interface RenderContext {
  camera: { x: number; y: number; zoom: number };
  animFrame: number;
  hoveredTile: { x: number; y: number } | null;
  selectedEntity: { type: string; id: string } | null;
  mode: 'normal' | 'placing' | 'claiming';
  placingType: string | null;
  placingValid: boolean;
  gridBuildings: Map<string, any>;
}
```

Then each draw function takes `(ctx: CanvasRenderingContext2D, gs: GameState, rc: RenderContext)`.

**Step 3: Create `src/ui/components/GameCanvas.svelte`**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { gameState } from '../stores/gameState';
  import { camera, hoveredTile, setupCameraControls, centerOnTile } from '../canvas/camera';
  import {
    drawTerrain, drawTerritory, drawBuildings, drawResourceDrops,
    drawAnimals, drawEnemies, drawVillagers, drawCaravans,
    drawCamps, drawVillages, drawExpeditions, drawPOIs,
    drawFog, drawPlacementPreview, drawClaimableOverlay,
    drawSelection, drawHover, drawNight, drawWeather, drawMinimap,
    type RenderContext,
  } from '../canvas/draw';

  export let selectedEntity: { type: string; id: string } | null = null;
  export let mode: 'normal' | 'placing' | 'claiming' = 'normal';
  export let placingType: string | null = null;
  export let placingValid: boolean = false;

  let canvas: HTMLCanvasElement;
  let minimap: HTMLCanvasElement;
  let animFrame = 0;
  let gridBuildings = new Map<string, any>();
  let rafId: number;

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

  // Re-derive gridBuildings when gameState changes
  $: if ($gameState) rebuildGridBuildings($gameState);

  function render() {
    rafId = requestAnimationFrame(render);
    animFrame++;
    const gs = $gameState;
    if (!gs || !canvas) return;

    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    setupCameraControls(canvas);
    // Center on first villager once game starts
    const unsub = gameState.subscribe(gs => {
      if (gs && gs.villagers.length > 0) {
        const v = gs.villagers[0];
        centerOnTile(v.x, v.y, canvas.width, canvas.height);
        unsub();
      }
    });
    rafId = requestAnimationFrame(render);
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<div class="map-container">
  <canvas bind:this={canvas} class="game-canvas"></canvas>
  <canvas bind:this={minimap} class="minimap" width="140" height="140"></canvas>
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
```

**Step 4: Wire into App.svelte**

Add `<GameCanvas />` to the game view in `App.svelte`.

**Step 5: Test**

```bash
npm run dev
```

Expected: New Game shows the full map with terrain, buildings, villagers moving around, fog, minimap. Same visual output as the old `renderer.html`.

**Step 6: Commit**

```bash
git add src/ui/canvas/ src/ui/components/GameCanvas.svelte src/ui/App.svelte
git commit -m "feat: port canvas rendering into Svelte component"
```

---

## Task 4: TopBar component

**Goal:** Port the topbar (day, time clock, season, weather, population, prosperity, renown, CP, resource row, speed controls) into a Svelte component.

**Files:**
- Create: `src/ui/components/TopBar.svelte`
- Modify: `src/ui/App.svelte` (add TopBar)
- Modify: `src/ui/stores/gameState.ts` (add speed setter, time-of-day derived store)

**Step 1: Add derived stores to `src/ui/stores/gameState.ts`**

```ts
import { TICKS_PER_DAY, NIGHT_TICKS } from '../../world.js';

export const renown = derived(gameState, $gs => $gs?.renown ?? 0);
export const constructionPoints = derived(gameState, $gs => $gs?.constructionPoints ?? 0);

export const timeOfDay = derived(gameState, $gs => {
  if (!$gs) return '6:00';
  const dayTick = $gs.tick % TICKS_PER_DAY;
  let hour: number, minute: number;
  if (dayTick < NIGHT_TICKS) {
    const nightProgress = dayTick / NIGHT_TICKS;
    const nightHours = 20 + nightProgress * 10;
    const wrapped = nightHours >= 24 ? nightHours - 24 : nightHours;
    hour = Math.floor(wrapped);
    minute = Math.floor((wrapped - hour) * 60);
  } else {
    const dayProgress = (dayTick - NIGHT_TICKS) / (TICKS_PER_DAY - NIGHT_TICKS);
    const dayHours = 6 + dayProgress * 14;
    hour = Math.floor(dayHours);
    minute = Math.floor((dayHours - hour) * 60);
  }
  return `${hour}:${minute.toString().padStart(2, '0')}`;
});

export function setSpeed(s: number) { speed.set(s); }
```

**Step 2: Create `src/ui/components/TopBar.svelte`**

Port the logic from `src/renderer/panels.ts` `updateTopbar()` (lines 67-135). Instead of manual DOM updates, use Svelte reactive bindings. Include:

- Day, time clock, season badge, weather
- Population, prosperity, renown, CP
- Resource row (food, wood, stone, etc. — only show non-zero)
- Speed buttons (0, 1, 5, 20)
- Conditional buttons: Festival (tavern/inn exists), To Arms (guards/enemies), Research (research_desk), Claim (town_hall)

Use the existing `renderer.css` styles adapted to Svelte scoped styles. The formatType helper is used to display names.

**Step 3: Wire into App.svelte**

```svelte
<TopBar />
<GameCanvas />
```

**Step 4: Test**

Expected: TopBar shows all stats updating reactively. Speed buttons work. Day counter and clock update. Conditional buttons appear/disappear based on game state.

**Step 5: Commit**

```bash
git add src/ui/components/TopBar.svelte src/ui/stores/gameState.ts src/ui/App.svelte
git commit -m "feat: port topbar to reactive Svelte component"
```

---

## Task 5: Sidebar and detail panel components

**Goal:** Port the sidebar tabs (Overview, Villagers, Military, Economy, Quests, Expeditions, Diplomacy) and the entity detail panel into Svelte components.

**Files:**
- Create: `src/ui/components/Sidebar.svelte`
- Create: `src/ui/components/sidebar/OverviewTab.svelte`
- Create: `src/ui/components/sidebar/VillagersTab.svelte`
- Create: `src/ui/components/sidebar/MilitaryTab.svelte`
- Create: `src/ui/components/sidebar/EconomyTab.svelte`
- Create: `src/ui/components/sidebar/QuestsTab.svelte`
- Create: `src/ui/components/sidebar/ExpeditionsTab.svelte`
- Create: `src/ui/components/sidebar/DiplomacyTab.svelte`
- Create: `src/ui/components/DetailPanel.svelte`
- Create: `src/ui/components/detail/VillagerDetail.svelte`
- Create: `src/ui/components/detail/BuildingDetail.svelte`
- Create: `src/ui/components/detail/EnemyDetail.svelte`
- Create: `src/ui/components/detail/AnimalDetail.svelte`
- Create: `src/ui/stores/selection.ts`
- Modify: `src/ui/App.svelte`

**Approach:**

Port all logic from `src/renderer/panels.ts`:
- `getVisibleTabs()` → reactive derived store in `selection.ts`
- Tab content rendering → individual Svelte components per tab
- `updateDetailPanel()` → `DetailPanel.svelte` with sub-components
- All `innerHTML` templates become Svelte template markup

The key advantage: no more `innerHTML` string building. Each tab/detail view is a proper component with reactive `{#each}`, `{#if}`, `on:click`, and scoped styles.

The `selectedEntity` store drives which detail panel shows. Clicking a villager/building/enemy on the map or in the sidebar list sets this store.

Port each tab one at a time, following the same HTML structure from `panels.ts` but using Svelte syntax. Copy the styles from `renderer.css` into scoped `<style>` blocks.

**Step 1: Create stores, then components one at a time**

**Step 2: Wire all components into App.svelte layout**

```svelte
<TopBar />
<main class="main-area">
  <GameCanvas {selectedEntity} {mode} {placingType} {placingValid} on:tileclick={handleTileClick} />
  <Sidebar />
  <DetailPanel />
</main>
<BuildBar />
```

**Step 3: Test each tab, verify clicks select entities, detail panel shows correct info**

**Step 4: Commit**

```bash
git commit -m "feat: port sidebar tabs and detail panel to Svelte components"
```

---

## Task 6: Build bar and commands

**Goal:** Port the build bar (categories, building cards, placement mode) and all player commands into Svelte components.

**Files:**
- Create: `src/ui/components/BuildBar.svelte`
- Create: `src/ui/components/ResearchOverlay.svelte`
- Create: `src/ui/stores/commands.ts` (all command wrappers that mutate gameState)
- Modify: `src/ui/App.svelte`

**Approach:**

Port from `src/renderer/buildbar.ts` and `src/renderer/commands.ts`:

- Build categories as reactive list
- Building cards with affordability checking via `$gameState` reactivity (no more `updateBuildItems` polling — Svelte handles this automatically)
- Placement mode state managed in a store
- Tech-locked cards shown with lock styling
- Research overlay as a modal component

Commands (`commands.ts`): Create wrapper functions that call simulation exports and update the gameState store:

```ts
import { gameState } from './gameState';
import { get } from 'svelte/store';
import { placeBuilding as simPlaceBuilding, ... } from '../../simulation/index.js';

export function placeBuilding(type: string, x: number, y: number): boolean {
  const gs = get(gameState);
  if (!gs) return false;
  const result = simPlaceBuilding(gs, type as any, x, y);
  if (result === gs) return false;
  gameState.set(result);
  return true;
}

// Same pattern for all other commands...
```

The key win: build card affordability is just `$gameState.resources.wood >= cost.wood` in the template — fully reactive, no polling, no `innerHTML` rebuild.

**Step 1-5: Create components, wire commands, test placement mode, verify research overlay works, commit**

---

## Task 7: Styling, notifications, save/load, and cleanup

**Goal:** Port remaining UI features, apply the full Cartographer's War Table theme, remove old renderer files.

**Files:**
- Create: `src/ui/components/Notifications.svelte`
- Create: `src/ui/components/LoadingScreen.svelte`
- Create: `src/ui/styles/theme.css` (global theme CSS ported from `renderer.css`)
- Modify: `src/ui/App.svelte` (final layout and style integration)
- Modify: `index.html` (link theme CSS)
- Delete: `src/renderer/` (entire directory)
- Delete: `src/browser-entry.ts`
- Delete: `renderer.html`
- Delete: `renderer.css`
- Delete: `log-server.js`
- Delete: `dist/renderer.js`

**Step 1: Create notification system**

Svelte store-based: `notifications` writable array. `notify()` pushes, auto-removes after 3.5s. `Notifications.svelte` renders the list with transitions.

**Step 2: Port save/load**

Save: serialize `$gameState` to JSON, trigger download via Electron's `dialog.showSaveDialog` (wire through preload.ts IPC).
Load: `dialog.showOpenDialog`, read file, parse JSON, set store.

For dev, also keep drag-and-drop loading on the window.

**Step 3: Port global styles**

Move the CSS variables, font declarations, and base styles from `renderer.css` into `src/ui/styles/theme.css`. Component-specific styles stay in each `.svelte` file's `<style>` block.

**Step 4: Wire keyboard shortcuts**

ESC to cancel placement, number keys for speed, etc.

**Step 5: Delete old renderer files**

```bash
rm -rf src/renderer/ src/browser-entry.ts renderer.html renderer.css log-server.js dist/renderer.js
```

**Step 6: Full integration test**

```bash
npm run dev
```

Test everything: new game, place buildings, assign workers, speed controls, sidebar tabs, detail panels, save/load, research, all buttons.

**Step 7: Verify simulation tests**

```bash
npx tsx src/tests/run-all.ts -q
```

**Step 8: Commit**

```bash
git commit -m "feat: complete Electron + Svelte migration, remove old renderer"
```

---

## Task 8: Production build and Electron packaging

**Goal:** `npm run build:electron` produces a distributable Windows executable.

**Files:**
- Modify: `package.json` (add electron-builder config)
- Create: `electron-builder.yml` (build configuration)

**Step 1: Add electron-builder configuration**

```yaml
# electron-builder.yml
appId: com.colonysim.app
productName: ColonySim
directories:
  output: release
  buildResources: build
files:
  - dist-app/**/*
  - dist-electron/**/*
  - package.json
win:
  target: nsis
  icon: build/icon.ico
```

**Step 2: Test production build**

```bash
npm run build
npx electron dist-electron/main.js
```

Expected: App launches from built files, not dev server. All features work.

**Step 3: Package**

```bash
npm run build:electron
```

Expected: `release/` directory contains a Windows installer.

**Step 4: Commit**

```bash
git commit -m "feat: add Electron production build and packaging"
```
