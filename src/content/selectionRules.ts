import type { SelectionRuleSet } from '../core/selection/selection.ts';

/** The ordinary yearly Criba: one girl and one boy, older youths hold more slips. */
export const STANDARD_RULES: SelectionRuleSet = {
  id: 'standard',
  eligibility: { minAge: 12, maxAge: 18 },
  slots: [
    { sex: 'F', count: 1 },
    { sex: 'M', count: 1 },
  ],
  baseEntries: { base: 1 },
  modifiers: ['disaffection'],
  exemptions: ['laureate'],
};

/** Every 25th edition: the Jubilee doubles the delegation. */
export const JUBILEE_RULES: SelectionRuleSet = {
  ...STANDARD_RULES,
  id: 'jubilee',
  slots: [
    { sex: 'F', count: 2 },
    { sex: 'M', count: 2 },
  ],
};

export function rulesForEdition(edition: number): SelectionRuleSet {
  return edition % 25 === 0 ? JUBILEE_RULES : STANDARD_RULES;
}
