import { describe, expect, it } from 'vitest';
import type { GameState } from '../index.ts';
import { TICKS_PER_YEAR, advanceTicks, applyCommand, createNewGame, hashState } from '../index.ts';

function toCapital(seed: string): GameState {
  const s = createNewGame({ seed });
  advanceTicks(s, TICKS_PER_YEAR);
  expect(applyCommand(s, { type: 'capital/depart' }).ok).toBe(true);
  return s;
}

const players = (s: GameState) => Object.values(s.games!.contestants).filter((c) => c.player);
const nextDay = (s: GameState) =>
  expect(applyCommand(s, { type: 'capital/advance-day' }).ok).toBe(true);

describe('the capital', () => {
  it('gathers 24 contestants: the real chosen citizens and 22 rivals from 11 districts', () => {
    const s = toCapital('cap');
    const all = Object.values(s.games!.contestants);
    expect(all).toHaveLength(24);
    expect(new Set(all.map((c) => c.district)).size).toBe(12);
    for (const p of players(s)) {
      const citizen = s.population.citizens[p.citizenId!]!;
      expect(s.competition.current!.participants).toContain(citizen.id);
      expect(p.skills).toEqual(citizen.skills);
    }
    // Rivals from the academies are better trained than the miners' children.
    const academy = all.filter((c) => c.district === 2);
    const poor = all.filter((c) => c.district === 11);
    const avg = (xs: typeof all) => xs.reduce((n, c) => n + c.skills.combat, 0) / xs.length;
    expect(avg(academy)).toBeGreaterThan(avg(poor));
  });

  it('a week of decisions changes skills, popularity, the evaluation and the patronage', () => {
    const s = toCapital('week');
    const [p] = players(s);
    const id = p!.id;
    expect(
      applyCommand(s, {
        type: 'capital/choose',
        contestantId: id,
        choice: 'posture',
        value: 'friendly',
      }).ok,
    ).toBe(true);
    nextDay(s);
    const credits = s.economy.resources.credits;
    expect(
      applyCommand(s, {
        type: 'capital/choose',
        contestantId: id,
        choice: 'outfit',
        value: 'identity',
        budget: 40,
      }).ok,
    ).toBe(true);
    expect(s.economy.resources.credits).toBe(credits - 40);
    nextDay(s);
    const combat = s.games!.contestants[id]!.skills.combat;
    for (let d = 3; d <= 5; d++) {
      expect(
        applyCommand(s, {
          type: 'capital/choose',
          contestantId: id,
          choice: 'training',
          value: 'combat',
        }).ok,
      ).toBe(true);
      if (d === 5)
        applyCommand(s, {
          type: 'capital/choose',
          contestantId: id,
          choice: 'hidden',
          value: 'yes',
        });
      nextDay(s);
    }
    const t = s.games!.contestants[id]!;
    expect(t.skills.combat).toBeGreaterThan(combat);
    expect(t.score).not.toBeNull();
    expect(t.shownScore!).toBeLessThan(t.score!);
    const attention = s.economy.attention;
    applyCommand(s, {
      type: 'capital/choose',
      contestantId: id,
      choice: 'interview',
      value: 'defiant',
    });
    nextDay(s);
    expect(s.economy.attention).toBeGreaterThan(attention);
    applyCommand(s, { type: 'capital/choose', contestantId: id, choice: 'plan', value: 'flee' });
    nextDay(s);
    expect(s.phase.kind).toBe('arena');
    expect(s.games!.patronage).toBeGreaterThan(0);
    expect(s.games!.log.length).toBeGreaterThan(5);
  });

  it('rejects choices on the wrong day, unknown options and unaffordable outfits', () => {
    const s = toCapital('guard');
    const id = players(s)[0]!.id;
    expect(
      applyCommand(s, {
        type: 'capital/choose',
        contestantId: id,
        choice: 'interview',
        value: 'humble',
      }).ok,
    ).toBe(false);
    expect(
      applyCommand(s, {
        type: 'capital/choose',
        contestantId: id,
        choice: 'posture',
        value: 'dance',
      }).ok,
    ).toBe(false);
    nextDay(s);
    expect(
      applyCommand(s, {
        type: 'capital/choose',
        contestantId: id,
        choice: 'outfit',
        value: 'bold',
        budget: 99999,
      }).ok,
    ).toBe(false);
    const rival = Object.values(s.games!.contestants).find((c) => !c.player)!;
    expect(
      applyCommand(s, {
        type: 'capital/choose',
        contestantId: rival.id,
        choice: 'outfit',
        value: 'bold',
      }).ok,
    ).toBe(false);
  });

  it('is deterministic', () => {
    const run = () => {
      const s = toCapital('det');
      for (let d = 0; d < 7; d++) applyCommand(s, { type: 'capital/advance-day' });
      return hashState(s);
    };
    expect(run()).toBe(run());
  });
});
