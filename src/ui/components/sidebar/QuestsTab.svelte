<script lang="ts">
  import { gameState } from '../../stores/gameState';
  import { QUEST_DEFINITIONS } from '../../../world.js';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);
  let completed = $derived(gs?.completedQuests ?? []);
</script>

<div class="quests-tab">
  <h3>Quests</h3>

  {#if gs}
    <div class="quest-list">
      {#each QUEST_DEFINITIONS as quest}
        {@const done = completed.includes(quest.id)}
        <div class="quest-row" class:completed={done}>
          <div class="quest-header">
            <span class="quest-status">{done ? '\u2714' : '\u25CB'}</span>
            <span class="quest-name">{quest.name}</span>
          </div>
          <div class="quest-desc">{quest.desc}</div>
          <div class="quest-reward">
            Reward:
            {#if quest.renown} +{quest.renown} renown{/if}
            {#if quest.gold} +{quest.gold} gold{/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .quests-tab { display: flex; flex-direction: column; gap: 0.5rem; }
  h3 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 0.85rem;
    margin: 0 0 0.25rem 0;
    border-bottom: 1px solid #3a3025;
    padding-bottom: 0.25rem;
  }
  .quest-list { display: flex; flex-direction: column; gap: 4px; }
  .quest-row {
    padding: 0.35rem;
    background: #2a2218;
    border: 1px solid #3a3025;
    border-radius: 2px;
  }
  .quest-row.completed { border-color: #4a7a42; opacity: 0.7; }
  .quest-header {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .quest-status { color: #b8964e; font-size: 0.8rem; }
  .quest-row.completed .quest-status { color: #4a7a42; }
  .quest-name {
    color: #f0e6d0;
    font-family: 'Crimson Text', serif;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .quest-desc {
    color: #a09880;
    font-size: 0.65rem;
    font-family: 'Crimson Text', serif;
    margin-top: 0.1rem;
  }
  .quest-reward {
    color: #b8964e;
    font-size: 0.65rem;
    font-family: 'JetBrains Mono', monospace;
    margin-top: 0.15rem;
  }
</style>
