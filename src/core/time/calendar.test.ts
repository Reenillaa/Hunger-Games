import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_YEAR,
  TICKS_PER_DAY,
  TICKS_PER_YEAR,
  dateFromTick,
  nextSelectionTick,
  selectionTickOfYear,
} from './calendar.ts';

describe('calendar', () => {
  it('starts in spring, year 1, day 1 at midnight', () => {
    expect(dateFromTick(0)).toMatchObject({
      year: 1,
      season: 'spring',
      dayOfSeason: 1,
      dayOfYear: 1,
      hour: 0,
    });
  });

  it('rolls days, seasons and years', () => {
    expect(dateFromTick(TICKS_PER_DAY - 1)).toMatchObject({ dayOfSeason: 1, hour: 23 });
    expect(dateFromTick(TICKS_PER_DAY * 10)).toMatchObject({ season: 'summer', dayOfSeason: 1 });
    expect(dateFromTick(TICKS_PER_DAY * 39)).toMatchObject({ season: 'winter', dayOfSeason: 10 });
    expect(dateFromTick(TICKS_PER_YEAR)).toMatchObject({ year: 2, season: 'spring', dayOfYear: 1 });
    expect(DAYS_PER_YEAR).toBe(40);
  });

  it('places the selection at noon on autumn day 1', () => {
    const t = selectionTickOfYear(1);
    expect(t).toBe(20 * TICKS_PER_DAY + 12);
    expect(dateFromTick(t)).toMatchObject({ season: 'autumn', dayOfSeason: 1, hour: 12 });
    expect(selectionTickOfYear(3) - selectionTickOfYear(2)).toBe(TICKS_PER_YEAR);
  });

  it('finds the next selection, skipping years already held', () => {
    expect(nextSelectionTick(0, null)).toBe(selectionTickOfYear(1));
    expect(nextSelectionTick(selectionTickOfYear(1), null)).toBe(selectionTickOfYear(1));
    expect(nextSelectionTick(selectionTickOfYear(1), 1)).toBe(selectionTickOfYear(2));
    expect(nextSelectionTick(selectionTickOfYear(1) + 1, null)).toBe(selectionTickOfYear(2));
  });

  it('rejects invalid ticks', () => {
    expect(() => dateFromTick(-1)).toThrow(RangeError);
    expect(() => dateFromTick(1.5)).toThrow(RangeError);
  });
});
