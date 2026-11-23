import type { RngState } from '../rng/rng.ts';
import { nextFloat, pick } from '../rng/rng.ts';
import type { DistrictTemplate, PropKind, StructureKind, TerrainCode } from './template.ts';
import { isBuildable, terrainAt } from './template.ts';
import { buildWalkGrid, entranceOf } from './walkGrid.ts';

export interface PlacedStructure {
  id: string;
  kind: StructureKind;
  /** Top-left cell of the footprint. */
  x: number;
  y: number;
  /** 1–3; upgrades change capacity (and, from Phase 10, the sprite). */
  level: number;
  /** False while under construction. */
  built: boolean;
  /** Construction progress in worker-hours. */
  progress: number;
  /** Workers currently assigned (recomputed by the labour allocator). */
  workers: number;
}

export interface PlacedProp {
  kind: PropKind;
  x: number;
  y: number;
  /** Sub-cell offset in cells (−0.35..0.35), for natural placement. */
  ox: number;
  oy: number;
}

export interface DistrictState {
  templateId: string;
  structures: PlacedStructure[];
  props: PlacedProp[];
}

export type FootprintTable = Record<StructureKind, { w: number; d: number }>;

/** Fixed landmarks of District XII (positions designed against the d12 template). */
const LANDMARKS: { kind: StructureKind; x: number; y: number }[] = [
  { kind: 'town_hall', x: 21, y: 18 },
  { kind: 'stage', x: 25, y: 21 },
  { kind: 'mine_headframe', x: 15, y: 7 },
  { kind: 'warehouse', x: 38, y: 20 },
  { kind: 'economato', x: 31, y: 25 },
  { kind: 'lumber_camp', x: 12, y: 31 },
  { kind: 'quarry', x: 37, y: 9 },
];

const HOUSES = { house_terrace: 9, house_shack: 13 } as const;

/** Two decimals; `+ 0` turns -0 into 0 so JSON round-trips are exact. */
const round2 = (v: number) => Math.round(v * 100) / 100 + 0;

/**
 * Builds the initial district layout. Deterministic for a given template + RNG state:
 * same seed ⇒ same houses, trees and rocks. Landmarks are fixed by design.
 */
