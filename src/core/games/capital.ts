import { DISTRICTS, HOME_DISTRICT_NUMBER } from '../../content/districts.ts';
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES } from '../../content/names.ts';
import { rulesForEdition } from '../../content/selectionRules.ts';
import { randomGenes, randomTraits } from '../population/generate.ts';
import type { AttributeId, Sex, SkillId } from '../population/types.ts';
import { ATTRIBUTE_IDS, SKILL_IDS, ageOf, fullName } from '../population/types.ts';
import type { RngState } from '../rng/rng.ts';
import { nextFloat, nextInt, pick } from '../rng/rng.ts';
import type { GameState } from '../state/gameState.ts';
import type {
  Contestant,
  GamesState,
  Interview,
  OpeningPlan,
  Outfit,
  Posture,
  TrainingFocus,
} from './types.ts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const TRAINING_SKILL: Partial<Record<TrainingFocus, SkillId>> = {
  combat: 'combat',
  survival: 'survival',
  stealth: 'stealth',
};

function rival(rng: RngState, district: number, sex: Sex, idx: number): Contestant {
  const profile = DISTRICTS.find((d) => d.id === district)!;
  const trained = nextFloat(rng) < profile.training;
  const age = trained ? nextInt(rng, 16, 18) : nextInt(rng, 12, 18);
  const attributes = {} as Record<AttributeId, number>;
  for (const a of ATTRIBUTE_IDS)
    attributes[a] = clamp(
      Math.round(3 + nextFloat(rng) * 4 + (trained ? 2 : 0) + profile.wealth),
      1,
      10,
    );
  const skills = {} as Record<SkillId, number>;
  for (const s of SKILL_IDS)
    skills[s] = clamp(Math.round(nextFloat(rng) * 5 + (age - 12) * 0.4), 0, 20);
  if (trained) {
    skills.combat += nextInt(rng, 6, 10);
    skills.survival += nextInt(rng, 2, 5);
  }
  return {
    id: `t${district}${sex}${idx}`,
    citizenId: null,
    district,
    name: `${pick(rng, sex === 'F' ? FIRST_NAMES_F : FIRST_NAMES_M)} ${pick(rng, LAST_NAMES)}`,
    sex,
    age,
    genes: randomGenes(rng),
    traits: randomTraits(rng),
    attributes,
    skills,
    popularity: Math.round(10 + profile.wealth * 25 + (trained ? 10 : 0)),
    score: null,
    shownScore: null,
    opinions: {},
    morale: nextInt(rng, 40, 75),
    choices: { training: [] },
    player: false,
    scouted: false,
  };
}

/** Called when the delegation leaves for the capital. */
export function createGames(state: GameState): GamesState {
  const current = state.competition.current;
  const rng = state.rng.capital;
  const edition = current?.edition ?? 0;
  const day = Math.floor(state.clock.tick / 24);
  const contestants: Record<string, Contestant> = {};
  const order: string[] = [];
  for (const citizenId of current?.participants ?? []) {
    const c = state.population.citizens[citizenId];
    if (!c) continue;
    const t: Contestant = {
      id: `p_${c.id}`,
      citizenId: c.id,
      district: HOME_DISTRICT_NUMBER,
      name: fullName(c),
      sex: c.sex,
      age: ageOf(c, day),
      genes: c.genes,
      traits: [...c.traits],
      attributes: { ...c.attributes },
      skills: { ...c.skills },
      popularity: 8,
      score: null,
      shownScore: null,
      opinions: {},
      morale: Math.round(c.mood * 0.6),
      choices: { training: [] },
      player: true,
      scouted: false,
    };
    contestants[t.id] = t;
    order.push(t.id);
  }
  const slots = rulesForEdition(edition).slots;
  for (const d of DISTRICTS) {
    if (d.id === HOME_DISTRICT_NUMBER) continue;
    let idx = 0;
    for (const slot of slots) {
      for (let k = 0; k < slot.count; k++) {
        const t = rival(rng, d.id, slot.sex, idx++);
        contestants[t.id] = t;
        order.push(t.id);
      }
    }
  }
  // First impressions: same district = allies by default; strangers neutral.
  for (const a of Object.values(contestants)) {
    for (const b of Object.values(contestants)) {
      if (a.id === b.id) continue;
      a.opinions[b.id] = a.district === b.district ? 45 : nextInt(rng, -10, 10);
    }
  }
  return { edition, contestants, order, patronage: 0, outfitBudget: 0, log: [] };
}

