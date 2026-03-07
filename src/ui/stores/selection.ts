import { writable, derived } from 'svelte/store';
import { gameState } from './gameState';
import type { Building, Villager, EnemyEntity, AnimalEntity } from '../../world.js';

export type SelectedEntity =
  | { type: 'villager'; id: string }
  | { type: 'building'; id: string }
  | { type: 'enemy'; id: string }
  | { type: 'animal'; id: string }
  | null;

export type SidebarTab = 'overview' | 'villagers' | 'military' | 'economy' | 'quests' | 'expeditions' | 'diplomacy';

export const selectedEntity = writable<SelectedEntity>(null);
export const activeTab = writable<SidebarTab>('overview');
export const showDetail = writable(false);

// Select and show detail
export function selectEntity(entity: SelectedEntity) {
  selectedEntity.set(entity);
  showDetail.set(entity !== null);
}

export function clearSelection() {
  selectedEntity.set(null);
  showDetail.set(false);
}

// Derived: which tabs are visible based on game state
export const visibleTabs = derived(gameState, $gs => {
  const tabs: SidebarTab[] = ['overview', 'villagers'];
  if (!$gs) return tabs;

  // Military: any guard, military building, or enemy
  const hasGuard = $gs.villagers.some(v => v.role === 'guard' || v.role === 'militia');
  const hasMilitary = $gs.buildings.some(b =>
    (b.type === 'watchtower' || b.type === 'barracks' || b.type === 'training_ground' || b.type === 'weapon_rack') && b.constructed
  );
  if (hasGuard || hasMilitary || $gs.enemies.length > 0 || $gs.banditCamps.length > 0) {
    tabs.push('military');
  }

  // Economy: marketplace or caravan
  const hasMarket = $gs.buildings.some(b => b.type === 'marketplace' && b.constructed);
  if (hasMarket || $gs.caravans.length > 0 || $gs.supplyRoutes.length > 0) {
    tabs.push('economy');
  }

  // Quests: any completed
  if ($gs.completedQuests.length > 0) {
    tabs.push('quests');
  }

  // Expeditions: any sent
  if ($gs.expeditions.length > 0 || $gs.pointsOfInterest.some(p => p.discovered)) {
    tabs.push('expeditions');
  }

  // Diplomacy: NPC village discovered
  if ($gs.npcSettlements.length > 0 && $gs.fog[$gs.npcSettlements[0]?.y]?.[$gs.npcSettlements[0]?.x]) {
    tabs.push('diplomacy');
  }

  return tabs;
});

// Derived: resolved entity data for detail panel
export const selectedVillager = derived([selectedEntity, gameState], ([$sel, $gs]) => {
  if (!$sel || $sel.type !== 'villager' || !$gs) return null;
  return $gs.villagers.find(v => v.id === $sel.id) ?? null;
});

export const selectedBuilding = derived([selectedEntity, gameState], ([$sel, $gs]) => {
  if (!$sel || $sel.type !== 'building' || !$gs) return null;
  return $gs.buildings.find(b => b.id === $sel.id) ?? null;
});

export const selectedEnemy = derived([selectedEntity, gameState], ([$sel, $gs]) => {
  if (!$sel || $sel.type !== 'enemy' || !$gs) return null;
  return $gs.enemies.find(e => e.id === $sel.id) ?? null;
});

export const selectedAnimal = derived([selectedEntity, gameState], ([$sel, $gs]) => {
  if (!$sel || $sel.type !== 'animal' || !$gs) return null;
  return $gs.animals.find(a => a.id === $sel.id) ?? null;
});
