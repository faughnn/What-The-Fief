<script lang="ts">
  import {
    gameState, day, season, population, prosperity, weather,
    renown, constructionPoints, speed, timeOfDay, setSpeed, resources,
  } from '../stores/gameState';

  const SPEEDS = [0, 1, 5, 20];

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const SEASON_ICONS: Record<string, string> = {
    spring: '\u2618', summer: '\u2600', autumn: '\u2618', winter: '\u2744',
  };

  const WEATHER_ICONS: Record<string, string> = {
    clear: '\u2600', rain: '\u2602', storm: '\u26A1',
  };

  // Key resources to always show in the topbar
  const TOP_RESOURCES = ['food', 'wood', 'stone', 'iron_ore', 'ingots', 'planks', 'gold'] as const;

  function getResourceIcon(r: string): string {
    const icons: Record<string, string> = {
      food: '\uD83C\uDF3E', wood: '\uD83E\uDEB5', stone: '\u25C7', iron_ore: '\u26CF',
      ingots: '\u2699', planks: '\u2261', gold: '\u2605', wheat: '\uD83C\uDF3E',
    };
    return icons[r] || '\u2022';
  }
</script>

<div class="topbar">
  <div class="topbar-left">
    <span class="logo">ColonySim</span>
    <span class="day">Day {$day}</span>
    <span class="time">{$timeOfDay}</span>
    <span class="season" title={formatType($season)}>
      {SEASON_ICONS[$season] || ''} {formatType($season)}
    </span>
    <span class="weather" title={formatType($weather)}>
      {WEATHER_ICONS[$weather] || ''}
    </span>
  </div>

  <div class="topbar-center">
    <span class="stat" title="Population">Pop: {$population}</span>
    <span class="stat" title="Prosperity">Pros: {$prosperity}</span>
    <span class="stat" title="Renown">Ren: {$renown}</span>
    <span class="stat" title="Construction Points">CP: {$constructionPoints}</span>
  </div>

  <div class="topbar-resources">
    {#if $resources}
      {#each TOP_RESOURCES as r}
        {@const val = ($resources as any)[r] ?? 0}
        {#if val > 0 || r === 'food' || r === 'wood' || r === 'stone'}
          <span class="resource" title={formatType(r)}>
            {formatType(r)}: {Math.floor(val)}
          </span>
        {/if}
      {/each}
    {/if}
  </div>

  <div class="topbar-right">
    <div class="speed-controls">
      {#each SPEEDS as s}
        <button
          class="speed-btn"
          class:active={$speed === s}
          onclick={() => setSpeed(s)}
        >
          {s === 0 ? '\u23F8' : `${s}x`}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.75rem;
    background: linear-gradient(180deg, #1e1810 0%, #251d14 100%);
    border-bottom: 2px solid #b8964e;
    color: #f0e6d0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    flex-shrink: 0;
    min-height: 32px;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo {
    font-family: 'Cinzel', serif;
    font-weight: 600;
    color: #b8964e;
    font-size: 0.9rem;
    margin-right: 0.5rem;
  }

  .day { color: #f0e6d0; font-weight: 500; }
  .time { color: #c8c0a8; }

  .season {
    color: #a0c890;
    padding: 0.1rem 0.4rem;
    border: 1px solid rgba(160, 200, 144, 0.3);
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .weather { color: #8ab0c0; }

  .topbar-center {
    display: flex;
    gap: 0.75rem;
    margin-left: auto;
  }

  .stat {
    color: #c8c0a8;
  }

  .topbar-resources {
    display: flex;
    gap: 0.5rem;
    margin-left: 1rem;
    padding-left: 1rem;
    border-left: 1px solid rgba(184, 150, 78, 0.3);
  }

  .resource {
    color: #c8b890;
    font-size: 0.75rem;
  }

  .topbar-right {
    margin-left: auto;
  }

  .speed-controls {
    display: flex;
    gap: 2px;
  }

  .speed-btn {
    background: #3a3025;
    border: 1px solid #5a4a35;
    color: #c8c0a8;
    padding: 0.15rem 0.45rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    cursor: pointer;
    border-radius: 2px;
  }

  .speed-btn:hover { background: #4a3a2a; }

  .speed-btn.active {
    background: #b8964e;
    color: #2a2118;
    border-color: #d4b06a;
  }
</style>
