import { createStreams, nextInt } from '../rng/rng.ts';
import type { GameState } from './gameState.ts';
import { STATE_SCHEMA_VERSION, nextId } from './gameState.ts';

export interface NewGameOptions {
  /** Any string; the same seed always produces the same world. */
  seed: string;
}

export const HOME_DISTRICT_ID = 'd12';

export function createNewGame(options: NewGameOptions): GameState {
  const seed = options.seed.trim();
  if (seed.length === 0) throw new RangeError('createNewGame: seed must not be empty');
  const rng = createStreams(seed);
  const state: GameState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    meta: {
      seed,
      homeDistrictId: HOME_DISTRICT_ID,
      // Original numbering for the yearly games; varies per playthrough.
      firstEdition: nextInt(rng.world, 101, 160),
    },
    clock: { tick: 0 },
    phase: { kind: 'district' },
    away: { days: 0 },
    competition: { lastSelectionYear: null },
    rng,
    ids: { next: 1 },
    chronicle: [],
  };
  state.chronicle.push({ id: nextId(state, 'h'), tick: 0, kind: 'gameStarted' });
  return state;
}
