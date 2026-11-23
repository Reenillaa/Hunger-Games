/**
 * Game calendar (docs/GAME_SYSTEMS.md §1, decision D-04).
 * 1 tick = 1 in-game hour. Year = 4 seasons × 10 days.
 */
export const HOURS_PER_DAY = 24;
export const DAYS_PER_SEASON = 10;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;
export const TICKS_PER_DAY = HOURS_PER_DAY;
export const TICKS_PER_YEAR = DAYS_PER_YEAR * TICKS_PER_DAY;

/** The selection ceremony happens at 00:00 of the first day of autumn every year. */
export const SELECTION_SEASON: Season = 'autumn';
export const SELECTION_DAY_OF_SEASON = 1;
/** Days spent in the capital before the arena. */
export const CAPITAL_DAYS = 7;

export interface CalendarDate {
  /** 1-based year since the game started. */
  year: number;
  season: Season;
  seasonIndex: number;
  /** 1-based day within the season. */
  dayOfSeason: number;
  /** 1-based day within the year. */
  dayOfYear: number;
  /** 0-based absolute day since tick 0. */
  absoluteDay: number;
  hour: number;
}

export function dateFromTick(tick: number): CalendarDate {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError(`Invalid tick ${tick}`);
  const absoluteDay = Math.floor(tick / TICKS_PER_DAY);
  const hour = tick % TICKS_PER_DAY;
  const year = Math.floor(absoluteDay / DAYS_PER_YEAR) + 1;
  const dayIndexInYear = absoluteDay % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayIndexInYear / DAYS_PER_SEASON);
  return {
    year,
    season: SEASONS[seasonIndex] as Season,
    seasonIndex,
    dayOfSeason: (dayIndexInYear % DAYS_PER_SEASON) + 1,
    dayOfYear: dayIndexInYear + 1,
    absoluteDay,
    hour,
  };
}

/** Tick at which the selection of the given year starts. */
export function selectionTickOfYear(year: number): number {
  const seasonIndex = SEASONS.indexOf(SELECTION_SEASON);
  const dayIndex = seasonIndex * DAYS_PER_SEASON + (SELECTION_DAY_OF_SEASON - 1);
  return (year - 1) * TICKS_PER_YEAR + dayIndex * TICKS_PER_DAY;
}

/** Tick of the next selection at or after `tick`, skipping years whose selection already took place. */
export function nextSelectionTick(tick: number, lastSelectionYear: number | null): number {
  let year = dateFromTick(tick).year;
  while (
    selectionTickOfYear(year) < tick ||
    (lastSelectionYear !== null && year <= lastSelectionYear)
  ) {
    year += 1;
  }
  return selectionTickOfYear(year);
}
