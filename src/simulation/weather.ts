// weather.ts — Season/weather transitions and lightning strikes

import { Season, SEASON_NAMES } from '../world.js';
import { TickState } from './helpers.js';

export function processSeasonAndWeather(ts: TickState): void {
  ts.season = SEASON_NAMES[Math.floor((ts.newDay % 40) / 10)];
  const weatherRng = ((ts.newDay * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
  const weatherThresholds: Record<Season, [number, number]> = {
    spring: [0.6, 0.9], summer: [0.7, 0.9], autumn: [0.4, 0.8], winter: [0.5, 0.8],
  };
  const [clearThresh, rainThresh] = weatherThresholds[ts.season];
  ts.weather = weatherRng < clearThresh ? 'clear' : weatherRng < rainThresh ? 'rain' : 'storm';
}

export function processLightning(ts: TickState): void {
  // Per-tick: during storms, small chance (0.5%) to strike a random constructed building
  if (ts.weather !== 'storm') return;
  const constructed = ts.buildings.filter(b => b.constructed && !b.onFire && b.type !== 'well' && b.type !== 'fountain' && b.type !== 'rubble');
  if (constructed.length === 0) return;

  const lightningRng = ((ts.newTick * 48271 + 3) & 0x7fffffff) / 0x7fffffff;
  if (lightningRng < 0.005) {
    const target = constructed[ts.newTick % constructed.length];
    target.onFire = true;
    ts.events.push(`Lightning struck the ${target.type} at (${target.x},${target.y})!`);
  }
}
