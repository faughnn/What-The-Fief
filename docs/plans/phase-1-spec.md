# Phase 1 — Foundation

## Goal
Establish the core data model, grid system, building placement, basic resources, tick cycle, text rendering, and state invariant validation.

## Types

### Terrain
`'grass' | 'forest' | 'water' | 'stone'`

### Tile
```ts
{ terrain: Terrain; building: Building | null; }
```

### Building
```ts
{
  id: string;
  type: BuildingType;
  x: number; y: number;
  width: number; height: number;
  assignedWorkers: string[];  // villager IDs (empty in Phase 1)
}
```

### BuildingType
`'house' | 'farm' | 'woodcutter' | 'quarry' | 'storehouse'`

### BuildingTemplate
```ts
{
  type: BuildingType;
  width: number; height: number;
  allowedTerrain: Terrain[];
  cost: Partial<Resources>;
  description: string;
}
```

### Resources
```ts
{ wood: number; stone: number; food: number; }
```

### GameState
```ts
{
  day: number;
  grid: Tile[][];        // grid[y][x]
  width: number;
  height: number;
  resources: Resources;
  buildings: Building[];
  nextBuildingId: number;
  population: number;     // placeholder for Phase 2
}
```

## Factory Functions (world.ts)

- `createWorld(width, height, seed?): GameState` — generates terrain using simple deterministic patterns:
  - Water: river running through the map (column range based on seed)
  - Forest: scattered clusters
  - Stone: small patches
  - Everything else: grass
  - Starting resources: wood=50, stone=20, food=30
  - Population: 3

- `BUILDING_TEMPLATES: Record<BuildingType, BuildingTemplate>` — defines each building's size, allowed terrain, and cost

## Simulation Functions (simulation.ts)

- `tick(state): GameState` — Phase 1: advances day by 1, runs invariant checks. No production yet (that needs villagers from Phase 2).

- `placeBuilding(state, type, x, y): GameState` — validates:
  - Building fits within grid bounds
  - All tiles under building have allowed terrain
  - No overlapping buildings
  - Player has enough resources
  - Deducts resources, adds building to state

- `validateState(state): string[]` — returns list of error strings:
  - No negative resources
  - No out-of-bounds buildings
  - No overlapping buildings
  - Population >= 0
  - Grid dimensions match width/height

## Renderer (render-text.ts)

- `renderMap(state): string` — ASCII grid with terrain chars:
  - grass=`.` forest=`T` water=`~` stone=`^`
  - Buildings overlay: house=`H` farm=`F` woodcutter=`W` quarry=`Q` storehouse=`S`
  - Column/row numbers as headers

- `renderSummary(state): string` — compact stats:
  - Day number
  - Resources
  - Population
  - Building count by type
  - Errors from validateState

- `renderAll(state, viewMode): string` — dispatches to appropriate renderer

## CLI (main.ts)

- `--ticks N` — run N ticks (default 1)
- `--view map|summary|all` (default: all)
- `--place type x,y` — place a building before ticking
- `--width W --height H` — world size (default 10x10)
- `--seed S` — world generation seed (default 42)

## Edge Cases
- Place building at grid edge: should work if it fits
- Place building on water: rejected
- Place building overlapping another: rejected
- Place building with insufficient resources: rejected
- 0 ticks: just shows initial state
- Large grids (>20x20): summary omits grid, shows stats only

## Expected Output (default run)
```
=== Colony State [day 1] ===

   0 1 2 3 4 5 6 7 8 9
 0 . . . . . ~ ~ . . .
 1 . . . . . ~ ~ . . .
 2 . T T . . ~ ~ . . ^
 3 . T . . . . . . ^ ^
 4 . . . . . . . . . .
 5 . . . . T T . . . .
 6 . . . . T . . . . .
 7 . . . . . . . ^ . .
 8 . . . . . . . . . .
 9 . . . . . . . . . .

Resources: wood=50 food=30 stone=20
Population: 3
Buildings: (none)
Errors: (none)
```
