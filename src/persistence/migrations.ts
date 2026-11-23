import { STATE_SCHEMA_VERSION } from '../core/index.ts';
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
 * Version 1 is the first released shape, so the chain is empty for now.
 */
export const MIGRATIONS: readonly Migration[] = [];

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
