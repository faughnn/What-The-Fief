# Phase 4 — Production Chains

## Goal
Add processed materials, Tier 2 buildings that consume inputs to produce outputs, food quality tiers with morale effects, and food spoilage.

## New Resource Types
Add to Resources: planks, ingots, flour, bread, leather, linen, rope

## Production Chains
```
wood     -> sawmill    -> planks
iron_ore -> smelter    -> ingots
wheat    -> mill       -> flour
flour    -> bakery     -> bread
herbs    -> (used directly for morale in Phase 5)
flax     -> weaver     -> linen
hemp     -> ropemaker  -> rope
```

## New Buildings

| Building | Size | Terrain | Cost | Workers | Input | Output |
|----------|------|---------|------|---------|-------|--------|
| sawmill | 2x1 | grass | 10 wood, 5 stone | 1 | 2 wood → | 3 planks |
| smelter | 2x2 | grass | 15 wood, 10 stone | 1 | 2 iron_ore → | 1 ingots |
| mill | 1x1 | grass | 8 wood | 1 | 3 wheat → | 3 flour |
| bakery | 1x1 | grass | 10 wood, 3 stone | 1 | 2 flour → | 3 bread |
| tanner | 1x1 | grass | 8 wood | 1 | (no input for now) → | 1 leather |
| weaver | 1x1 | grass | 8 wood | 1 | 2 flax → | 2 linen |
| ropemaker | 1x1 | grass | 6 wood | 1 | 2 hemp → | 2 rope |

## Production with Inputs
Extend BuildingTemplate with:
```ts
inputs: Partial<Resources> | null;  // resources consumed per work cycle
```
Worker produces only if inputs available in global storage. Inputs deducted, outputs added.

## Food Quality
- Eating priority: bread > flour > wheat > food (raw)
- bread: +2 food satisfaction per unit (best)
- flour: +1.5 food satisfaction (ok)
- wheat/food: +1 food satisfaction (basic)
- Morale effect deferred to Phase 5 (just track what they ate)

## Food Spoilage
- Raw food loses 5% per tick (round down, min 0)
- Wheat loses 2% per tick
- Bread doesn't spoil
- Flour loses 1% per tick
