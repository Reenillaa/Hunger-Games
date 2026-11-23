import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { GameState, PhaseKind, Season } from '../core/index.ts';
import { STATE_SCHEMA_VERSION, dateFromTick } from '../core/index.ts';
import { decodeSave, encodeSave } from './codec.ts';
import { SaveError } from './errors.ts';

export const AUTO_SLOTS = ['auto-a', 'auto-b'] as const;
export const MANUAL_SLOTS = ['slot-1', 'slot-2', 'slot-3'] as const;
export type SlotId = (typeof AUTO_SLOTS)[number] | (typeof MANUAL_SLOTS)[number];

export interface SlotMeta {
  id: SlotId;
  kind: 'auto' | 'manual';
  savedAt: string;
  saveVersion: number;
  sizeBytes: number;
  seed: string;
  tick: number;
  year: number;
  season: Season;
  dayOfSeason: number;
  phase: PhaseKind;
}

interface DiezmoDB extends DBSchema {
  slots: { key: SlotId; value: SlotMeta };
  saves: { key: SlotId; value: Uint8Array };
  profile: { key: string; value: unknown };
}

export const DB_NAME = 'diezmo';
const DB_VERSION = 1;

/**
 * IndexedDB storage for save slots: 3 manual slots + 2 rotating autosaves
 * (two copies so a corrupted write never loses the only autosave).
 */
export class SaveRepository {
  private readonly db: IDBPDatabase<DiezmoDB>;
  private readonly now: () => Date;

  private constructor(db: IDBPDatabase<DiezmoDB>, now: () => Date) {
    this.db = db;
    this.now = now;
  }

  static async open(
    name: string = DB_NAME,
    now: () => Date = () => new Date(),
  ): Promise<SaveRepository> {
    try {
      const db = await openDB<DiezmoDB>(name, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains('slots'))
            database.createObjectStore('slots', { keyPath: 'id' });
          if (!database.objectStoreNames.contains('saves')) database.createObjectStore('saves');
          if (!database.objectStoreNames.contains('profile')) database.createObjectStore('profile');
        },
      });
      return new SaveRepository(db, now);
    } catch (cause) {
      throw new SaveError('storage', 'Local storage is not available', { cause });
    }
  }

  close(): void {
    this.db.close();
  }

  async listSlots(): Promise<SlotMeta[]> {
    const all = await this.db.getAll('slots');
    return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async latest(): Promise<SlotMeta | null> {
    return (await this.listSlots())[0] ?? null;
  }

  async save(slotId: SlotId, state: Readonly<GameState>): Promise<SlotMeta> {
    const savedAt = this.now();
    const bytes = await encodeSave(state, savedAt);
    const date = dateFromTick(state.clock.tick);
    const meta: SlotMeta = {
      id: slotId,
      kind: slotId.startsWith('auto') ? 'auto' : 'manual',
      savedAt: savedAt.toISOString(),
      saveVersion: STATE_SCHEMA_VERSION,
      sizeBytes: bytes.byteLength,
      seed: state.meta.seed,
      tick: state.clock.tick,
      year: date.year,
      season: date.season,
      dayOfSeason: date.dayOfSeason,
      phase: state.phase.kind,
    };
    try {
      const tx = this.db.transaction(['slots', 'saves'], 'readwrite');
      await Promise.all([
        tx.objectStore('saves').put(bytes, slotId),
        tx.objectStore('slots').put(meta),
        tx.done,
      ]);
    } catch (cause) {
      throw new SaveError('storage', 'The game could not be saved', { cause });
    }
    return meta;
  }

  /** Overwrites the older of the two autosave slots. */
  async autosave(state: Readonly<GameState>): Promise<SlotMeta> {
    const metas = await Promise.all(AUTO_SLOTS.map((id) => this.db.get('slots', id)));
    const [a, b] = metas;
    const target: SlotId = !a
      ? 'auto-a'
      : !b
        ? 'auto-b'
        : a.savedAt <= b.savedAt
          ? 'auto-a'
          : 'auto-b';
    return this.save(target, state);
  }

  async load(slotId: SlotId): Promise<GameState> {
    const bytes = await this.db.get('saves', slotId);
    if (!bytes) throw new SaveError('not-found', `Slot ${slotId} is empty`);
    return (await decodeSave(bytes)).state;
  }

  /** Loads the most recent slot that decodes correctly (falls back to the other autosave copy). */
  async loadLatestValid(): Promise<{ state: GameState; meta: SlotMeta } | null> {
    for (const meta of await this.listSlots()) {
      try {
        return { state: await this.load(meta.id), meta };
      } catch {
        // Try the next most recent slot.
      }
    }
    return null;
  }

  async delete(slotId: SlotId): Promise<void> {
    const tx = this.db.transaction(['slots', 'saves'], 'readwrite');
    await Promise.all([
      tx.objectStore('saves').delete(slotId),
      tx.objectStore('slots').delete(slotId),
      tx.done,
    ]);
  }

  async getProfile<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('profile', key)) as T | undefined;
  }

  async setProfile(key: string, value: unknown): Promise<void> {
    await this.db.put('profile', value, key);
  }

  /** Bytes for a downloadable backup file. */
  exportBytes(state: Readonly<GameState>): Promise<Uint8Array> {
    return encodeSave(state, this.now());
  }
}

/** Validates an imported backup file and returns the playable state. */
export async function importSaveBytes(bytes: Uint8Array): Promise<GameState> {
  return (await decodeSave(bytes)).state;
}
