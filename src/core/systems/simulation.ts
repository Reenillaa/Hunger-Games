import type { SimContext } from '../events.ts';
import { collectingContext } from '../events.ts';
import type { GameState } from '../state/gameState.ts';
import { editionOfYear } from '../state/gameState.ts';
import { enterPhase } from '../state/phases.ts';
import { rulesForEdition } from '../../content/selectionRules.ts';
import { allocateLabor, economyDay, economyHour } from '../economy/economy.ts';
import { note } from '../population/simulate.ts';
import { runSelection } from '../selection/selection.ts';
import { populationDay, populationSeason, populationYear } from '../population/simulate.ts';
import type { CalendarDate } from '../time/calendar.ts';
import { TICKS_PER_DAY, dateFromTick, selectionTickOfYear } from '../time/calendar.ts';

/**
 * A system reacts to the passage of district time. Later phases register economy,
 * population, events and regime systems here; order in SYSTEMS is execution order.
 */
export interface System {
  id: string;
  onTick?(state: GameState, ctx: SimContext, date: CalendarDate): void;
  onDayStart?(state: GameState, ctx: SimContext, date: CalendarDate): void;
}

/** Draws the delegation and applies the immediate consequences on families and jobs. */
function holdSelection(state: GameState, edition: number, year: number, ctx: SimContext): void {
  const rules = rulesForEdition(edition);
  const day = Math.floor(state.clock.tick / 24);
  const result = runSelection(state.population, rules, day, state.rng.selection);
  const entries: Record<string, number> = {};
  for (const e of [...result.pool.F, ...result.pool.M]) entries[e.citizenId] = e.entries;
  state.competition.current = { edition, ruleId: rules.id, participants: result.chosen, entries };
  state.competition.history.push({ edition, year, participants: result.chosen });
  for (const id of result.chosen) {
    const c = state.population.citizens[id];
    if (!c) continue;
    note(c, day, 'hist.selected', { edition: String(edition) });
    c.jobId = null;
    // Fear at home; dread among friends.
    for (const relId of [c.motherId, c.fatherId, c.partnerId, ...c.childrenIds]) {
      const r = relId ? state.population.citizens[relId] : null;
      if (r?.alive) r.moodModifiers.push({ key: 'dread', value: -20, untilDay: day + 30 });
    }
    for (const [fid, rel] of Object.entries(c.relations)) {
      const f = state.population.citizens[fid];
      if (f?.alive && rel.opinion > 30)
        f.moodModifiers.push({ key: 'dread', value: -10, untilDay: day + 30 });
    }
  }
  allocateLabor(state);
  ctx.emit({ type: 'selection/drawn', edition, participants: result.chosen });
}

/** Triggers the yearly selection ceremony on autumn day 1 at 00:00. */
const selectionTrigger: System = {
  id: 'selection-trigger',
  onTick(state, ctx, date) {
    if (ctx.autopilot || state.phase.kind !== 'district') return;
    if (state.clock.tick !== selectionTickOfYear(date.year)) return;
    if (state.competition.lastSelectionYear === date.year) return;
    state.competition.lastSelectionYear = date.year;
    holdSelection(state, editionOfYear(state, date.year), date.year, ctx);
    enterPhase(
      state,
      { kind: 'selection', edition: editionOfYear(state, date.year) },
      'selectionHeld',
      ctx,
    );
  },
};

/** Production, construction, food, labour and the seasonal coal quota (Phase 3). */
const economy: System = {
  id: 'economy',
  onDayStart: (state, ctx, date) => economyDay(state, date, ctx),
  onTick: (state, ctx, date) => economyHour(state, date, ctx),
};

/** Citizens: daily life, seasonal couples and births, yearly ageing (Phase 4). */
const population: System = {
  id: 'population',
  onDayStart(state, ctx, date) {
    populationDay(state, date, ctx);
    if (date.dayOfSeason === 1 && date.absoluteDay > 0) populationSeason(state, date, ctx);
    if (date.dayOfYear === 1 && date.absoluteDay > 0) populationYear(state, date, ctx);
  },
};

export const SYSTEMS: readonly System[] = [economy, population, selectionTrigger];

export class SimulationError extends Error {}

/** Advances district time by one hour. Only valid while the district phase is active. */
export function advanceTick(state: GameState, ctx: SimContext = collectingContext()): void {
  if (state.phase.kind !== 'district') {
    throw new SimulationError(`District time cannot advance during phase "${state.phase.kind}"`);
  }
  state.clock.tick += 1;
  const date = dateFromTick(state.clock.tick);
  if (date.hour === 0) {
    ctx.emit({ type: 'time/day-started', tick: state.clock.tick, date });
    if (date.dayOfSeason === 1)
      ctx.emit({ type: 'time/season-started', tick: state.clock.tick, date });
    if (date.dayOfYear === 1) ctx.emit({ type: 'time/year-started', tick: state.clock.tick, date });
    for (const system of SYSTEMS) system.onDayStart?.(state, ctx, date);
  }
  for (const system of SYSTEMS) system.onTick?.(state, ctx, date);
}

/**
 * Advances up to `ticks` hours, stopping early if the phase leaves the district
 * (e.g. the selection starts). Returns how many ticks actually ran.
 */
export function advanceTicks(
  state: GameState,
  ticks: number,
  ctx: SimContext = collectingContext(),
): number {
  let ran = 0;
  while (ran < ticks && state.phase.kind === 'district') {
    advanceTick(state, ctx);
    ran += 1;
  }
  return ran;
}

/** Runs the district unattended for whole days (used while the delegation was away). */
export function runAutopilotDays(state: GameState, days: number, emit: SimContext['emit']): void {
  const ctx: SimContext = { emit, autopilot: true };
  for (let i = 0; i < days * TICKS_PER_DAY; i++) advanceTick(state, ctx);
  emit({ type: 'autopilot/completed', days });
}
