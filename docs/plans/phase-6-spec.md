# Phase 6 — Tools & Equipment

## Goal
Add tool tiers that boost worker efficiency, tool durability/degradation, toolless penalty, blacksmith/toolmaker buildings.

## Tool Tiers
```ts
type ToolTier = 'none' | 'basic' | 'sturdy' | 'iron';
```

Effects on production:
- none: 50% output
- basic: 100% output
- sturdy: 125% output
- iron: 150% output

## Tool Durability
Each tool has durability (uses remaining):
- basic: 20 days
- sturdy: 40 days
- iron: 80 days

When durability reaches 0, tool breaks and reverts to 'none'. Auto-replacement from storage.

## Tool Items in Resources
```ts
basic_tools, sturdy_tools, iron_tools
```

## New Buildings

| Building | Size | Cost | Workers | Input | Output |
|----------|------|------|---------|-------|--------|
| blacksmith | 2x1 | 15 wood, 10 stone | 1 | 2 ingots → | 2 basic_tools |
| toolmaker | 2x1 | 20 wood, 15 stone | 1 | 2 ingots, 1 planks → | 1 sturdy_tools |
| armorer | 2x2 | 25 wood, 20 stone | 1 | 3 ingots, 1 leather → | 1 iron_tools |

## Villager Tool Field
```ts
tool: ToolTier;
toolDurability: number;
```

## Tick Changes
- After work: decrement tool durability
- If tool breaks: auto-equip from storage (best available)
- Production modifier = skillMult * traitMult * moraleMult * toolMult

## Auto-equip Priority
iron_tools > sturdy_tools > basic_tools > none
