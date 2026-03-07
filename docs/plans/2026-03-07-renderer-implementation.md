# Renderer Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace renderer.html with a full Cartographer's War Table UI that supports all 60+ game features.

**Architecture:** Modular TypeScript renderer. Thin HTML shell (`renderer.html`) links external CSS (`renderer.css`) and imports a bundled JS module (`dist/renderer.js`). Source lives in `src/renderer/` as 5 TS modules, bundled by esbuild. Canvas 2D for map rendering, DOM for UI panels.

**Tech Stack:** HTML5 Canvas, TypeScript (esbuild bundled), CSS3 with variables, Google Fonts (Cinzel, Crimson Text, JetBrains Mono)

**Design doc:** `docs/plans/2026-03-07-renderer-redesign.md`

**File Structure:**
```
renderer.html                  — HTML shell (~120 lines), links CSS + JS
renderer.css                   — All styles (~600 lines)
src/renderer/
  main.ts                      — Init, game loop, camera, state, save/load
  canvas.ts                    — All canvas drawing (terrain, buildings, entities, fog, weather)
  panels.ts                    — Sidebar tabs, detail panel, topbar updates
  commands.ts                  — All command wiring (window._ handlers)
  buildbar.ts                  — Build bar, research overlay, placement mode
dist/renderer.js               — esbuild bundle output (from src/renderer/main.ts)
```

**Build command:**
```bash
npx esbuild src/renderer/main.ts --bundle --format=esm --outfile=dist/renderer.js
```
This replaces the old `dist/colonysim.js` approach — the renderer bundle imports simulation code directly from `src/` so only one bundle is needed.

---

## Pre-work: No browser-entry.ts changes needed

Since the renderer modules now import directly from `src/world.ts` and `src/simulation/index.ts`, there's no need to maintain `browser-entry.ts` exports. The renderer bundle (`dist/renderer.js`) is self-contained — esbuild resolves all imports from source.

`src/browser-entry.ts` can remain as-is for any other consumers, but the renderer no longer depends on it.

---

## Task 1: HTML Shell + CSS Theme + Module Scaffolding

Create `renderer.html` (thin shell), `renderer.css` (full theme), and scaffold the 5 TS modules with stub exports.

**Files:**
- Overwrite: `renderer.html`
- Create: `renderer.css`
- Create: `src/renderer/main.ts`
- Create: `src/renderer/canvas.ts`
- Create: `src/renderer/panels.ts`
- Create: `src/renderer/commands.ts`
- Create: `src/renderer/buildbar.ts`

### HTML Structure (renderer.html — thin shell)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ColonySim</title>
  <link rel="stylesheet" href="renderer.css">
</head>
<body>
  <!-- Loading screen -->
  <div id="loading" class="loading-screen">...</div>

  <!-- Drop overlay -->
  <div id="dropOverlay" class="drop-overlay">...</div>

  <!-- Top bar -->
  <header class="topbar">
    <div class="topbar-left">
      <!-- Wax seal logo + "ColonySim" -->
      <!-- Day counter, season badge, weather icon, pop, prosperity, renown, CP -->
    </div>
    <div class="topbar-center">
      <!-- Compact resource row (icons + numbers, scrollable) -->
    </div>
    <div class="topbar-right">
      <!-- Speed controls, Research btn, Territory btn, Festival btn, Call to Arms btn, Save/Load -->
    </div>
  </header>

  <!-- Main area -->
  <main class="main-area">
    <!-- Canvas wrapper -->
    <div class="map-container" id="mapContainer">
      <canvas id="gameCanvas"></canvas>
      <div class="tooltip" id="tooltip">...</div>
      <div class="notifications" id="notifications"></div>
      <div class="mode-indicator" id="modeIndicator">...</div>
      <canvas class="minimap" id="minimap"></canvas>
    </div>

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <!-- Tab bar -->
      <nav class="sidebar-tabs" id="sidebarTabs">
        <!-- Tabs rendered dynamically based on game state -->
      </nav>
      <!-- Tab content panels -->
      <div class="sidebar-content" id="sidebarContent">
        <!-- Each tab's content rendered here -->
      </div>
    </aside>

    <!-- Detail panel (slides over sidebar when entity selected) -->
    <div class="detail-panel" id="detailPanel"></div>

    <!-- Assign picker dropdown -->
    <div class="assign-picker" id="assignPicker"></div>
  </main>

  <!-- Build bar (bottom) -->
  <footer class="buildbar" id="buildbar">
    <div class="buildbar-toggle" id="buildbarToggle">Build</div>
    <div class="buildbar-categories" id="buildCategories"></div>
    <div class="buildbar-items" id="buildItems"></div>
  </footer>

  <!-- Research overlay -->
  <div class="research-overlay" id="researchOverlay">...</div>

  <!-- Hidden file input -->
  <input type="file" id="fileInput" accept=".json" style="display:none">

  <script type="module" src="dist/renderer.js"></script>
