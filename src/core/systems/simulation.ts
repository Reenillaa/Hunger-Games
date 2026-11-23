import type { SimContext } from '../events.ts';
import { collectingContext } from '../events.ts';
import type { GameState } from '../state/gameState.ts';
import { editionOfYear } from '../state/gameState.ts';
import { enterPhase } from '../state/phases.ts';
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

/** Triggers the yearly selection ceremony on autumn day 1 at 00:00. */
const selectionTrigger: System = {
  id: 'selection-trigger',
  onTick(state, ctx, date) {
    if (ctx.autopilot || state.phase.kind !== 'district') return;
    if (state.clock.tick !== selectionTickOfYear(date.year)) return;
    if (state.competition.lastSelectionYear === date.year) return;
    state.competition.lastSelectionYear = date.year;
    enterPhase(
      state,
      { kind: 'selection', edition: editionOfYear(state, date.year) },
      'selectionHeld',
      ctx,
    );
  },
};

export const SYSTEMS: readonly System[] = [selectionTrigger];

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
