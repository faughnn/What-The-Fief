<script lang="ts">
  import { gameState } from '../../stores/gameState';
  import { liberateVillageCmd, recruitFromVillageCmd } from '../../stores/commands';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const TRUST_THRESHOLDS: Record<string, number> = {
    stranger: 0, associate: 100, friend: 500, protector: 1200,
  };

  let gs = $derived($gameState);
  let settlements = $derived(gs?.npcSettlements ?? []);
</script>

<div class="diplomacy-tab">
  <h3>Diplomacy</h3>

  {#if gs}
    {#each settlements as s}
      <div class="village-card">
        <div class="village-header">
          <span class="village-name">{s.name}</span>
          <span class="trust-rank" class:liberated={s.liberated}>{formatType(s.trustRank)}</span>
        </div>

        <!-- Trust bar -->
        {#if !s.liberated}
          {@const nextThreshold = s.trustRank === 'stranger' ? 100 : s.trustRank === 'associate' ? 500 : s.trustRank === 'friend' ? 1200 : 1200}
          {@const currentBase = TRUST_THRESHOLDS[s.trustRank] ?? 0}
          {@const pct = Math.min(100, ((s.trust - currentBase) / (nextThreshold - currentBase)) * 100)}
          <div class="trust-bar-bg">
            <div class="trust-bar-fill" style="width: {pct}%"></div>
          </div>
          <div class="trust-val">Trust: {s.trust} / {nextThreshold}</div>
        {:else}
          <div class="trust-val liberated">Liberated</div>
        {/if}

        <!-- Actions -->
        <div class="village-actions">
          {#if s.trustRank === 'protector' && !s.liberated && !s.liberationInProgress}
            <button class="cmd-btn" onclick={() => liberateVillageCmd(s.id)}>Liberate</button>
          {/if}
          {#if s.liberated}
            <button class="cmd-btn" onclick={() => recruitFromVillageCmd(s.id)}>Recruit (10 renown)</button>
          {/if}
        </div>
      </div>
    {/each}

    {#if settlements.length === 0}
      <div class="muted">No settlements discovered.</div>
    {/if}
  {/if}
</div>

<style>
  .diplomacy-tab { display: flex; flex-direction: column; gap: 0.5rem; }
  h3 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 0.85rem;
    margin: 0 0 0.25rem 0;
    border-bottom: 1px solid #3a3025;
    padding-bottom: 0.25rem;
  }
  .village-card {
    padding: 0.4rem;
    background: #2a2218;
    border: 1px solid #3a3025;
    border-radius: 3px;
    margin-bottom: 4px;
  }
  .village-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }
  .village-name {
    color: #f0e6d0;
    font-family: 'Crimson Text', serif;
    font-weight: 600;
    font-size: 0.8rem;
  }
  .trust-rank {
    color: #a09880;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    padding: 0.1rem 0.3rem;
    border: 1px solid #3a3025;
    border-radius: 2px;
  }
  .trust-rank.liberated { color: #4a7a42; border-color: #4a7a42; }
  .trust-bar-bg {
    background: #1a1410;
    height: 6px;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.15rem;
  }
  .trust-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #5a7a8a, #b8964e);
    transition: width 0.3s;
  }
  .trust-val {
    color: #a09880;
    font-size: 0.65rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .trust-val.liberated { color: #4a7a42; }
  .village-actions {
    display: flex;
    gap: 4px;
    margin-top: 0.3rem;
  }
  .cmd-btn {
    background: #3a3025;
    border: 1px solid #5a4a35;
    color: #f0e6d0;
    padding: 0.2rem 0.5rem;
    font-family: 'Cinzel', serif;
    font-size: 0.65rem;
    cursor: pointer;
    border-radius: 2px;
  }
  .cmd-btn:hover { background: #4a3a2a; border-color: #b8964e; }
  .muted { color: #6a5a4a; font-size: 0.7rem; font-style: italic; }
</style>
