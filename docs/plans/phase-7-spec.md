# Phase 7 — Expansion & Exploration

## Goal
Larger maps (50x50), fog of war, scouting system, territory claiming, resource discovery.

## Fog of War
- `MapFog: boolean[][]` — true = revealed, false = fog
- Initially: 10x10 area around starting position is revealed
- Fog tiles shown as `?` on map
- Can only build in revealed + claimed territory

## Territory
- `territory: boolean[][]` — true = claimed
- Initially: 5x5 area around center is claimed
- Can only place buildings in claimed territory
- Claiming costs resources: 5 wood + 2 stone per 5x5 chunk

## Scouting
- New role: 'scout'
- CLI: `--scout villagerId direction` (n/s/e/w)
- Scout reveals a 10x10 area per tick in the given direction
- Scout moves 5 tiles per tick toward the edge
- Returns home after reaching map edge or 10 ticks

## Resource Deposits
- Hidden in fog: iron deposits (stone tiles), fertile soil (grass bonus), herb patches
- Discovered when fog is revealed
- Tile metadata: `deposit: 'iron' | 'fertile' | 'herbs' | null`

## Town Hall
- New building: town_hall (3x3, expensive)
- Required to claim new territory
- Only one allowed

## Default Map Size
- Change default to 20x20 (50x50 too big for text output)
- Compact view for maps > 20x20

## Changes
- GameState adds: fog, territory
- createWorld generates deposits in fog
- placeBuilding checks territory
- New --scout CLI command
