<script lang="ts">
  import type { AnimalEntity } from '../../../world.js';

  interface Props { animal: AnimalEntity; }
  let { animal }: Props = $props();

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

<div class="animal-detail">
  <h3>{formatType(animal.type)}</h3>

  <div class="stat-section">
    <div class="stat-label">HP</div>
    <div class="bar-bg">
      <div class="bar-fill" class:hostile={animal.behavior === 'hostile'} style="width: {(animal.hp / animal.maxHp) * 100}%"></div>
    </div>
    <div class="bar-text">{animal.hp}/{animal.maxHp}</div>
  </div>

  <div class="stats">
    <div class="stat-row"><span>Behavior:</span> <span>{formatType(animal.behavior)}</span></div>
    <div class="stat-row"><span>Attack:</span> <span>{animal.attack}</span></div>
    <div class="stat-row"><span>Position:</span> <span>({animal.x}, {animal.y})</span></div>
  </div>
</div>

<style>
  .animal-detail { display: flex; flex-direction: column; gap: 0.4rem; }
  h3 { font-family: 'Cinzel', serif; color: #b8964e; font-size: 0.95rem; margin: 0; }
  .stat-section { display: flex; align-items: center; gap: 0.3rem; }
  .stat-label { color: #a09880; font-size: 0.65rem; min-width: 24px; font-family: 'JetBrains Mono', monospace; }
  .bar-bg { flex: 1; background: #2a2218; height: 8px; border-radius: 2px; overflow: hidden; }
  .bar-fill { height: 100%; background: #8a7a5a; }
  .bar-fill.hostile { background: #a84030; }
  .bar-text { color: #c8c0a8; font-size: 0.6rem; min-width: 40px; text-align: right; font-family: 'JetBrains Mono', monospace; }
  .stats { display: flex; flex-direction: column; gap: 2px; }
  .stat-row { display: flex; justify-content: space-between; font-size: 0.7rem; color: #c8c0a8; font-family: 'JetBrains Mono', monospace; }
</style>
