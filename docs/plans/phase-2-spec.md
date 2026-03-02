# Phase 2 — Living Village

## Goal
Add villager agents with individual identity, movement/pathfinding, job assignment, day schedule (wake→travel→work→eat→sleep), basic needs (food, housing), and immigration/departure.

## New/Modified Types

### Villager (add to world.ts)
```ts
{
  id: string;
  name: string;
  x: number; y: number;
  destX: number | null; destY: number | null;
  path: {x: number, y: number}[];
  role: VillagerRole;
  jobBuildingId: string | null;
  state: VillagerState;
  food: number;         // 0-10, consumes 1/day
  homeless: number;     // days without a house
}
```

### VillagerRole
`'idle' | 'farmer' | 'woodcutter' | 'quarrier' | 'builder'`

### VillagerState
`'sleeping' | 'walking_to_work' | 'working' | 'walking_home' | 'eating' | 'idle'`

### GameState additions
```ts
{
  villagers: Villager[];
  nextVillagerId: number;
}
```
Population becomes derived from `villagers.length`.

## Names Pool
Array of ~30 medieval names. Deterministic: villager N gets name N % pool.length.

## Pathfinding
Simple BFS on the grid. Water tiles are impassable. Buildings on tiles are passable (villagers walk through their workplace). Returns path as coordinate array, or empty if unreachable.

## Tick Cycle (expand tick())

1. **Wake** — sleeping villagers in houses change state to walking_to_work (if assigned) or idle
2. **Pathfind** — villagers with a job but no path calculate path to their job building
3. **Travel** — villagers move up to 3 tiles along their path per tick
4. **Work** — villagers at their job building produce resources:
   - farmer at farm: +3 food
   - woodcutter at woodcutter hut: +2 wood
   - quarrier at quarry: +2 stone
5. **Eat** — each villager consumes 1 food from global storage. If no food: villager.food decreases. If villager.food reaches 0, villager starves and departs.
6. **Housing check** — villagers without a house assigned increment homeless counter. After 5 days homeless, villager departs.
7. **Return home** — working villagers path back to their house
8. **Sleep** — villagers at home set state to sleeping
9. **Immigration** — if food > population * 3 AND there's an unoccupied house, a new villager arrives (max 1 per tick)
10. **Departure** — starving or long-homeless villagers leave

## Action Functions

- `assignVillager(state, villagerId, buildingId): GameState` — assign villager to work at a building. Validation: villager exists, building exists, building has room for workers.

## Housing
- Each house holds 2 villagers
- Villagers are auto-assigned to houses with space (first-fit)
- Building a house may trigger immigration next tick

## Invariant Updates
- population === villagers.length
- No villager position out of bounds
- No orphaned job assignments (villagerId references valid building, building references valid villager)
- All assigned villagers have valid home assignment

## CLI additions
- `--assign villagerId buildingId`
- `--view villagers` — show villager roster

## Renderer additions
- Villager positions on map: lowercase letter of their role first char (f=farmer, w=woodcutter, etc.), or `v` for idle
- Villager roster view: name, role, position, state, food level

## Edge Cases
- 0 food: villagers start starving, depart after food=0
- No houses: all villagers homeless, depart after 5 days
- Full houses: immigration stops
- Unreachable workplace: villager stays idle
- 100 ticks: verify stable population with enough food/houses
