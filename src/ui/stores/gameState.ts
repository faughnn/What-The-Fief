import { writable, derived, get } from 'svelte/store';
import type { GameState } from '../../world.js';
import { createWorld, RENDER_TICKS_PER_SEC, TICKS_PER_DAY, NIGHT_TICKS } from '../../world.js';
import { tick } from '../../simulation/index.js';

// Core game state
export const gameState = writable<GameState | null>(null);
export const speed = writable(1);
export const paused = writable(false);
export const stateChanged = writable(false);

// Track reference changes
let lastStateRef: GameState | null = null;
gameState.subscribe(gs => {
  if (gs !== lastStateRef) {
    lastStateRef = gs;
    stateChanged.set(true);
  }
});

// Derived stores for UI reactivity
export const day = derived(gameState, $gs => $gs?.day ?? 0);
export const season = derived(gameState, $gs => $gs?.season ?? 'spring');
export const population = derived(gameState, $gs => $gs?.villagers.length ?? 0);
export const resources = derived(gameState, $gs => $gs?.resources ?? null);
export const prosperity = derived(gameState, $gs => Math.round($gs?.prosperity ?? 0));
export const weather = derived(gameState, $gs => $gs?.weather ?? 'clear');
export const renown = derived(gameState, $gs => $gs?.renown ?? 0);
export const constructionPoints = derived(gameState, $gs => $gs?.constructionPoints ?? 0);

export const timeOfDay = derived(gameState, $gs => {
  if (!$gs) return '6:00';
  const dayTick = $gs.tick % TICKS_PER_DAY;
  let hour: number, minute: number;
  if (dayTick < NIGHT_TICKS) {
    const nightProgress = dayTick / NIGHT_TICKS;
    const nightHours = 20 + nightProgress * 10;
    const wrapped = nightHours >= 24 ? nightHours - 24 : nightHours;
    hour = Math.floor(wrapped);
    minute = Math.floor((wrapped - hour) * 60);
  } else {
    const dayProgress = (dayTick - NIGHT_TICKS) / (TICKS_PER_DAY - NIGHT_TICKS);
    const dayHours = 6 + dayProgress * 14;
    hour = Math.floor(dayHours);
    minute = Math.floor((dayHours - hour) * 60);
  }
  return `${hour}:${minute.toString().padStart(2, '0')}`;
});

// Game loop
const TICK_INTERVAL = 1000 / RENDER_TICKS_PER_SEC;
let lastTickTime = 0;
let animFrameId: number | null = null;
let lastEventCount = 0;

export const events = writable<string[]>([]);

function gameLoop(timestamp: number) {
  animFrameId = requestAnimationFrame(gameLoop);
  const gs = get(gameState);
  const spd = get(speed);
  const isPaused = get(paused);
  if (!gs || spd === 0 || isPaused) {
    lastTickTime = timestamp;
    return;
  }

  const elapsed = timestamp - lastTickTime;
  const ticksToRun = Math.floor(elapsed / (TICK_INTERVAL / spd));
  if (ticksToRun > 0) {
    lastTickTime = timestamp;
    const maxTicks = Math.min(ticksToRun, spd * 2);
    let state = gs;
    for (let i = 0; i < maxTicks; i++) {
      state = tick(state);
    }
    // Collect new events
    const newEvents = state.events.slice(lastEventCount);
    lastEventCount = state.events.length;
    if (newEvents.length > 0) {
      events.update(e => [...e.slice(-50), ...newEvents]);
    }
    gameState.set(state);
  }
}

export function startGame() {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  lastTickTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

export function stopGame() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

export function newGame() {
  const gs = createWorld(200, 200, Date.now());
  // Fast-forward past night so villagers start awake at dawn
  let state = gs;
  for (let i = 0; i < NIGHT_TICKS + 1; i++) {
    state = tick(state);
  }
  lastEventCount = state.events.length;
  gameState.set(state);
  startGame();
}

export function setSpeed(s: number) { speed.set(s); }