export function evaluationScore(c: Contestant, rng: RngState): number {
  const raw =
    (c.skills.combat + c.skills.survival + c.skills.stealth) / 5 +
    (c.attributes.strength + c.attributes.agility + c.attributes.endurance) / 4 +
    nextInt(rng, -1, 1);
  return clamp(Math.round(raw), 1, 12);
}

function aiChoices(c: Contestant, rng: RngState, day: number): void {
  const ch = c.choices;
  if (day === 1 && !ch.posture)
    ch.posture =
      c.attributes.strength >= 7 || c.traits.includes('aggressive')
        ? 'intimidating'
        : c.traits.includes('sociable')
          ? 'friendly'
          : 'reserved';
  if (day === 2 && !ch.outfit)
    ch.outfit = pick(rng, ['identity', 'bold', 'traditional'] as Outfit[]);
  if (day >= 3 && day <= 5 && ch.training.length < day - 2) {
    const strong = c.skills.combat >= 8;
    ch.training.push(
      strong
        ? nextFloat(rng) < 0.6
          ? 'combat'
          : 'allies'
        : pick(rng, ['survival', 'stealth', 'endurance', 'allies', 'combat'] as TrainingFocus[]),
    );
  }
  if (day === 5 && ch.hidden === undefined)
    ch.hidden = c.traits.includes('suspicious') || c.traits.includes('manipulative');
  if (day === 6 && !ch.interview)
    ch.interview = c.traits.includes('rebel')
      ? 'defiant'
      : c.attributes.charisma >= 7
        ? 'charming'
        : pick(rng, ['humble', 'mysterious'] as Interview[]);
  if (day === 7 && !ch.plan) ch.plan = c.skills.combat >= 10 ? 'fight' : 'flee';
}

function adjustOpinions(
  games: GamesState,
  from: Contestant,
  delta: number,
  rng: RngState,
  count: number,
): void {
  const others = games.order.filter((id) => id !== from.id);
  for (let i = 0; i < count; i++) {
    const other = games.contestants[pick(rng, others)]!;
    other.opinions[from.id] = clamp((other.opinions[from.id] ?? 0) + delta, -100, 100);
  }
}

/**
 * Resolves the day that just ended for every contestant (the player's choices or sensible
 * defaults, and the AI's own). Returns the attention the regime pays to the home district.
 */
