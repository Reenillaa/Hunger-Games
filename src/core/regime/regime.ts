import type { DistrictEventDef, EventEffects } from '../../content/districtEvents.ts';
import { DISTRICT_EVENTS } from '../../content/districtEvents.ts';
import {
  CALAMITIES,
  CALAMITY_BASE_CHANCE,
  CALAMITY_FULLNESS_CHANCE,
  SPOIL_RATE,
  SPOIL_THRESHOLD,
} from '../../content/calamities.ts';
import { homeProfile } from '../../content/homeDistricts.ts';
import type { ResourceId } from '../district/template.ts';
import { storageCapacity } from '../economy/economy.ts';
import type { SimContext } from '../events.ts';
import type { Citizen } from '../population/types.ts';
import { ageOf, livingCitizens } from '../population/types.ts';
import { killCitizen } from '../population/simulate.ts';
import type { RngState } from '../rng/rng.ts';
import { nextFloat, pick } from '../rng/rng.ts';
import type { GameState } from '../state/gameState.ts';
import type { CalendarDate } from '../time/calendar.ts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type DecreeId = 'curfew' | 'garrison';

/** The regime's grip on the district (Phase 9): events, decrees, reprisals and unrest. */
export interface RegimeState {
  /** Event waiting for the player's decision. */
  pending: { eventId: string; day: number } | null;
  decrees: { id: DecreeId; untilDay: number }[];
  /** 0–100: how close the district is to rising up. */
  unrest: number;
  lastEventDay: number;
  /** What happened and what was decided (localisation keys). */
  log: { day: number; key: string; vars?: Record<string, string> }[];
}

export function createRegime(): RegimeState {
  return { pending: null, decrees: [], unrest: 0, lastEventDay: 0, log: [] };
}

export function hasDecree(state: GameState, id: DecreeId): boolean {
  return state.regime.decrees.some((d) => d.id === id);
}

/** Production multiplier from the regime's decrees (a curfew costs working hours). */
export function decreeFactor(state: GameState): number {
  return hasDecree(state, 'curfew') ? 0.85 : 1;
}

function eligible(state: GameState, ev: DistrictEventDef): boolean {
  const w = ev.when;
  if (!w) return true;
  const e = state.economy;
  if (w.minAttention !== undefined && e.attention < w.minAttention) return false;
  if (w.maxMorale !== undefined && e.morale > w.maxMorale) return false;
  if (w.minUnrest !== undefined && state.regime.unrest < w.minUnrest) return false;
  if (w.districts && !w.districts.includes(state.meta.homeDistrictId)) return false;
  if (w.needsLaureate && !livingCitizens(state.population).some((c) => c.laureate !== undefined))
    return false;
  return true;
}

function randomAdult(state: GameState, rng: RngState): Citizen | null {
  const day = Math.floor(state.clock.tick / 24);
  const adults = livingCitizens(state.population).filter((c) => ageOf(c, day) >= 18);
  return adults.length > 0 ? pick(rng, adults) : null;
}

function log(state: GameState, key: string, vars?: Record<string, string>): void {
  const day = Math.floor(state.clock.tick / 24);
  state.regime.log.push({ day, key, ...(vars ? { vars } : {}) });
  if (state.regime.log.length > 60) state.regime.log.splice(0, state.regime.log.length - 60);
}

/** Applies an event option's effects (resources never go below zero). */
export function applyEffects(state: GameState, fx: EventEffects, ctx: SimContext): void {
  const rng = state.rng.regime;
  const e = state.economy;
  const r = e.resources;
  if (fx.food) r.food = Math.max(0, r.food + fx.food);
  if (fx.coal) r.coal = Math.max(0, r.coal + fx.coal);
  if (fx.wood) r.wood = Math.max(0, r.wood + fx.wood);
  if (fx.credits) r.credits = Math.max(0, r.credits + fx.credits);
  if (fx.morale) e.morale = clamp(e.morale + fx.morale, 0, 100);
  if (fx.attention) e.attention = clamp(e.attention + fx.attention, 0, 100);
  if (fx.unrest) state.regime.unrest = clamp(state.regime.unrest + fx.unrest, 0, 100);
  if (fx.mood) {
    const day = Math.floor(state.clock.tick / 24);
    for (const c of livingCitizens(state.population))
      c.moodModifiers.push({ key: 'event', value: fx.mood * 3, untilDay: day + 10 });
  }
  if (fx.death) {
    const victim = randomAdult(state, rng);
    if (victim) {
      killCitizen(state, victim, fx.death === 'regime' ? 'regime' : fx.death, ctx);
      log(state, `reg.death.${fx.death}`, { name: `${victim.firstName} ${victim.lastNames[0]}` });
    }
  }
  if (fx.chance)
    applyEffects(state, nextFloat(rng) < fx.chance.p ? fx.chance.then : fx.chance.else, ctx);
}

