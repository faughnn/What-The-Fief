<script lang="ts">
  import { activeTab, visibleTabs, showDetail } from '../stores/selection';
  import OverviewTab from './sidebar/OverviewTab.svelte';
  import VillagersTab from './sidebar/VillagersTab.svelte';
  import MilitaryTab from './sidebar/MilitaryTab.svelte';
  import EconomyTab from './sidebar/EconomyTab.svelte';
  import QuestsTab from './sidebar/QuestsTab.svelte';
  import ExpeditionsTab from './sidebar/ExpeditionsTab.svelte';
  import DiplomacyTab from './sidebar/DiplomacyTab.svelte';
  import DetailPanel from './DetailPanel.svelte';

  function formatTab(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
</script>

<aside class="sidebar">
  {#if $showDetail}
    <DetailPanel />
  {:else}
    <div class="tab-bar">
      {#each $visibleTabs as tab}
        <button
          class="tab-btn"
          class:active={$activeTab === tab}
          onclick={() => activeTab.set(tab)}
        >
          {formatTab(tab)}
        </button>
      {/each}
    </div>
    <div class="tab-content">
      {#if $activeTab === 'overview'}
        <OverviewTab />
      {:else if $activeTab === 'villagers'}
        <VillagersTab />
      {:else if $activeTab === 'military'}
        <MilitaryTab />
      {:else if $activeTab === 'economy'}
        <EconomyTab />
      {:else if $activeTab === 'quests'}
        <QuestsTab />
      {:else if $activeTab === 'expeditions'}
        <ExpeditionsTab />
      {:else if $activeTab === 'diplomacy'}
        <DiplomacyTab />
      {/if}
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    width: 280px;
    min-width: 280px;
    background: linear-gradient(180deg, #1e1810 0%, #221a12 100%);
    border-left: 2px solid #b8964e;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 1px;
    padding: 4px;
    background: #1a1410;
    border-bottom: 1px solid #3a3025;
  }

  .tab-btn {
    background: #2a2218;
    border: 1px solid #3a3025;
    color: #a09880;
    padding: 0.25rem 0.5rem;
    font-family: 'Cinzel', serif;
    font-size: 0.65rem;
    cursor: pointer;
    border-radius: 2px;
    flex: 1;
    min-width: 60px;
    text-align: center;
  }

  .tab-btn:hover { background: #3a3025; color: #f0e6d0; }

  .tab-btn.active {
    background: #b8964e;
    color: #2a2118;
    border-color: #d4b06a;
    font-weight: 600;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: #5a4a35 #1e1810;
  }
</style>
