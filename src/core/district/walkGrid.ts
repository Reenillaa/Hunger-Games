import type { PathGrid } from '../path/astar.ts';
import type { DistrictState, FootprintTable, PlacedStructure } from './generate.ts';
import type { DistrictTemplate, TerrainCode } from './template.ts';
import { terrainAt } from './template.ts';

/** Cost of walking through each terrain (Infinity = impassable). Roads are preferred. */
const TERRAIN_COST: Record<TerrainCode, number> = {
  r: 1,
  b: 1,
  p: 1,
  d: 1.4,
  v: 1.6,
  t: 2,
  g: 2,
  c: 2.2,
  f: 2.6,
  s: 3.5,
  w: Infinity,
  R: Infinity,
};

export function buildWalkGrid(
  template: DistrictTemplate,
  district: DistrictState,
  footprints: FootprintTable,
): PathGrid {
  const { width, height } = template;
  const cost = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cost[y * width + x] = TERRAIN_COST[terrainAt(template, x, y) ?? 'R'];
    }
  }
  for (const s of district.structures) {
    const { w, d } = footprints[s.kind];
    for (let dy = 0; dy < d; dy++)
      for (let dx = 0; dx < w; dx++) cost[(s.y + dy) * width + s.x + dx] = Infinity;
  }
  return { width, height, cost };
}

/** Walkable cell just in front of a structure's door (front faces +y in cell space). */
export function entranceOf(
  s: PlacedStructure,
  footprints: FootprintTable,
  grid: PathGrid,
): { x: number; y: number } | null {
  const { w, d } = footprints[s.kind];
  const candidates = [
    { x: s.x, y: s.y + d },
    { x: s.x + Math.floor(w / 2), y: s.y + d },
    { x: s.x + w, y: s.y + d - 1 },
    { x: s.x - 1, y: s.y },
    { x: s.x, y: s.y - 1 },
  ];
  for (const c of candidates) {
    if (
      c.x >= 0 &&
      c.y >= 0 &&
      c.x < grid.width &&
      c.y < grid.height &&
      Number.isFinite(grid.cost[c.y * grid.width + c.x]!)
    ) {
      return c;
    }
  }
  return null;
}
