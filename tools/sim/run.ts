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
import type { Command } from '../../src/core/index.ts';

const { values } = parseArgs({
  options: {
    years: { type: 'string', default: '10' },
    seed: { type: 'string', default: 'sim' },
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
for (let y = 0; y < years; y++) {
  ticks += advanceTicks(state, TICKS_PER_YEAR * 2);
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
    },
    null,
    2,
  ),
);
