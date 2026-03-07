import { writable } from 'svelte/store';
import type { BuildingType } from '../../world.js';

export type UIMode = 'normal' | 'placing' | 'claiming';

export const uiMode = writable<UIMode>('normal');
export const placingType = writable<BuildingType | null>(null);
export const placingValid = writable(false);
export const showResearch = writable(false);

export function startPlacing(type: BuildingType) {
  uiMode.set('placing');
  placingType.set(type);
}

export function startClaiming() {
  uiMode.set('claiming');
  placingType.set(null);
}

export function cancelPlacement() {
  uiMode.set('normal');
  placingType.set(null);
  placingValid.set(false);
}
