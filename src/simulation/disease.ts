// disease.ts — Disease spreading (per-tick)

import { TickState, hasTech } from './helpers.js';

export function processDisease(ts: TickState): void {
  // Per-tick: sick villagers spread disease to adjacent healthy villagers (10% per tick)
  for (const v of ts.villagers) {
    if (!v.sick) continue;
    for (const other of ts.villagers) {
      if (other.id === v.id || other.sick) continue;
      // Check adjacency (within 1 tile)
      if (Math.abs(other.x - v.x) <= 1 && Math.abs(other.y - v.y) <= 1) {
        const spreadRng = ((ts.newTick * 1103515245 + v.x * 12345 + other.x * 67890 + v.y * 2654435761) & 0x7fffffff) / 0x7fffffff;
        if (spreadRng < 0.10) {
          other.sick = true;
          other.sickDays = hasTech(ts.research, 'medicine') ? 3 : 5;
        }
      }
    }
  }
}
