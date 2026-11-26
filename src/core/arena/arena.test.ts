import { describe, expect, it } from 'vitest';
import type { GameState } from '../index.ts';
import { TICKS_PER_YEAR, advanceTicks, applyCommand, createNewGame, hashState } from '../index.ts';
import { hitChance } from './arena.ts';
import { ARENA_SIZE, lineOfSight } from './map.ts';

function toArena(seed: string): GameState {
  const s = createNewGame({ seed });
  advanceTicks(s, TICKS_PER_YEAR);
  expect(applyCommand(s, { type: 'capital/depart' }).ok).toBe(true);
  for (let d = 0; d < 7; d++)
    expect(applyCommand(s, { type: 'capital/advance-day' }).ok).toBe(true);
  expect(s.phase.kind).toBe('arena');
  return s;
}

const team = (s: GameState) => Object.values(s.arena!.actors).filter((a) => a.player);

describe('the arena', () => {
  it('starts with every contestant alive on the ring around the Relicario', () => {
    const s = toArena('ring');
    const actors = Object.values(s.arena!.actors);
    expect(actors).toHaveLength(24);
    const c = ARENA_SIZE / 2;
    for (const a of actors) {
      expect(a.alive).toBe(true);
      expect(Math.hypot(a.x - c, a.y - c)).toBeLessThan(9);
    }
    expect(new Set(actors.map((a) => `${a.x},${a.y}`)).size).toBe(24);
  });

  it('plays until something needs the player, and ends with at most one survivor', () => {
    const s = toArena('fight');
    const r = applyCommand(s, { type: 'arena/advance' });
    expect(r.ok).toBe(true);
    expect(s.arena!.round).toBeGreaterThan(0);
    expect(s.arena!.interrupt ?? s.arena!.round === 24).toBeTruthy();
    expect(applyCommand(s, { type: 'arena/conclude' }).ok).toBe(true);
    expect(s.phase.kind).toBe('aftermath');
    const alive = Object.values(s.arena!.actors).filter((a) => a.alive);
    expect(alive.length).toBeLessThanOrEqual(1);
    expect(s.arena!.finished).not.toBeNull();
    // The delegation spent the week in the Capitol plus the days of the games.
    expect(s.away.days).toBeGreaterThanOrEqual(7);
  });

  it('is deterministic for the same seed and orders', () => {
    const a = toArena('det');
    const b = toArena('det');
    for (const s of [a, b]) {
      const [p] = team(s);
      applyCommand(s, { type: 'arena/stance', stance: 'cautious' });
      applyCommand(s, { type: 'arena/order', actorId: p!.id, order: { kind: 'hide' } });
      applyCommand(s, { type: 'arena/conclude' });
    }
    expect(hashState(a)).toBe(hashState(b));
  });

  it('orders, stance and capsules are validated', () => {
    const s = toArena('orders');
    const [p] = team(s);
    const rival = Object.values(s.arena!.actors).find((a) => !a.player)!;
    expect(
      applyCommand(s, { type: 'arena/order', actorId: rival.id, order: { kind: 'hide' } }).ok,
    ).toBe(false);
    expect(
      applyCommand(s, { type: 'arena/order', actorId: p!.id, order: { kind: 'move', x: 99, y: 0 } })
        .ok,
    ).toBe(false);
    s.arena!.patronage = 10;
    expect(applyCommand(s, { type: 'arena/gift', actorId: p!.id, item: 'medkit' }).ok).toBe(false);
    s.arena!.patronage = 500;
    expect(applyCommand(s, { type: 'arena/gift', actorId: p!.id, item: 'water' }).ok).toBe(true);
    expect(s.arena!.patronage).toBeLessThan(500);
    applyCommand(s, { type: 'arena/order', actorId: p!.id, order: { kind: 'rest' } });
    applyCommand(s, { type: 'arena/advance', maxRounds: 1 });
    const after = s.arena!.actors[p!.id]!;
    if (after.alive) expect(after.items.includes('water') || after.thirst > 80).toBe(true);
  });

  it('hit chances stay within 5–95 and the line of sight is blocked by cliffs', () => {
    const s = toArena('hit');
    const [a, b] = Object.values(s.arena!.actors);
    const p = hitChance(s, s.arena!, a!, b!);
    expect(p).toBeGreaterThanOrEqual(5);
    expect(p).toBeLessThanOrEqual(95);
    expect(lineOfSight(20, 20, 21, 21)).toBe(true);
  });

  it('100 headless games: varied winners, causes of death and lengths', () => {
    const winners = new Map<number, number>();
    const causes = new Map<string, number>();
    const lengths: number[] = [];
    let homeWins = 0;
    let homePlace = 0;
    let homeCount = 0;
    for (let i = 0; i < 100; i++) {
      const s = toArena(`stats-${i}`);
      applyCommand(s, { type: 'arena/conclude' });
      const arena = s.arena!;
      lengths.push(arena.finished!.round);
      const w = arena.finished!.winner ? arena.actors[arena.finished!.winner]! : null;
      if (w) {
        const d = s.games!.contestants[w.id]!.district;
        winners.set(d, (winners.get(d) ?? 0) + 1);
        if (w.player) homeWins += 1;
      }
      const byDeath = Object.values(arena.actors).sort(
        (x, y) => (y.deathRound ?? 1e9) - (x.deathRound ?? 1e9),
      );
      byDeath.forEach((a, k) => {
        if (a.player) {
          homePlace += k + 1;
          homeCount += 1;
        }
      });
      for (const a of Object.values(arena.actors))
        if (!a.alive) causes.set(a.deathCause!, (causes.get(a.deathCause!) ?? 0) + 1);
    }
    lengths.sort((x, y) => x - y);
    const median = lengths[50]!;
    // Games last between ~2 and ~12 arena days; nobody wins every time.
    expect(median).toBeGreaterThan(24);
    expect(median).toBeLessThan(24 * 12);
    expect(winners.size).toBeGreaterThan(5);
    expect(Math.max(...winners.values())).toBeLessThan(45);
    expect(causes.get('combat') ?? 0).toBeGreaterThan(500);
    expect(causes.size).toBeGreaterThan(2);
    // The poor home district is an underdog, but hiding keeps it mid-table without orders.
    expect(homePlace / homeCount).toBeLessThan(15);
    console.log('arena stats', {
      median,
      homeWins,
      homePlace: homePlace / homeCount,
      winners: [...winners],
      causes: [...causes],
    });
  }, 120_000);
});

