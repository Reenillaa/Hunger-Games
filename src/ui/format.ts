import type { GameState, Season } from '../core/index.ts';
import { TICKS_PER_DAY, dateFromTick, nextSelectionTick } from '../core/index.ts';
import type { LocaleKey } from '../content/i18n.ts';
import { t } from '../content/i18n.ts';

export const seasonName = (season: Season) => t(`season.${season}` as LocaleKey);

export function formatDate(tick: number): string {
  const d = dateFromTick(tick);
  return t('calendar.date', { year: d.year, season: seasonName(d.season), day: d.dayOfSeason });
}

export function formatHour(tick: number): string {
  return t('calendar.time', { hour: String(dateFromTick(tick).hour).padStart(2, '0') });
}

export function formatCountdown(state: Readonly<GameState>): string {
  const remaining =
    nextSelectionTick(state.clock.tick, state.competition.lastSelectionYear) - state.clock.tick;
  return t('calendar.countdown', {
    selection: t('selection.name'),
    days: Math.floor(remaining / TICKS_PER_DAY),
    hours: remaining % TICKS_PER_DAY,
  });
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}
