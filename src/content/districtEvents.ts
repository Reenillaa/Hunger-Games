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
  /** Only in these home districts (regional dilemmas). */
  districts?: string[];
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
    when: { districts: ['d12', 'd5', 'd2'] },
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
  // ---- Regional dilemmas: each district has its own trade, and its own way of losing people.
  {
    id: 'storm_at_sea',
    weight: 3,
    when: { districts: ['d4'] },
    options: [
      { id: 'stay_in', effects: { food: -40, morale: -2 } },
      {
        id: 'sail',
        effects: { chance: { p: 0.6, then: { food: 130 }, else: { death: 'accident', mood: -4 } } },
      },
    ],
  },
  {
    id: 'forest_fire',
    weight: 3,
    when: { districts: ['d7'] },
    options: [
      { id: 'firebreak', effects: { wood: -50, mood: 2 } },
      { id: 'evacuate', effects: { wood: -160, morale: -4 } },
    ],
  },
  {
    id: 'blight',
    weight: 3,
    when: { districts: ['d11', 'd9'] },
    options: [
      { id: 'burn', effects: { food: -80, attention: -3 } },
      {
        id: 'hide',
        effects: { chance: { p: 0.5, then: {}, else: { food: -150, attention: 12 } } },
      },
    ],
  },
  {
    id: 'recruiters',
    weight: 3,
    when: { districts: ['d2'] },
    options: [
      { id: 'volunteer', effects: { credits: 60, attention: -10, morale: -6 } },
      { id: 'refuse', effects: { attention: 10, morale: 6 } },
    ],
  },
  {
    id: 'gala_order',
    weight: 3,
    when: { districts: ['d1'] },
    options: [
      { id: 'deliver', effects: { credits: 120, morale: -4 } },
      { id: 'stall', effects: { attention: 8, morale: 4 } },
    ],
  },
  {
    id: 'blackout',
    weight: 3,
    when: { districts: ['d5'] },
    options: [
      { id: 'ration', effects: { morale: -6, mood: -2 } },
      { id: 'repair', effects: { credits: -50, morale: 3 } },
    ],
  },
  {
    id: 'derailment',
    weight: 3,
    when: { districts: ['d6'] },
    options: [
      { id: 'report', effects: { attention: -6 } },
      {
        id: 'salvage',
        effects: {
          chance: { p: 0.6, then: { food: 80, credits: 40 }, else: { attention: 15 } },
        },
      },
    ],
  },
  {
    id: 'factory_fire',
    weight: 3,
    when: { districts: ['d8'] },
    options: [
      { id: 'rescue', effects: { credits: -40, morale: 5, mood: 2 } },
      { id: 'save_looms', effects: { credits: 40, death: 'accident', morale: -8 } },
    ],
  },
  {
    id: 'stolen_prototype',
    weight: 3,
    when: { districts: ['d3'] },
    options: [
      { id: 'hand_over', effects: { attention: -8, morale: -6 } },
      {
        id: 'cover',
        effects: {
          chance: { p: 0.5, then: { credits: 80 }, else: { attention: 18, death: 'regime' } },
        },
      },
    ],
  },
  {
    id: 'cattle_fever',
    weight: 3,
    when: { districts: ['d10'] },
    options: [
      { id: 'cull', effects: { food: -90, attention: -4 } },
      { id: 'treat', effects: { credits: -50, mood: 1 } },
    ],
  },
];
