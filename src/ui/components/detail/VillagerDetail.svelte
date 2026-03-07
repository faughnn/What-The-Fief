<script lang="ts">
  import type { Villager } from '../../../world.js';
  import { gameState } from '../../stores/gameState';
  import { setGuardCmd, setFormationCmd, sendScoutCmd, assignVillagerCmd } from '../../stores/commands';

  interface Props { villager: Villager; }
  let { villager }: Props = $props();

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);
  let home = $derived(gs?.buildings.find(b => b.id === villager.homeBuildingId) ?? null);
  let workplace = $derived(gs?.buildings.find(b => b.id === villager.jobBuildingId) ?? null);

  function makeGuard() { setGuardCmd(villager.id); }
  function scoutNorth() { sendScoutCmd(villager.id, 'n'); }

  function assignToBuilding(buildingId: string) {
    assignVillagerCmd(villager.id, buildingId);
  }
</script>

<div class="villager-detail">
  <h3>{villager.name}</h3>
  <div class="subtitle">{formatType(villager.role)} | Age {villager.age}</div>

  <!-- HP Bar -->
  <div class="stat-section">
    <div class="stat-label">HP</div>
    <div class="bar-bg">
      <div class="bar-fill hp" style="width: {(villager.hp / villager.maxHp) * 100}%"></div>
    </div>
    <div class="bar-text">{villager.hp}/{villager.maxHp}</div>
  </div>

  <!-- Food -->
  <div class="stat-row">
    <span>Food: {villager.food.toFixed(1)}</span>
    <span>Morale: {Math.round(villager.morale)}</span>
  </div>

  <!-- State -->
  <div class="stat-row">
    <span>State: {formatType(villager.state)}</span>
    <span>Pos: ({villager.x}, {villager.y})</span>
  </div>

  <!-- Equipment -->
  <div class="section">
    <div class="section-title">Equipment</div>
    <div class="equip-grid">
      {#if villager.weapon !== 'none'}
        <span>Weapon: {formatType(villager.weapon)} ({villager.weaponDurability})</span>
      {/if}
      {#if villager.armor !== 'none'}
        <span>Armor: {formatType(villager.armor)} ({villager.armorDurability})</span>
      {/if}
      {#if villager.tool !== 'none'}
        <span>Tool: {formatType(villager.tool)} ({villager.toolDurability})</span>
      {/if}
      <span>{villager.clothed ? 'Clothed' : 'No clothing'}</span>
    </div>
  </div>

  <!-- Skills -->
  <div class="section">
    <div class="section-title">Skills</div>
    <div class="skill-grid">
      {#each Object.entries(villager.skills) as [skill, level]}
        {#if level > 0}
          <div class="skill-row">
            <span class="skill-name">{formatType(skill)}</span>
            <div class="skill-bar-bg">
              <div class="skill-bar-fill" style="width: {(level / (villager.skillCaps?.[skill as keyof typeof villager.skillCaps] ?? 100))}%"></div>
            </div>
            <span class="skill-val">{level}/{villager.skillCaps?.[skill as keyof typeof villager.skillCaps] ?? '?'}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Traits -->
  {#if villager.traits.length > 0}
    <div class="section">
      <div class="section-title">Traits</div>
      <div class="trait-list">
        {#each villager.traits as trait}
          <span class="trait-badge">{formatType(trait)}</span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Friends -->
  {#if villager.friends.length > 0}
    <div class="section">
      <div class="section-title">Friends</div>
      {#each villager.friends as friendId}
        {@const friend = gs?.villagers.find(v => v.id === friendId)}
        {#if friend}
          <span class="friend-name">{friend.name}</span>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Housing -->
  <div class="section">
    <div class="section-title">Housing</div>
    <div class="info-text">{home ? formatType(home.type) : 'Homeless'}</div>
  </div>

  <!-- Workplace -->
  {#if workplace}
    <div class="section">
      <div class="section-title">Workplace</div>
      <div class="info-text">{formatType(workplace.type)}</div>
    </div>
  {/if}

  <!-- Guard Controls -->
  {#if villager.role === 'guard'}
    <div class="section">
      <div class="section-title">Guard Controls</div>
      <div class="btn-row">
        <button class="cmd-btn" class:active={villager.guardMode === 'patrol'} onclick={() => setFormationCmd(villager.id, 'patrol', villager.guardLine)}>Patrol</button>
        <button class="cmd-btn" class:active={villager.guardMode === 'charge'} onclick={() => setFormationCmd(villager.id, 'charge', villager.guardLine)}>Charge</button>
        <button class="cmd-btn" class:active={villager.guardMode === 'hold'} onclick={() => setFormationCmd(villager.id, 'hold', villager.guardLine)}>Hold</button>
      </div>
      <div class="btn-row">
        <button class="cmd-btn" class:active={villager.guardLine === 'front'} onclick={() => setFormationCmd(villager.id, villager.guardMode, 'front')}>Front</button>
        <button class="cmd-btn" class:active={villager.guardLine === 'back'} onclick={() => setFormationCmd(villager.id, villager.guardMode, 'back')}>Back</button>
      </div>
    </div>
  {/if}

  <!-- Commands -->
  <div class="section">
    <div class="section-title">Commands</div>
    <div class="btn-row">
      {#if villager.role !== 'guard'}
        <button class="cmd-btn" onclick={makeGuard}>Set Guard</button>
      {/if}
      <button class="cmd-btn" onclick={scoutNorth}>Scout North</button>
    </div>
  </div>
</div>

<style>
  .villager-detail { display: flex; flex-direction: column; gap: 0.4rem; }
  h3 { font-family: 'Cinzel', serif; color: #b8964e; font-size: 0.95rem; margin: 0; }
  .subtitle { color: #a09880; font-size: 0.72rem; font-family: 'Crimson Text', serif; }
  .bar-fill.hp { background: #4a7a42; }
  .section { border-top: 1px solid #3a3025; padding-top: 0.3rem; }
  .equip-grid { display: flex; flex-direction: column; gap: 2px; font-size: 0.68rem; color: #c8b890; font-family: 'JetBrains Mono', monospace; }
  .skill-grid { display: flex; flex-direction: column; gap: 3px; }
  .skill-row { display: flex; align-items: center; gap: 0.3rem; }
  .skill-name { color: #a09880; font-size: 0.65rem; min-width: 60px; font-family: 'JetBrains Mono', monospace; }
  .skill-bar-bg { flex: 1; background: #2a2218; height: 5px; border-radius: 1px; overflow: hidden; }
  .skill-bar-fill { height: 100%; background: #5a7a8a; }
  .skill-val { color: #c8c0a8; font-size: 0.6rem; min-width: 35px; text-align: right; font-family: 'JetBrains Mono', monospace; }
  .trait-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .trait-badge {
    background: #3a3025;
    color: #c8b890;
    padding: 0.1rem 0.35rem;
    border-radius: 2px;
    font-size: 0.6rem;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid #4a3a2a;
  }
  .friend-name { color: #c8c0a8; font-size: 0.7rem; display: block; font-family: 'Crimson Text', serif; }
  .info-text { color: #c8c0a8; font-size: 0.7rem; font-family: 'JetBrains Mono', monospace; }
  .btn-row { margin-top: 0.15rem; }
</style>
