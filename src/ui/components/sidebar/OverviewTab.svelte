<script lang="ts">
  import { gameState, day, season, weather, prosperity, renown, events, resources } from '../../stores/gameState';
  import type { ResourceType } from '../../../world.js';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const RESOURCE_GROUPS: { label: string; keys: ResourceType[] }[] = [
    { label: 'Food', keys: ['food', 'wheat', 'fish', 'flour', 'bread', 'meat', 'dried_food', 'smoked_food'] },
    { label: 'Raw Materials', keys: ['wood', 'stone', 'iron_ore', 'herbs', 'flax', 'hemp'] },
    { label: 'Processed', keys: ['planks', 'charcoal', 'ingots', 'leather', 'linen', 'rope', 'furniture', 'water', 'fertilizer', 'stone_blocks' as ResourceType] },
    { label: 'Equipment', keys: ['basic_tools', 'sturdy_tools', 'iron_tools', 'sword', 'bow', 'leather_armor' as ResourceType, 'iron_armor' as ResourceType, 'bandage' as ResourceType] },
    { label: 'Currency', keys: ['gold' as ResourceType] },
  ];
</script>

<div class="overview">
  <h3>Overview</h3>

  <div class="section">
    <div class="stat-row">
      <span>Day {$day}</span>
      <span>{formatType($season)}</span>
      <span>{formatType($weather)}</span>
    </div>
    <div class="stat-row">
      <span>Prosperity: {Math.round($prosperity)}</span>
      <span>Renown: {$renown}</span>
    </div>
  </div>

  {#if $gameState}
    <!-- Raid Threat -->
    <div class="section">
      <div class="label">Raid Threat</div>
      <div class="bar-bg">
        <div class="bar-fill threat" style="width: {Math.min(100, ($gameState.raidBar / 100) * 100)}%"></div>
      </div>
    </div>

    <!-- Resources by group -->
    {#each RESOURCE_GROUPS as group}
      {@const items = group.keys.filter(k => ($resources as any)?.[k] > 0)}
      {#if items.length > 0}
        <div class="section">
          <div class="label">{group.label}</div>
          <div class="resource-grid">
            {#each items as r}
              <div class="res-item">
                <span class="res-name">{formatType(r)}</span>
                <span class="res-val">{Math.floor(($resources as any)[r])}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {/if}

  <!-- Event Log -->
  <div class="section">
    <div class="label">Events</div>
    <div class="event-log">
      {#each [...$events].reverse().slice(0, 8) as evt}
        <div class="event">{evt}</div>
      {/each}
      {#if $events.length === 0}
        <div class="event muted">No events yet.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .overview { display: flex; flex-direction: column; gap: 0.5rem; }
  h3 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 0.85rem;
    margin: 0 0 0.25rem 0;
    border-bottom: 1px solid #3a3025;
    padding-bottom: 0.25rem;
  }
  .label { letter-spacing: 0.05em; }
  .stat-row { gap: 0.75rem; font-size: 0.75rem; }
  .bar-bg { border: 1px solid #3a3025; }
  .bar-fill.threat { background: linear-gradient(90deg, #a83a2a, #c04030); }
  .resource-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px 0.5rem;
  }
  .res-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: #c8b890;
    font-family: 'JetBrains Mono', monospace;
  }
  .res-name { color: #a09880; }
  .res-val { color: #f0e6d0; }
  .event-log {
    max-height: 150px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #5a4a35 #1e1810;
  }
  .event {
    font-size: 0.68rem;
    color: #a09880;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(58, 48, 37, 0.3);
    font-family: 'Crimson Text', serif;
  }
  .event.muted { color: #6a5a4a; font-style: italic; }
</style>
