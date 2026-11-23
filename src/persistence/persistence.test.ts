import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY, advanceTicks, createNewGame, hashState } from '../core/index.ts';
import { GameSession } from '../game/session.ts';
import { decodeSave, encodeSave } from './codec.ts';
import { SaveError } from './errors.ts';
import { migrateState } from './migrations.ts';
import type { Migration } from './migrations.ts';
import { SaveRepository, importSaveBytes } from './saveRepository.ts';

let dbCounter = 0;
function clock(start = Date.UTC(2026, 0, 1)) {
  let t = start;
  return () => new Date((t += 1000));
}
const openRepo = () => SaveRepository.open(`test-${++dbCounter}`, clock());

describe('codec', () => {
  it('round-trips the complete state through gzip', async () => {
    const s = createNewGame({ seed: 'codec' });
    advanceTicks(s, 123);
    const bytes = await encodeSave(s, new Date(0));
    expect(bytes[0]).toBe(0x1f);
    const { state } = await decodeSave(bytes);
    expect(hashState(state)).toBe(hashState(s));
  });

  it('accepts plain JSON envelopes', async () => {
    const s = createNewGame({ seed: 'plain' });
    const json = JSON.stringify({
      format: 'diezmo-save',
      saveVersion: 2,
      gameVersion: 'x',
      savedAt: '',
      state: s,
    });
    const { state } = await decodeSave(new TextEncoder().encode(json));
    expect(state).toEqual(s);
  });

  it('rejects garbage, foreign files, future versions and invalid states', async () => {
    const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
    await expect(decodeSave(new Uint8Array([1, 2, 3]))).rejects.toMatchObject({ code: 'corrupt' });
    await expect(decodeSave(enc({ hello: 1 }))).rejects.toMatchObject({ code: 'unknown-format' });
    const s = createNewGame({ seed: 'x' });
    await expect(
      decodeSave(enc({ format: 'diezmo-save', saveVersion: 99, state: s })),
    ).rejects.toMatchObject({
      code: 'too-new',
    });
    await expect(
      decodeSave(
        enc({ format: 'diezmo-save', saveVersion: 2, state: { ...s, clock: { tick: -5 } } }),
      ),
    ).rejects.toMatchObject({ code: 'invalid-state' });
  });
});

describe('production migration v1 → v2', () => {
  it('adds the district layout to a Phase 1 save', async () => {
    const { district: _drop, ...rest } = createNewGame({ seed: 'old-save' });
    const v1 = { ...rest, schemaVersion: 1 };
    const json = JSON.stringify({ format: 'diezmo-save', saveVersion: 1, state: v1 });
    const { state } = await decodeSave(new TextEncoder().encode(json));
    expect(state.schemaVersion).toBe(2);
    expect(state.district.structures.length).toBeGreaterThan(20);
    expect(state.clock).toEqual(v1.clock);
  });
});

describe('migrations', () => {
  const chain: Migration[] = [
    {
      from: 1,
      to: 2,
      description: 'rename gold → credits',
      migrate: ({ gold, ...rest }) => ({ ...rest, credits: gold }),
    },
    { from: 2, to: 3, description: 'add morale', migrate: (s) => ({ ...s, morale: 50 }) },
  ];

  it('chains migrations step by step and stamps the version', () => {
    const out = migrateState({ schemaVersion: 1, gold: 7 }, 1, 3, chain);
    expect(out).toEqual({ schemaVersion: 3, credits: 7, morale: 50 });
  });

  it('does not mutate the input', () => {
    const input = { schemaVersion: 1, gold: 7 };
    migrateState(input, 1, 3, chain);
    expect(input).toEqual({ schemaVersion: 1, gold: 7 });
  });

  it('fails clearly when a step is missing', () => {
    expect(() => migrateState({}, 1, 3, [chain[0]!])).toThrow(SaveError);
  });
});

describe('SaveRepository (IndexedDB)', () => {
  it('saves and loads a manual slot', async () => {
    const repo = await openRepo();
    const s = createNewGame({ seed: 'slot' });
    advanceTicks(s, TICKS_PER_DAY * 3 + 5);
    const meta = await repo.save('slot-1', s);
    expect(meta).toMatchObject({
      id: 'slot-1',
      kind: 'manual',
      year: 1,
      season: 'spring',
      dayOfSeason: 4,
    });
    expect(hashState(await repo.load('slot-1'))).toBe(hashState(s));
    repo.close();
  });

  it('rotates two autosave copies and loads the newest', async () => {
    const repo = await openRepo();
    const s = createNewGame({ seed: 'auto' });
    const first = await repo.autosave(s);
    advanceTicks(s, 10);
    const second = await repo.autosave(s);
    advanceTicks(s, 10);
    const third = await repo.autosave(s);
    expect(first.id).not.toBe(second.id);
    expect(third.id).toBe(first.id);
    const latest = await repo.loadLatestValid();
    expect(latest?.state.clock.tick).toBe(s.clock.tick);
    repo.close();
  });

  it('a session continued from a save evolves identically', async () => {
    const repo = await openRepo();
    const original = new GameSession(createNewGame({ seed: 'continue' }));
    original.advance(300);
    await repo.save('slot-2', original.getState());
    const restored = new GameSession(await repo.load('slot-2'));
    original.advance(500);
    restored.advance(500);
    expect(hashState(restored.getState())).toBe(hashState(original.getState()));
    repo.close();
  });

  it('lists slots newest first, deletes, and reports empty slots', async () => {
    const repo = await openRepo();
    const s = createNewGame({ seed: 'list' });
    await repo.save('slot-1', s);
    await repo.save('slot-3', s);
    expect((await repo.listSlots()).map((m) => m.id)).toEqual(['slot-3', 'slot-1']);
    await repo.delete('slot-3');
    expect((await repo.listSlots()).map((m) => m.id)).toEqual(['slot-1']);
    await expect(repo.load('slot-2')).rejects.toMatchObject({ code: 'not-found' });
    repo.close();
  });

  it('exports and re-imports a backup file', async () => {
    const repo = await openRepo();
    const s = createNewGame({ seed: 'export' });
    advanceTicks(s, 77);
    const imported = await importSaveBytes(await repo.exportBytes(s));
    expect(hashState(imported)).toBe(hashState(s));
    repo.close();
  });

  it('stores profile values', async () => {
    const repo = await openRepo();
    await repo.setProfile('seenCinematics', ['intro']);
    expect(await repo.getProfile<string[]>('seenCinematics')).toEqual(['intro']);
    repo.close();
  });
});
