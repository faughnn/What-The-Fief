# Phase 5 — Villager Depth

## Goal
Add skill system (learn-by-doing), personality traits, morale system, and morale effects on productivity and population.

## Skills
Each villager has a skills map: `Record<SkillType, number>` (0-100).
Types: farming, mining, crafting, woodcutting, cooking, herbalism

### Skill gain
+1 XP per day worked in relevant skill. Skills affect output:
- 0-25: 80% output
- 26-50: 100% output
- 51-75: 120% output
- 76-100: 150% output

Production formula: `base_output * skillMultiplier`. Fractional output rounds down (min 1 if working).

### Skill-to-building mapping
- farming: farm, flax_field, hemp_field
- mining: quarry, iron_mine
- crafting: sawmill, smelter, bakery, tanner, weaver, ropemaker
- woodcutting: woodcutter
- cooking: mill, bakery
- herbalism: herb_garden

## Traits
Each villager gets 0-2 traits at creation. Traits are permanent.

| Trait | Effect |
|-------|--------|
| strong | +20% production output |
| lazy | -20% production output |
| skilled_crafter | +50% crafting XP gain |
| fast_learner | +50% all XP gain |
| glutton | eats 2 food/day instead of 1 |
| frugal | 50% chance to skip eating |
| cheerful | +10 base morale |
| gloomy | -10 base morale |

## Morale
Each villager has morale: 0-100, starting at 50.

### Morale factors (recalculated each tick)
- Base: 50
- Housed: +10 (has home), 0 (homeless)
- Fed: +10 (ate bread), +5 (ate flour), 0 (ate wheat/food), -20 (starving)
- Trait bonus: cheerful +10, gloomy -10
- Final morale = clamp(sum, 0, 100)

### Morale effects on work
- morale >= 70: +10% output bonus
- morale 30-69: normal
- morale < 30: -20% output
- morale <= 10: villager departs (along with starvation/homeless)

## Changes to Tick
1. After eating: calculate morale for each villager
2. Apply skill/morale/trait modifiers to production output
3. Gain skill XP after working
4. Departure: food<=0 OR homeless>=5 OR morale<=10

## Villager additions
```ts
skills: Record<SkillType, number>;
traits: Trait[];
morale: number;
lastAte: 'bread' | 'flour' | 'wheat' | 'food' | 'nothing';
```

## Renderer additions
- Villager view shows skills, traits, morale
- Summary shows average morale
