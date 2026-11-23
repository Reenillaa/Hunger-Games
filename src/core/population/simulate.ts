import { BUILDINGS } from '../../content/buildings.ts';
import type { TraitId } from '../../content/traits.ts';
import { AFFINITY, TRAITS } from '../../content/traits.ts';
import type { PlacedStructure } from '../district/generate.ts';
import type { StructureKind } from '../district/template.ts';
import type { SimContext } from '../events.ts';
import { nextFloat, nextInt, pick } from '../rng/rng.ts';
import type { GameState } from '../state/gameState.ts';
import { nextId } from '../state/gameState.ts';
import type { CalendarDate } from '../time/calendar.ts';
import { createCitizen, couple } from './generate.ts';
import type { Citizen, SkillId } from './types.ts';
import { ADULT_AGE, ELDER_AGE, ageOf, fullName, livingCitizens } from './types.ts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MAX_RELATIONS = 12;
const MAX_HISTORY = 40;

/** Skill trained by each workplace (and used for its productivity). */
export const JOB_SKILL: Partial<Record<StructureKind, SkillId>> = {
  mine_headframe: 'mining',
  quarry: 'mining',
  lumber_camp: 'survival',
  garden: 'farming',
  warehouse: 'crafting',
  economato: 'social',
  infirmary: 'medicine',
  school: 'teaching',
  town_hall: 'social',
};

export function note(c: Citizen, day: number, key: string, vars?: Record<string, string>): void {
  c.history.push(vars ? { day, key, vars } : { day, key });
  if (c.history.length > MAX_HISTORY) c.history.splice(0, c.history.length - MAX_HISTORY);
}

export function canWork(c: Citizen, day: number): boolean {
  const age = ageOf(c, day);
  return c.alive && age >= ADULT_AGE && age < ELDER_AGE && c.health > 25;
}

/**
 * Assigns individual citizens to workplaces: construction sites first, then production, then
 * services; within a workplace the most skilled free workers are chosen. Deterministic.
 */
export function assignJobs(
  state: GameState,
  maxWorkersOf: (s: PlacedStructure) => number,
  order: (s: PlacedStructure) => number,
): void {
  const day = Math.floor(state.clock.tick / 24);
  const pool = livingCitizens(state.population)
    .filter((c) => canWork(c, day))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const free = new Set(pool.map((c) => c.id));
  for (const c of livingCitizens(state.population)) {
    if (!free.has(c.id)) c.jobId = null;
  }
  const sorted = [...state.district.structures].sort(
    (a, b) => order(a) - order(b) || (a.id < b.id ? -1 : 1),
  );
  for (const s of sorted) {
    const want = maxWorkersOf(s);
    const skill: SkillId = !s.built ? 'construction' : (JOB_SKILL[s.kind] ?? 'crafting');
    const candidates = pool
      .filter((c) => free.has(c.id))
      .sort((a, b) => b.skills[skill] - a.skills[skill] || (a.id < b.id ? -1 : 1));
    const chosen = candidates.slice(0, want);
    for (const c of chosen) {
      if (c.jobId !== s.id) {
        if (c.jobId === null && c.history.at(-1)?.key !== 'hist.job')
          note(c, day, 'hist.job', { job: s.kind });
        c.jobId = s.id;
      }
      free.delete(c.id);
    }
    s.workers = chosen.length;
    const avg =
      chosen.length > 0 ? chosen.reduce((n, c) => n + c.skills[skill], 0) / chosen.length : 0;
    s.efficiency = Math.round((0.6 + avg / 20) * 100) / 100;
  }
  for (const id of free) {
    const c = state.population.citizens[id];
    if (c) c.jobId = null;
  }
}

/** Keeps the abstract counts used by the economy in step with the real citizens. */
export function syncCounts(state: GameState): void {
  const day = Math.floor(state.clock.tick / 24);
  let adults = 0;
  let children = 0;
  for (const c of livingCitizens(state.population)) {
    if (ageOf(c, day) >= ADULT_AGE) adults += 1;
    else children += 1;
  }
  state.economy.population = { adults, children };
}

function traitMood(c: Citizen): number {
  return c.traits.reduce((n, t) => n + TRAITS[t].mood, 0);
}

function affinity(a: Citizen, b: Citizen): number {
  let score = 0;
  for (const [x, y, v] of AFFINITY) {
    if (
      (a.traits.includes(x) && b.traits.includes(y)) ||
      (a.traits.includes(y) && b.traits.includes(x))
    )
      score += v;
  }
  return score + (TRAITS[a.traits[0] as TraitId]?.social ?? 0) * 0.3;
}

function relate(a: Citizen, b: Citizen, delta: number): void {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    const r = x.relations[y.id] ?? { opinion: 0 };
    r.opinion = clamp(r.opinion + delta, -100, 100);
    x.relations[y.id] = r;
    const keys = Object.keys(x.relations);
    if (keys.length > MAX_RELATIONS) {
      // Forget the most indifferent acquaintance.
      keys.sort(
        (k1, k2) => Math.abs(x.relations[k1]!.opinion) - Math.abs(x.relations[k2]!.opinion),
      );
      delete x.relations[keys[0]!];
    }
  }
}

