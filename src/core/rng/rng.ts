/**
 * Deterministic, serializable PRNG (sfc32) seeded with cyrb128.
 * The state is a plain 4-tuple stored inside GameState, so saves reproduce the exact sequence.
 */
export type RngState = [number, number, number, number];

/** Hashes an arbitrary string into a 128-bit seed (cyrb128). */
export function seedFromString(input: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Advances the state in place and returns an unsigned 32-bit integer. */
export function nextU32(s: RngState): number {
  const a = s[0];
  const b = s[1];
  const c = s[2];
  const d = s[3];
  const t = (((a + b) | 0) + d) | 0;
  s[3] = (d + 1) | 0;
  s[0] = b ^ (b >>> 9);
  s[1] = (c + (c << 3)) | 0;
  const r = (c << 21) | (c >>> 11);
  s[2] = (r + t) | 0;
  return t >>> 0;
}

/** Float in [0, 1). */
export function nextFloat(s: RngState): number {
  return nextU32(s) / 4294967296;
}

/** Integer in [min, max] (both inclusive). */
export function nextInt(s: RngState, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`nextInt: invalid range [${min}, ${max}]`);
  }
  return min + Math.floor(nextFloat(s) * (max - min + 1));
}

/** Picks one element uniformly. Throws on empty arrays. */
export function pick<T>(s: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pick: empty array');
  return items[nextInt(s, 0, items.length - 1)] as T;
}

/** Weighted pick; weights must be >= 0 with a positive sum. Returns the chosen index. */
export function pickWeightedIndex(s: RngState, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) {
    if (w < 0 || !Number.isFinite(w)) throw new RangeError('pickWeightedIndex: invalid weight');
    total += w;
  }
  if (total <= 0) throw new RangeError('pickWeightedIndex: weights sum to zero');
  let roll = nextFloat(s) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Independent named streams: changing how one system consumes randomness
 * never shifts the sequence seen by another system.
 */
export const RNG_STREAMS = [
  'world',
  'population',
  'economy',
  'events',
  'selection',
  'capital',
  'arena',
  'regime',
] as const;
export type RngStreamId = (typeof RNG_STREAMS)[number];

export function createStreams(masterSeed: string): Record<RngStreamId, RngState> {
  const streams = {} as Record<RngStreamId, RngState>;
  for (const id of RNG_STREAMS) streams[id] = seedFromString(`${masterSeed}::${id}`);
  return streams;
}
