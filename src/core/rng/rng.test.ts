import { describe, expect, it } from 'vitest';
import {
  createStreams,
  nextFloat,
  nextInt,
  nextU32,
  pickWeightedIndex,
  seedFromString,
} from './rng.ts';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = seedFromString('veta-negra');
    const b = seedFromString('veta-negra');
    const seqA = Array.from({ length: 50 }, () => nextU32(a));
    const seqB = Array.from({ length: 50 }, () => nextU32(b));
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = seedFromString('seed-a');
    const b = seedFromString('seed-b');
    expect(nextU32(a)).not.toBe(nextU32(b));
  });

  it('keeps floats in [0,1) and ints in range', () => {
    const s = seedFromString('range');
    for (let i = 0; i < 5000; i++) {
      const f = nextFloat(s);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(s, -3, 7);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('is roughly uniform', () => {
    const s = seedFromString('uniform');
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) buckets[nextInt(s, 0, 9)]! += 1;
    for (const count of buckets) expect(Math.abs(count - n / 10)).toBeLessThan((n / 10) * 0.05);
  });

  it('respects weights and never picks zero-weight entries', () => {
    const s = seedFromString('weights');
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[pickWeightedIndex(s, [1, 0, 3])]! += 1;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(2.7);
    expect(counts[2]! / counts[0]!).toBeLessThan(3.3);
  });

  it('creates independent streams that survive JSON round-trips', () => {
    const streams = createStreams('master');
    const copy = JSON.parse(JSON.stringify(streams)) as typeof streams;
    expect(nextU32(streams.arena)).toBe(nextU32(copy.arena));
    expect(streams.arena).not.toEqual(streams.economy);
  });

  it('rejects invalid ranges', () => {
    const s = seedFromString('x');
    expect(() => nextInt(s, 5, 1)).toThrow(RangeError);
  });
});
