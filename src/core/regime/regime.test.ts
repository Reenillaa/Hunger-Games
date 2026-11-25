import { describe, expect, it } from 'vitest';
import { DISTRICT_EVENTS } from '../../content/districtEvents.ts';
import { HOME_DISTRICTS } from '../../content/homeDistricts.ts';
import { es } from '../../content/locales/es.ts';
import {
  TICKS_PER_DAY,
  advanceTicks,
  applyCommand,
  collectingContext,
  createNewGame,
} from '../index.ts';
import { decreeFactor, regimeDay } from './regime.ts';
import { dateFromTick } from '../time/calendar.ts';

describe('the regime', () => {
  it('raises dilemmas now and then; they wait for the player and resolve by command', () => {
    const s = createNewGame({ seed: 'events' });
    let seen = 0;
    for (let d = 0; d < 60 && seen === 0; d++) {
      advanceTicks(s, TICKS_PER_DAY);
      if (s.regime.pending) seen += 1;
    }
    expect(s.regime.pending).not.toBeNull();
    const ev = DISTRICT_EVENTS.find((e) => e.id === s.regime.pending!.eventId)!;
    expect(applyCommand(s, { type: 'event/choose', option: 99 }).ok).toBe(false);
    const free = ev.options.findIndex((o) => !(o.effects.credits && o.effects.credits < 0));
    expect(applyCommand(s, { type: 'event/choose', option: Math.max(0, free) }).ok).toBe(true);
    expect(s.regime.pending).toBeNull();
    expect(s.regime.log.at(-1)?.key).toMatch(/^ev\./);
  });

  it('high attention brings a curfew (less production) and then a public reprisal', () => {
    const s = createNewGame({ seed: 'reprisal' });
    const ctx = collectingContext();
    const alive = () => Object.values(s.population.citizens).filter((c) => c.alive).length;
    const before = alive();
    s.economy.attention = 90;
    regimeDay(s, dateFromTick(s.clock.tick), ctx);
    expect(decreeFactor(s)).toBeLessThan(1);
    expect(alive()).toBe(before - 1);
    expect(Object.values(s.population.citizens).some((c) => c.deathCause === 'regime')).toBe(true);
    expect(s.economy.attention).toBeLessThan(90);
    expect(s.regime.unrest).toBeGreaterThan(0);
  });

  it('every event has localisable options and at least one free choice', () => {
    for (const ev of DISTRICT_EVENTS) {
      expect(ev.options.length).toBeGreaterThan(1);
      // A district without credits must always have something it can choose.
      expect(ev.options.some((o) => !(o.effects.credits && o.effects.credits < 0))).toBe(true);
    }
  });

  it('regional dilemmas only reach their own districts, and every text exists', () => {
    const keys = es as Record<string, string>;
    for (const ev of DISTRICT_EVENTS) {
      expect(keys[`ev.${ev.id}.title`]).toBeTruthy();
      for (const o of ev.options) expect(keys[`ev.${ev.id}.${o.id}.done`]).toBeTruthy();
      for (const d of ev.when?.districts ?? []) expect(Object.keys(HOME_DISTRICTS)).toContain(d);
    }
    // A fishing district never hears of a mine accident; it gets storms instead.
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const s = createNewGame({ seed: `sea-${i}`, homeDistrict: 'd4' });
      for (let d = 0; d < 120; d++) {
        advanceTicks(s, TICKS_PER_DAY);
        if (s.regime.pending) {
          seen.add(s.regime.pending.eventId);
          applyCommand(s, { type: 'event/choose', option: 0 });
        }
      }
    }
    expect(seen.has('mine_accident')).toBe(false);
    expect(seen.has('forest_fire')).toBe(false);
    expect(seen.has('storm_at_sea')).toBe(true);
  });
});
