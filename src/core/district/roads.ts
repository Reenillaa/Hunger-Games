import type { DistrictState, FootprintTable } from './generate.ts';
import type { DistrictTemplate } from './template.ts';
import { terrainAt } from './template.ts';

/** Longest path the town lays by itself to connect a new building. */
export const MAX_AUTO_ROAD = 40;

/** True for cells that already count as road (template roads, plaza, bridges, laid roads). */
export function isRoad(template: DistrictTemplate, district: DistrictState, x: number, y: number) {
  const code = terrainAt(template, x, y);
  if (code === 'r' || code === 'p' || code === 'b') return true;
  return district.roads.includes(y * template.width + x);
}

/**
 * Lays a dirt path from a new building's front to the nearest road (DECISIONS I-55): a
 * breadth-first search over open land that prefers straight runs, so paths grow on their own
 * as the district grows and nobody has to draw them. Deterministic. Returns the cells laid.
 */
export function layRoadTo(
  template: DistrictTemplate,
  district: DistrictState,
  footprints: FootprintTable,
  structureId: string,
): number[] {
  const s = district.structures.find((st) => st.id === structureId);
  if (!s) return [];
  const { width, height } = template;
  const blocked = new Uint8Array(width * height);
  for (const st of district.structures) {
    const { w, d } = footprints[st.kind];
    for (let dy = 0; dy < d; dy++)
      for (let dx = 0; dx < w; dx++) blocked[(st.y + dy) * width + st.x + dx] = 1;
  }
  const open = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    if (blocked[y * width + x]) return false;
    const code = terrainAt(template, x, y);
    return code === 'g' || code === 'd' || code === 'c' || code === 'f' || code === 'v';
  };
  // Sources: the cells in front of the door first (front faces +y), then the other sides.
  const { w, d } = footprints[s.kind];
  const sources: [number, number][] = [];
  for (let dx = 0; dx < w; dx++) sources.push([s.x + dx, s.y + d]);
  for (let dy = 0; dy < d; dy++) sources.push([s.x + w, s.y + dy], [s.x - 1, s.y + dy]);
  for (let dx = 0; dx < w; dx++) sources.push([s.x + dx, s.y - 1]);
  const prev = new Int32Array(width * height).fill(-2);
  const dirOf = new Int8Array(width * height).fill(-1);
  const dist = new Int32Array(width * height).fill(-1);
  let queue: number[] = [];
  for (const [x, y] of sources) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const k = y * width + x;
    if (isRoad(template, district, x, y)) return []; // already touching a road
    if (!open(x, y) || prev[k] !== -2) continue;
    prev[k] = -1;
    dist[k] = 0;
    queue.push(k);
  }
  const DIRS = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ] as const;
  let target = -1;
  // Layered BFS; inside a layer, keep going straight when possible (fewer zigzags).
  while (queue.length > 0 && target < 0) {
    const next: number[] = [];
    for (const k of queue) {
      if (dist[k]! >= MAX_AUTO_ROAD) continue;
      const x = k % width;
      const y = (k - x) / width;
      const order = dirOf[k]! >= 0 ? [dirOf[k]!, 0, 1, 2, 3] : [0, 1, 2, 3];
      for (const di of order) {
        const [dx, dy] = DIRS[di]!;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nk = ny * width + nx;
        if (prev[nk] !== -2) continue;
        if (isRoad(template, district, nx, ny)) {
          prev[nk] = k;
          target = nk;
          break;
        }
        if (!open(nx, ny)) continue;
        prev[nk] = k;
        dirOf[nk] = di;
        dist[nk] = dist[k]! + 1;
        next.push(nk);
      }
      if (target >= 0) break;
    }
    queue = next;
  }
  if (target < 0) return [];
  const laid: number[] = [];
  for (let k = prev[target]!; k >= 0; k = prev[k]!) laid.push(k);
  laid.reverse();
  district.roads.push(...laid.filter((k) => !district.roads.includes(k)));
  // Trees and rocks on the new path are cleared.
  const onPath = new Set(laid);
  district.props = district.props.filter((p) => !onPath.has(p.y * width + p.x));
  return laid;
}
