import { describe, expect, it } from 'vitest';
import { MAX_ACTIVE_LAWS, LAWS } from '../../content/laws.ts';
import { applyCommand, createNewGame, dailyFoodNeed, lawProduction } from '../index.ts';

describe('district laws', () => {
  it('toggle on and off, at most three at once', () => {
    const s = createNewGame({ seed: 'laws' });
    for (const law of LAWS.slice(0, MAX_ACTIVE_LAWS))
      expect(applyCommand(s, { type: 'law/toggle', id: law.id }).ok).toBe(true);
    expect(applyCommand(s, { type: 'law/toggle', id: LAWS[MAX_ACTIVE_LAWS]!.id }).ok).toBe(false);
    expect(applyCommand(s, { type: 'law/toggle', id: LAWS[0]!.id }).ok).toBe(true);
    expect(s.laws).toHaveLength(MAX_ACTIVE_LAWS - 1);
    expect(applyCommand(s, { type: 'law/toggle', id: 'nope' }).ok).toBe(false);
  });

  it('long shifts raise production; rationing lowers what is eaten', () => {
    const s = createNewGame({ seed: 'laws2' });
    const need = dailyFoodNeed(s);
    expect(lawProduction(s)).toBe(1);
    applyCommand(s, { type: 'law/toggle', id: 'long_shifts' });
    applyCommand(s, { type: 'law/toggle', id: 'rationing' });
    expect(lawProduction(s)).toBeCloseTo(1.15);
    expect(dailyFoodNeed(s)).toBeCloseTo(need * 0.8);
  });
});
