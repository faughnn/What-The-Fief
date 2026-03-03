# Phase 8 — Combat & Defense

## Goal
Add raid system, enemy waves, guard role, squad formation, combat simulation, fortifications.

## Raid System
- `raidBar: number` (0-100) — fills based on prosperity
- Prosperity = total resources / 50 + buildings.length + villagers.length
- Each tick: raidBar += prosperity * 0.5
- When raidBar >= 100: trigger raid, reset to 0, increment raidLevel

## Raid Levels
| Level | Enemies | Type |
|-------|---------|------|
| 1 | 3 bandits | basic |
| 2 | 5 bandits | basic |
| 3 | 3 bandits + 2 wolves | mixed |
| 4+ | level*2 bandits + level wolves | scaling |

## Enemy Types
```ts
interface Enemy {
  type: 'bandit' | 'wolf' | 'boar';
  hp: number;
  attack: number;
  defense: number;
}
```
- bandit: hp=10, attack=3, defense=1
- wolf: hp=6, attack=4, defense=0
- boar: hp=15, attack=2, defense=2

## Guard Role
- Villager role: 'guard'
- Guards have combat stats based on tools:
  - none: attack=1, defense=0
  - basic: attack=2, defense=1
  - sturdy: attack=3, defense=2
  - iron: attack=5, defense=3

## Combat Resolution
Stats-based, per-round:
1. Each guard deals `attack - enemy.defense` damage (min 1) to nearest enemy
2. Each enemy deals `attack - guard.defense` damage (min 1) to nearest guard
3. Remove dead units (hp <= 0)
4. Repeat until one side eliminated

Guard HP = 10 + morale/10. Guards can be injured (reduce HP), heal 2 HP/day.

## Raid Outcome
- Victory: guards survive, enemies eliminated. Reduce raidBar by 20.
- Defeat: enemies destroy a random building, steal 20% of food/wheat.

## Fortifications
- wall: 1x1, stone cost, blocks enemy path
- fence: 1x1, wood cost, slows enemies

## New State Fields
```ts
raidBar: number;
raidLevel: number;
activeRaid: { enemies: Enemy[], resolved: boolean } | null;
```

## CLI
- `--view combat` — shows raid bar, guard count, active raid
