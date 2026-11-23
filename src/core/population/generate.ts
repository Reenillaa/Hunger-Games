import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES } from '../../content/names.ts';
import { BUILDINGS } from '../../content/buildings.ts';
import type { TraitId } from '../../content/traits.ts';
import { TRAITS, TRAIT_IDS } from '../../content/traits.ts';
import type { PlacedStructure } from '../district/generate.ts';
import type { RngState } from '../rng/rng.ts';
import { nextFloat, nextInt, pick } from '../rng/rng.ts';
import { DAYS_PER_YEAR } from '../time/calendar.ts';
import type {
  AttributeId,
  Citizen,
  PopulationState,
  PortraitGenes,
  Sex,
  SkillId,
} from './types.ts';
import { ATTRIBUTE_IDS, SKILL_IDS } from './types.ts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface Builder {
  rng: RngState;
  today: number;
  citizens: Record<string, Citizen>;
  nextId: () => string;
}

export function randomTraits(rng: RngState): TraitId[] {
  const count = nextFloat(rng) < 0.5 ? 2 : 3;
  const out: TraitId[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 50) {
    const t = pick(rng, TRAIT_IDS);
    if (out.includes(t) || out.includes(TRAITS[t].opposite as TraitId)) continue;
    out.push(t);
  }
  return out;
}

export function randomGenes(rng: RngState): PortraitGenes {
  return {
    skin: nextInt(rng, 0, 4),
    hair: nextInt(rng, 0, 5),
    hairStyle: nextInt(rng, 0, 5),
    face: nextInt(rng, 0, 3),
    eyes: nextInt(rng, 0, 3),
    nose: nextInt(rng, 0, 3),
    brow: nextInt(rng, 0, 2),
  };
}

/** Each feature comes from one parent, with a 15% mutation chance. */
export function inheritGenes(
  rng: RngState,
  mother: PortraitGenes,
  father: PortraitGenes,
): PortraitGenes {
  const fresh = randomGenes(rng);
  const out = {} as PortraitGenes;
  for (const k of Object.keys(fresh) as (keyof PortraitGenes)[]) {
    const roll = nextFloat(rng);
    out[k] = roll < 0.15 ? fresh[k] : roll < 0.575 ? mother[k] : father[k];
  }
  return out;
}

function attributes(rng: RngState, parents: Citizen[]): Record<AttributeId, number> {
  const out = {} as Record<AttributeId, number>;
  for (const a of ATTRIBUTE_IDS) {
    const base =
      parents.length > 0
        ? parents.reduce((n, p) => n + p.attributes[a], 0) / parents.length
        : 3 + nextFloat(rng) * 5;
    out[a] = clamp(Math.round(base + (nextFloat(rng) - 0.5) * 4), 1, 10);
  }
  return out;
}

function skillsFor(rng: RngState, age: number, sex: Sex): Record<SkillId, number> {
  const out = {} as Record<SkillId, number>;
  const years = Math.max(0, age - 12);
  for (const s of SKILL_IDS)
    out[s] = clamp(Math.round(nextFloat(rng) * Math.min(6, years * 0.4)), 0, 20);
  if (age >= 16) {
    // District life: most adults have spent years in the mine or the fields.
    out.mining = clamp(Math.round(nextFloat(rng) * Math.min(14, years * 0.8)), 0, 20);
    out.farming = clamp(out.farming + nextInt(rng, 0, 5), 0, 20);
    out[pick(rng, SKILL_IDS)] += nextInt(rng, 2, 6);
  }
  if (age >= 12 && age < 19 && nextFloat(rng) < 0.3) out.survival += nextInt(rng, 2, 6); // poaching in the woods
  if (sex === 'M' && nextFloat(rng) < 0.3) out.construction += nextInt(rng, 1, 4);
  for (const s of SKILL_IDS) out[s] = clamp(out[s], 0, 20);
  return out;
}

