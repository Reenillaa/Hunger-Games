import { describe, expect, it } from 'vitest';
import { daylightAt } from './daylight.ts';

describe('daylightAt', () => {
  it('is neutral at noon and dark at midnight', () => {
    expect(daylightAt(12)).toEqual({ ambient: 0xffffff, night: 0, shadow: 1 });
    const midnight = daylightAt(0);
    expect(midnight.night).toBe(1);
    expect(midnight.shadow).toBe(0);
    expect(midnight.ambient).toBeLessThan(0x505050 + 0x100000);
  });

  it('changes continuously through dusk and dawn', () => {
    let prev = daylightAt(17.9).night;
    for (let h = 18; h <= 21; h += 0.05) {
      const n = daylightAt(h).night;
      expect(n).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(n - prev).toBeLessThan(0.08);
      prev = n;
    }
    expect(daylightAt(5).night).toBeCloseTo(1);
    expect(daylightAt(7).night).toBeCloseTo(0);
  });

  it('wraps hours outside 0–24', () => {
    expect(daylightAt(36)).toEqual(daylightAt(12));
    expect(daylightAt(-12)).toEqual(daylightAt(12));
  });
});