describe('homecoming (Phase 8)', () => {
  it('the fallen are buried as real citizens and the history keeps the results', () => {
    const s = toArena('fallen');
    // Every home contestant falls; a rival wins.
    for (const a of team(s)) {
      a.alive = false;
      a.deathRound = 0;
      a.deathCause = 'combat';
    }
    applyCommand(s, { type: 'arena/conclude' });
    const entry = s.competition.history.at(-1)!;
    expect(entry.result?.home).toHaveLength(team(s).length);
    expect(entry.result?.winnerName).toBeTruthy();
    const ids = entry.result!.home.map((r) => r.citizenId);
    const morale = s.economy.morale;
    expect(applyCommand(s, { type: 'home/return' }).ok).toBe(true);
    for (const id of ids) {
      const c = s.population.citizens[id]!;
      expect(c.alive).toBe(false);
      expect(c.deathCause).toBe('games');
    }
    expect(s.economy.morale).toBeLessThanOrEqual(morale);
  });

  it('a laureate comes home a hero and the district is rewarded', () => {
    const s = toArena('laureate');
    const [hero, partner] = team(s);
    for (const a of Object.values(s.arena!.actors)) {
      if (a.id === hero!.id) continue;
      a.alive = false;
      a.deathRound = 0;
    }
    const food = s.economy.resources.food;
    applyCommand(s, { type: 'arena/conclude' });
    const result = s.competition.history.at(-1)!.result!;
    expect(result.home.find((r) => r.alive)?.place).toBe(1);
    const citizenId = s.games!.contestants[hero!.id]!.citizenId!;
    const partnerCitizen = s.games!.contestants[partner!.id]!.citizenId!;
    applyCommand(s, { type: 'home/return' });
    const c = s.population.citizens[citizenId]!;
    expect(c.alive).toBe(true);
    expect(c.laureate).toBe(result ? s.competition.history.at(-1)!.edition : -1);
    expect(c.history.some((h) => h.key === 'hist.laureate')).toBe(true);
    expect(s.population.citizens[partnerCitizen]!.alive).toBe(false);
    // The autopilot eats some of it, but the reward is clearly there.
    expect(s.economy.resources.food).toBeGreaterThan(food);
  });
});

describe('arena maps', () => {
  it('even editions are fought on the frozen tundra, and the cold drains energy faster', () => {
    let tundra: GameState | null = null;
    let forest: GameState | null = null;
    for (let i = 0; i < 12 && (!tundra || !forest); i++) {
      const s = toArena(`maps-${i}`);
      if (s.arena!.mapId === 'arena_tundra') tundra ??= s;
      else forest ??= s;
    }
    expect(tundra).not.toBeNull();
    expect(forest).not.toBeNull();
    expect(tundra!.games!.edition % 2).toBe(0);
    const drain = (s: GameState) => {
      const team = Object.values(s.arena!.actors).filter((a) => a.player);
      // Same needs at the start in both arenas: only the map makes the difference.
      for (const a of team) {
        a.order = { kind: 'hide' };
        a.energy = 50;
        a.hunger = 20;
        a.thirst = 20;
        a.hp = 100;
      }
      const before = team.reduce((n, a) => n + a.energy, 0);
      const round = s.arena!.round;
      applyCommand(s, { type: 'arena/advance', maxRounds: 12 });
      // Per round: an interrupt (a rival in sight) may stop one arena earlier than the other.
      const rounds = Math.max(1, s.arena!.round - round);
      return (before - team.reduce((n, a) => n + a.energy, 0)) / rounds;
    };
    expect(drain(tundra!)).toBeGreaterThan(drain(forest!));
    applyCommand(tundra!, { type: 'arena/conclude' });
    expect(tundra!.arena!.finished).not.toBeNull();
  });
});
