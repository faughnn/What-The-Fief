// movement.ts — Pathfinding and step-by-step movement

import { Tile, Villager } from '../world.js';

// --- Core BFS Pathfinding ---
function findPathCore(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
  canPassTile: (tile: Tile) => boolean,
): { x: number; y: number }[] {
  if (fromX === toX && fromY === toY) return [];
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [];
  queue.push({ x: fromX, y: fromY, path: [] });
  visited.add(`${fromX},${fromY}`);
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited.has(key)) continue;
      const tile = grid[ny][nx];
      if (tile.terrain === 'water') continue;
      // Destination tile is always passable (workers enter buildings)
      if (nx !== toX || ny !== toY) {
        if (!canPassTile(tile)) continue;
      }
      const newPath = [...current.path, { x: nx, y: ny }];
      if (nx === toX && ny === toY) return newPath;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: newPath });
    }
  }
  return [];
}

// --- Ally pathfinding: buildings block except gate, rubble, fence ---
export function findPath(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
): { x: number; y: number }[] {
  return findPathCore(grid, width, height, fromX, fromY, toX, toY, (tile) => {
    if (!tile.building) return true;
    const t = tile.building.type;
    return t === 'gate' || t === 'rubble' || t === 'fence';
  });
}

// --- Enemy pathfinding: walls, fences, gates block ---
export function findPathEnemy(
  grid: Tile[][], width: number, height: number,
  fromX: number, fromY: number, toX: number, toY: number,
): { x: number; y: number }[] {
  return findPathCore(grid, width, height, fromX, fromY, toX, toY, (tile) => {
    if (!tile.building) return true;
    const t = tile.building.type;
    return t !== 'wall' && t !== 'fence' && t !== 'gate';
  });
}

// --- Movement: move villager 1 step along their path ---
export function moveOneStep(v: Villager): boolean {
  if (v.pathIndex >= v.path.length) return false;
  const next = v.path[v.pathIndex];
  v.x = next.x;
  v.y = next.y;
  v.pathIndex++;
  return true;
}

export function atDestination(v: Villager): boolean {
  return v.pathIndex >= v.path.length;
}

export function planPath(v: Villager, grid: Tile[][], width: number, height: number, toX: number, toY: number): void {
  if (v.x === toX && v.y === toY) {
    v.path = [];
    v.pathIndex = 0;
    return;
  }
  v.path = findPath(grid, width, height, v.x, v.y, toX, toY);
  v.pathIndex = 0;
}
