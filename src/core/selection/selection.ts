import type { RngState } from '../rng/rng.ts';
import { pickWeightedIndex } from '../rng/rng.ts';
import type { Citizen, PopulationState, Sex } from '../population/types.ts';
import { ageOf, livingCitizens } from '../population/types.ts';

/**
 * Data-driven selection rules (docs/GAME_SYSTEMS.md §7.1). New rules are new data or a new
 * named modifier; the engine (filter → weight → modify → exempt → draw) never changes.
 */
export interface SelectionRuleSet {
  id: string;
  eligibility: { minAge: number; maxAge: number };
  slots: { sex: Sex; count: number }[];
  baseEntries: { base: number };
  modifiers: SelectionModifierId[];
  exemptions: SelectionExemptionId[];
}

export type SelectionModifierId = 'disaffection';
export type SelectionExemptionId = 'laureate';

export interface SelectionEntry {
  citizenId: string;
  entries: number;
}

export interface SelectionResult {
  ruleId: string;
  /** Chosen citizens in slot order. */
  chosen: string[];
  /** Eligible pool per sex with entries (for odds and the ceremony). */
  pool: Record<Sex, SelectionEntry[]>;
}

/** Extra slips for those the regime distrusts: low regime opinion, or close family of one. */
const MODIFIERS: Record<SelectionModifierId, (c: Citizen, pop: PopulationState) => number> = {
  disaffection(c, pop) {
    const family = [c.motherId, c.fatherId].map((id) => (id ? pop.citizens[id] : undefined));
    const distrusted = c.regimeOpinion < -40 || family.some((f) => f && f.regimeOpinion < -55);
    return distrusted ? 2 : 0;
  },
};

const EXEMPTIONS: Record<SelectionExemptionId, (c: Citizen) => boolean> = {
  laureate: (c) => c.history.some((h) => h.key === 'hist.laureate'),
};

export function eligiblePool(
  pop: PopulationState,
  rules: SelectionRuleSet,
  day: number,
  excluded: ReadonlySet<string> = new Set(),
): Record<Sex, SelectionEntry[]> {
  const pool: Record<Sex, SelectionEntry[]> = { F: [], M: [] };
  const candidates = livingCitizens(pop)
    .filter((c) => {
      const age = ageOf(c, day);
      return (
        age >= rules.eligibility.minAge && age <= rules.eligibility.maxAge && !excluded.has(c.id)
      );
    })
    .filter((c) => !rules.exemptions.some((e) => EXEMPTIONS[e](c)))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const c of candidates) {
    const age = ageOf(c, day);
    // One slip at the minimum age, one more for every year above it.
    let entries = rules.baseEntries.base + Math.max(0, age - rules.eligibility.minAge);
    for (const m of rules.modifiers) entries += MODIFIERS[m](c, pop);
    pool[c.sex].push({ citizenId: c.id, entries });
  }
  return pool;
}

/** Draws without replacement per slot with the dedicated `selection` RNG stream. */
export function runSelection(
  pop: PopulationState,
  rules: SelectionRuleSet,
  day: number,
  rng: RngState,
): SelectionResult {
  const pool = eligiblePool(pop, rules, day);
  const chosen: string[] = [];
  for (const slot of rules.slots) {
    const remaining = pool[slot.sex].filter((e) => !chosen.includes(e.citizenId));
    for (let k = 0; k < slot.count && remaining.length > 0; k++) {
      const idx = pickWeightedIndex(
        rng,
        remaining.map((e) => e.entries),
      );
      chosen.push(remaining[idx]!.citizenId);
      remaining.splice(idx, 1);
    }
  }
  return { ruleId: rules.id, chosen, pool };
}

/** Probability that a citizen's name came out, given the pool (single slot approximation). */
export function oddsOf(result: SelectionResult, citizenId: string, sex: Sex): number {
  const entries = result.pool[sex];
  const total = entries.reduce((n, e) => n + e.entries, 0);
  const mine = entries.find((e) => e.citizenId === citizenId)?.entries ?? 0;
  return total > 0 ? mine / total : 0;
}