export function generateDistrict(
  template: DistrictTemplate,
  footprints: FootprintTable,
  rng: RngState,
): DistrictState {
  const occupied = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const structures: PlacedStructure[] = [];
  let counter = 1;

  const cellsOf = (kind: StructureKind, x: number, y: number) => {
    const { w, d } = footprints[kind];
    const cells: [number, number][] = [];
    for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) cells.push([x + dx, y + dy]);
    return cells;
  };
  const place = (kind: StructureKind, x: number, y: number) => {
    for (const [cx, cy] of cellsOf(kind, x, y)) occupied.add(key(cx, cy));
    structures.push({
      id: `s_${(counter++).toString(36)}`,
      kind,
      x,
      y,
      level: 1,
      built: true,
      progress: 0,
      workers: 0,
    });
  };

  for (const l of LANDMARKS) place(l.kind, l.x, l.y);

  // Houses: as close to the plaza as possible, with a one-cell alley around each.
  const { plaza } = template;
  const px = (plaza.x0 + plaza.x1) / 2;
  const py = (plaza.y0 + plaza.y1) / 2;
  const canHouse = (kind: StructureKind, x: number, y: number) => {
    const { w, d } = footprints[kind];
    for (let dy = -1; dy <= d; dy++) {
      for (let dx = -1; dx <= w; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        const inside = dx >= 0 && dy >= 0 && dx < w && dy < d;
        if (inside && !isBuildable(template, cx, cy)) return false;
        if (occupied.has(key(cx, cy))) return false;
      }
    }
    return true;
  };
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      if (!isBuildable(template, x, y)) continue;
      const nearRoad = hasNeighbour(template, x, y, 2, 'r');
      const dist = Math.hypot(x - px, y - py);
      candidates.push({ x, y, score: dist - (nearRoad ? 3 : 0) + nextFloat(rng) * 4 });
    }
  }
  candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
  // A house must never cut the town in two (e.g. by blocking the bridge): flood-fill check.
  const stillConnected = (): boolean => {
    const district = { templateId: template.id, structures, props: [] };
    const grid = buildWalkGrid(template, district, footprints);
    const start = template.plaza.y1 * grid.width + template.plaza.x0;
    const seen = new Uint8Array(grid.width * grid.height);
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const n = stack.pop()!;
      const x = n % grid.width;
      const y = Math.floor(n / grid.width);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        const k = ny * grid.width + nx;
        if (!seen[k] && Number.isFinite(grid.cost[k]!)) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    return structures.every((s) => {
      if (s.kind === 'stage') return true;
      const door = entranceOf(s, footprints, grid);
      return door !== null && seen[door.y * grid.width + door.x] === 1;
    });
  };
  const tryPlace = (kind: StructureKind, x: number, y: number): boolean => {
    place(kind, x, y);
    if (stillConnected()) return true;
    const removed = structures.pop()!;
    for (const [cx, cy] of cellsOf(removed.kind, removed.x, removed.y))
      occupied.delete(key(cx, cy));
    return false;
  };
  const remaining: Record<'house_terrace' | 'house_shack', number> = { ...HOUSES };
  for (const c of candidates) {
    if (remaining.house_terrace + remaining.house_shack === 0) break;
    const order: ('house_terrace' | 'house_shack')[] =
      nextFloat(rng) < 0.45 ? ['house_terrace', 'house_shack'] : ['house_shack', 'house_terrace'];
    for (const kind of order) {
      if (remaining[kind] > 0 && canHouse(kind, c.x, c.y) && tryPlace(kind, c.x, c.y)) {
        remaining[kind] -= 1;
        break;
      }
    }
  }

  // Two vegetable gardens next to the houses.
  let gardens = 2;
  for (const c of candidates) {
    if (gardens === 0) break;
    if (canHouse('garden', c.x, c.y) && tryPlace('garden', c.x, c.y)) gardens -= 1;
  }

  // Props.
  const props: PlacedProp[] = [];
  const offset = () => round2((nextFloat(rng) - 0.5) * 0.7);
  const addProp = (kind: PropKind, x: number, y: number, jitter = true) => {
    occupied.add(key(x, y));
    props.push({ kind, x, y, ox: jitter ? offset() : 0, oy: jitter ? offset() : 0 });
  };
  const pines: PropKind[] = ['pine_a', 'pine_b', 'pine_c'];
  const rocks: PropKind[] = ['rock_a', 'rock_b', 'rock_c'];
  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      if (occupied.has(key(x, y))) continue;
      const code = terrainAt(template, x, y) as TerrainCode;
      const dist = Math.hypot(x - px, y - py);
      const roll = nextFloat(rng);
      if (code === 'f' && roll < 0.55) addProp(pick(rng, pines), x, y);
      else if (code === 's' && roll < 0.22) addProp(pick(rng, rocks), x, y);
      else if (code === 'g' && dist > 13 && roll < 0.035) addProp(pick(rng, pines), x, y);
      else if (code === 'g' && dist > 9 && roll > 0.985) addProp(pick(rng, rocks), x, y);
      else if (code === 'v' && roll < 0.25) addProp('dead_tree', x, y);
    }
  }

  // Street lamps along roads near the plaza.
  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      if (occupied.has(key(x, y)) || !isBuildable(template, x, y)) continue;
      if (Math.hypot(x - px, y - py) > 11 || !hasNeighbour(template, x, y, 1, 'r')) continue;
      if ((x * 7 + y * 13) % 5 === 0) addProp('lamp', x, y, false);
    }
  }
  // Working clutter near the mine, warehouse, station and shop.
  const clutter: [PropKind, number, number][] = [
    ['coal_heap', 18, 10],
    ['coal_heap', 42, 23],
    ['coal_heap', 42, 27],
    ['supplies', 37, 23],
    ['supplies', 33, 27],
  ];
  for (const [kind, x, y] of clutter) if (!occupied.has(key(x, y))) addProp(kind, x, y);

  props.sort((a, b) => a.y - b.y || a.x - b.x);
  return { templateId: template.id, structures, props };
}

function hasNeighbour(
  t: DistrictTemplate,
  x: number,
  y: number,
  radius: number,
  code: TerrainCode,
): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++)
      if (terrainAt(t, x + dx, y + dy) === code) return true;
  }
  return false;
}
