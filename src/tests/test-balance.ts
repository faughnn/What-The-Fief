// test-balance.ts — Automated balance tests
// Runs scenarios and checks survival metrics.
// A balanced game means colonies CAN survive 100+ ticks with reasonable play.

import { createWorld, BUILDING_TEMPLATES } from '../world.js';
import { tick, placeBuilding, assignVillager, setGuard } from '../simulation.js';

interface Metrics {
  peakPop: number;
  finalPop: number;
  survivalTicks: number;  // last tick with pop > 0
  raidsSurvived: number;
  raidsLost: number;
  peakFood: number;
  starvationTicks: number; // ticks where any villager had food <= 1
  errors: string[];
}

function runScenario(name: string, setup: (state: any) => any, maxTicks: number): Metrics {
  let state = setup(createWorld(20, 20, 42));

  const metrics: Metrics = {
    peakPop: state.villagers.length,
    finalPop: 0,
    survivalTicks: 0,
    raidsSurvived: 0,
    raidsLost: 0,
    peakFood: 0,
    starvationTicks: 0,
    errors: [],
  };

  let prevRaidLevel = state.raidLevel;
  let prevBuildingCount = state.buildings.length;

  for (let i = 0; i < maxTicks; i++) {
    state = tick(state);

    if (state.villagers.length > 0) metrics.survivalTicks = state.day;
    metrics.peakPop = Math.max(metrics.peakPop, state.villagers.length);

    // Track food
    const totalFood = state.resources.food + state.resources.wheat + state.resources.bread;
    metrics.peakFood = Math.max(metrics.peakFood, totalFood);
    if (state.villagers.some((v: any) => v.food <= 1)) metrics.starvationTicks++;

    // Track raids
    if (state.raidLevel > prevRaidLevel) {
      if (state.buildings.length >= prevBuildingCount) {
        metrics.raidsSurvived++;
      } else {
        metrics.raidsLost++;
      }
    }
    prevRaidLevel = state.raidLevel;
    prevBuildingCount = state.buildings.length;
  }

  metrics.finalPop = state.villagers.length;
  return metrics;
}

function printMetrics(name: string, m: Metrics, target: { minSurvival: number; minFinalPop: number }) {
  const survived = m.survivalTicks >= target.minSurvival;
  const populated = m.finalPop >= target.minFinalPop;
  const icon = survived && populated ? 'PASS' : 'FAIL';

  console.log(`\n[${icon}] ${name}`);
  console.log(`  Survival: ${m.survivalTicks} ticks (need ${target.minSurvival})`);
  console.log(`  Population: peak=${m.peakPop}, final=${m.finalPop} (need ${target.minFinalPop})`);
  console.log(`  Raids: ${m.raidsSurvived} won, ${m.raidsLost} lost`);
  console.log(`  Food: peak=${m.peakFood}, starvation_ticks=${m.starvationTicks}`);
  return survived && populated;
}

// === SCENARIOS ===

// Scenario 1: Basic colony — 3 villagers, farm + housing, 1 guard
// Should survive at least 80 ticks with basic play
const s1 = runScenario('Basic Colony', (state) => {
  state = placeBuilding(state, 'house', 3, 8);
  state = placeBuilding(state, 'house', 7, 8);
  state = placeBuilding(state, 'farm', 3, 11);
  state = assignVillager(state, 'v1', 'b3');
  state = setGuard(state, 'v2');
  return state;
}, 100);

// Scenario 2: Food-focused — 2 food buildings, should not starve
const s2 = runScenario('Food Focus', (state) => {
  state = placeBuilding(state, 'house', 3, 8);
  state = placeBuilding(state, 'house', 7, 8);
  state = placeBuilding(state, 'farm', 3, 11);
  state = placeBuilding(state, 'chicken_coop', 6, 11);
  state = assignVillager(state, 'v1', 'b3');
  state = assignVillager(state, 'v2', 'b4');
  state = setGuard(state, 'v3');
  return state;
}, 100);

// Scenario 3: Long game — can the colony grow and sustain 120 ticks?
const s3 = runScenario('Long Game', (state) => {
  state = placeBuilding(state, 'house', 3, 8);
  state = placeBuilding(state, 'house', 7, 8);
  state = placeBuilding(state, 'house', 5, 12);
  state = placeBuilding(state, 'farm', 3, 11);
  state = placeBuilding(state, 'chicken_coop', 6, 11);
  state = assignVillager(state, 'v1', 'b4');
  state = assignVillager(state, 'v2', 'b5');
  state = setGuard(state, 'v3');
  return state;
}, 120);

// === RESULTS ===
console.log('\n=== BALANCE TEST RESULTS ===');
let pass = 0;
let total = 3;
if (printMetrics('Basic Colony (100 ticks)', s1, { minSurvival: 80, minFinalPop: 2 })) pass++;
if (printMetrics('Food Focus (100 ticks)', s2, { minSurvival: 80, minFinalPop: 2 })) pass++;
if (printMetrics('Long Game (120 ticks)', s3, { minSurvival: 100, minFinalPop: 3 })) pass++;

console.log(`\n${pass}/${total} scenarios passed.`);
if (pass < total) process.exit(1);
