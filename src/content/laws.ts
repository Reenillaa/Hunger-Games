/**
 * District laws (GAME_SYSTEMS §6): standing decisions the player switches on and off. Each one is
 * a trade-off applied every day while active. At most MAX_ACTIVE_LAWS at once. Texts: `law.<id>.*`.
 */
export interface LawDef {
  id: string;
  /** Production multiplier while active (1 = none). */
  production?: number;
  /** Food eaten multiplier (rationing). */
  foodNeed?: number;
  /** Daily changes. */
  morale?: number;
  attention?: number;
  unrest?: number;
  food?: number;
  credits?: number;
}

export const MAX_ACTIVE_LAWS = 3;

export const LAWS: LawDef[] = [
  { id: 'long_shifts', production: 1.15, morale: -0.6 },
  { id: 'rationing', foodNeed: 0.8, morale: -0.4 },
  { id: 'grain_vouchers', food: 8, morale: -0.25 },
  { id: 'black_market', credits: 4, attention: 0.5 },
  { id: 'assemblies', morale: 0.5, unrest: -0.4, attention: 0.35 },
  { id: 'own_curfew', attention: -0.5, morale: -0.3 },
  { id: 'schooling', production: 0.95, morale: 0.25 },
];

export const lawById = (id: string) => LAWS.find((l) => l.id === id);