</body>
</html>
```

### Module Scaffolding

Each module gets stub exports so the bundle compiles from Task 1:

**src/renderer/main.ts** — imports from canvas, panels, commands, buildbar. Sets up game loop, camera, state. Exports shared state (gameState, camera, etc.) for other modules.

**src/renderer/canvas.ts** — exports `render()` function and all draw* functions. Imports game types from `../world.js`.

**src/renderer/panels.ts** — exports `updateTopbar()`, `updateSidebar()`, `updateDetailPanel()`. Imports game types.

**src/renderer/commands.ts** — exports `wireCommands()` which sets all `window._*` handlers. Imports simulation commands from `../simulation/index.js`.

**src/renderer/buildbar.ts** — exports `initBuildBar()`, `updateBuildItems()`, `toggleResearch()`, `renderResearch()`. Imports building templates from `../world.js`.

All modules import shared state from `main.ts` to access `gameState`, `camera`, `selectedEntity`, etc.

### CSS Theme — Cartographer's War Table (renderer.css)

Key design tokens (CSS variables):
```css
:root {
  /* Wood & parchment */
  --bg-table: #2a2118;          /* dark oak table */
  --bg-table-grain: #332a1f;    /* wood grain highlight */
  --parchment: #f0e6d0;         /* aged paper */
  --parchment-dark: #e0d4b8;    /* darker parchment */
  --parchment-edge: #d4c8a8;    /* worn edges */

  /* Ink & text */
  --ink: #3a3025;               /* dark brown ink */
  --ink-light: #6a6050;         /* faded ink */
  --ink-faint: #9a9080;         /* very faded */

  /* Accents */
  --brass: #b8964e;             /* brass/gold trim */
  --brass-bright: #d4aa5a;      /* polished brass */
  --brass-dark: #8a7040;        /* tarnished brass */
  --wax-red: #a83a2a;           /* wax seal / danger */
  --wax-red-soft: rgba(168, 58, 42, 0.15);
  --forest: #4a7a42;            /* success / nature */
  --forest-soft: rgba(74, 122, 66, 0.15);
  --sea-blue: #5a7a8a;          /* water / info */

  /* Map terrain */
  --terrain-grass: #c0cc96;
  --terrain-grass-alt: #b4c08a;
  --terrain-forest: #7a9a60;
  --terrain-forest-dark: #688a50;
  --terrain-water: #7aacba;
  --terrain-water-deep: #6898a8;
  --terrain-stone: #a8a090;
  --terrain-stone-dark: #989080;
  --terrain-hill: #b0a880;
  --terrain-hill-dark: #a09870;
  --terrain-road: #c8b890;
  --terrain-fog: #d8d0c0;

  /* Building categories */
  --cat-housing: #c89860;
  --cat-production: #7a9a60;
  --cat-processing: #9a8060;
  --cat-military: #687890;
  --cat-storage: #a08a58;
  --cat-utility: #8878a0;
  --cat-decoration: #b08898;

  /* Entities */
  --entity-villager: #f0e8d8;
  --entity-villager-stroke: #807060;
  --entity-enemy: #b84838;
  --entity-animal-passive: #b0a880;
  --entity-animal-hostile: #a06050;
  --entity-drop: #d0c060;
  --entity-merchant: #c89830;
  --entity-camp: #8a3a2a;
  --entity-village: #6a8a5a;

  /* Fonts */
  --font-display: 'Cinzel', serif;
  --font-body: 'Crimson Text', serif;
  --font-data: 'JetBrains Mono', monospace;
}
```

CSS must include:
- Parchment texture via layered CSS gradients (noise-like pattern)
- Ornamental borders on panels using box-shadow + border-image or pseudo-elements
- Brass-trimmed buttons with hover states
- Sidebar tab styling (vertical tabs, parchment look, active = raised/lit)
- Panel sections with small decorative dividers (::before/::after)
- Season badges with themed colors
- Notification toast styling (parchment card, wax-seal colored left border)
- Build bar cards (parchment cards with brass border on hover)
- Research tech cards (three tiers, completed = forest green, locked = faded)
- HP bars with parchment-textured tracks
- Scrollbar styling (thin, brass-colored)
- Compass rose border on minimap (CSS pseudo-elements or simple border styling)
- Canvas inset shadow (map recessed into table)
- Loading screen (centered crest/title on dark wood)
- Transition animations for panel open/close (slide)

Commit: `feat: renderer v2 — HTML shell, CSS theme, module scaffolding`

---

## Task 2: Canvas Rendering — Terrain, Buildings, Fog

Port and upgrade all canvas drawing code. This task covers terrain, buildings, fog, territory, and map overlays.

**Files:**
- Modify: `src/renderer/canvas.ts`
- Modify: `src/renderer/main.ts` (wire up render loop)

### Constants and State

Port from old renderer:
- `TILE = 20`, camera, hover, selection, mode state
- `gameState`, `speed`, `tickAccumulator`, `animFrame`
- Canvas/context references

### New Building Category Map

Complete map for ALL building types (the old one was missing ~20):

```js
const BUILDING_CATEGORY = {
  // Housing
  tent: 'housing', cottage: 'housing', house: 'housing', manor: 'housing',
  inn: 'housing', barracks: 'housing',
  // Production
  farm: 'production', large_farm: 'production', woodcutter: 'production',
  quarry: 'production', deep_quarry: 'production', forester: 'production',
  herb_garden: 'production', flax_field: 'production', hemp_field: 'production',
  iron_mine: 'production', chicken_coop: 'production', livestock_barn: 'production',
  apiary: 'production', foraging_hut: 'production', foraging_lodge: 'production',
  hunting_lodge: 'production', fishing_hut: 'production', coal_burner: 'production',
  water_collector: 'production',
  // Processing
  sawmill: 'processing', lumber_mill: 'processing', smelter: 'processing',
  advanced_smelter: 'processing', mill: 'processing', windmill: 'processing',
  bakery: 'processing', kitchen: 'processing', tanner: 'processing',
  weaver: 'processing', ropemaker: 'processing', blacksmith: 'processing',
  toolmaker: 'processing', armorer: 'processing', weaponsmith: 'processing',
  fletcher: 'processing', leather_workshop: 'processing', carpenter: 'processing',
  butchery: 'processing', compost_pile: 'processing', drying_rack: 'processing',
  smoking_rack: 'processing', mint: 'processing', apothecary: 'processing',
  // Military
  wall: 'military', reinforced_wall: 'military', fence: 'military', gate: 'military',
  watchtower: 'military', spike_trap: 'military', training_ground: 'military',
  weapon_rack: 'military',
  // Storage
  storehouse: 'storage', large_storehouse: 'storage', outpost: 'storage',
  food_cellar: 'storage',
  // Utility
  town_hall: 'utility', research_desk: 'utility', marketplace: 'utility',
  tavern: 'utility', well: 'utility', church: 'utility', graveyard: 'utility',
  library: 'utility', road: 'utility',
  // Decoration
  garden: 'decoration', fountain: 'decoration', statue: 'decoration',
};
```

### Terrain Rendering (drawTerrain)

Must handle ALL terrain types:
- `grass` — subtle two-tone wash with organic blending
- `forest` — grass base + 2-3 triangle tree shapes with trunk lines, ink outlines
- `water` — cartographic wavy parallel lines, animated with `animFrame`
- `stone` — stippled/hatched texture (small dots or cross-hatch lines)
- `hill` — elevation hatching (parallel diagonal lines, classic cartography)
- Deposits rendered as small diamond shapes (iron=dark gray, fertile=bright green, herbs=teal)
- Road tiles — dashed tan center line over grass base

### Building Rendering (drawBuildings)

Upgrade `drawBuildingIcon` with icons for ALL building types. Group by visual similarity:

**Housing icons (roof silhouettes):**
- tent: small triangle, lower
- cottage: medium triangle
- house: peaked triangle + chimney
- manor: wide triangle + two wings
- inn: large building with flag
- barracks: flat-roofed with shield emblem

**Production icons:**
- farm/large_farm: row of tiny crop stalks
- woodcutter: small axe shape
- quarry/deep_quarry: pickaxe shape
- fishing_hut: hook/line
- forester: tree + axe
- and so on for each type...

**Military icons:**
- wall/reinforced_wall: solid square block, reinforced is thicker/darker
- fence: thin border square
- gate: border square with gap in middle
- watchtower: concentric circles with range ring
- spike_trap: X mark
- training_ground: crossed swords
- weapon_rack: vertical bar with notches

**Connected walls:** Check adjacent tiles for wall/fence neighbors and draw connecting lines between them.

Construction sites: dashed outline + cross-hatch fill + progress bar at bottom
Damage: crack lines drawn across building face (not color overlay)
Fire: animated orange wisp shapes with flicker (sin wave alpha)

### Fog of War (drawFog)

- Unrevealed: aged parchment color (#d8d0c0) — match the table surface
- Fog edge: darker ink-style border on revealed edges (2px soft line)
- Optional: faint compass grid lines in fog area

### Territory (drawTerritory)

- Dashed ink boundary line tracing the EDGE of territory (not fill)
- Use `ctx.setLineDash([6, 4])` with brown ink color
- Walk the territory border: for each territory tile adjacent to non-territory, draw border segment

### Night Overlay (drawNight)

Fix to use TICKS_PER_DAY and NIGHT_TICKS:
```js
const dayTick = gameState.tick % TICKS_PER_DAY;
const isNight = dayTick < NIGHT_TICKS;
```
- Night: deep blue-purple vignette overlay, darker at edges
- Dawn/dusk: gradual transition in/out (first/last 5% of night ticks)
- Candlelight: small warm radial gradient at occupied buildings during night

### Weather Effects (drawWeather)

- Rain: semi-transparent diagonal lines across viewport (20-40 lines)
- Storm: heavier + denser rain lines + occasional bright flash frame (every ~120 frames, 3 frame duration)

Commit: `feat: renderer v2 — canvas rendering (terrain, buildings, fog, weather)`

---

## Task 3: Canvas Rendering — Entities + Minimap

**Files:**
- Modify: `src/renderer/canvas.ts`

### Villager Rendering (drawVillagers)

For each villager:
1. Draw body: slightly oval shape (head circle + body circle), colored by state
2. Activity indicator: tiny icon floating 4px above head
   - sleeping: 3 small "z" letters
   - working: tiny hammer shape
   - eating: tiny circle (food dot)
   - traveling/hauling: tiny footprint dots
   - hunting: tiny bow shape
   - constructing: tiny scaffold lines
   - assaulting_camp: tiny sword
   - scouting: tiny spyglass/eye
3. Guard marker: small shield pip to the right
4. Carrying indicator: small tan satchel dot below when carryTotal > 0
5. Sick indicator: green tint overlay
6. Selected: golden ring highlight
7. Movement bob animation when traveling (sin wave)

### Enemy Rendering (drawEnemies)

- Base shape: pennant/banner (triangle on stick)
- Color: wax-red with darker glow ring
- Size varies by type:
  - `bandit`: normal size
  - `bandit_archer`: slightly smaller, tiny bow mark
  - `bandit_brute`: 1.5x larger, thicker lines
  - `bandit_warlord`: 1.5x larger + crown pip above
  - `wolf`/`boar`: animal silhouettes (hostile color)
- Siege equipment: white circle ring around entity

### Animal Rendering (drawAnimals)

- Passive: small animal silhouette in muted brown
  - deer: 4-point body + antler marks
  - rabbit: small round + ears
- Hostile: silhouette in reddish-brown
  - wolf: angular body + pointed ears
  - boar: rounded body + tusk marks

### Bandit Camp Rendering (drawCamps)

- Skull marker (simple: circle + two dot eyes + jaw line)
- Surrounded by 2-3 tiny tent triangles
- Size scales: more tents for higher strength
- HP bar below if damaged

### NPC Village Rendering (drawVillages)

- Cluster of 3-4 tiny house shapes
- Color-coded border by trust rank:
  - stranger: gray
  - associate: tan
  - friend: green
  - protector: blue
  - leader: gold
- Name label at high zoom

### Resource Drops (drawDrops)

- Small sack shape (rounded rectangle with tie at top)
- Subtle shine glint (small white dot, moves with animFrame)

### Merchants & Caravans (drawCaravans)

- Merchant: cart shape (rectangle + two circles for wheels) in gold
- Caravan: smaller cart in bronze

### Expedition Squads (drawExpeditions)

- For each expedition, find member villagers and draw a banner near their centroid
- Banner: vertical line + small flag shape in player colors (brass/gold)
- Or simply: expedition members get a flag pip above them

### POI Rendering (drawPOIs)

For discovered but unexplored POIs:
- Small star/sparkle marker at POI location
- Type-specific color (ruins=gray, cache=gold, den=red, camp=brown, grove=green)

### Minimap (drawMinimap)

Port existing minimap but upgrade:
- Compass rose: draw N/S/E/W marks at edges of minimap canvas
- Show bandit camps as red dots
- Show NPC villages as green dots
- Show expedition squads as gold dots
- Brass-colored viewport rectangle

### Zoom-Level Detail Scaling

```js
function getDetailLevel() {
  if (camera.zoom < 0.6) return 'minimal';   // just colored shapes
  if (camera.zoom < 1.2) return 'normal';     // full icons + indicators
  return 'detailed';                           // + names, HP bars, labels
}
```
- minimal: skip activity icons, use simpler building shapes
- normal: full rendering as described
- detailed: draw entity names as text, show HP bars on damaged entities

Commit: `feat: renderer v2 — entity rendering, minimap, zoom levels`

---

## Task 4: UI Panels — Topbar + Sidebar Tabs

**Files:**
- Modify: `src/renderer/panels.ts`
- Modify: `src/renderer/main.ts` (wire panel updates into game loop)

### Topbar Updates (updateTopbar)

Called every 5 frames. Updates:
- Day counter, tick counter
- Season badge (Spring/Summer/Autumn/Winter with themed class)
- Weather indicator
- Population count
- Prosperity
- Renown (new)
- Construction Points
- Compact resource row: show top ~12 resources with nonzero amounts, scrollable

### Sidebar Tab System

Dynamic tab rendering based on game state:

```js
function getVisibleTabs(gs) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'scroll' },
    { id: 'villagers', label: 'Villagers', icon: 'people' },
  ];
  // Military: any guard, military building, or enemies present
  const hasMilitary = gs.villagers.some(v => v.role === 'guard')
    || gs.buildings.some(b => ['wall','fence','reinforced_wall','gate','watchtower','barracks','training_ground','spike_trap','weapon_rack'].includes(b.type))
    || gs.enemies.length > 0;
  if (hasMilitary) tabs.push({ id: 'military', label: 'Military', icon: 'shield' });

  // Economy: marketplace or caravans
  const hasEconomy = gs.buildings.some(b => b.type === 'marketplace')
    || gs.caravans.length > 0 || gs.merchant || gs.supplyRoutes.length > 0;
  if (hasEconomy) tabs.push({ id: 'economy', label: 'Economy', icon: 'coins' });

  // Quests: any completed
  if (gs.completedQuests.length > 0) tabs.push({ id: 'quests', label: 'Quests', icon: 'scroll' });

  // Expeditions: any sent
  if (gs.expeditions.length > 0 || gs.pointsOfInterest.some(p => p.discovered))
    tabs.push({ id: 'expeditions', label: 'Explore', icon: 'compass' });

  // Diplomacy: any NPC village discovered (in fog)
  if (gs.npcSettlements.some(s => gs.fog[s.y]?.[s.x]))
    tabs.push({ id: 'diplomacy', label: 'Diplomacy', icon: 'handshake' });

  return tabs;
}
```

Track `activeTab` state. Default to 'overview'. Render tab bar and content.

### Overview Tab Content

```
Resources (grouped):
  Food: food, wheat, bread, fish, meat, dried_food, smoked_food, eggs, honey
  Raw: wood, stone, iron_ore, herbs, flax, hemp
  Processed: planks, charcoal, ingots, flour, leather, linen, rope, furniture, water, fertilizer
  Military: sword, bow, leather_armor, iron_armor, bandage, basic_tools, sturdy_tools, iron_tools
  Currency: gold

