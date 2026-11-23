/**
 * Headless batch simulation (no browser, no engine). Grows with every system:
 * today it runs the yearly cycle; later phases add economy, population and arena reports.
 *
 *   npm run sim -- --years 50 --seed 123
 */
import { parseArgs } from 'node:util';
import {
  CAPITAL_DAYS,
  TICKS_PER_YEAR,
  advanceTicks,
  applyCommand,
  createNewGame,
  dateFromTick,
  hashState,
} from '../../src/core/index.ts';
import type { Command, GameState } from '../../src/core/index.ts';
import { TICKS_PER_DAY, checkPlacement, dailyFoodNeed } from '../../src/core/index.ts';

/** A simple, sensible player: sells surplus coal, buys food, builds gardens when short. */
function basicGovernor(state: GameState): void {
  const e = state.economy;
  const need = dailyFoodNeed(state);
  const spareCoal = Math.floor(e.resources.coal - e.quota.required * 0.9);
  if (spareCoal > 5)
    applyCommand(state, { type: 'trade', action: 'sell', resource: 'coal', amount: spareCoal });
  if (e.resources.food < need * 3) {
    const amount = Math.min(
      Math.floor(e.resources.credits / 2),
      Math.ceil(need * 3 - e.resources.food),
    );
    if (amount > 0) applyCommand(state, { type: 'trade', action: 'buy', resource: 'food', amount });
  }
  const gardens = state.district.structures.filter((s) => s.kind === 'garden').length;
  if (gardens < 5 && e.resources.wood >= 15) {
    for (let y = 10; y < 46; y++) {
      for (let x = 8; x < 44; x++) {
        if (checkPlacement(state, 'garden', x, y) === null) {
          applyCommand(state, { type: 'build/place', kind: 'garden', x, y });
          return;
        }
      }
    }
  }
}

const { values } = parseArgs({
  options: {
    years: { type: 'string', default: '10' },
    seed: { type: 'string', default: 'sim' },
    policy: { type: 'string', default: 'none' },
  },
});
const years = Number(values.years);
if (!Number.isInteger(years) || years < 1) throw new Error('--years must be a positive integer');

const competition: Command[] = [
  { type: 'capital/depart' },
  ...Array.from({ length: CAPITAL_DAYS }, (): Command => ({ type: 'capital/advance-day' })),
  { type: 'arena/conclude' },
  { type: 'home/return' },
];

const started = performance.now();
const state = createNewGame({ seed: values.seed });
let ticks = 0;
const yearly: unknown[] = [];
for (let y = 0; y < years; y++) {
  if (values.policy === 'basic') {
    while (state.phase.kind === 'district') {
      ticks += advanceTicks(state, TICKS_PER_DAY);
      if (state.phase.kind === 'district') basicGovernor(state);
    }
  } else {
    ticks += advanceTicks(state, TICKS_PER_YEAR * 2);
  }
  const e = state.economy;
  yearly.push({
    year: y + 1,
    food: Math.round(e.resources.food),
    coal: Math.round(e.resources.coal),
    wood: Math.round(e.resources.wood),
    credits: Math.round(e.resources.credits),
    morale: Math.round(e.morale),
    attention: e.attention,
    hungerDays: e.hungerDays,
    alive: Object.values(state.population.citizens).filter((c) => c.alive).length,
    dead: Object.values(state.population.citizens).filter((c) => !c.alive && (c.deathDay ?? -1) >= 0).length,
    born: Object.values(state.population.citizens).filter((c) => c.history.some((h) => h.key === 'hist.born')).length,
    quotaMet:
      e.quota.history.filter((q) => q.delivered >= q.required).length +
      '/' +
      e.quota.history.length,
  });
  if (state.phase.kind !== 'selection') throw new Error(`Year ${y + 1}: selection did not start`);
  for (const cmd of competition) {
    const result = applyCommand(state, cmd);
    if (!result.ok) throw new Error(`Year ${y + 1}: ${cmd.type} failed: ${result.error.message}`);
  }
}
const elapsed = performance.now() - started;
const date = dateFromTick(state.clock.tick);

console.log(
  JSON.stringify(
    {
      seed: values.seed,
      years,
      finalDate: `year ${date.year}, ${date.season} day ${date.dayOfSeason}`,
      selectionsHeld: state.chronicle.filter((c) => c.kind === 'selectionHeld').length,
      editions: [state.meta.firstEdition, state.meta.firstEdition + years - 1],
      districtTicks: ticks,
      stateHash: hashState(state),
      elapsedMs: Math.round(elapsed),
      ticksPerSecond: Math.round((ticks / elapsed) * 1000),
      economyByYear: yearly,
    },
    null,
    2,
  ),
);