function familyOf(state: GameState, c: Citizen): Citizen[] {
  const ids = new Set<string>([...c.childrenIds]);
  if (c.motherId) ids.add(c.motherId);
  if (c.fatherId) ids.add(c.fatherId);
  if (c.partnerId) ids.add(c.partnerId);
  for (const pid of [c.motherId, c.fatherId]) {
    const p = pid ? state.population.citizens[pid] : null;
    for (const sib of p?.childrenIds ?? []) if (sib !== c.id) ids.add(sib);
  }
  return [...ids]
    .map((id) => state.population.citizens[id])
    .filter((x): x is Citizen => !!x && x.alive);
}

export function killCitizen(
  state: GameState,
  c: Citizen,
  cause: NonNullable<Citizen['deathCause']>,
  ctx: SimContext,
): void {
  const day = Math.floor(state.clock.tick / 24);
  c.alive = false;
  c.deathDay = day;
  c.deathCause = cause;
  c.jobId = null;
  note(c, day, 'hist.died', { cause });
  // Grief: family and close friends.
  for (const f of familyOf(state, c)) {
    f.moodModifiers.push({ key: 'grief', value: -25, untilDay: day + 30 });
    note(f, day, 'hist.lost', { name: fullName(c) });
  }
  for (const [id, r] of Object.entries(c.relations)) {
    const friend = state.population.citizens[id];
    if (friend?.alive && r.opinion > 40)
      friend.moodModifiers.push({ key: 'grief', value: -12, untilDay: day + 15 });
  }
  if (c.partnerId) {
    const p = state.population.citizens[c.partnerId];
    if (p) p.partnerId = null;
  }
  c.homeId = null;
  ctx.emit({ type: 'citizen/died', id: c.id, name: fullName(c), cause });
}

/** Daily: health, mood, learning, sampled social interactions. */
export function populationDay(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const rng = state.rng.population;
  const day = date.absoluteDay;
  const e = state.economy;
  const living = livingCitizens(state.population);
  const infirmaryCare = state.district.structures
    .filter((s) => s.kind === 'infirmary' && s.built)
    .reduce((n, s) => n + s.workers, 0);
  const schoolCare = state.district.structures
    .filter((s) => s.kind === 'school' && s.built)
    .reduce((n, s) => n + s.workers, 0);
  const byHome = new Map<string, Citizen[]>();
  const byJob = new Map<string, Citizen[]>();
  for (const c of living) {
    if (c.homeId) byHome.set(c.homeId, [...(byHome.get(c.homeId) ?? []), c]);
    if (c.jobId) byJob.set(c.jobId, [...(byJob.get(c.jobId) ?? []), c]);
  }
  for (const c of living) {
    const age = ageOf(c, day);
    // Health: hunger hurts, care heals, old age wears.
    const frail = age >= ELDER_AGE || age < 4 ? 1.5 : 1;
    let dh =
      e.shortage > 0.02
        ? -(0.4 + 3.5 * e.shortage) * frail * (1.25 - c.attributes.endurance / 20)
        : 0.4;
    if (infirmaryCare > 0) dh += 0.6;
    if (age > ELDER_AGE) dh -= 0.15;
    c.health = clamp(c.health + dh, 0, 100);
    // Mood: towards a target set by living conditions, personality and recent events.
    c.moodModifiers = c.moodModifiers.filter((m) => m.untilDay > day);
    const homeCrowd = c.homeId ? (byHome.get(c.homeId)?.length ?? 0) : 0;
    const home = state.district.structures.find((s) => s.id === c.homeId);
    const capacity = home ? (BUILDINGS[home.kind].housing?.[home.level - 1] ?? 4) : 0;
    const target =
      45 +
      (e.morale - 50) * 0.4 +
      traitMood(c) +
      c.moodModifiers.reduce((n, m) => n + m.value, 0) -
      (homeCrowd > capacity ? 10 : 0) -
      (c.health < 40 ? 15 : 0);
    c.mood = clamp(c.mood + (target - c.mood) * 0.15, 0, 100);
    // Learning by doing; school for the young.
    if (c.jobId) {
      const job = state.district.structures.find((s) => s.id === c.jobId);
      const skill: SkillId =
        job && !job.built ? 'construction' : ((job && JOB_SKILL[job.kind]) ?? 'crafting');
      c.skills[skill] = Math.min(20, c.skills[skill] + 0.04 + c.attributes.intellect * 0.004);
    } else if (age >= 6 && age < ADULT_AGE && schoolCare > 0) {
      c.attributes.intellect = Math.min(10, c.attributes.intellect + 0.004);
      c.skills.social = Math.min(20, c.skills.social + 0.02);
    }
    // Social life: one or two sampled encounters at home, at work or anywhere in town.
    const encounters = c.traits.includes('sociable') ? 2 : 1;
    for (let k = 0; k < encounters; k++) {
      const roll = nextFloat(rng);
      const pool =
        roll < 0.4 && c.jobId
          ? byJob.get(c.jobId)
          : roll < 0.7 && c.homeId
            ? byHome.get(c.homeId)
            : living;
      const other = pool && pool.length > 1 ? pick(rng, pool) : null;
      if (!other || other.id === c.id) continue;
      const delta = affinity(c, other) + (nextFloat(rng) - 0.45) * 6 + (c.mood - 50) * 0.04;
      relate(c, other, delta);
    }
    if (c.health <= 0) killCitizen(state, c, e.hungerDays > 0 ? 'hunger' : 'illness', ctx);
  }
}