/** The player (or the autopilot) answers the pending event. */
export function resolveEvent(state: GameState, optionIndex: number, ctx: SimContext): void {
  const pending = state.regime.pending;
  if (!pending) return;
  const ev = DISTRICT_EVENTS.find((d) => d.id === pending.eventId);
  state.regime.pending = null;
  if (!ev) return;
  const option = ev.options[optionIndex] ?? ev.options[0]!;
  applyEffects(state, option.effects, ctx);
  log(state, `ev.${ev.id}.${option.id}.done`);
  ctx.emit({ type: 'regime/event-resolved', eventId: ev.id, option: option.id });
}

/**
 * Daily wear on the stores: food and wood spoil above 60 % of the capacity, and now and then a
 * mishap (rats, thieves, fire, the Capitol's requisition...) takes a share of what is kept.
 */
export function mishapDay(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const e = state.economy;
  const r = e.resources;
  const cap = storageCapacity(state);
  for (const res of ['food', 'wood'] as const) {
    const excess = r[res] - cap * SPOIL_THRESHOLD;
    if (excess > 0) r[res] = Math.max(0, r[res] - Math.ceil(excess * SPOIL_RATE[res]));
  }
  // Mishaps only strike while the district is being governed (not during the Games' journey).
  if (state.phase.kind !== 'district') return;
  const rng = state.rng.regime;
  const fill = Math.max(...(['food', 'wood', 'stone', 'coal'] as const).map((k) => r[k] / cap));
  if (nextFloat(rng) >= CALAMITY_BASE_CHANCE + CALAMITY_FULLNESS_CHANCE * Math.min(1, fill)) return;
  const home = state.meta.homeDistrictId;
  const pool = CALAMITIES.filter(
    (c) =>
      (!c.seasons || c.seasons.includes(date.season)) &&
      (!c.districts || c.districts.includes(home)),
  );
  const total = pool.reduce((n, c) => n + c.weight, 0);
  let roll = nextFloat(rng) * total;
  const def = pool.find((c) => (roll -= c.weight) < 0) ?? pool[0];
  if (!def) return;
  const lost: Partial<Record<ResourceId, number>> = {};
  for (const [key, share] of Object.entries(def.losses)) {
    const res: ResourceId = key === 'heating' ? homeProfile(home).heating : (key as ResourceId);
    const n = Math.floor(r[res] * share);
    if (n <= 0) continue;
    r[res] -= n;
    lost[res] = (lost[res] ?? 0) + n;
  }
  if (Object.keys(lost).length === 0) return;
  if (def.morale) e.morale = clamp(e.morale + def.morale, 0, 100);
  log(state, `cal.${def.id}.log`);
  ctx.emit({ type: 'regime/calamity', id: def.id, lost });
}

/**
 * Daily: decrees expire, the regime reacts to attention (curfews, reprisals), unrest builds up
 * with hunger and fear, and now and then a new dilemma reaches the district.
 */
export function regimeDay(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const g = state.regime;
  const e = state.economy;
  const rng = state.rng.regime;
  const day = date.absoluteDay;
  g.decrees = g.decrees.filter((d) => d.untilDay > day);
  mishapDay(state, date, ctx);
  // Unanswered dilemmas resolve themselves the cautious way after two days (or at once unattended).
  if (g.pending && (ctx.autopilot || day - g.pending.day >= 2)) resolveEvent(state, 0, ctx);

  // Unrest: hunger and low morale feed it; a calm, fed district cools down.
  g.unrest = clamp(g.unrest + (e.morale < 30 ? 1.2 : -0.4) + e.shortage * 2, 0, 100);
  e.attention = clamp(e.attention + (g.unrest > 60 ? 0.8 : -0.25), 0, 100);

  if (e.attention >= 60 && !hasDecree(state, 'curfew')) {
    g.decrees.push({ id: 'curfew', untilDay: day + 10 });
    e.morale = clamp(e.morale - 6, 0, 100);
    log(state, 'reg.curfew');
    ctx.emit({ type: 'regime/decree', id: 'curfew' });
  }
  if (e.attention >= 85 && !hasDecree(state, 'garrison')) {
    // A public reprisal: one adult is taken. The district never forgets.
    g.decrees.push({ id: 'garrison', untilDay: day + 20 });
    applyEffects(state, { death: 'regime', morale: -15, unrest: 15, attention: -25 }, ctx);
    log(state, 'reg.reprisal');
    ctx.emit({ type: 'regime/decree', id: 'garrison' });
  }

  if (!g.pending && day - g.lastEventDay >= 3 && nextFloat(rng) < 0.18) {
    const pool = DISTRICT_EVENTS.filter((ev) => eligible(state, ev));
    const total = pool.reduce((n, ev) => n + ev.weight, 0);
    let roll = nextFloat(rng) * total;
    const ev = pool.find((d) => (roll -= d.weight) < 0) ?? pool[0];
    if (ev) {
      g.pending = { eventId: ev.id, day };
      g.lastEventDay = day;
      ctx.emit({ type: 'regime/event', eventId: ev.id });
      if (ctx.autopilot) resolveEvent(state, 0, ctx);
    }
  }
}
