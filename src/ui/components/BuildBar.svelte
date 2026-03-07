<script lang="ts">
  import { gameState } from '../stores/gameState';
  import { uiMode, placingType, startPlacing, startClaiming, cancelPlacement, showResearch } from '../stores/placement';
  import { BUILDING_TEMPLATES, BUILDING_TECH_REQUIREMENTS, TECH_TREE, type BuildingType, type TechId, type BuildingTemplate } from '../../world.js';
  import { hasTech } from '../../simulation/helpers.js';

  type Category = 'housing' | 'production' | 'food' | 'military' | 'infrastructure' | 'decoration';

  const CATEGORIES: { id: Category; label: string; types: BuildingType[] }[] = [
    {
      id: 'housing', label: 'Housing',
      types: ['tent', 'cottage', 'house', 'manor', 'barracks', 'inn'],
    },
    {
      id: 'food', label: 'Food',
      types: ['farm', 'large_farm', 'fishing_hut', 'foraging_hut', 'foraging_lodge', 'chicken_coop', 'livestock_barn', 'apiary', 'hunting_lodge', 'trappers_camp',
              'mill', 'windmill', 'bakery', 'kitchen', 'butchery', 'drying_rack', 'smoking_rack', 'compost_pile', 'food_cellar'],
    },
    {
      id: 'production', label: 'Production',
      types: ['woodcutter', 'forester', 'quarry', 'deep_quarry', 'stonemason', 'sawmill', 'lumber_mill',
              'herb_garden', 'flax_field', 'hemp_field', 'iron_mine',
              'smelter', 'advanced_smelter', 'coal_burner',
              'tanner', 'weaver', 'ropemaker', 'blacksmith', 'toolmaker', 'carpenter',
              'well', 'water_collector', 'mint'],
    },
    {
      id: 'military', label: 'Military',
      types: ['wall', 'fence', 'gate', 'reinforced_wall', 'watchtower',
              'weaponsmith', 'fletcher', 'armorer', 'leather_workshop',
              'training_ground', 'spike_trap', 'weapon_rack'],
    },
    {
      id: 'infrastructure', label: 'Infrastructure',
      types: ['storehouse', 'large_storehouse', 'outpost', 'road', 'town_hall',
              'marketplace', 'research_desk', 'library', 'apothecary',
              'tavern', 'church', 'graveyard'],
    },
    {
      id: 'decoration', label: 'Decoration',
      types: ['garden', 'fountain', 'statue'],
    },
  ];

  let activeCategory = $state<Category>('housing');

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);

  function canAfford(type: BuildingType): boolean {
    if (!gs) return false;
    const template = BUILDING_TEMPLATES[type];
    if (!template) return false;
    for (const [res, cost] of Object.entries(template.cost)) {
      if ((gs.resources as any)[res] < cost) return false;
    }
    return true;
  }

  function isUnlocked(type: BuildingType): boolean {
    if (!gs) return false;
    const req = BUILDING_TECH_REQUIREMENTS[type];
    if (!req) return true;
    return hasTech(gs.research, req);
  }

  function getBuildingCost(type: BuildingType): string {
    const template = BUILDING_TEMPLATES[type];
    if (!template) return '';
    return Object.entries(template.cost)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => `${v} ${formatType(k)}`)
      .join(', ');
  }

  function selectBuilding(type: BuildingType) {
    if (!isUnlocked(type) || !canAfford(type)) return;
    startPlacing(type);
  }
</script>

<div class="buildbar">
  <div class="categories">
    {#each CATEGORIES as cat}
      <button
        class="cat-btn"
        class:active={activeCategory === cat.id}
        onclick={() => { activeCategory = cat.id; }}
      >
        {cat.label}
      </button>
    {/each}
    <div class="cat-spacer"></div>
    <button class="cat-btn special" onclick={() => startClaiming()}>Claim</button>
    <button class="cat-btn special" onclick={() => showResearch.set(true)}>Research</button>
    {#if $uiMode !== 'normal'}
      <button class="cat-btn cancel" onclick={cancelPlacement}>Cancel [Esc]</button>
    {/if}
  </div>

  <div class="building-cards">
    {#each CATEGORIES.find(c => c.id === activeCategory)?.types ?? [] as type}
      {@const template = BUILDING_TEMPLATES[type]}
      {@const unlocked = isUnlocked(type)}
      {@const affordable = canAfford(type)}
      {@const techReq = BUILDING_TECH_REQUIREMENTS[type]}
      {#if template}
        <button
          class="building-card"
          class:locked={!unlocked}
          class:unaffordable={unlocked && !affordable}
          class:selected={$placingType === type}
          onclick={() => selectBuilding(type)}
          disabled={!unlocked || !affordable}
        >
          <div class="card-name">{formatType(type)}</div>
          <div class="card-cost">{getBuildingCost(type)}</div>
          {#if !unlocked && techReq}
            <div class="card-lock">Requires: {TECH_TREE[techReq]?.name ?? techReq}</div>
          {/if}
          {#if template.maxWorkers > 0}
            <div class="card-info">{template.maxWorkers} worker{template.maxWorkers > 1 ? 's' : ''}</div>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .buildbar {
    background: linear-gradient(0deg, #1e1810 0%, #221a12 100%);
    border-top: 2px solid #b8964e;
    padding: 4px 8px;
    flex-shrink: 0;
  }

  .categories {
    display: flex;
    gap: 2px;
    margin-bottom: 4px;
    align-items: center;
  }

  .cat-btn {
    background: #2a2218;
    border: 1px solid #3a3025;
    color: #a09880;
    padding: 0.2rem 0.5rem;
    font-family: 'Cinzel', serif;
    font-size: 0.65rem;
    cursor: pointer;
    border-radius: 2px;
  }

  .cat-btn:hover { background: #3a3025; color: #f0e6d0; }
  .cat-btn.active { background: #b8964e; color: #2a2118; border-color: #d4b06a; font-weight: 600; }
  .cat-btn.special { border-color: #5a7a8a; color: #8ab0c0; }
  .cat-btn.special:hover { background: #2a3a3a; }
  .cat-btn.cancel { border-color: #a83a2a; color: #c04030; }
  .cat-spacer { flex: 1; }

  .building-cards {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 2px 0;
    scrollbar-width: thin;
    scrollbar-color: #5a4a35 #1e1810;
  }

  .building-card {
    min-width: 110px;
    max-width: 130px;
    padding: 0.35rem 0.45rem;
    background: #2a2218;
    border: 1px solid #3a3025;
    border-radius: 3px;
    cursor: pointer;
    text-align: left;
    color: #f0e6d0;
    flex-shrink: 0;
  }

  .building-card:hover:not(:disabled) { background: #3a3025; border-color: #b8964e; }
  .building-card.selected { border-color: #b8964e; background: #3a3a20; }
  .building-card.locked {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .building-card.unaffordable {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .card-name {
    font-family: 'Cinzel', serif;
    font-size: 0.7rem;
    color: #f0e6d0;
    font-weight: 500;
    margin-bottom: 2px;
  }

  .card-cost {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: #a09880;
  }

  .card-lock {
    font-size: 0.55rem;
    color: #a83a2a;
    font-style: italic;
    margin-top: 2px;
  }

  .card-info {
    font-size: 0.55rem;
    color: #6a5a4a;
    margin-top: 1px;
    font-family: 'JetBrains Mono', monospace;
  }
</style>
