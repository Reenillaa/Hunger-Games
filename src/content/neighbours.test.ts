import { describe, expect, it } from 'vitest';
import { HOME_DISTRICTS } from './homeDistricts.ts';
import { neighbourOf } from './neighbours.ts';

describe('beyond the fog', () => {
  it('every district has neighbours, and they are real playable districts', () => {
    for (const id of Object.keys(HOME_DISTRICTS)) {
      const around = (['n', 'e', 's', 'w'] as const).map((d) => neighbourOf(id, d));
      expect(around.filter(Boolean).length, id).toBeGreaterThan(0);
      for (const n of around) {
        if (n) {
          expect(n).not.toBe(id);
          expect(Object.keys(HOME_DISTRICTS)).toContain(n);
        }
      }
    }
  });
  it('directions follow the world map (12 is east of 8; nothing west of the coast)', () => {
    expect(neighbourOf('d8', 'e')).toBe('d12');
    expect(neighbourOf('d4', 'w')).toBeNull();
  });
});
