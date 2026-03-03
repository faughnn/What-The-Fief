# Phase 10 — Advanced Economy

## Goal
Add animal husbandry, trade system, and prosperity scoring.

## Animal Husbandry

### New Buildings
- `chicken_coop`: 1x1, grass, cost: wood=8. maxWorkers=1. Produces food 2/worker (no inputs)
- `livestock_barn`: 2x1, grass, cost: wood=15 stone=5. maxWorkers=1. Produces leather 1/worker + food 1/worker (no inputs)
- `apiary`: 1x1, grass, cost: wood=6. maxWorkers=1. Produces herbs 1/worker (no inputs, represents honey/medicinal)

### New Roles
- `chicken_keeper`: works chicken_coop
- `rancher`: works livestock_barn
- `beekeeper`: works apiary

### Skill Mapping
- chicken_coop → farming
- livestock_barn → farming
- apiary → herbalism

## Trade System

### Marketplace Building
- `marketplace`: 2x2, grass, cost: wood=20 stone=10 planks=5. maxWorkers=0 (no production)
- Enables merchant visits

### Merchant Visits
- Every 15 ticks, if marketplace exists, a merchant arrives
- GameState gets `merchant: MerchantState | null`
- Merchant offers to buy/sell at fixed prices
- Merchant stays for 3 ticks, then leaves

### Trade Prices (buy = what you pay, sell = what you get)
| Resource | Buy Price (gold) | Sell Price (gold) |
|----------|-----------------|-------------------|
| food | 2 | 1 |
| wheat | 3 | 1 |
| wood | 3 | 2 |
| stone | 4 | 2 |
| planks | 6 | 3 |
| ingots | 8 | 4 |
| bread | 5 | 3 |
| herbs | 4 | 2 |
| leather | 5 | 3 |
| linen | 6 | 3 |
| rope | 5 | 2 |

### Gold Resource
- New resource: `gold`
- Starting gold: 0
- Earned by selling goods to merchants
- Spent buying goods from merchants

### CLI Trade Commands
- `--buy resource amount` — buy from merchant (processed before ticks)
- `--sell resource amount` — sell to merchant (processed before ticks)
- Trade only works if merchant is present (marketplace exists, merchant visiting)

## Prosperity System
- `prosperity: number` tracked in GameState (0-100)
- Calculated each tick based on:
  - +10 if avg food > 3
  - +10 if all villagers housed
  - +10 if avg morale > 60
  - +5 per unique food type available (bread, wheat, food)
  - +5 per building type present (up to +30)
  - +10 if guards present
  - +10 if any tech researched
- Prosperity affects immigration rate (prosperity > 50 = faster immigration)
- Displayed in summary view

## New State Fields
```ts
gold: number;           // in Resources
merchant: MerchantState | null;
prosperity: number;
merchantTimer: number;  // ticks until next merchant
```

```ts
interface MerchantState {
  ticksLeft: number;    // turns until merchant leaves
}
```

## New Resource
- Add `gold` to ResourceType, Resources, ALL_RESOURCES
- Gold is NOT subject to storage cap (tracked separately)
- Gold is NOT subject to spoilage

## Validation
- Gold must be non-negative
- Prosperity 0-100
- merchantTimer >= 0
