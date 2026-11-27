import type { DistrictTemplate, TerrainCode } from '../../core/district/template.ts';
import { terrainAt } from '../../core/district/template.ts';

/**
 * The visual relief of a district (DECISIONS I-76): heights the eye sees, never the rules. The
 * template's mountains rise as rocky cliffs, the woods roll in gentle hills, and everything the
 * town uses (grass, earth, roads, plaza, water, rails, fields) stays at height 0, so buildings,
 * paths and people never sit on a slope.
 *
 * Heights are in cells (one unit of height is one cell length, like the sprites' renders).
 */

/** Direction towards the sun in grid space (cx, cy, z): the buildings' key light, upper left. */
export const SUN = (() => {
  const v = [-0.8, 0.2, 1.6];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return { x: v[0]! / n, y: v[1]! / n, z: v[2]! / n };
})();

/** Terrain that may rise: rock, scree and woods. Everything else is the town's flat floor. */
const RAISED: ReadonlySet<TerrainCode> = new Set(['R', 'f']);

function noise2(x: number, y: number, seed: number): number {
  // Smooth value noise from a hashed lattice (render-only, deterministic).
  const h = (i: number, j: number) => {
    const v = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal noise in [0, 1). */
export function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x * f, y * f, seed + o * 13) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export class Relief {
  readonly width: number;
  readonly height: number;
  /** Height per cell centre. */
  private readonly cells: Float32Array;
  /** Height per cell corner ((W + 1) × (H + 1)): the smooth surface the ground is drawn from. */
  private readonly corners: Float32Array;
  /** Largest height on the map (for shadow marching). */
  readonly peak: number;

  constructor(template: DistrictTemplate, seed: number) {
    const W = template.width;
    const H = template.height;
    this.width = W;
    this.height = H;
    const code = (x: number, y: number) => terrainAt(template, x, y);
    // Distance (in cells, capped) from each raised cell to the nearest flat one: slopes start
    // at the edge of the town floor and the woods only swell well inside.
    const dist = new Float32Array(W * H).fill(99);
    const queue: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = code(x, y);
        if (!c || !RAISED.has(c)) {
          dist[y * W + x] = 0;
          queue.push(y * W + x);
        }
      }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]!;
      const x = i % W;
      const y = Math.floor(i / W);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (dist[j]! > dist[i]! + 1) {
          dist[j] = dist[i]! + 1;
          queue.push(j);
        }
      }
    }
    this.cells = new Float32Array(W * H);
    let peak = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = code(x, y);
        const d = dist[y * W + x]!;
        let h = 0;
        if (c === 'R') {
          // The template's mountain, never lower than a clear cliff, with a rugged top.
          const base = Math.max(template.elevation[y]?.[x] ?? 0, 1.4);
          const rim = Math.min(1, d / 2);
          h = (base + (fbm(x * 0.35, y * 0.35, seed) - 0.5) * 1.1) * (0.55 + 0.45 * rim);
        } else if (c === 'f') {
          // Rolling wooded hills, flat at the edge of the woods.
          const swell = Math.min(1, Math.max(0, (d - 1) / 3));
          h = fbm(x * 0.12, y * 0.12, seed + 5) * 1.6 * swell;
        }
        h = Math.max(0, h);
        this.cells[y * W + x] = h;
        peak = Math.max(peak, h);
      }
    this.peak = peak;
    this.corners = new Float32Array((W + 1) * (H + 1));
    for (let j = 0; j <= H; j++)
      for (let i = 0; i <= W; i++) {
        // A corner touching the town floor stays at 0: flat land meets the slope cleanly.
        let sum = 0;
        let n = 0;
        let floor = false;
        for (const [x, y] of [
          [i - 1, j - 1],
          [i, j - 1],
          [i - 1, j],
          [i, j],
        ] as const) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const v = this.cells[y * W + x]!;
          if (v === 0) floor = true;
          sum += v;
          n++;
        }
        this.corners[j * (W + 1) + i] = floor || n === 0 ? 0 : sum / n;
      }
  }

  /** Height of a cell centre (for placing sprites). */
  cell(x: number, y: number): number {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return 0;
    return this.at(x, y);
  }

  /** Smooth surface height at fractional cell coordinates (cell centres at integers). */
  at(x: number, y: number): number {
    // Corner (i, j) sits at cell coordinates (i − 0.5, j − 0.5).
    const u = Math.min(this.width, Math.max(0, x + 0.5));
    const v = Math.min(this.height, Math.max(0, y + 0.5));
    const i = Math.min(this.width - 1, Math.floor(u));
    const j = Math.min(this.height - 1, Math.floor(v));
    const fx = u - i;
    const fy = v - j;
    const W1 = this.width + 1;
    const a = this.corners[j * W1 + i]!;
    const b = this.corners[j * W1 + i + 1]!;
    const c = this.corners[(j + 1) * W1 + i]!;
    const d = this.corners[(j + 1) * W1 + i + 1]!;
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  /** True when the whole cell lies on the flat floor. */
  flat(x: number, y: number): boolean {
    const W1 = this.width + 1;
    return (
      this.corners[y * W1 + x] === 0 &&
      this.corners[y * W1 + x + 1] === 0 &&
      this.corners[(y + 1) * W1 + x] === 0 &&
      this.corners[(y + 1) * W1 + x + 1] === 0
    );
  }

  /** Surface normal (unit) at a point. */
  normal(x: number, y: number): { x: number; y: number; z: number } {
    const e = 0.25;
    const dx = (this.at(x + e, y) - this.at(x - e, y)) / (2 * e);
    const dy = (this.at(x, y + e) - this.at(x, y - e)) / (2 * e);
    const n = Math.hypot(dx, dy, 1);
    return { x: -dx / n, y: -dy / n, z: 1 / n };
  }

  /** 0 when the sun is blocked by higher ground between the point and the sun, else 1. */
  sunlit(x: number, y: number, z = this.at(x, y)): number {
    if (this.peak <= z) return 1;
    const horizontal = Math.hypot(SUN.x, SUN.y);
    const rise = SUN.z / horizontal; // height gained per cell walked towards the sun
    const sx = SUN.x / horizontal;
    const sy = SUN.y / horizontal;
    for (let t = 0.35; t < 12; t += 0.35) {
      const h = z + t * rise;
      if (h > this.peak) return 1;
      if (this.at(x + sx * t, y + sy * t) > h) return 0;
    }
    return 1;
  }

  /** How enclosed a point is (0 open … 1 deep in a hollow at the foot of a cliff). */
  occlusion(x: number, y: number): number {
    const z = this.at(x, y);
    let above = 0;
    for (const [dx, dy] of [
      [1.5, 0],
      [-1.5, 0],
      [0, 1.5],
      [0, -1.5],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ] as const)
      above += Math.max(0, this.at(x + dx, y + dy) - z);
    return Math.min(1, above / 6);
  }
}
