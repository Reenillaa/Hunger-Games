import { describe, expect, it } from 'vitest';
import { JUBILEE_RULES, STANDARD_RULES, rulesForEdition } from '../../content/selectionRules.ts';
import {
  TICKS_PER_YEAR,
  advanceTicks,
  ageOf,
  createNewGame,
  livingCitizens,
  seedFromString,
} from '../index.ts';
import { eligiblePool, runSelection } from './selection.ts';

describe('selection rules', () => {
  const s = createNewGame({ seed: 'criba' });

  it('only youths of the right age enter, older ones with more slips', () => {
    const pool = eligiblePool(s.population, STANDARD_RULES, 0);
    for (const e of [...pool.F, ...pool.M]) {
      const c = s.population.citizens[e.citizenId]!;
      const age = ageOf(c, 0);
      expect(age).toBeGreaterThanOrEqual(12);
      expect(age).toBeLessThanOrEqual(18);
      expect(e.entries).toBeGreaterThanOrEqual(1 + age - 12);
    }
    expect(pool.F.length + pool.M.length).toBeGreaterThan(10);
  });

  it('draws one girl and one boy, deterministically per seed', () => {
    const a = runSelection(s.population, STANDARD_RULES, 0, seedFromString('x'));
    const b = runSelection(s.population, STANDARD_RULES, 0, seedFromString('x'));
    expect(a.chosen).toEqual(b.chosen);
    expect(a.chosen).toHaveLength(2);
    expect(s.population.citizens[a.chosen[0]!]!.sex).toBe('F');
    expect(s.population.citizens[a.chosen[1]!]!.sex).toBe('M');
  });

  it('respects the weights statistically', () => {
    const counts = new Map<string, number>();
    const rng = seedFromString('stats');
    for (let i = 0; i < 4000; i++) {
      const r = runSelection(s.population, STANDARD_RULES, 0, rng);
      counts.set(r.chosen[0]!, (counts.get(r.chosen[0]!) ?? 0) + 1);
    }
    const pool = eligiblePool(s.population, STANDARD_RULES, 0).F;
    const total = pool.reduce((n, e) => n + e.entries, 0);
    for (const e of pool) {
      const expected = (e.entries / total) * 4000;
      expect(Math.abs((counts.get(e.citizenId) ?? 0) - expected)).toBeLessThan(
        Math.max(40, expected * 0.25),
      );
    }
  });

  it('the disaffected and their children hold extra slips', () => {
    const youth = eligiblePool(s.population, STANDARD_RULES, 0).F[0]!;
    const c = s.population.citizens[youth.citizenId]!;
    const before = youth.entries;
    c.regimeOpinion = -80;
    const after = eligiblePool(s.population, STANDARD_RULES, 0).F.find(
      (e) => e.citizenId === c.id,
    )!.entries;
    expect(after).toBe(before + 2);
  });

  it('a Jubilee every 25 editions doubles the delegation', () => {
    expect(rulesForEdition(125)).toBe(JUBILEE_RULES);
    expect(rulesForEdition(124)).toBe(STANDARD_RULES);
    const r = runSelection(s.population, JUBILEE_RULES, 0, seedFromString('j'));
    expect(r.chosen.length).toBe(4);
    expect(new Set(r.chosen).size).toBe(4);
  });
});

describe('the Criba in the yearly cycle', () => {
  it('records the delegation, frightens the families and frees their jobs', () => {
    const s = createNewGame({ seed: 'cycle-criba' });
    advanceTicks(s, TICKS_PER_YEAR);
    expect(s.phase.kind).toBe('selection');
    const current = s.competition.current!;
    expect(current.participants).toHaveLength(2);
    for (const id of current.participants) {
      const c = s.population.citizens[id]!;
      expect(c.jobId).toBeNull();
      expect(c.history.at(-1)?.key).toBe('hist.selected');
      const mother = c.motherId ? s.population.citizens[c.motherId] : null;
      if (mother?.alive) expect(mother.moodModifiers.some((m) => m.key === 'dread')).toBe(true);
    }
    expect(s.competition.history).toHaveLength(1);
    expect(
      livingCitizens(s.population).every(
        (c) => !current.participants.includes(c.id) || c.jobId === null,
      ),
    ).toBe(true);
  });
});
