import type { GameState } from '../core/index.ts';
import { STATE_SCHEMA_VERSION } from '../core/index.ts';
import { SaveError } from './errors.ts';
import type { Migration, RawState } from './migrations.ts';
import { MIGRATIONS, migrateState } from './migrations.ts';
import { validateGameState } from './validate.ts';

export const SAVE_FORMAT = 'diezmo-save';
export const GAME_VERSION = '0.1.0';

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  saveVersion: number;
  gameVersion: string;
  savedAt: string;
  state: unknown;
}

async function pipe(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const isGzip = (b: Uint8Array) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

/** Serializes the complete state (everything needed to rebuild the simulation) into gzip bytes. */
export async function encodeSave(state: Readonly<GameState>, savedAt: Date): Promise<Uint8Array> {
  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    saveVersion: STATE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    savedAt: savedAt.toISOString(),
    state,
  };
  const json = new TextEncoder().encode(JSON.stringify(envelope));
  return pipe(json, new CompressionStream('gzip'));
}

/** Decodes gzip or plain JSON bytes, migrates old versions and validates the result. */
export async function decodeSave(
  bytes: Uint8Array,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<{ state: GameState; envelope: SaveEnvelope }> {
  let envelope: unknown;
  try {
    const raw = isGzip(bytes) ? await pipe(bytes, new DecompressionStream('gzip')) : bytes;
    envelope = JSON.parse(new TextDecoder().decode(raw));
  } catch (cause) {
    throw new SaveError('corrupt', 'The save file could not be read', { cause });
  }
  const env = envelope as Partial<SaveEnvelope> | null;
  if (!env || env.format !== SAVE_FORMAT || typeof env.state !== 'object' || env.state === null) {
    throw new SaveError('unknown-format', 'Not a save file of this game');
  }
  const migrated = migrateState(
    env.state as RawState,
    Number(env.saveVersion),
    STATE_SCHEMA_VERSION,
    migrations,
  );
  const problems = validateGameState(migrated);
  if (problems.length > 0) {
    throw new SaveError('invalid-state', `Save failed validation: ${problems.join(', ')}`);
  }
  return { state: migrated as unknown as GameState, envelope: env as SaveEnvelope };
}
