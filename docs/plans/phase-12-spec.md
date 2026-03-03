# Phase 12 — Narrative Layer

## Goal
Add event system, quests, renown, and narrative progression to give the colony a story arc.

## Event System
- Random events each tick (seeded from day)
- Events appear in output as narrative text
- Base 10% chance per tick for an event

### Event Types
| Event | Chance | Effect |
|-------|--------|--------|
| wandering_trader | 15% | +5 gold, +3 random resource |
| bountiful_harvest | 10% | +5 wheat (spring/summer only) |
| bandit_sighting | 15% | raidBar += 15 |
| lost_traveler | 10% | New villager arrives if housing available |
| plague | 5% | All villagers -2 food |
| festival | 10% | All villagers +10 morale for 1 tick |
| discovery | 10% | Reveal 5x5 fog area near territory edge |
| drought | 10% | Next tick food production halved (summer only) |
| blessing | 5% | +3 prosperity |
| wolf_attack | 10% | 1 random villager takes 3 damage |

## Renown System
- `renown: number` in GameState (starts at 0)
- Earned by:
  - Winning raids: +5 per victory
  - Research completed: +3 per tech
  - High prosperity (>70): +1 per tick
  - Events (wandering_trader, festival): +1
- Spent on:
  - Nothing yet (future feature hook — for now, just a score)

## Quest System (Simplified)
- 3 milestone quests tracked automatically:
  1. "First Steps": Have 5 villagers, 3 buildings → +10 renown, +20 gold
  2. "Fortified": Win first raid → +15 renown, +30 gold
  3. "Prosperous": Reach prosperity >= 70 → +20 renown, +50 gold

## New State Fields
```ts
renown: number;
events: string[];          // events that occurred this tick
completedQuests: string[]; // quest IDs completed
```

## CLI
- Events shown in summary view (last tick's events)
- `--view events` — shows event log and quests

## Event Log
- `state.events` stores narrative strings from the current tick
- Reset each tick, filled during event processing
- Displayed in summary view if non-empty
