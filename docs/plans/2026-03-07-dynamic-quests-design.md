# Dynamic Event Quest System

## Overview

Time-limited quests that spawn periodically and require the player (overseer) to respond. Quests expire if not completed. Adds gameplay variety beyond passive milestone tracking.

## Data Model

```typescript
interface DynamicQuest {
  id: string;
  type: 'defend' | 'supply' | 'hunt' | 'rescue' | 'trade';
  name: string;
  description: string;
  startDay: number;
  deadline: number;
  status: 'active' | 'completed' | 'expired';
  target?: { x: number; y: number };
  requirements?: Partial<Record<ResourceType, number>>;
  villageId?: string;
  reward: { gold: number; renown: number; trust?: number; villager?: boolean };
  spawnedEntityId?: number;
}
```

## Quest Types

### Defend (20% weight)
- Announces incoming raid, spawns a stronger-than-normal wave 3 days later
- Complete: all raid enemies killed
- Deadline: 3 days after raid spawns
- Reward: 20 gold, 15 renown

### Supply Request (25% weight)
- NPC village requests resources (food, wood, stone, etc.)
- Complete: player uses acceptSupplyQuest command to send resources
- Deadline: 5 days
- Reward: 15 gold, 50 trust to requesting village

### Hunt Bounty (25% weight)
- Elite beast spawns near territory edge (25 HP, 5 atk, 2 def)
- Complete: beast killed
- Deadline: 5 days
- Reward: 15 gold, 10 renown + loot drops

### Rescue (15% weight)
- Lost traveler placed at map location outside territory
- Complete: any villager reaches traveler location, traveler walks to settlement
- Deadline: 7 days
- Reward: free villager (bypasses renown cost)

### Trade Opportunity (15% weight)
- Special merchant prices for 3 days (50% discount on buys, 50% premium on sells)
- Complete: passive (auto-completes when deadline passes, reward is the pricing)
- Deadline: 3 days
- Reward: N/A (benefit is the prices themselves)

## Spawn Rules

- Start after day 20
- One quest every 10-15 days (random interval)
- Max 2 active quests at once
- No duplicate active types
- Type picked randomly by weight

## Commands

- `acceptSupplyQuest(questId)` — deducts resources from storehouse, completes supply quest

## System Integration

- New file: `src/simulation/dynamic-quests.ts`
- Called daily from tick orchestrator (day 0 tick)
- Order: spawn check -> completion check -> expiry check
- Events logged to GameState.events

## Implementation Plan

1. Add DynamicQuest type and GameState.dynamicQuests to world.ts
2. Add elite_beast enemy type constants
3. Create dynamic-quests.ts with spawn/check/expire logic
4. Add acceptSupplyQuest command to commands.ts
5. Wire into tick orchestrator (index.ts daily checks)
6. Write tests for all 5 quest types
7. Update stress test player AI to interact with quests
8. Update PROGRESS.md
