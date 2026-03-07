<script lang="ts">
  import { gameState } from '../../stores/gameState';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);
  let expeditions = $derived(gs?.expeditions ?? []);
  let pois = $derived(gs?.pointsOfInterest.filter(p => p.discovered) ?? []);
</script>

<div class="expeditions-tab">
  <h3>Expeditions</h3>

  {#if gs}
    <!-- Active Expeditions -->
    <div class="section">
      <div class="label">Active ({expeditions.length})</div>
      {#each expeditions as exp}
        <div class="exp-row">
          <span class="exp-state">{formatType(exp.state)}</span>
          <span class="exp-info">{exp.memberIds.length} members</span>
        </div>
      {/each}
      {#if expeditions.length === 0}
        <div class="muted">No active expeditions.</div>
      {/if}
    </div>

    <!-- Discovered POIs -->
    <div class="section">
      <div class="label">Points of Interest ({pois.length})</div>
      {#each pois as poi}
        <div class="poi-row" class:explored={poi.explored}>
          <span class="poi-type">{poi.explored ? '\u2714' : '\u25CF'} {formatType(poi.type)}</span>
          <span class="poi-pos">({poi.x}, {poi.y})</span>
        </div>
      {/each}
      {#if pois.length === 0}
        <div class="muted">No POIs discovered yet.</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .expeditions-tab { display: flex; flex-direction: column; gap: 0.5rem; }
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
  .exp-row, .poi-row {
    display: flex;
    justify-content: space-between;
    padding: 0.2rem 0.3rem;
    font-size: 0.7rem;
    color: #c8c0a8;
    font-family: 'JetBrains Mono', monospace;
    border-bottom: 1px solid rgba(58, 48, 37, 0.3);
  }
  .poi-row.explored { opacity: 0.5; }
  .exp-state { color: #b8964e; }
  .exp-info, .poi-pos { color: #a09880; }
  .poi-type { color: #c8c0a8; }
  .muted { color: #6a5a4a; font-size: 0.7rem; font-style: italic; }
</style>