export function createCitizen(
  b: Builder,
  opts: {
    sex: Sex;
    age: number;
    lastNames: [string, string];
    mother?: Citizen;
    father?: Citizen;
    homeId: string | null;
    alive?: boolean;
  },
): Citizen {
  const { rng } = b;
  const parents = [opts.mother, opts.father].filter((p): p is Citizen => !!p);
  const traits = randomTraits(rng);
  const c: Citizen = {
    id: b.nextId(),
    firstName: pick(rng, opts.sex === 'F' ? FIRST_NAMES_F : FIRST_NAMES_M),
    lastNames: opts.lastNames,
    sex: opts.sex,
    birthDay: b.today - opts.age * DAYS_PER_YEAR - nextInt(rng, 0, DAYS_PER_YEAR - 1),
    alive: opts.alive ?? true,
    genes:
      opts.mother && opts.father
        ? inheritGenes(rng, opts.mother.genes, opts.father.genes)
        : randomGenes(rng),
    motherId: opts.mother?.id ?? null,
    fatherId: opts.father?.id ?? null,
    partnerId: null,
    childrenIds: [],
    homeId: opts.alive === false ? null : opts.homeId,
    jobId: null,
    attributes: attributes(rng, parents),
    skills: skillsFor(rng, opts.age, opts.sex),
    traits,
    health: opts.age > 60 ? nextInt(rng, 50, 85) : nextInt(rng, 70, 100),
    mood: nextInt(rng, 45, 70),
    regimeOpinion:
      nextInt(rng, -40, 15) +
      (traits.includes('devout') ? 35 : 0) -
      (traits.includes('rebel') ? 30 : 0),
    relations: {},
    moodModifiers: [],
    history: [],
  };
  if (opts.alive === false) {
    c.deathDay = b.today - nextInt(rng, 1, 15) * DAYS_PER_YEAR;
    c.deathCause = nextFloat(rng) < 0.4 ? 'accident' : 'age';
  }
  for (const p of parents) p.childrenIds.push(c.id);
  b.citizens[c.id] = c;
  return c;
}

export function couple(a: Citizen, b: Citizen): void {
  a.partnerId = b.id;
  b.partnerId = a.id;
}

/**
 * Initial population: households fill the houses. Parents are children of grandparent couples
 * (mostly deceased) so siblings, cousins and family names connect the town from day one.
 */
export function generatePopulation(
  houses: PlacedStructure[],
  rng: RngState,
  today: number,
  idOf: () => string,
): PopulationState {
  const b: Builder = { rng, today, citizens: {}, nextId: idOf };
  // Grandparent couples: the lineages of the district.
  const lineages: { gf: Citizen; gm: Citizen; used: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const alive = nextFloat(rng) < 0.3;
    const ageGf = nextInt(rng, alive ? 62 : 70, alive ? 76 : 90);
    const gf = createCitizen(b, {
      sex: 'M',
      age: ageGf,
      lastNames: [pick(rng, LAST_NAMES), pick(rng, LAST_NAMES)],
      homeId: null,
      alive,
    });
    const gm = createCitizen(b, {
      sex: 'F',
      age: ageGf - nextInt(rng, 0, 5),
      lastNames: [pick(rng, LAST_NAMES), pick(rng, LAST_NAMES)],
      homeId: null,
      alive,
    });
    if (gf.alive && gm.alive) couple(gf, gm);
    lineages.push({ gf, gm, used: 0 });
  }
  const childOfLineage = (sex: Sex, age: number, homeId: string): Citizen => {
    const free = lineages.filter((l) => l.used < 3);
    const l = pick(rng, free.length > 0 ? free : lineages);
    l.used += 1;
    return createCitizen(b, {
      sex,
      age,
      lastNames: [l.gf.lastNames[0], l.gm.lastNames[0]],
      mother: l.gm,
      father: l.gf,
      homeId,
    });
  };

  for (const house of houses) {
    const capacity = BUILDINGS[house.kind].housing?.[house.level - 1] ?? 4;
    let room = capacity;
    // Elderly grandparents still alive move in with one of their children's households.
    while (room >= 3) {
      const roll = nextFloat(rng);
      if (roll < 0.12 && room >= 2) {
        // Single adult or widow(er).
        childOfLineage(nextFloat(rng) < 0.5 ? 'F' : 'M', nextInt(rng, 24, 60), house.id);
        room -= 1;
        continue;
      }
      const fatherAge = nextInt(rng, 26, 52);
      const motherAge = clamp(fatherAge + nextInt(rng, -6, 3), 22, 50);
      const father = childOfLineage('M', fatherAge, house.id);
      const mother = childOfLineage('F', motherAge, house.id);
      couple(father, mother);
      room -= 2;
      const kids = Math.min(room, nextInt(rng, 1, 4));
      for (let k = 0; k < kids; k++) {
        // Older children are more common in the household (siblings already grown).
        const maxAge = Math.min(18, motherAge - 18);
        const age =
          nextFloat(rng) < 0.6
            ? nextInt(rng, Math.min(8, maxAge), maxAge)
            : nextInt(rng, 0, maxAge);
        createCitizen(b, {
          sex: nextFloat(rng) < 0.5 ? 'F' : 'M',
          age,
          lastNames: [father.lastNames[0], mother.lastNames[0]],
          mother,
          father,
          homeId: house.id,
        });
        room -= 1;
      }
      if (capacity < 8) break;
    }
  }
  // Living grandparents join the home of their eldest child.
  for (const l of lineages) {
    for (const g of [l.gf, l.gm]) {
      if (!g.alive) continue;
      const child = g.childrenIds.map((id) => b.citizens[id]).find((c) => c?.alive && c.homeId);
      g.homeId = child?.homeId ?? houses[0]?.id ?? null;
    }
  }
  return { citizens: b.citizens };
}
