/**
 * Personality traits (docs/GAME_SYSTEMS.md §5.3). Opposites never coexist. Effects are weights:
 * they bias decisions (work, relationships, arena AI in Phase 7) rather than fixing behaviour.
 */
export const TRAITS = {
  brave: { opposite: 'coward', mood: 0, social: 0, work: 0.03 },
  coward: { opposite: 'brave', mood: -2, social: 0, work: -0.02 },
  ambitious: { opposite: 'content', mood: -1, social: 0, work: 0.06 },
  content: { opposite: 'ambitious', mood: 4, social: 1, work: -0.02 },
  loyal: { opposite: 'selfish', mood: 0, social: 3, work: 0.02 },
  selfish: { opposite: 'loyal', mood: 1, social: -3, work: 0 },
  sociable: { opposite: 'loner', mood: 2, social: 4, work: 0 },
  loner: { opposite: 'sociable', mood: 0, social: -2, work: 0.02 },
  suspicious: { opposite: 'trusting', mood: -1, social: -2, work: 0 },
  trusting: { opposite: 'suspicious', mood: 1, social: 2, work: 0 },
  aggressive: { opposite: 'peaceful', mood: -1, social: -4, work: 0.02 },
  peaceful: { opposite: 'aggressive', mood: 2, social: 2, work: 0 },
  manipulative: { opposite: 'sincere', mood: 0, social: -1, work: 0.01 },
  sincere: { opposite: 'manipulative', mood: 0, social: 2, work: 0 },
  resilient: { opposite: 'fragile', mood: 3, social: 0, work: 0.02 },
  fragile: { opposite: 'resilient', mood: -3, social: 0, work: -0.02 },
  devout: { opposite: 'rebel', mood: 0, social: 0, work: 0.02 },
  rebel: { opposite: 'devout', mood: -1, social: 1, work: 0 },
} as const;

export type TraitId = keyof typeof TRAITS;
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

/** Pairs that make friends or rivals more easily. */
export const AFFINITY: [TraitId, TraitId, number][] = [
  ['sociable', 'sociable', 3],
  ['loyal', 'loyal', 3],
  ['aggressive', 'peaceful', -4],
  ['aggressive', 'aggressive', -3],
  ['manipulative', 'sincere', -3],
  ['suspicious', 'manipulative', -4],
  ['devout', 'rebel', -5],
  ['rebel', 'rebel', 3],
  ['content', 'ambitious', -1],
  ['trusting', 'sincere', 2],
];
