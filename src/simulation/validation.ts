// validation.ts — State validation (invariant checker)

import { GameState, ALL_RESOURCES } from '../world.js';

export function validateState(state: GameState): string[] {
  const errors: string[] = [];

  for (const key of ALL_RESOURCES) {
    if (state.resources[key] < 0) errors.push(`ERROR: Negative resource ${key}=${state.resources[key]}`);
    // Note: resources CAN exceed cap temporarily (e.g., storehouse destroyed).
    // addResource() already prevents adding past cap. No error here.
  }

  if (state.grid.length !== state.height) errors.push(`ERROR: Grid height mismatch`);
  for (let y = 0; y < state.grid.length; y++) {
    if (state.grid[y].length !== state.width) errors.push(`ERROR: Grid row ${y} width mismatch`);
  }

  for (const b of state.buildings) {
    if (b.x < 0 || b.y < 0 || b.x + b.width > state.width || b.y + b.height > state.height) {
      errors.push(`ERROR: Building ${b.id} (${b.type}) out of bounds`);
    }
  }

  for (let i = 0; i < state.buildings.length; i++) {
    for (let j = i + 1; j < state.buildings.length; j++) {
      const a = state.buildings[i];
      const b = state.buildings[j];
      if (!(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)) {
        errors.push(`ERROR: Buildings ${a.id} and ${b.id} overlap`);
      }
    }
  }

  for (const v of state.villagers) {
    if (v.x < 0 || v.y < 0 || v.x >= state.width || v.y >= state.height) {
      errors.push(`ERROR: Villager ${v.id} out of bounds`);
    }
    if (v.jobBuildingId && !state.buildings.find(b => b.id === v.jobBuildingId)) {
      errors.push(`ERROR: Villager ${v.id} orphaned job ${v.jobBuildingId}`);
    }
    if (v.homeBuildingId && !state.buildings.find(b => b.id === v.homeBuildingId)) {
      errors.push(`ERROR: Villager ${v.id} orphaned home ${v.homeBuildingId}`);
    }
  }

  return errors;
}
