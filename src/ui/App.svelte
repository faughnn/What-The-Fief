<script lang="ts">
  import { gameState, newGame, setSpeed } from './stores/gameState';
  import { selectedEntity, selectEntity, clearSelection } from './stores/selection';
  import { uiMode, placingType, placingValid, cancelPlacement } from './stores/placement';
  import { placeBuildingCmd, claimTerritoryCmd } from './stores/commands';
  import { BUILDING_TEMPLATES, type BuildingType } from '../world.js';
  import TopBar from './components/TopBar.svelte';
  import GameCanvas from './components/GameCanvas.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import BuildBar from './components/BuildBar.svelte';
  import ResearchOverlay from './components/ResearchOverlay.svelte';
  import Notifications from './components/Notifications.svelte';

  function handleTileClick(tile: { x: number; y: number }, e: MouseEvent) {
    const gs = $gameState;
    if (!gs) return;

    if ($uiMode === 'placing' && $placingType) {
      const success = placeBuildingCmd($placingType, tile.x, tile.y);
      if (success && !e.shiftKey) {
        cancelPlacement();
      }
      return;
    }

    if ($uiMode === 'claiming') {
      claimTerritoryCmd(tile.x, tile.y);
      return;
    }

    // Normal mode — find entity at tile
    // Check villagers first
    const villager = gs.villagers.find(v => v.x === tile.x && v.y === tile.y);
    if (villager) {
      selectEntity({ type: 'villager', id: villager.id });
      return;
    }

    // Check enemies
    const enemy = gs.enemies.find(e => e.x === tile.x && e.y === tile.y);
    if (enemy) {
      selectEntity({ type: 'enemy', id: enemy.id });
      return;
    }

    // Check animals
    const animal = gs.animals.find(a => a.x === tile.x && a.y === tile.y);
    if (animal) {
      selectEntity({ type: 'animal', id: animal.id });
      return;
    }

    // Check buildings
    const building = gs.buildings.find(b =>
      tile.x >= b.x && tile.x < b.x + b.width &&
      tile.y >= b.y && tile.y < b.y + b.height
    );
    if (building) {
      selectEntity({ type: 'building', id: building.id });
      return;
    }

    clearSelection();
  }

  // Placement validation
  $effect(() => {
    const gs = $gameState;
    const mode = $uiMode;
    const type = $placingType;
    if (!gs || mode !== 'placing' || !type) {
      placingValid.set(false);
      return;
    }
    // Validation happens on click — always show as potentially valid
    placingValid.set(true);
  });

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if ($uiMode !== 'normal') {
        cancelPlacement();
      } else {
        clearSelection();
      }
    }
    // Speed controls
    if (e.key === '0') setSpeed(0);
    if (e.key === '1') setSpeed(1);
    if (e.key === '2') setSpeed(5);
    if (e.key === '3') setSpeed(20);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !$gameState}
  <div class="loading-screen">
    <div class="loading-content">
      <h1>ColonySim</h1>
      <p class="subtitle">A colony grows from a single tent</p>
      <button class="start-btn" onclick={newGame}>New Game</button>
    </div>
  </div>
{:else}
  <TopBar />
  <div class="main-area">
    <GameCanvas
      selectedEntity={$selectedEntity}
      mode={$uiMode}
      placingType={$placingType}
      placingValid={$placingValid}
      onTileClick={handleTileClick}
    />
    <Sidebar />
  </div>
  <BuildBar />
  <ResearchOverlay />
  <Notifications />
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #2a2118;
    background-image:
      radial-gradient(circle at 30% 40%, rgba(184, 150, 78, 0.05) 0%, transparent 50%),
      radial-gradient(circle at 70% 60%, rgba(184, 150, 78, 0.03) 0%, transparent 50%);
  }

  .loading-content {
    text-align: center;
  }

  h1 {
    font-family: 'Cinzel', serif;
    color: #b8964e;
    font-size: 3.5rem;
    margin: 0 0 0.5rem 0;
    text-shadow: 0 2px 10px rgba(184, 150, 78, 0.3);
    letter-spacing: 0.1em;
  }

  .subtitle {
    color: #8a7a60;
    font-family: 'Crimson Text', serif;
    font-size: 1.2rem;
    font-style: italic;
    margin: 0 0 2rem 0;
  }

  .start-btn {
    background: linear-gradient(180deg, #b8964e 0%, #9a7a3e 100%);
    border: 2px solid #d4b06a;
    color: #2a2118;
    padding: 0.85rem 3rem;
    font-family: 'Cinzel', serif;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: 4px;
    letter-spacing: 0.05em;
    transition: all 0.2s;
  }

  .start-btn:hover {
    background: linear-gradient(180deg, #d4b06a 0%, #b8964e 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(184, 150, 78, 0.4);
  }

  .main-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  :global(html), :global(body), :global(#app) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #2a2118;
    color: #f0e6d0;
    overflow: hidden;
  }

  :global(#app) {
    display: flex;
    flex-direction: column;
  }

  :global(*) {
    box-sizing: border-box;
  }
</style>