export function resolveCapitalDay(state: GameState, day: number): number {
  const games = state.games;
  if (!games) return 0;
  const rng = state.rng.capital;
  let attention = 0;
  for (const id of games.order) {
    const c = games.contestants[id]!;
    if (!c.player) aiChoices(c, rng, day);
    const ch = c.choices;
    const log = (key: string, vars: Record<string, string> = {}) =>
      c.player && games.log.push({ day, key, vars: { name: c.name.split(' ')[0]!, ...vars } });
    switch (day) {
      case 1: {
        const posture: Posture = ch.posture ?? 'reserved';
        ch.posture = posture;
        if (posture === 'friendly') {
          adjustOpinions(games, c, 12, rng, 6);
          c.popularity += 3;
        } else if (posture === 'intimidating') {
          adjustOpinions(games, c, -12, rng, 8);
          c.popularity += c.attributes.strength >= 6 ? 6 : -3;
        }
        log(`cap.log.posture.${posture}`);
        break;
      }
      case 2: {
        const outfit: Outfit = ch.outfit ?? 'traditional';
        ch.outfit = outfit;
        const budget = c.player
          ? games.outfitBudget
          : Math.round(DISTRICTS[c.district - 1]!.wealth * 80);
        let gain = Math.sqrt(budget) * 1.5;
        if (outfit === 'identity') gain += 6 + nextInt(rng, 0, 6);
        else if (outfit === 'bold') gain += nextFloat(rng) < 0.5 ? 16 : -4;
        else gain += 4;
        c.popularity += Math.round(gain);
        log(`cap.log.outfit.${outfit}`, { gain: String(Math.round(gain)) });
        break;
      }
      case 3:
      case 4:
      case 5: {
        const focus: TrainingFocus = ch.training[day - 3] ?? 'survival';
        ch.training[day - 3] = focus;
        const learn = 0.5 + c.attributes.intellect / 10;
        const skill = TRAINING_SKILL[focus];
        if (skill)
          c.skills[skill] = clamp(
            c.skills[skill] + Math.round((2 + nextInt(rng, 0, 2)) * learn),
            0,
            20,
          );
        if (focus === 'endurance')
          c.attributes.endurance = clamp(c.attributes.endurance + 1, 1, 10);
        if (focus === 'allies') {
          // Allies come easier to the sociable and from similar districts.
          const others = games.order.filter((o) => o !== c.id);
          for (let i = 0; i < 3; i++) {
            const o = games.contestants[pick(rng, others)]!;
            const bond =
              10 +
              (c.traits.includes('sociable') ? 6 : 0) +
              (Math.abs(o.district - c.district) <= 2 ? 4 : 0);
            o.opinions[c.id] = clamp((o.opinions[c.id] ?? 0) + bond, -100, 100);
            c.opinions[o.id] = clamp((c.opinions[o.id] ?? 0) + bond, -100, 100);
          }
        }
        if (focus === 'scout') {
          c.scouted = true;
          c.attributes.perception = clamp(c.attributes.perception + 1, 1, 10);
        }
        log(`cap.log.train.${focus}`);
        if (day === 5) {
          c.score = evaluationScore(c, rng);
          const hidden = ch.hidden ?? false;
          ch.hidden = hidden;
          c.shownScore = hidden ? Math.max(1, c.score - 4 - nextInt(rng, 0, 2)) : c.score;
          c.popularity += hidden ? 1 : c.shownScore * 2;
          if (!hidden && c.score >= 9) adjustOpinions(games, c, -8, rng, 8); // a threat to everyone
          log(hidden ? 'cap.log.eval.hidden' : 'cap.log.eval.shown', {
            score: String(c.shownScore),
          });
        }
        break;
      }
      case 6: {
        const angle: Interview = ch.interview ?? 'humble';
        ch.interview = angle;
        const charisma = c.attributes.charisma;
        let gain = charisma * 1.2;
        if (angle === 'humble')
          gain += c.traits.includes('sincere') || c.traits.includes('content') ? 9 : 4;
        if (angle === 'charming') gain += charisma * 1.2;
        if (angle === 'defiant') {
          gain += 12;
          if (c.player) attention += 10;
        }
        if (angle === 'mysterious')
          gain += c.traits.includes('loner') || c.traits.includes('suspicious') ? 10 : 3;
        if (angle === 'tragic') {
          const citizen = c.citizenId ? state.population.citizens[c.citizenId] : null;
          gain += citizen?.history.some((h) => h.key === 'hist.lost') ? 14 : 2;
        }
        c.popularity += Math.round(gain);
        log(`cap.log.interview.${angle}`, { gain: String(Math.round(gain)) });
        break;
      }
      case 7: {
        const plan: OpeningPlan = ch.plan ?? 'flee';
        ch.plan = plan;
        c.morale = clamp(c.morale + (c.traits.includes('resilient') ? 10 : 4), 0, 100);
        log(`cap.log.plan.${plan}`);
        break;
      }
    }
    c.popularity = clamp(c.popularity, 0, 100);
  }
  if (day === 7) {
    games.patronage = games.order
      .map((id) => games.contestants[id]!)
      .filter((c) => c.player)
      .reduce((n, c) => n + Math.round(c.popularity * 1.5), 0);
  }
  return attention;
}
