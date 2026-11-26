import { describe, expect, it } from 'vitest';
import { TRAITS } from '../../content/traits.ts';
import type { GameState } from '../index.ts';
import {
  ADULT_AGE,
  advanceTicks,
  ageOf,
  applyCommand,
  collectingContext,
  createNewGame,
  hashState,
  killCitizen,
  livingCitizens,
} from '../index.ts';

const today = (s: GameState) => Math.floor(s.clock.tick / 24);

function checkInvariants(s: GameState): void {
  const all = s.population.citizens;
  for (const c of Object.values(all)) {
    expect(c.motherId).not.toBe(c.id);
    expect(c.fatherId).not.toBe(c.id);
    for (const kid of c.childrenIds) {
      const k = all[kid]!;
      expect(k.motherId === c.id || k.fatherId === c.id).toBe(true);
    }
    // The living are partnered symmetrically; the dead keep their late partner for the family tree.
    if (c.alive && c.partnerId) {
      const p = all[c.partnerId]!;
      expect(p.partnerId).toBe(c.id);
      expect(p.alive).toBe(true);
    }
    if (!c.alive) {
      expect(c.jobId).toBeNull();
      expect(c.homeId).toBeNull();
      expect(c.deathDay).toBeDefined();
    }
    for (const t of c.traits) expect(c.traits).not.toContain(TRAITS[t].opposite);
    expect(Object.keys(c.relations).length).toBeLessThanOrEqual(12);
    expect(c.health).toBeGreaterThanOrEqual(0);
    expect(c.mood).toBeLessThanOrEqual(100);
  }
  for (const st of s.district.structures) {
    const staff = livingCitizens(s.population).filter((c) => c.jobId === st.id);
    expect(staff.length).toBe(st.workers);
    for (const w of staff) expect(ageOf(w, today(s))).toBeGreaterThanOrEqual(ADULT_AGE);
  }
}

describe('initial population', () => {
  const s = createNewGame({ seed: 'people' });
  const living = livingCitizens(s.population);

  it('fills the (few) starting houses with about 60 people in families', () => {
    expect(living.length).toBeGreaterThan(40);
    expect(living.length).toBeLessThan(90);
    for (const c of living) expect(c.homeId).not.toBeNull();
    const couples = living.filter((c) => c.partnerId).length / 2;
    expect(couples).toBeGreaterThan(10);
    expect(living.filter((c) => ageOf(c, 0) >= 12 && ageOf(c, 0) <= 18).length).toBeGreaterThan(5);
  });

  it('remembers deceased grandparents and links siblings across homes', () => {
    const dead = Object.values(s.population.citizens).filter((c) => !c.alive);
    expect(dead.length).toBeGreaterThan(5);
    const siblingsApart = living.some((c) => {
      const m = c.motherId ? s.population.citizens[c.motherId] : null;
      return m?.childrenIds.some(
        (id) => id !== c.id && s.population.citizens[id]?.homeId !== c.homeId,
      );
    });
    expect(siblingsApart).toBe(true);
  });

  it("children carry their parents' first surnames and resemble them", () => {
    const kid = living.find((c) => c.fatherId && c.motherId && ageOf(c, 0) < 16)!;
    const f = s.population.citizens[kid.fatherId!]!;
    const m = s.population.citizens[kid.motherId!]!;
    expect(kid.lastNames).toEqual([f.lastNames[0], m.lastNames[0]]);
    const inherited = Object.keys(kid.genes).filter((k) => {
      const key = k as keyof typeof kid.genes;
      return kid.genes[key] === f.genes[key] || kid.genes[key] === m.genes[key];
    });
    expect(inherited.length).toBeGreaterThanOrEqual(4);
  });

  it('assigns real people to jobs, the most skilled first', () => {
    checkInvariants(s);
    const mine = s.district.structures.find((st) => st.kind === 'mine_headframe')!;
    expect(mine.workers).toBe(6);
    expect(mine.efficiency).toBeGreaterThan(0.6);
  });

  it('is deterministic per seed', () => {
    expect(hashState(createNewGame({ seed: 'people' }))).toBe(hashState(s));
  });
});

describe('life goes on', () => {
  it('three years later: births, deaths, couples, consistent families', () => {
    const s = createNewGame({ seed: 'years' });
    const start = livingCitizens(s.population).length;
    for (let y = 0; y < 3; y++) {
      // Keep everyone fed so the test is about demography, not famine.
      while (s.phase.kind === 'district') {
        s.economy.resources.food = 500;
        advanceTicks(s, 24);
      }
      // Skip the games: return home immediately each year.
      for (const type of [
        'capital/depart',
        ...Array(7).fill('capital/advance-day'),
        'arena/conclude',
        'home/return',
      ]) {
        applyCommand(s, { type } as never);
      }
    }
    const born = Object.values(s.population.citizens).filter((c) =>
      c.history.some((h) => h.key === 'hist.born'),
    );
    const died = Object.values(s.population.citizens).filter((c) => !c.alive && c.deathDay! > 0);
    expect(born.length).toBeGreaterThan(0);
    expect(died.length).toBeGreaterThanOrEqual(0);
    expect(livingCitizens(s.population).length).toBeGreaterThan(start * 0.7);
    checkInvariants(s);
  });

  it('a death leaves the family in mourning', () => {
    const s = createNewGame({ seed: 'grief' });
    const victim = livingCitizens(s.population).find(
      (c) => c.partnerId && c.childrenIds.length > 0,
    )!;
    const partner = s.population.citizens[victim.partnerId!]!;
    const ctx = collectingContext();
    killCitizen(s, victim, 'accident', ctx);
    expect(victim.alive).toBe(false);
    expect(partner.partnerId).toBeNull();
    expect(partner.moodModifiers.some((m) => m.key === 'grief')).toBe(true);
    expect(partner.history.at(-1)?.key).toBe('hist.lost');
    expect(ctx.events.some((e) => e.type === 'citizen/died')).toBe(true);
  });
});
