# Renderer Redesign: Cartographer's War Table

## Overview

Full replacement of renderer.html. The current UI was built when the game had ~20 features; it now has ~60+. Rather than patching, we're building a new renderer from scratch with a distinctive aesthetic and full feature coverage.

## Aesthetic Direction

**Concept:** The player is a lord surveying a living map on a heavy oak table. UI panels are parchment documents, notifications are wax-sealed dispatches, borders have brass/cartographic trim.

**Typography:**
- Display/headers: `Cinzel` (ornate serif, medieval authority)
- Body text: `Crimson Text` (readable period serif)
- Data/numbers: `JetBrains Mono` (clean monospace for tabular data)

**Color Palette:**
- Dark wood background: `#2a2118`
- Aged parchment panels: `#f0e6d0`
- Brass/gold accents: `#b8964e`
- Ink text: `#3a3025`
- Wax red (danger): `#a83a2a`
- Forest green (success): `#4a7a42`
- Faded blue (water/info): `#5a7a8a`

**Visual Details:**
- Subtle parchment texture via CSS noise/gradient
- Ornamental corner flourishes on panels
- Compass rose border on minimap
- Inset shadow on canvas (map sits "in" the table)
- Wax-seal style notification badges

## Layout

```
+-------------------------------------------------------------+
| TOP BAR: Logo - Day/Season/Weather - Resources - Speed Ctrl  |
+-----------------------------------------+-------------------+
|                                         | SIDEBAR (280px)   |
|                                         | [Dynamic Tabs]    |
|           CANVAS (THE MAP)              |                   |
|                                         | Tab content       |
|                                         |                   |
|     [compass-bordered minimap]          |                   |
+-----------------------------------------+-------------------+
| BUILD BAR: [Categories] | [Building cards with costs]       |
+-------------------------------------------------------------+
```

## Sidebar Tabs (Progressive Disclosure)

Tabs appear dynamically based on game state, not hardcoded:

| Tab | Appears When |
|-----|-------------|
| Overview | Always (resources, stats, events, renown) |
| Villagers | Always (list, click for detail) |
| Military | First guard/military building/enemy appears |
| Economy | Marketplace built or caravan arrives |
| Quests | First quest completed |
| Expeditions | First expedition sent |
| Diplomacy | NPC village discovered |

Visibility logic lives in the UI only (checks GameState fields). No simulation changes needed.

## Detail Panel

Clicking any entity on the map opens a detail overlay that slides over the sidebar tabs. Shows full entity info + context-sensitive commands. Close button returns to tabs.

### Villager Detail
- Name, age, role, state
- HP bar, food, morale
- Skills with levels and caps
- Traits
- Weapon, armor, tool (with durability)
- Friends list
- Housing comfort
- Combat skill (for guards)
- Commands: Set Guard, Assign Job, Set Job Priority, Scout

### Building Detail
- Type, HP bar, construction progress
- Production info (inputs/outputs)
- Local buffer contents
- Worker list with assign/unassign
- Upgrade path and button
- Formation controls (for military buildings)

### Enemy Detail
- Type, HP, attack, defense, siege equipment
- Type-specific info (archer range, brute armor, warlord status)

### Animal Detail
- Type, behavior, HP

## Sidebar Tab Contents

### Overview
- Full resource list (grouped: Food, Raw Materials, Processed, Military, Currency)
- Raid threat bar
- Event log (last 8)
- Renown display
- Day/season/weather (duplicated from topbar for tab context)

### Military
- Guards list with formation badges
- Formation controls (charge/hold/patrol)
- Call to Arms / Stand Down buttons
- Active threats (enemies on map)
- Bandit camps with assault button
- Spike trap count

### Economy
- Supply routes (create/cancel)
- Active caravans
- Trade prices (dynamic)
- Marketplace buy/sell (if selected)

### Quests
- Quest list with completion status
- Rewards shown
- Progress indicators for incomplete quests

### Expeditions
- Active expedition squads
- Send expedition controls
- Recall button
- POIs discovered
- Expedition rewards log

### Diplomacy
- NPC villages with trust levels
- Trust progress bars
- Liberate button (at protector rank)
- Recruit button (for liberated villages)
- Renown stream info

## Canvas Rendering

### Terrain
- **Grass:** Soft watercolor wash with subtle variation, organic blending
- **Forest:** Stylized tree clusters (2-3 triangle trees), ink outlines
- **Water:** Cartographic parallel wavy ink strokes, animated
- **Stone:** Stippled/hatched rocky texture
- **Hills:** Hatched elevation lines (classic cartography), brownish-green
- **Roads:** Dotted/dashed tan line, trail on old map
- **Fog:** Aged parchment, darker at revealed edges

### Buildings
- Miniature architectural sketches (top-down silhouettes)
- Category-colored with ink-weight outlines
- Walls visually connect adjacent segments
- Watchtower shows detection radius ring
- Construction = scaffolding cross-hatch over dashed outline
- Damage = crack overlays
- Fire = animated hand-drawn flame wisps

### Entities
- **Villagers:** Round head + body dot, activity icon above (hammer/wheat/Zzz/footprints), guard shield pip, carrying satchel
- **Enemies:** Red banner/pennant shape, sized by type, glow ring
- **Animals:** Tiny silhouettes by species
- **Merchants/Caravans:** Cart with wheels
- **Resource drops:** Small sack/bundle with glint
- **Expedition squads:** Banner on pole, moving
- **Bandit camps:** Skull + tent cluster, sized by strength
- **NPC villages:** House cluster, color-coded by trust

### Night & Weather
- Night: Blue-purple overlay with vignette, candlelight glow from occupied buildings
- Rain: Diagonal semi-transparent line streaks
- Storm: Heavy rain + occasional flash
- Territory: Dashed ink boundary line (map border style)

### Zoom Levels
- Zoomed out: Simplified icons, no activity markers
- Mid (default): Full detail
- Zoomed in: Names visible, HP bars appear

## Commands Wired Up

All simulation exports connected to UI triggers:

- placeBuilding, claimTerritory (existing)
- assignVillager, setGuard, sendScout (existing)
- setResearch, upgradeBuilding (existing)
- buyResource, sellResource (existing)
- setFormation (new: in military tab / guard detail)
- setPatrol (new: in guard detail)
- callToArms, standDown (new: military tab)
- holdFestival (new: overview or economy tab)
- sendExpedition, recallExpedition (new: expeditions tab)
- assaultCamp (new: military tab, camp detail)
- liberateVillage, recruitFromVillage (new: diplomacy tab)
- setJobPriority, setPreferredJob (new: villager detail)
- createSupplyRoute, cancelSupplyRoute (new: economy tab)
- payTribute (new: diplomacy or event-triggered)

## Technical Notes

- Single HTML file with inline CSS + JS (same pattern as current)
- Imports from `./dist/colonysim.js` (esbuild bundle)
- Canvas 2D rendering, no sprites/images — all procedural
- "Hand-drawn" feel from slight vertex offsets, varying stroke widths, warm alpha blending
- Tab visibility = simple conditionals checking GameState in UI update loop
- Detail panel = innerHTML swap on sidebar (same pattern, expanded)
