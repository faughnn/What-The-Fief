# Phase 9 — Research & Progression

## Goal
Add tech tree with research buildings, researcher role, and tech bonuses that enhance existing systems.

## Research Building
- `research_desk`: 1x1, grass, cost: wood=10 stone=5, maxWorkers=1
- Researcher produces `knowledge` points toward current research
- Base rate: 1 knowledge/day per researcher (affected by crafting skill + tool + morale multipliers)

## Research State
```ts
interface ResearchState {
  completed: TechId[];
  current: TechId | null;
  progress: number;  // accumulated knowledge toward current
}
```
Added to GameState as `research: ResearchState`.

## Tech Tree

| TechId | Cost | Effect |
|--------|------|--------|
| crop_rotation | 10 | Farms +1 wheat per worker |
| masonry | 10 | Quarries +1 stone per worker |
| herbalism_lore | 10 | Herb gardens +1 herbs per worker |
| metallurgy | 20 | Smelters +1 ingot per worker |
| improved_tools | 15 | All tool durability +20% |
| fortification | 20 | Guards +1 defense |
| military_tactics | 25 | Guards +2 attack |
| civil_engineering | 30 | Building costs -25% (rounded down) |

8 techs total. No prerequisites — any tech can be researched in any order.
Cannot research already-completed techs.

## Tech Effects Implementation
- Production bonuses: modify `amountPerWorker` in tick's work step
- `improved_tools`: multiply durability by 1.2 when equipping
- `fortification`/`military_tactics`: add to GUARD_COMBAT stats during combat
- `civil_engineering`: reduce costs in placeBuilding

## Researcher Role
- New role: `researcher`
- BUILDING_SKILL_MAP: research_desk → crafting
- ROLE_MAP: research_desk → researcher

## CLI
- `--research techId` — set current research target
- `--view research` — shows completed techs, current research, progress

## New State Fields
```ts
research: ResearchState;
```

## Validation
- Current research must be a valid, non-completed tech
- Progress must be non-negative
