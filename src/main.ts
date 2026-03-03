// main.ts — CLI entry point

import { createWorld, BuildingType, Direction } from './world.js';
import { tick, placeBuilding, assignVillager, sendScout, claimTerritory, setGuard } from './simulation.js';
import { renderAll, ViewMode } from './render-text.js';

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const result = {
    ticks: 1,
    view: 'all' as ViewMode,
    place: [] as { type: BuildingType; x: number; y: number }[],
    assign: [] as { villagerId: string; buildingId: string }[],
    scout: [] as { villagerId: string; direction: Direction }[],
    claim: [] as { x: number; y: number }[],
    guard: [] as string[],
    width: 20,
    height: 20,
    seed: 42,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--ticks': result.ticks = parseInt(args[++i], 10); break;
      case '--view': result.view = args[++i] as ViewMode; break;
      case '--place': {
        const type = args[++i] as BuildingType;
        const [x, y] = args[++i].split(',').map(Number);
        result.place.push({ type, x, y });
        break;
      }
      case '--assign': {
        result.assign.push({ villagerId: args[++i], buildingId: args[++i] });
        break;
      }
      case '--scout': {
        result.scout.push({ villagerId: args[++i], direction: args[++i] as Direction });
        break;
      }
      case '--claim': {
        const [x, y] = args[++i].split(',').map(Number);
        result.claim.push({ x, y });
        break;
      }
      case '--guard': result.guard.push(args[++i]); break;
      case '--width': result.width = parseInt(args[++i], 10); break;
      case '--height': result.height = parseInt(args[++i], 10); break;
      case '--seed': result.seed = parseInt(args[++i], 10); break;
    }
  }

  return result;
}

function main() {
  const opts = parseArgs(process.argv);
  let state = createWorld(opts.width, opts.height, opts.seed);

  for (const p of opts.place) state = placeBuilding(state, p.type, p.x, p.y);
  for (const a of opts.assign) state = assignVillager(state, a.villagerId, a.buildingId);
  for (const s of opts.scout) state = sendScout(state, s.villagerId, s.direction);
  for (const c of opts.claim) state = claimTerritory(state, c.x, c.y);
  for (const g of opts.guard) state = setGuard(state, g);

  for (let i = 0; i < opts.ticks; i++) state = tick(state);

  console.log(renderAll(state, opts.view));
}

main();