Raid Threat: [progress bar]
Renown: [number]
Construction Points: [number]

Events: [last 8, reverse chronological]
```

Only show resource categories that have any nonzero values.

### Villagers Tab Content

List all villagers with:
- State color dot
- Name
- Role (abbreviated)
- Age
- HP bar (if damaged)
- Click to open detail panel

### Military Tab Content

- **Guards section:** List of guards with formation badge (C/H/P for charge/hold/patrol)
- **Formation controls:** 3 buttons (Charge / Hold / Patrol) — applies to selected guard or all
- **Call to Arms:** Toggle button (shows "Stand Down" when active, "Call to Arms" when not)
- **Active Threats:** Count of enemies on map
- **Bandit Camps:** List with HP, strength, assault button
- **Defenses:** Wall count, watchtower count, spike trap count

### Economy Tab Content

- **Supply Routes:** List active routes (from → to, resource type). Create/cancel buttons.
- **Active Caravans:** List with origin settlement and goods
- **Marketplace:** Buy/sell interface (if marketplace exists)
- **Dynamic Prices:** Show current price adjustments

### Quests Tab Content

- List all QUEST_DEFINITIONS
- Show completed with checkmark, pending with progress hint
- Rewards shown (renown + gold)

### Expeditions Tab Content

- **Active Expeditions:** List with state (traveling/exploring/fighting/returning), target POI
- **Send Expedition:** Button (opens picker for guard selection + direction)
- **Recall:** Button per expedition
- **Discovered POIs:** List with type, explored status, rewards

### Diplomacy Tab Content

- **NPC Villages:** List with:
  - Name, direction
  - Trust rank badge (color coded)
  - Trust progress bar to next rank
  - Specialty resource
  - Liberate button (at protector rank, if not liberated)
  - Recruit button (if liberated, costs renown)

Commit: `feat: renderer v2 — topbar, sidebar tabs, all panel content`

---

## Task 5: Detail Panel + Commands

**Files:**
- Modify: `src/renderer/panels.ts` (detail panel rendering)
- Modify: `src/renderer/commands.ts` (all command wiring)

### Detail Panel (entity inspection)

When any entity is clicked on the canvas, the detail panel slides over the sidebar.

**Villager Detail:**
- Name, age, role, state
- HP bar + numbers
- Food level, morale
- Skills with levels + caps (progress bar to cap)
- Traits (as badges)
- Weapon + durability, Armor + durability, Tool + durability
- Housing (home building name + comfort level)
- Friends list
- Combat skill level (for guards)
- Commands:
  - Set Guard / Unset Guard
  - Assign Job (opens building picker)
  - Set Job Priority (per building type, 0-9 input)
  - Set Preferred Job (building type picker)
  - Scout (direction picker: N/S/E/W)
  - Set Formation (Charge/Hold/Patrol — guards only)
  - Set Guard Line (Front/Back — guards only)

**Building Detail:**
- Type, HP bar, construction %
- Production info (inputs → output)
- Local buffer (resource list with amounts / capacity)
- Workers list (name + state, with unassign button)
- Assign Worker button (opens villager picker)
- Upgrade path + cost + button
- Formation controls (if watchtower)

**Enemy Detail:**
- Type, HP bar
- Attack, Defense, Range (for archers)
- Siege equipment
- Position

**Animal Detail:**
- Type, Behavior, HP bar, Position

**Bandit Camp Detail (clicking camp on map):**
- HP bar, Strength
- Last raid day, next raid estimate
- Assault button

**NPC Village Detail (clicking village on map):**
- Name, specialty
- Trust rank + progress
- Liberate / Recruit buttons

### Command Wiring

All commands exposed to window for onclick handlers:

```js
// NEW commands (not in old renderer):
window._setFormation = (vid, mode) => { gameState = setFormation(gameState, vid, mode); };
window._callToArms = () => { gameState = callToArms(gameState); };
window._standDown = () => { gameState = standDown(gameState); };
window._holdFestival = () => { gameState = holdFestival(gameState); };
window._assaultCamp = (campId) => { /* set assault on all idle guards */ };
window._sendExpedition = (guardIds, targetX, targetY) => { gameState = sendExpedition(gameState, guardIds, targetX, targetY); };
window._recallExpedition = (expId) => { gameState = recallExpedition(gameState, expId); };
window._liberateVillage = (settlementId) => { gameState = liberateVillage(gameState, settlementId); };
window._recruitFromVillage = (settlementId) => { gameState = recruitFromVillage(gameState, settlementId); };
window._setJobPriority = (vid, buildingType, priority) => { gameState = setJobPriority(gameState, vid, buildingType, priority); };
window._createSupplyRoute = (fromId, toId, resourceType) => { gameState = createSupplyRoute(gameState, fromId, toId, resourceType); };
window._cancelSupplyRoute = (routeId) => { gameState = cancelSupplyRoute(gameState, routeId); };
window._setPatrol = (vid, route) => { gameState = setPatrol(gameState, vid, route); };
```

### Assign Picker (reusable dropdown)

Used for:
1. Assigning a villager to a building (show buildings with open slots)
2. Assigning a worker to a specific building (show idle villagers)
3. Picking guards for expedition (show available guards)
4. Picking supply route endpoints (show storehouses/outposts)

Generic picker function:
```js
function showPicker(items, onSelect, anchorElement) {
  // items: [{ id, label, sublabel }]
  // Renders dropdown, positions near anchor, calls onSelect(id) on click
}
```

### Topbar Command Buttons

- **Festival button:** Shows cost on hover, disabled if no tavern/inn or on cooldown
- **Call to Arms toggle:** Red when active, shows militia count
- **Territory claim mode:** Same as before
- **Research button:** Opens research overlay

Commit: `feat: renderer v2 — detail panel, all commands wired`

---

## Task 6: Build Bar + Research Overlay + Interactions

**Files:**
- Modify: `src/renderer/buildbar.ts`
- Modify: `src/renderer/main.ts` (camera, input, save/load)

### Build Bar

Port and expand. New category labels must include all building types:
```js
const CATEGORY_LABELS = {
  housing: 'Housing', production: 'Production', processing: 'Processing',
  military: 'Military', storage: 'Storage', utility: 'Utility',
  decoration: 'Decoration',
};
```

Building cards show:
- Name (formatted)
- Cost
- Description (from template)
- Tech requirement (if any, shown as lock icon when not researched)
- Disabled state: can't afford OR missing tech OR no CP (except road/rubble)

Enhanced placement:
- Stay in placement mode for walls, fences, reinforced_walls, roads, spike_traps (batch placement)
- Show building footprint preview with valid/invalid coloring
- Check `FREE_CONSTRUCTION` for road/rubble (no CP cost)

### Research Overlay

Port existing but enhance styling:
- Parchment background
- Three tier sections with ornamental dividers
- Tech cards with:
  - Name, description
  - Cost (knowledge points)
  - Prerequisites (with line connectors if possible, or text)
  - State: completed (green seal), in-progress (amber glow + progress bar), available, locked (faded + lock icon)
- Click to set research

### Camera & Input

Port all camera controls:
- Mouse drag to pan
- Scroll wheel to zoom (0.3x to 5x)
- Click to select entities (priority: villager > enemy > animal > building > camp > village)
- Right-click / ESC to cancel mode or deselect
- Keyboard shortcuts:
  - Space/P: pause/resume
  - 1/2/3: speed 1x/5x/20x
  - B: toggle build bar
  - R: toggle research
  - T: territory claim mode
  - M: toggle military tab
  - F: hold festival (if available)

### Hover Tooltips

Enhanced tooltip showing:
- Entity name + type
- Key stats (HP, role, state)
- Building buffer contents
- Terrain type + deposit

### Save / Load / New Game

Port existing functionality:
- Save: download JSON
- Load: file input or drag-and-drop
- New Game: createWorld(200, 200)

Commit: `feat: renderer v2 — build bar, research, interactions, save/load`

---

## Task 7: Polish + Final Testing

**Files:**
- Modify: `renderer.css` (animations, transitions)
- Modify: `src/renderer/canvas.ts` (performance, polish)
- Modify: `src/renderer/main.ts` (performance)

### Animations & Transitions
- Sidebar tab transitions (content fade)
- Detail panel slide-in from right
- Build bar slide-up
- Notification toasts: slide down + fade in, fade out after 4s
- Season badge color transition
- Button hover effects (brass glow)

### Minimap Compass Rose
- Draw N/S/E/W tick marks at minimap border edges
- Small "N" label at top

### Loading Screen Polish
- Dark wood background
- Centered title in Cinzel
- "A colony grows from a single tent" subtitle in Crimson Text
- New Game + Load buttons in brass styling

### Performance
- Only redraw minimap every 30 frames
- Only update panel DOM every 5 frames
- Terrain: consider caching static terrain to an offscreen canvas, redraw only when fog changes
- Skip rendering tiles outside viewport (frustum culling):
```js
const startX = Math.max(0, Math.floor(-camera.x / TILE));
const startY = Math.max(0, Math.floor(-camera.y / TILE));
const endX = Math.min(gs.width, Math.ceil((-camera.x + viewW / camera.zoom) / TILE));
const endY = Math.min(gs.height, Math.ceil((-camera.y + viewH / camera.zoom) / TILE));
```

### Final Smoke Test

1. Build the bundle: `npx esbuild src/renderer/main.ts --bundle --format=esm --outfile=dist/renderer.js`
2. Open renderer.html in browser
3. Click "New Game"
4. Verify:
   - Map renders with all terrain types (grass, forest, water, stone, hills)
   - Buildings can be placed and render correctly
   - Villagers appear and move
   - Sidebar tabs appear as features unlock
   - All tab contents render
   - Detail panel opens on entity click
   - Research overlay works
   - Speed controls work
   - Save/load works
   - Night cycle uses correct tick math
   - Weather effects render
   - All commands trigger without console errors

Commit: `feat: renderer v2 — polish, performance, final`

---

## Execution Notes

- Each task builds on the previous — they must be done sequentially
- Rebuild after each task: `npx esbuild src/renderer/main.ts --bundle --format=esm --outfile=dist/renderer.js`
- Test in browser after each task (open renderer.html, click New Game, verify)
- Renderer modules import directly from `../world.js` and `../simulation/index.js` — no browser-entry.ts dependency
- Keep the old renderer.html in git history in case of rollback need
- Shared state (gameState, camera, selectedEntity, etc.) lives in main.ts and is imported by other modules
- All DOM element IDs are defined in renderer.html — modules reference them via `document.getElementById()`