/** Seasonal: couples form, children are born. */
export function populationSeason(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const rng = state.rng.population;
  const day = date.absoluteDay;
  const living = livingCitizens(state.population);
  // Couples: mutual high opinion between single adults of different sex.
  for (const c of living) {
    if (c.partnerId || ageOf(c, day) < 18 || ageOf(c, day) > 55) continue;
    const match = Object.entries(c.relations)
      .filter(([, r]) => r.opinion > 45)
      .map(([id]) => state.population.citizens[id])
      .find(
        (o) =>
          o &&
          o.alive &&
          !o.partnerId &&
          o.sex !== c.sex &&
          ageOf(o, day) >= 18 &&
          ageOf(o, day) <= 55 &&
          (o.relations[c.id]?.opinion ?? 0) > 45 &&
          o.motherId !== c.motherId,
      );
    if (match && nextFloat(rng) < 0.5) {
      couple(c, match);
      note(c, day, 'hist.coupled', { name: fullName(match) });
      note(match, day, 'hist.coupled', { name: fullName(c) });
      c.moodModifiers.push({ key: 'love', value: 12, untilDay: day + 20 });
      match.moodModifiers.push({ key: 'love', value: 12, untilDay: day + 20 });
      // The woman moves in with her partner if there is room (simple rule, revisited later).
      const mover = c.sex === 'F' ? c : match;
      const stayer = mover === c ? match : c;
      if (stayer.homeId && mover.homeId !== stayer.homeId) {
        mover.homeId = stayer.homeId;
        note(mover, day, 'hist.moved', { name: fullName(stayer) });
      }
      ctx.emit({ type: 'citizen/coupled', a: fullName(c), b: fullName(match) });
    }
  }
  // Births: depend on age, health, food and room at home.
  const occupancy = new Map<string, number>();
  for (const c of living) if (c.homeId) occupancy.set(c.homeId, (occupancy.get(c.homeId) ?? 0) + 1);
  for (const mother of living) {
    if (mother.sex !== 'F' || !mother.partnerId || !mother.homeId) continue;
    const age = ageOf(mother, day);
    if (age < 18 || age > 42 || mother.health < 50) continue;
    const father = state.population.citizens[mother.partnerId];
    if (!father?.alive) continue;
    const home = state.district.structures.find((s) => s.id === mother.homeId);
    const capacity = home ? (BUILDINGS[home.kind].housing?.[home.level - 1] ?? 4) : 0;
    const crowded = (occupancy.get(mother.homeId) ?? 0) >= capacity + 1;
    const chance =
      0.12 *
      (state.economy.hungerDays > 0 ? 0.3 : 1) *
      (crowded ? 0.25 : 1) *
      (mother.childrenIds.length > 4 ? 0.3 : 1);
    if (nextFloat(rng) >= chance) continue;
    const child = createCitizen(
      { rng, today: day, citizens: state.population.citizens, nextId: () => nextId(state, 'c') },
      {
        sex: nextFloat(rng) < 0.5 ? 'F' : 'M',
        age: 0,
        lastNames: [father.lastNames[0], mother.lastNames[0]],
        mother,
        father,
        homeId: mother.homeId,
      },
    );
    child.birthDay = day;
    child.skills = Object.fromEntries(
      Object.keys(child.skills).map((k) => [k, 0]),
    ) as Citizen['skills'];
    note(child, day, 'hist.born');
    note(mother, day, 'hist.child', { name: child.firstName });
    note(father, day, 'hist.child', { name: child.firstName });
    for (const p of [mother, father])
      p.moodModifiers.push({ key: 'birth', value: 15, untilDay: day + 15 });
    occupancy.set(mother.homeId, (occupancy.get(mother.homeId) ?? 0) + 1);
    ctx.emit({ type: 'citizen/born', id: child.id, name: fullName(child) });
  }
}

/** Yearly: mortality by age (a Gompertz-like curve), rare accidents for miners. */
export function populationYear(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const rng = state.rng.population;
  for (const c of livingCitizens(state.population)) {
    const age = ageOf(c, date.absoluteDay);
    const risk = 0.0008 * Math.exp(0.085 * age) * (c.health < 40 ? 2 : 1);
    if (nextFloat(rng) < Math.min(0.6, risk)) {
      killCitizen(state, c, age > 60 ? 'age' : 'illness', ctx);
      continue;
    }
    const job = c.jobId ? state.district.structures.find((s) => s.id === c.jobId) : null;
    if (job?.kind === 'mine_headframe' && nextInt(rng, 0, 999) < 6)
      killCitizen(state, c, 'accident', ctx);
  }
}
