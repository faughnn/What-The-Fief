// main.ts — CLI entry point

import { createWorld, BuildingType } from './world.js';
import { tick, placeBuilding } from './simulation.js';
import { renderAll, ViewMode } from './render-text.js';

// --- Argument Parsing ---
function parseArgs(argv: string[]): {
  ticks: number;
  view: ViewMode;
  place: { type: BuildingType; x: number; y: number }[];
  width: number;
  height: number;
  seed: number;
} {
  const args = argv.slice(2);
  const result = {
    ticks: 1,
    view: 'all' as ViewMode,
    place: [] as { type: BuildingType; x: number; y: number }[],
    width: 10,
    height: 10,
    seed: 42,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--ticks':
        result.ticks = parseInt(args[++i], 10);
        break;
      case '--view':
        result.view = args[++i] as ViewMode;
        break;
      case '--place': {
        const type = args[++i] as BuildingType;
        const [x, y] = args[++i].split(',').map(Number);
        result.place.push({ type, x, y });
        break;
      }
      case '--width':
        result.width = parseInt(args[++i], 10);
        break;
      case '--height':
        result.height = parseInt(args[++i], 10);
        break;
      case '--seed':
        result.seed = parseInt(args[++i], 10);
        break;
    }
  }

  return result;
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  let state = createWorld(opts.width, opts.height, opts.seed);

  // Place buildings before ticking
  for (const p of opts.place) {
    state = placeBuilding(state, p.type, p.x, p.y);
  }

  // Run ticks
  for (let i = 0; i < opts.ticks; i++) {
    state = tick(state);
  }

  // Render
  console.log(renderAll(state, opts.view));
}

main();
