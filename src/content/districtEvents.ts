/**
 * District events (GAME_SYSTEMS §12): small dilemmas between the regime, hunger and dignity.
 * Pure data: conditions read the state through a few numbers; effects are applied by the core.
 * Texts live in the locale files under `ev.<id>.*`.
 */
export interface EventEffects {
  food?: number;
  coal?: number;
  wood?: number;
  credits?: number;
  morale?: number;
  attention?: number;
  /** Mood change for every living citizen. */
  mood?: number;
  /** Pressure towards an uprising (0–100). */
  unrest?: number;
  /** A random adult dies (cause given). */
  death?: 'accident' | 'regime' | 'illness';
  /** Gamble: with probability p the `then` effects apply, otherwise `else`. */
  chance?: { p: number; then: EventEffects; else: EventEffects };
}

export interface EventCondition {
  minAttention?: number;
  maxMorale?: number;
  minUnrest?: number;
  needsLaureate?: boolean;
  needsInfirmary?: boolean;
}

export interface DistrictEventDef {
  id: string;
  weight: number;
  when?: EventCondition;
  options: { id: string; effects: EventEffects }[];
}

export const DISTRICT_EVENTS: DistrictEventDef[] = [
  {
    id: 'inspection',
    weight: 3,
    when: { minAttention: 20 },
    options: [
      { id: 'comply', effects: { credits: -40, attention: -8 } },
      {
        id: 'bribe',
        effects: {
          credits: -80,
          chance: { p: 0.7, then: { attention: -15 }, else: { attention: 20, morale: -5 } },
        },
      },
      {
        id: 'hide',
        effects: {
          morale: 3,
          chance: { p: 0.5, then: {}, else: { attention: 15, food: -40 } },
        },
      },
    ],
  },
  {
    id: 'black_market',
    weight: 3,
    options: [
      { id: 'buy', effects: { credits: -50, food: 130, attention: 6 } },
      { id: 'report', effects: { attention: -6, morale: -6 } },
      { id: 'ignore', effects: {} },
    ],
  },
  {
    id: 'mine_accident',
    weight: 2,
    options: [
      { id: 'rescue', effects: { coal: -40, morale: 4, mood: 3 } },
      { id: 'seal', effects: { morale: -10, death: 'accident', unrest: 4 } },
    ],
  },
  {
    id: 'speech',
    weight: 3,
    options: [
      { id: 'listen', effects: { morale: -3, attention: -3 } },
      { id: 'switch_off', effects: { morale: 2, attention: 4 } },
    ],
  },
  {
    id: 'graffiti',
    weight: 2,
    when: { maxMorale: 55 },
    options: [
      { id: 'erase', effects: { morale: -4, attention: -5 } },
      { id: 'leave', effects: { unrest: 8, attention: 10, morale: 5 } },
      { id: 'hunt', effects: { attention: -10, morale: -12, unrest: -4 } },
    ],
  },
  {
    id: 'strike',
    weight: 4,
    when: { maxMorale: 30 },
    options: [
      { id: 'concede', effects: { food: -80, morale: 15, unrest: -10 } },
      { id: 'crush', effects: { attention: 5, morale: -10, unrest: 12, death: 'regime' } },
      { id: 'negotiate', effects: { credits: -60, morale: 8, unrest: -5 } },
    ],
  },
  {
    id: 'epidemic',
    weight: 2,
    options: [
      { id: 'medicine', effects: { credits: -70, mood: 4 } },
      {
        id: 'wait',
        effects: { chance: { p: 0.5, then: { mood: -2 }, else: { death: 'illness', mood: -6 } } },
      },
    ],
  },
  {
    id: 'laureate_visit',
    weight: 2,
    when: { needsLaureate: true },
    options: [
      { id: 'celebrate', effects: { food: -30, morale: 10 } },
      { id: 'quiet', effects: { morale: 2 } },
    ],
  },
  {
    id: 'wardens',
    weight: 3,
    when: { minAttention: 45 },
    options: [
      { id: 'endure', effects: { morale: -8 } },
      {
        id: 'protest',
        effects: {
          unrest: 12,
          attention: 12,
          chance: { p: 0.3, then: { death: 'regime' }, else: { morale: 6 } },
        },
      },
    ],
  },
  {
    id: 'harvest_tithe',
    weight: 2,
    options: [
      { id: 'pay', effects: { food: -60, attention: -5 } },
      { id: 'short', effects: { food: -20, attention: 8 } },
    ],
  },
];
