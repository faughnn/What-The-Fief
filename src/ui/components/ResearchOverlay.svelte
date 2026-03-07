<script lang="ts">
  import { gameState } from '../stores/gameState';
  import { showResearch } from '../stores/placement';
  import { setResearchCmd } from '../stores/commands';
  import { TECH_TREE, type TechId, type TechDefinition } from '../../world.js';
  import { hasTech } from '../../simulation/helpers.js';

  function formatType(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  let gs = $derived($gameState);

  function canResearch(tech: TechDefinition): boolean {
    if (!gs) return false;
    if (hasTech(gs.research, tech.id)) return false;
    if (gs.research.current === tech.id) return false;
    return tech.prerequisites.every(p => hasTech(gs.research, p));
  }

  function startResearch(techId: TechId) {
    setResearchCmd(techId);
  }

  function close() { showResearch.set(false); }

  const tiers = [1, 2, 3] as const;
</script>

{#if $showResearch}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay-backdrop" onclick={close}>
    <div class="overlay-panel" onclick={(e) => e.stopPropagation()}>
      <div class="overlay-header">
        <h2>Research</h2>
        <button class="close-btn" onclick={close}>\u2715</button>
      </div>

      {#if gs}
        <!-- Current research -->
        {#if gs.research.current}
          {@const currentTech = TECH_TREE[gs.research.current]}
          <div class="current-research">
            <div class="current-label">Researching:</div>
            <div class="current-name">{currentTech.name}</div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: {(gs.research.progress / currentTech.cost) * 100}%"></div>
            </div>
            <div class="current-progress">{gs.research.progress}/{currentTech.cost} knowledge</div>
          </div>
        {:else}
          <div class="current-research muted">No research in progress. Select a technology below.</div>
        {/if}

        <!-- Tech tree by tier -->
        {#each tiers as tier}
          <div class="tier-section">
            <div class="tier-label">Tier {tier}</div>
            <div class="tech-grid">
              {#each Object.values(TECH_TREE).filter(t => t.tier === tier) as tech}
                {@const completed = hasTech(gs.research, tech.id)}
                {@const current = gs.research.current === tech.id}
                {@const available = canResearch(tech)}
                <button
                  class="tech-card"
                  class:completed={completed}
                  class:current={current}
                  class:available={available}
                  class:locked={!completed && !current && !available}
                  onclick={() => available && startResearch(tech.id)}
                  disabled={!available}
                >
                  <div class="tech-name">{tech.name}</div>
                  <div class="tech-desc">{tech.description}</div>
                  <div class="tech-cost">
                    {#if completed}
                      Completed
                    {:else if current}
                      In Progress
                    {:else}
                      Cost: {tech.cost} knowledge
                    {/if}
                  </div>
                  {#if tech.prerequisites.length > 0 && !completed}
                    <div class="tech-prereqs">
                      Requires: {tech.prerequisites.map(p => TECH_TREE[p].name).join(', ')}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .overlay-panel {
    background: #1e1810;
    border: 2px solid #b8964e;
    border-radius: 6px;
    padding: 1rem;
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #5a4a35 #1e1810;
  }

  .overlay-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  h2 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 1.1rem;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #a09880;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .close-btn:hover { color: #f0e6d0; }

  .current-research {
    background: #2a2218;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #3a3025;
    margin-bottom: 0.75rem;
  }
  .current-research.muted { color: #6a5a4a; font-style: italic; font-size: 0.8rem; }
  .current-label { color: #a09880; font-size: 0.7rem; font-family: 'Cinzel', serif; }
  .current-name { color: #b8964e; font-family: 'Cinzel', serif; font-size: 0.9rem; }
  .bar-bg { background: #1a1410; height: 8px; border-radius: 2px; overflow: hidden; margin: 0.3rem 0; }
  .bar-fill { height: 100%; background: #5a7a8a; transition: width 0.3s; }
  .current-progress { color: #c8c0a8; font-size: 0.7rem; font-family: 'JetBrains Mono', monospace; }

  .tier-section { margin-bottom: 0.5rem; }
  .tier-label {
    color: #b8964e;
    font-family: 'Cinzel', serif;
    font-size: 0.8rem;
    border-bottom: 1px solid #3a3025;
    padding-bottom: 0.15rem;
    margin-bottom: 0.3rem;
  }

  .tech-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 4px;
  }

  .tech-card {
    padding: 0.4rem;
    background: #2a2218;
    border: 1px solid #3a3025;
    border-radius: 3px;
    cursor: pointer;
    text-align: left;
    color: #f0e6d0;
  }
  .tech-card:hover:not(:disabled) { border-color: #b8964e; }
  .tech-card.completed { border-color: #4a7a42; opacity: 0.6; }
  .tech-card.current { border-color: #5a7a8a; background: #2a2a30; }
  .tech-card.available { border-color: #5a4a35; }
  .tech-card.locked { opacity: 0.35; cursor: not-allowed; }

  .tech-name { font-family: 'Cinzel', serif; font-size: 0.75rem; color: #f0e6d0; }
  .tech-desc { font-size: 0.62rem; color: #a09880; font-family: 'Crimson Text', serif; margin-top: 2px; }
  .tech-cost { font-size: 0.6rem; color: #c8b890; font-family: 'JetBrains Mono', monospace; margin-top: 3px; }
  .tech-card.completed .tech-cost { color: #4a7a42; }
  .tech-card.current .tech-cost { color: #5a7a8a; }
  .tech-prereqs { font-size: 0.55rem; color: #6a5a4a; margin-top: 2px; }
</style>
