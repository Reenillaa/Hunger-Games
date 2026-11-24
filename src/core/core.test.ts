import { describe, expect, it } from 'vitest';
import {
  CAPITAL_DAYS,
  TICKS_PER_DAY,
  TICKS_PER_YEAR,
  advanceTick,
  advanceTicks,
  applyCommand,
  collectingContext,
  createNewGame,
  dateFromTick,
  hashState,
  selectionTickOfYear,
} from './index.ts';
import { START_HOUR } from './state/newGame.ts';
import type { Command, GameState } from './index.ts';

function runToSelection(state: GameState): void {
  const ran = advanceTicks(state, TICKS_PER_YEAR * 2);
  expect(ran).toBeGreaterThan(0);
  expect(state.phase.kind).toBe('selection');
}

function playCompetition(state: GameState): void {
  const sequence: Command[] = [
    { type: 'capital/depart' },
    ...Array.from({ length: CAPITAL_DAYS }, () => ({ type: 'capital/advance-day' }) as const),
    { type: 'arena/conclude' },
    { type: 'home/return' },
  ];
  for (const cmd of sequence) {
    const result = applyCommand(state, cmd);
    expect(result.ok, `${cmd.type}: ${!result.ok ? result.error.message : ''}`).toBe(true);
  }
}

describe('new game', () => {
  it('starts in the district, spring of year 1, with a chronicle entry', () => {
    const s = createNewGame({ seed: 'abc' });
    expect(s.phase).toEqual({ kind: 'district' });
    expect(s.clock.tick).toBe(START_HOUR);
    expect(s.chronicle).toHaveLength(1);
    expect(s.meta.firstEdition).toBeGreaterThanOrEqual(101);
    expect(s.meta.firstEdition).toBeLessThanOrEqual(160);
  });

  it('is fully serializable', () => {
    const s = createNewGame({ seed: 'json' });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('rejects empty seeds', () => {
    expect(() => createNewGame({ seed: '  ' })).toThrow(RangeError);
  });
});

describe('determinism', () => {
  it('same seed + same commands ⇒ same state hash after 1000+ ticks', () => {
    const run = () => {
      const s = createNewGame({ seed: 'determinism' });
      advanceTicks(s, 1000);
      if (s.phase.kind === 'selection') playCompetition(s);
      advanceTicks(s, 300);
      return hashState(s);
    };
    expect(run()).toBe(run());
  });

  it('different seeds ⇒ different states', () => {
    expect(hashState(createNewGame({ seed: 'a' }))).not.toBe(
      hashState(createNewGame({ seed: 'b' })),
    );
  });

  it('a JSON round-trip mid-game does not change the outcome', () => {
    const a = createNewGame({ seed: 'roundtrip' });
    advanceTicks(a, 200);
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    advanceTicks(a, 400);
    advanceTicks(b, 400);
    expect(hashState(a)).toBe(hashState(b));
  });
});

describe('yearly cycle (walking skeleton)', () => {
  it('emits day/season/year events', () => {
    const s = createNewGame({ seed: 'events' });
    const ctx = collectingContext();
    for (let i = 0; i < TICKS_PER_DAY * 10; i++) advanceTick(s, ctx);
    const types = ctx.events.map((e) => e.type);
    expect(types.filter((t) => t === 'time/day-started')).toHaveLength(10);
    expect(types).toContain('time/season-started');
  });

  it('triggers the selection on autumn day 1 of year 1', () => {
    const s = createNewGame({ seed: 'cycle' });
    runToSelection(s);
    expect(s.clock.tick).toBe(selectionTickOfYear(1));
    expect(dateFromTick(s.clock.tick)).toMatchObject({ season: 'autumn', dayOfSeason: 1 });
    expect(s.phase).toEqual({ kind: 'selection', edition: s.meta.firstEdition });
  });

  it('runs selection → capital (7 days) → arena → aftermath → district with autopilot', () => {
    const s = createNewGame({ seed: 'cycle' });
    runToSelection(s);
    const selectionTick = s.clock.tick;
    playCompetition(s);
    expect(s.phase.kind).toBe('district');
    const away = s.chronicle.at(-1)!.daysAway!;
    // The week in the Capitol plus the days the games lasted.
    expect(away).toBeGreaterThan(CAPITAL_DAYS);
    expect(s.clock.tick).toBe(selectionTick + away * TICKS_PER_DAY);
    expect(s.away.days).toBe(0);
    expect(s.chronicle.map((c) => c.kind)).toEqual([
      'gameStarted',
      'selectionHeld',
      'departedToCapital',
      'arenaStarted',
      'arenaConcluded',
      'returnedHome',
    ]);
  });

  it('holds exactly one selection per year over several years', () => {
    const s = createNewGame({ seed: 'years' });
    for (let year = 1; year <= 3; year++) {
      runToSelection(s);
      expect(s.phase.kind === 'selection' && s.phase.edition).toBe(s.meta.firstEdition + year - 1);
      playCompetition(s);
    }
    expect(s.chronicle.filter((c) => c.kind === 'selectionHeld')).toHaveLength(3);
  });

  it('refuses commands in the wrong phase without mutating state', () => {
    const s = createNewGame({ seed: 'guard' });
    const before = hashState(s);
    const result = applyCommand(s, { type: 'arena/conclude' });
    expect(result.ok).toBe(false);
    expect(hashState(s)).toBe(before);
  });

  it('does not advance district time outside the district', () => {
    const s = createNewGame({ seed: 'frozen' });
    runToSelection(s);
    expect(() => advanceTick(s)).toThrow();
    expect(advanceTicks(s, 10)).toBe(0);
  });
});
