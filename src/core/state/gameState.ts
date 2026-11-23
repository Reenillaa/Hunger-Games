import type { DistrictState } from '../district/generate.ts';
import type { EconomyState } from '../economy/economy.ts';
import type { PopulationState } from '../population/types.ts';
import type { RngState, RngStreamId } from '../rng/rng.ts';

/** Bumped whenever the shape of GameState changes; saves migrate across versions. */
export const STATE_SCHEMA_VERSION = 4;

export const PHASE_KINDS = ['district', 'selection', 'capital', 'arena', 'aftermath'] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

export type PhaseState =
  | { kind: 'district' }
  | { kind: 'selection'; edition: number }
  | { kind: 'capital'; edition: number; day: number }
  | { kind: 'arena'; edition: number }
  | { kind: 'aftermath'; edition: number };

export type ChronicleKind =
  | 'gameStarted'
  | 'selectionHeld'
  | 'departedToCapital'
  | 'arenaStarted'
  | 'arenaConcluded'
  | 'returnedHome';

/** Permanent historical record of the playthrough (who, when, what). */
export interface ChronicleEntry {
  id: string;
  tick: number;
  kind: ChronicleKind;
  edition?: number;
  /** Days the delegation spent away (only for `returnedHome`). */
  daysAway?: number;
}

export interface GameState {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  meta: {
    seed: string;
    homeDistrictId: string;
    /** Edition number of the games held in year 1 (procedurally chosen per playthrough). */
    firstEdition: number;
  };
  clock: { tick: number };
  phase: PhaseState;
  /** Bookkeeping while the delegation is away; the district catches up on return (autopilot). */
  away: { days: number };
  competition: { lastSelectionYear: number | null };
  /** The player's home district: layout of structures and props (v2). */
  district: DistrictState;
  /** Resources, quota, abstract population, morale and regime attention (v3). */
  economy: EconomyState;
  /** Every citizen, alive or dead, with family, traits, skills and history (v4). */
  population: PopulationState;
  rng: Record<RngStreamId, RngState>;
  ids: { next: number };
  chronicle: ChronicleEntry[];
}

export function editionOfYear(state: GameState, year: number): number {
  return state.meta.firstEdition + year - 1;
}

/** Deterministic, compact, save-stable identifiers. */
export function nextId(state: GameState, prefix: string): string {
  const id = `${prefix}_${state.ids.next.toString(36)}`;
  state.ids.next += 1;
  return id;
}
