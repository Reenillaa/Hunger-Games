import { STRUCTURE_FOOTPRINTS } from '../content/structures.ts';
import { TEMPLATES } from '../content/maps/index.ts';
import { STATE_SCHEMA_VERSION, generateDistrict, seedFromString } from '../core/index.ts';
import { SaveError } from './errors.ts';

export type RawState = Record<string, unknown>;

export interface Migration {
  from: number;
  to: number;
  description: string;
  migrate(state: RawState): RawState;
}

/**
 * Production migrations, in order. Each entry upgrades the state shape by exactly one version.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    to: 2,
    description: 'Phase 2: add the home district layout (structures and props).',
    migrate(state) {
      const meta = state.meta as { seed?: unknown } | undefined;
      const seed = typeof meta?.seed === 'string' ? meta.seed : 'unknown';
      const template = TEMPLATES.d12;
      if (!template) throw new SaveError('migration-missing', 'District template d12 missing');
      // Old saves had no district: generate it from a stream derived from the original seed.
      const district = generateDistrict(
        template,
        STRUCTURE_FOOTPRINTS,
        seedFromString(`${seed}::migrate-v2`),
      );
      return { ...state, district };
    },
  },
];

/** Upgrades a raw state from `fromVersion` to `targetVersion` by chaining migrations. */
export function migrateState(
  raw: RawState,
  fromVersion: number,
  targetVersion: number = STATE_SCHEMA_VERSION,
  migrations: readonly Migration[] = MIGRATIONS,
): RawState {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new SaveError('corrupt', `Invalid save version ${String(fromVersion)}`);
  }
  if (fromVersion > targetVersion) {
    throw new SaveError(
      'too-new',
      `Save version ${fromVersion} is newer than this game (${targetVersion})`,
    );
  }
  let current = raw;
  for (let v = fromVersion; v < targetVersion; v++) {
    const step = migrations.find((m) => m.from === v && m.to === v + 1);
    if (!step) throw new SaveError('migration-missing', `No migration from v${v} to v${v + 1}`);
    current = step.migrate(structuredClone(current));
    current.schemaVersion = v + 1;
  }
  return current;
}
