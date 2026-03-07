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
  .bar-fill { background: #c04030; }
  .stats { display: flex; flex-direction: column; gap: 2px; }
</style>
