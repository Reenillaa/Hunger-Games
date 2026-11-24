import type { SimContext } from '../events.ts';
import { killCitizen, note } from '../population/simulate.ts';
import type { GameState } from '../state/gameState.ts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How one home contestant fared (kept in the competition history). */
export interface HomeResult {
  citizenId: string;
  name: string;
  /** 1 = winner; 24 = first to fall. */
  place: number;
  kills: number;
  alive: boolean;
  cause: string | null;
  killer: string | null;
}

export interface GamesResult {
  winnerName: string | null;
  winnerDistrict: number | null;
  rounds: number;
  home: HomeResult[];
}

/** Ranks every contestant by survival and records the home district's results. */
export function recordResults(state: GameState): GamesResult | null {
  const arena = state.arena;
  const games = state.games;
  if (!arena?.finished || !games) return null;
  const ranked = Object.values(arena.actors).sort(
    (a, b) =>
      (b.alive ? 1e9 : (b.deathRound ?? 0)) - (a.alive ? 1e9 : (a.deathRound ?? 0)) ||
      b.kills - a.kills ||
      (a.id < b.id ? -1 : 1),
  );
  const winner = arena.finished.winner ? games.contestants[arena.finished.winner] : null;
  const home: HomeResult[] = [];
  ranked.forEach((a, i) => {
    const c = games.contestants[a.id]!;
    if (!c.player || !c.citizenId) return;
    home.push({
      citizenId: c.citizenId,
      name: c.name,
      place: i + 1,
      kills: a.kills,
      alive: a.alive,
      cause: a.alive ? null : (a.deathCause ?? 'combat'),
      killer: a.killedBy ? (games.contestants[a.killedBy]?.name ?? null) : null,
    });
  });
  const result: GamesResult = {
    winnerName: winner?.name ?? null,
    winnerDistrict: winner?.district ?? null,
    rounds: arena.finished.round,
    home,
  };
  const entry = state.competition.history.find((h) => h.edition === games.edition);
  if (entry) entry.result = result;
  return result;
}

/** Rewards of a laureate's district (GAME_SYSTEMS §11): a year of plenty and pride. */
export const LAUREATE_REWARD = { food: 400, credits: 250, morale: 25 };

/**
 * Applied when the delegation comes home: the fallen are buried (grief spreads through real
 * families), the laureate returns a hero, and the district's morale and the regime react.
 */
export function applyHomecoming(state: GameState, ctx: SimContext): void {
  const entry = state.competition.history.find((h) => h.edition === state.games?.edition);
  const result = entry?.result;
  if (!result) return;
  const day = Math.floor(state.clock.tick / 24);
  const e = state.economy;
  for (const r of result.home) {
    const c = state.population.citizens[r.citizenId];
    if (!c?.alive) continue;
    if (r.alive) {
      c.laureate = entry!.edition;
      note(c, day, 'hist.laureate', { edition: String(entry!.edition) });
      c.mood = clamp(c.mood - 20, 0, 100); // they won, but they saw too much
      c.moodModifiers.push({ key: 'arenaTrauma', value: -15, untilDay: day + 120 });
      for (const relId of [c.motherId, c.fatherId, c.partnerId, ...c.childrenIds]) {
        const rel = relId ? state.population.citizens[relId] : null;
        if (rel?.alive)
          rel.moodModifiers.push({ key: 'laureateHome', value: 25, untilDay: day + 60 });
      }
    } else {
      killCitizen(state, c, 'games', ctx);
    }
  }
  const won = result.home.some((r) => r.alive);
  if (won) {
    e.resources.food += LAUREATE_REWARD.food;
    e.resources.credits += LAUREATE_REWARD.credits;
    e.morale = clamp(e.morale + LAUREATE_REWARD.morale, 0, 100);
    for (const c of Object.values(state.population.citizens))
      if (c.alive) c.moodModifiers.push({ key: 'victory', value: 10, untilDay: day + 30 });
  } else {
    e.morale = clamp(e.morale - 8 * result.home.length, 0, 100);
    // Brave deaths on screen stir quiet anger; the regime notices.
    const kills = result.home.reduce((n, r) => n + r.kills, 0);
    if (kills > 0) e.attention = clamp(e.attention + 3 * kills, 0, 100);
  }
  ctx.emit({
    type: 'games/homecoming',
    edition: entry!.edition,
    laureate: result.home.find((r) => r.alive)?.citizenId ?? null,
    fallen: result.home.filter((r) => !r.alive).map((r) => r.citizenId),
  });
}
