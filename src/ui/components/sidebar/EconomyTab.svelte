<script lang="ts">
  import { gameState } from '../../stores/gameState';
  import { selectEntity } from '../../stores/selection';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);
  let caravans = $derived(gs?.caravans ?? []);
  let supplyRoutes = $derived(gs?.supplyRoutes ?? []);
  let marketplace = $derived(gs?.buildings.find(b => b.type === 'marketplace' && b.constructed) ?? null);
</script>

<div class="economy-tab">
  <h3>Economy</h3>

  {#if gs}
    <!-- Supply Routes -->
    <div class="section">
      <div class="label">Supply Routes ({supplyRoutes.length})</div>
      {#if supplyRoutes.length > 0}
        {#each supplyRoutes as route}
          <div class="route-row">
            <span>{formatType(route.resourceType)}</span>
            <span class="route-info">Active</span>
          </div>
        {/each}
      {:else}
        <div class="muted">No supply routes.</div>
      {/if}
    </div>

    <!-- Active Caravans -->
    <div class="section">
      <div class="label">Caravans ({caravans.length})</div>
      {#each caravans as c}
        <div class="caravan-row">
          <span>From: {gs.npcSettlements.find(s => s.id === c.settlementId)?.name ?? 'Unknown'}</span>
          <span class="caravan-info">{Math.ceil(c.ticksLeft / 4000)} days</span>
        </div>
      {/each}
      {#if caravans.length === 0}
        <div class="muted">No active caravans.</div>
      {/if}
    </div>

    <!-- Marketplace -->
    {#if marketplace}
      <div class="section">
        <div class="label">Marketplace</div>
        <button class="entity-row" onclick={() => selectEntity({ type: 'building', id: marketplace!.id })}>
          <span>View marketplace details</span>
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .economy-tab { display: flex; flex-direction: column; gap: 0.5rem; }
  h3 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 0.85rem;
    margin: 0 0 0.25rem 0;
    border-bottom: 1px solid #3a3025;
    padding-bottom: 0.25rem;
  }
  .section { margin-bottom: 0.25rem; }
  .label {
    color: #a09880;
    font-family: 'Cinzel', serif;
    font-size: 0.7rem;
    margin-bottom: 0.2rem;
    text-transform: uppercase;
  }
  .route-row, .caravan-row {
    display: flex;
    justify-content: space-between;
    padding: 0.2rem 0.3rem;
    font-size: 0.7rem;
    color: #c8c0a8;
    font-family: 'JetBrains Mono', monospace;
    border-bottom: 1px solid rgba(58, 48, 37, 0.3);
  }
  .route-info, .caravan-info { color: #a09880; }
  .entity-row {
    display: block;
    width: 100%;
    padding: 0.25rem 0.35rem;
    background: #2a2218;
    border: 1px solid #3a3025;
    border-radius: 2px;
    cursor: pointer;
    color: #c8c0a8;
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    text-align: left;
  }
  .entity-row:hover { background: #3a3025; border-color: #b8964e; }
  .muted { color: #6a5a4a; font-size: 0.7rem; font-style: italic; }
</style>
