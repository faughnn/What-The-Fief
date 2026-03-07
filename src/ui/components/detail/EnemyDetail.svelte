<script lang="ts">
  import type { EnemyEntity } from '../../../world.js';

  interface Props { enemy: EnemyEntity; }
  let { enemy }: Props = $props();

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

<div class="enemy-detail">
  <h3>{formatType(enemy.type)}</h3>

  <div class="stat-section">
    <div class="stat-label">HP</div>
    <div class="bar-bg">
      <div class="bar-fill" style="width: {(enemy.hp / enemy.maxHp) * 100}%"></div>
    </div>
    <div class="bar-text">{enemy.hp}/{enemy.maxHp}</div>
  </div>

  <div class="stats">
    <div class="stat-row"><span>Attack:</span> <span>{enemy.attack}</span></div>
    <div class="stat-row"><span>Defense:</span> <span>{enemy.defense}</span></div>
    {#if enemy.range > 0}
      <div class="stat-row"><span>Range:</span> <span>{enemy.range}</span></div>
    {/if}
    {#if enemy.siege !== 'none'}
      <div class="stat-row"><span>Siege:</span> <span>{formatType(enemy.siege)}</span></div>
    {/if}
    <div class="stat-row"><span>Position:</span> <span>({enemy.x}, {enemy.y})</span></div>
  </div>
</div>

<style>
  .enemy-detail { display: flex; flex-direction: column; gap: 0.4rem; }
  h3 { font-family: 'Cinzel', serif; color: #c04030; font-size: 0.95rem; margin: 0; }
  .stat-section { display: flex; align-items: center; gap: 0.3rem; }
  .stat-label { color: #a09880; font-size: 0.65rem; min-width: 24px; font-family: 'JetBrains Mono', monospace; }
  .bar-bg { flex: 1; background: #2a2218; height: 8px; border-radius: 2px; overflow: hidden; }
  .bar-fill { height: 100%; background: #c04030; }
  .bar-text { color: #c8c0a8; font-size: 0.6rem; min-width: 40px; text-align: right; font-family: 'JetBrains Mono', monospace; }
  .stats { display: flex; flex-direction: column; gap: 2px; }
  .stat-row { display: flex; justify-content: space-between; font-size: 0.7rem; color: #c8c0a8; font-family: 'JetBrains Mono', monospace; }
</style>
