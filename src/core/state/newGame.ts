import { createRegime } from '../regime/regime.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import { TEMPLATES } from '../../content/maps/index.ts';
import { generateDistrict } from '../district/generate.ts';
import { allocateLabor, initialEconomy } from '../economy/economy.ts';
import { generatePopulation } from '../population/generate.ts';
import { syncCounts } from '../population/simulate.ts';
import { createStreams, nextInt } from '../rng/rng.ts';
import type { GameState } from './gameState.ts';
import { STATE_SCHEMA_VERSION, nextId } from './gameState.ts';

export interface NewGameOptions {
  /** Any string; the same seed always produces the same world. */
  seed: string;
}

export const HOME_DISTRICT_ID = 'd12';
/** A new game starts on the first morning, not at midnight. */
export const START_HOUR = 8;

/** Fills the houses with families (shared by new games and the v3 → v4 migration). */
export function populate(state: GameState): void {
  const houses = state.district.structures.filter((s) => s.kind.startsWith('house'));
  state.population = generatePopulation(
    houses,
    state.rng.population,
    Math.floor(state.clock.tick / 24),
    () => nextId(state, 'c'),
  );
  syncCounts(state);
}

export function createNewGame(options: NewGameOptions): GameState {
  const seed = options.seed.trim();
  if (seed.length === 0) throw new RangeError('createNewGame: seed must not be empty');
  const rng = createStreams(seed);
  const firstEdition = nextInt(rng.world, 101, 160);
  const template = TEMPLATES[HOME_DISTRICT_ID];
  if (!template) throw new Error(`Missing district template ${HOME_DISTRICT_ID}`);
  const state: GameState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    meta: {
      seed,
      homeDistrictId: HOME_DISTRICT_ID,
      // Original numbering for the yearly games; varies per playthrough.
      firstEdition,
    },
    clock: { tick: START_HOUR },
    phase: { kind: 'district' },
    away: { days: 0 },
    competition: { lastSelectionYear: null, current: null, history: [] },
    district: generateDistrict(template, STRUCTURE_FOOTPRINTS, rng.world),
    economy: initialEconomy(),
    population: { citizens: {} },
    games: null,
    arena: null,
    regime: createRegime(),
    rng,
    ids: { next: 1 },
    chronicle: [],
  };
  state.chronicle.push({ id: nextId(state, 'h'), tick: START_HOUR, kind: 'gameStarted' });
  populate(state);
  allocateLabor(state);
  return state;
}
