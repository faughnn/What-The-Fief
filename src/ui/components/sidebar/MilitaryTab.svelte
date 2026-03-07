<script lang="ts">
  import { gameState } from '../../stores/gameState';
  import { selectEntity } from '../../stores/selection';
  import { callToArmsCmd, standDownCmd, assaultCampCmd } from '../../stores/commands';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);

  let guards = $derived(gs?.villagers.filter(v => v.role === 'guard') ?? []);
  let militia = $derived(gs?.villagers.filter(v => v.role === 'militia') ?? []);
  let enemies = $derived(gs?.enemies ?? []);
  let camps = $derived(gs?.banditCamps ?? []);
  let spikeTrapCount = $derived(gs?.buildings.filter(b => b.type === 'spike_trap' && b.constructed).length ?? 0);
</script>

<div class="military-tab">
  <h3>Military</h3>

  {#if gs}
    <!-- Call to Arms -->
    <div class="section">
      {#if gs.callToArms}
        <button class="cmd-btn danger" onclick={standDownCmd}>Stand Down</button>
        <span class="militia-note">Militia active: {militia.length}</span>
      {:else}
        <button class="cmd-btn" onclick={callToArmsCmd}>Call to Arms</button>
      {/if}
    </div>

    <!-- Guards -->
    <div class="section">
      <div class="label">Guards ({guards.length})</div>
      {#each guards as g}
        <button class="entity-row" onclick={() => selectEntity({ type: 'villager', id: g.id })}>
          <span class="name">{g.name}</span>
          <span class="info">
            {formatType(g.guardMode)} / {g.guardLine}
            {#if g.weapon !== 'none'} | {formatType(g.weapon)}{/if}
          </span>
        </button>
      {/each}
      {#if guards.length === 0}
        <div class="muted">No guards assigned.</div>
      {/if}
    </div>

    <!-- Threats -->
    {#if enemies.length > 0}
      <div class="section">
        <div class="label danger-text">Active Threats ({enemies.length})</div>
        {#each enemies as e}
          <button class="entity-row threat" onclick={() => selectEntity({ type: 'enemy', id: e.id })}>
            <span class="name">{formatType(e.type)}</span>
            <span class="info">HP: {e.hp}/{e.maxHp} | Atk: {e.attack}</span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Bandit Camps -->
    {#if camps.length > 0}
      <div class="section">
        <div class="label">Bandit Camps ({camps.length})</div>
        {#each camps as camp}
          <div class="camp-row">
            <span>Str {camp.strength} | HP: {camp.hp}/{camp.maxHp}</span>
            <button class="cmd-btn small" onclick={() => assaultCampCmd(camp.id)}>Assault</button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Spike Traps -->
    {#if spikeTrapCount > 0}
      <div class="section">
        <div class="label">Defenses</div>
        <div class="muted">Spike traps: {spikeTrapCount}</div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .military-tab { display: flex; flex-direction: column; gap: 0.5rem; }
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
  .danger-text { color: #c04030; }
  .entity-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0.25rem 0.35rem;
    background: #2a2218;
    border: 1px solid #3a3025;
    border-radius: 2px;
    cursor: pointer;
    color: #f0e6d0;
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    margin-bottom: 2px;
    text-align: left;
  }
  .entity-row:hover { background: #3a3025; border-color: #b8964e; }
  .entity-row.threat { border-color: #5a2a20; }
  .entity-row.threat:hover { border-color: #a83a2a; }
  .name { color: #f0e6d0; }
  .info { color: #a09880; font-size: 0.65rem; }
  .camp-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.2rem 0.3rem;
    font-size: 0.7rem;
    color: #c8c0a8;
    font-family: 'JetBrains Mono', monospace;
  }
  .cmd-btn {
    background: #3a3025;
    border: 1px solid #5a4a35;
    color: #f0e6d0;
    padding: 0.3rem 0.6rem;
    font-family: 'Cinzel', serif;
    font-size: 0.7rem;
    cursor: pointer;
    border-radius: 2px;
  }
  .cmd-btn:hover { background: #4a3a2a; border-color: #b8964e; }
  .cmd-btn.danger { border-color: #a83a2a; color: #c04030; }
  .cmd-btn.danger:hover { background: #3a2020; }
  .cmd-btn.small { padding: 0.15rem 0.4rem; font-size: 0.6rem; }
  .militia-note { color: #a09880; font-size: 0.7rem; margin-left: 0.5rem; }
  .muted { color: #6a5a4a; font-size: 0.7rem; font-style: italic; }
</style>
