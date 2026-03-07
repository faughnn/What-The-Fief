<script lang="ts">
  import { selectedEntity, selectedVillager, selectedBuilding, selectedEnemy, selectedAnimal, clearSelection } from '../stores/selection';
  import VillagerDetail from './detail/VillagerDetail.svelte';
  import BuildingDetail from './detail/BuildingDetail.svelte';
  import EnemyDetail from './detail/EnemyDetail.svelte';
  import AnimalDetail from './detail/AnimalDetail.svelte';
</script>

<div class="detail-panel">
  <button class="close-btn" onclick={clearSelection}>\u2190 Back</button>

  {#if $selectedVillager}
    <VillagerDetail villager={$selectedVillager} />
  {:else if $selectedBuilding}
    <BuildingDetail building={$selectedBuilding} />
  {:else if $selectedEnemy}
    <EnemyDetail enemy={$selectedEnemy} />
  {:else if $selectedAnimal}
    <AnimalDetail animal={$selectedAnimal} />
  {:else}
    <div class="muted">Entity not found.</div>
  {/if}
</div>

<style>
  .detail-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #5a4a35 #1e1810;
  }
  .close-btn {
    background: #2a2218;
    border: 1px solid #3a3025;
    color: #b8964e;
    padding: 0.25rem 0.5rem;
    font-family: 'Cinzel', serif;
    font-size: 0.7rem;
    cursor: pointer;
    border-radius: 2px;
    align-self: flex-start;
  }
  .close-btn:hover { background: #3a3025; }
  .muted { color: #6a5a4a; font-size: 0.7rem; font-style: italic; }
</style>
