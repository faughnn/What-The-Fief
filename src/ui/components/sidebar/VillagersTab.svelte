<script lang="ts">
  import { gameState } from '../../stores/gameState';
  import { selectEntity } from '../../stores/selection';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function stateIcon(state: string): string {
    switch (state) {
      case 'sleeping': return 'Zzz';
      case 'working': case 'constructing': return '\u2692';
      case 'eating': return '\u2615';
      case 'hunting': return '\u25C9';
      case 'scouting': return '\u25CE';
      case 'on_expedition': return '\u2690';
      case 'assaulting_camp': return '\u2694';
      case 'healing': return '+';
      case 'relaxing': return '\u266A';
      case 'idle': return '\u2022';
      default: return state.includes('traveling') ? '\u2794' : '\u2022';
    }
  }
</script>

<div class="villagers-tab">
  <h3>Villagers ({$gameState?.villagers.length ?? 0})</h3>

  {#if $gameState}
    <div class="villager-list">
      {#each $gameState.villagers as v}
        <button
          class="villager-row"
          onclick={() => selectEntity({ type: 'villager', id: v.id })}
        >
          <div class="v-main">
            <span class="v-name">{v.name}</span>
            <span class="v-role">{formatType(v.role)}</span>
          </div>
          <div class="v-status">
            <span class="v-state">{stateIcon(v.state)}</span>
            {#if v.hp < v.maxHp}
              <span class="v-hp" title="HP: {v.hp}/{v.maxHp}">
                {Math.round((v.hp / v.maxHp) * 100)}%
              </span>
            {/if}
            {#if v.sick}
              <span class="v-sick" title="Sick">\u2620</span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .villagers-tab { display: flex; flex-direction: column; gap: 0.25rem; }
  h3 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 0.85rem;
    margin: 0 0 0.25rem 0;
    border-bottom: 1px solid #3a3025;
    padding-bottom: 0.25rem;
  }
  .villager-list { display: flex; flex-direction: column; gap: 2px; }
  .villager-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3rem 0.4rem;
    background: #2a2218;
    border: 1px solid #3a3025;
    border-radius: 2px;
    cursor: pointer;
    text-align: left;
    color: #f0e6d0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
  }
  .villager-row:hover { background: #3a3025; border-color: #b8964e; }
  .v-main { display: flex; flex-direction: column; }
  .v-name { color: #f0e6d0; font-weight: 500; }
  .v-role { color: #a09880; font-size: 0.65rem; }
  .v-status { display: flex; align-items: center; gap: 0.3rem; }
  .v-state { color: #c8c0a8; }
  .v-hp { color: #c04030; font-size: 0.65rem; }
  .v-sick { color: #a83a2a; }
</style>
