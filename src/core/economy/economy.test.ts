import { describe, expect, it } from 'vitest';
import {
  TICKS_PER_DAY,
  advanceTicks,
  applyCommand,
  createNewGame,
  dateFromTick,
} from '../index.ts';
import type { GameState } from '../index.ts';
import {
  checkPlacement,
  collectingContext,
  economyDay,
  economyHour,
  storageCapacity,
  unemployed,
} from '../index.ts';
import { TEMPLATES } from '../../content/maps/index.ts';

const fresh = () => createNewGame({ seed: 'eco' });

function findSpot(
  state: GameState,
  kind: 'garden' | 'house_shack' | 'mine_headframe' | 'lumber_camp',
): { x: number; y: number } {
  const t = TEMPLATES.d12!;
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++)
      if (checkPlacement(state, kind, x, y) === null) return { x, y };
  throw new Error(`no spot for ${kind}`);
}

describe('labour', () => {
  it('never assigns more workers than adults and fills production first', () => {
    const s = fresh();
    const assigned = s.district.structures.reduce((n, st) => n + st.workers, 0);
    expect(assigned).toBeLessThanOrEqual(s.economy.population.adults);
    expect(unemployed(s)).toBeGreaterThanOrEqual(0);
    expect(s.district.structures.find((st) => st.kind === 'mine_headframe')!.workers).toBe(6);
  });
});

describe('production', () => {
  it('mines coal only during working hours', () => {
    const s = fresh();
    s.clock.tick = 2; // 02:00
    const before = s.economy.resources.coal;
    economyHour(s, dateFromTick(2), collectingContext());
    expect(s.economy.resources.coal).toBe(before);
    economyHour(s, dateFromTick(10), collectingContext());
    expect(s.economy.resources.coal).toBeGreaterThan(before);
  });

  it('respects storage capacity', () => {
    const s = fresh();
    s.economy.resources.coal = storageCapacity(s);
    economyHour(s, dateFromTick(10), collectingContext());
    expect(s.economy.resources.coal).toBe(storageCapacity(s));
  });

  it('gardens produce nothing in winter', () => {
    const s = fresh();
    const winterNoon = 30 * TICKS_PER_DAY + 12;
    const before = s.economy.resources.food;
    economyHour(s, dateFromTick(winterNoon), collectingContext());
    expect(s.economy.resources.food).toBe(before);
  });
});

describe('construction', () => {
  it('places a site, pays the cost, builds with workers and completes', () => {
    const s = fresh();
    const spot = findSpot(s, 'house_shack');
    const wood = s.economy.resources.wood;
    const result = applyCommand(s, { type: 'build/place', kind: 'house_shack', ...spot });
    expect(result.ok).toBe(true);
    expect(s.economy.resources.wood).toBe(wood - 20);
    const site = s.district.structures.at(-1)!;
    expect(site.built).toBe(false);
    expect(site.workers).toBeGreaterThan(0);
    const ctx = collectingContext();
    for (let h = 0; h < 48 && !site.built; h++) economyHour(s, dateFromTick(10), ctx);
    expect(site.built).toBe(true);
    expect(ctx.events.some((e) => e.type === 'building/completed')).toBe(true);
  });

  it('rejects water, occupied cells, missing requirements and missing resources', () => {
    const s = fresh();
    expect(checkPlacement(s, 'house_shack', 14, 20)).toBe('blocked'); // river
    const hall = s.district.structures.find((st) => st.kind === 'town_hall')!;
    expect(checkPlacement(s, 'house_shack', hall.x, hall.y)).toBe('occupied');
    expect(checkPlacement(s, 'mine_headframe', 33, 33)).toBe('requirement');
    expect(checkPlacement(s, 'lumber_camp', 40, 30)).toBe('requirement');
    s.economy.resources.wood = 0;
    const spot = { x: 34, y: 30 };
    expect(checkPlacement(s, 'house_shack', spot.x, spot.y)).toBe('cost');
    expect(applyCommand(s, { type: 'build/place', kind: 'house_shack', ...spot }).ok).toBe(false);
  });

  it('refunds when demolishing and refuses landmarks', () => {
    const s = fresh();
    const spot = findSpot(s, 'garden');
    applyCommand(s, { type: 'build/place', kind: 'garden', ...spot });
    const site = s.district.structures.at(-1)!;
    const wood = s.economy.resources.wood;
    expect(applyCommand(s, { type: 'build/demolish', id: site.id }).ok).toBe(true);
    expect(s.economy.resources.wood).toBe(wood + 15);
    const hall = s.district.structures.find((st) => st.kind === 'town_hall')!;
    expect(applyCommand(s, { type: 'build/demolish', id: hall.id }).ok).toBe(false);
  });

  it('upgrades raise the level and the worker capacity', () => {
    const s = fresh();
    s.economy.resources.wood = 300;
    s.economy.resources.stone = 300;
    s.economy.population.adults = 200;
    const mine = s.district.structures.find((st) => st.kind === 'mine_headframe')!;
    expect(applyCommand(s, { type: 'build/upgrade', id: mine.id }).ok).toBe(true);
    expect(mine.level).toBe(2);
    expect(mine.workers).toBe(10);
  });
});

describe('daily life and the regime', () => {
  it('eats food every day and suffers when it runs out', () => {
    const s = fresh();
    const food = s.economy.resources.food;
    economyDay(s, dateFromTick(TICKS_PER_DAY * 2), collectingContext());
    expect(s.economy.resources.food).toBeLessThan(food);
    s.economy.resources.food = 0;
    const morale = s.economy.morale;
    const ctx = collectingContext();
    economyDay(s, dateFromTick(TICKS_PER_DAY * 3), ctx);
    expect(s.economy.morale).toBeLessThan(morale);
    expect(s.economy.hungerDays).toBe(1);
    expect(ctx.events.some((e) => e.type === 'economy/hunger')).toBe(true);
  });

  it('settles the coal quota at the start of each season', () => {
    const s = fresh();
    s.economy.resources.coal = 10;
    const attention = s.economy.attention;
    economyDay(s, dateFromTick(TICKS_PER_DAY * 10), collectingContext()); // summer day 1
    expect(s.economy.quota.history).toHaveLength(1);
    expect(s.economy.quota.history[0]!.delivered).toBe(10);
    expect(s.economy.attention).toBeGreaterThan(attention);
  });

  it('trades at the economato', () => {
    const s = fresh();
    const credits = s.economy.resources.credits;
    expect(
      applyCommand(s, { type: 'trade', action: 'sell', resource: 'coal', amount: 10 }).ok,
    ).toBe(true);
    expect(s.economy.resources.credits).toBe(credits + 30);
    expect(applyCommand(s, { type: 'trade', action: 'buy', resource: 'food', amount: 10 }).ok).toBe(
      true,
    );
    expect(
      applyCommand(s, { type: 'trade', action: 'buy', resource: 'food', amount: 100000 }).ok,
    ).toBe(false);
    expect(
      applyCommand(s, { type: 'trade', action: 'sell', resource: 'coal', amount: -1 }).ok,
    ).toBe(false);
  });

  it('runs a full year without the player and stays consistent', () => {
    const s = fresh();
    advanceTicks(s, TICKS_PER_DAY * 19);
    for (const v of Object.values(s.economy.resources)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(s.economy.morale).toBeGreaterThanOrEqual(0);
    expect(s.economy.morale).toBeLessThanOrEqual(100);
  });
});
