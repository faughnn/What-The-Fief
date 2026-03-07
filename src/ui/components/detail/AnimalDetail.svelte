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
  .bar-fill { background: #8a7a5a; }
  .bar-fill.hostile { background: #a84030; }
  .stats { display: flex; flex-direction: column; gap: 2px; }
</style>
