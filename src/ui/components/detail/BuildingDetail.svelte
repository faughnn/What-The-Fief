<script lang="ts">
  import type { Building } from '../../../world.js';
  import { BUILDING_TEMPLATES } from '../../../world.js';
  import { gameState } from '../../stores/gameState';
  import { assignVillagerCmd, upgradeBuildingCmd } from '../../stores/commands';
  import { selectEntity } from '../../stores/selection';

  interface Props { building: Building; }
  let { building }: Props = $props();

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);
  let template = $derived(BUILDING_TEMPLATES[building.type]);
  let workers = $derived(
    gs?.villagers.filter(v => building.assignedWorkers.includes(v.id)) ?? []
  );
  let unassigned = $derived(
    gs?.villagers.filter(v => v.role === 'idle' && !building.assignedWorkers.includes(v.id)) ?? []
  );

  function assignWorker(villagerId: string) {
    assignVillagerCmd(villagerId, building.id);
  }

  function upgrade() {
    upgradeBuildingCmd(building.id);
  }
</script>

<div class="building-detail">
  <h3>{formatType(building.type)}</h3>
  <div class="subtitle">
    {building.constructed ? 'Constructed' : `Building... ${Math.round((building.constructionProgress / building.constructionRequired) * 100)}%`}
    | ({building.x}, {building.y}) {building.width}x{building.height}
  </div>

  <!-- HP Bar -->
  <div class="stat-section">
    <div class="stat-label">HP</div>
    <div class="bar-bg">
      <div class="bar-fill" class:healthy={building.hp > building.maxHp * 0.5} class:damaged={building.hp <= building.maxHp * 0.5} style="width: {(building.hp / building.maxHp) * 100}%"></div>
    </div>
    <div class="bar-text">{building.hp}/{building.maxHp}</div>
  </div>

  {#if building.onFire}
    <div class="alert">ON FIRE!</div>
  {/if}

  <!-- Construction progress -->
  {#if !building.constructed}
    <div class="stat-section">
      <div class="stat-label">Build</div>
      <div class="bar-bg">
        <div class="bar-fill construction" style="width: {(building.constructionProgress / building.constructionRequired) * 100}%"></div>
      </div>
      <div class="bar-text">{Math.round((building.constructionProgress / building.constructionRequired) * 100)}%</div>
    </div>
  {/if}

  <!-- Production info -->
  {#if template?.production}
    <div class="section">
      <div class="section-title">Production</div>
      <div class="info-text">
        {#if template.production.inputs}
          {#each Object.entries(template.production.inputs) as [res, amt]}
            {amt} {formatType(res)} +
          {/each}
          {' \u2192 '}
        {/if}
        {template.production.amountPerWorker} {formatType(template.production.output)}/worker
      </div>
    </div>
  {/if}

  <!-- Local buffer -->
  {#if Object.keys(building.localBuffer).length > 0}
    <div class="section">
      <div class="section-title">Local Buffer ({building.bufferCapacity} cap)</div>
      <div class="buffer-grid">
        {#each Object.entries(building.localBuffer) as [res, amt]}
          {#if (amt as number) > 0}
            <div class="buffer-item">
              <span>{formatType(res)}</span>
              <span>{Math.floor(amt as number)}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Workers -->
  <div class="section">
    <div class="section-title">Workers ({workers.length}/{template?.maxWorkers ?? 0})</div>
    {#each workers as w}
      <button class="worker-row" onclick={() => selectEntity({ type: 'villager', id: w.id })}>
        <span>{w.name}</span>
        <span class="worker-state">{formatType(w.state)}</span>
      </button>
    {/each}
    {#if workers.length < (template?.maxWorkers ?? 0) && unassigned.length > 0}
      <div class="assign-section">
        <div class="assign-label">Assign idle villager:</div>
        {#each unassigned.slice(0, 5) as v}
          <button class="assign-btn" onclick={() => assignWorker(v.id)}>{v.name}</button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Upgrade -->
  <div class="section">
    <div class="section-title">Actions</div>
    <div class="btn-row">
      <button class="cmd-btn" onclick={upgrade}>Upgrade</button>
    </div>
  </div>
</div>

<style>
  .building-detail { display: flex; flex-direction: column; gap: 0.4rem; }
  h3 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 0.95rem;
    margin: 0;
  }
  .subtitle { color: #a09880; font-size: 0.68rem; font-family: 'JetBrains Mono', monospace; }
  .alert { color: #e86820; font-weight: bold; font-size: 0.8rem; font-family: 'Cinzel', serif; }
  .stat-section { display: flex; align-items: center; gap: 0.3rem; }
  .stat-label { color: #a09880; font-size: 0.65rem; min-width: 30px; font-family: 'JetBrains Mono', monospace; }
  .bar-bg { flex: 1; background: #2a2218; height: 8px; border-radius: 2px; overflow: hidden; }
  .bar-fill { height: 100%; transition: width 0.3s; }
  .bar-fill.healthy { background: #4a7a42; }
  .bar-fill.damaged { background: #c04030; }
  .bar-fill.construction { background: #b8964e; }
  .bar-text { color: #c8c0a8; font-size: 0.6rem; min-width: 45px; text-align: right; font-family: 'JetBrains Mono', monospace; }
  .section { border-top: 1px solid #3a3025; padding-top: 0.3rem; }
  .section-title { color: #a09880; font-family: 'Cinzel', serif; font-size: 0.65rem; text-transform: uppercase; margin-bottom: 0.15rem; }
  .info-text { color: #c8c0a8; font-size: 0.68rem; font-family: 'JetBrains Mono', monospace; }
  .buffer-grid { display: flex; flex-direction: column; gap: 1px; }
  .buffer-item { display: flex; justify-content: space-between; font-size: 0.68rem; color: #c8b890; font-family: 'JetBrains Mono', monospace; }
  .worker-row {
    display: flex; justify-content: space-between; width: 100%;
    padding: 0.2rem 0.3rem; background: #2a2218; border: 1px solid #3a3025;
    border-radius: 2px; cursor: pointer; color: #f0e6d0; font-size: 0.68rem;
    font-family: 'JetBrains Mono', monospace; margin-bottom: 2px; text-align: left;
  }
  .worker-row:hover { background: #3a3025; border-color: #b8964e; }
  .worker-state { color: #a09880; }
  .assign-section { margin-top: 0.2rem; }
  .assign-label { color: #6a5a4a; font-size: 0.6rem; margin-bottom: 0.1rem; }
  .assign-btn {
    background: #2a2a18; border: 1px solid #4a4a30; color: #c8c0a8;
    padding: 0.15rem 0.3rem; font-size: 0.6rem; cursor: pointer; border-radius: 2px;
    margin: 1px; font-family: 'JetBrains Mono', monospace;
  }
  .assign-btn:hover { background: #3a3a28; border-color: #b8964e; }
  .btn-row { display: flex; gap: 4px; }
  .cmd-btn {
    background: #3a3025; border: 1px solid #5a4a35; color: #f0e6d0;
    padding: 0.2rem 0.45rem; font-family: 'Cinzel', serif; font-size: 0.6rem;
    cursor: pointer; border-radius: 2px;
  }
  .cmd-btn:hover { background: #4a3a2a; border-color: #b8964e; }
</style>
