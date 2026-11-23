/**
 * A* on a square grid with 8-way movement (no corner cutting), octile heuristic.
 * Pure and deterministic: shared by the district townsfolk and the arena AI.
 */
export interface PathGrid {
  width: number;
  height: number;
  /** Cost to enter a cell; Infinity (or <= 0) means blocked. Index = y * width + x. */
  cost: Float32Array;
}

export interface Cell {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

export function cellCost(grid: PathGrid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return Infinity;
  const c = grid.cost[y * grid.width + x] ?? Infinity;
  return c > 0 ? c : Infinity;
}

export function isWalkable(grid: PathGrid, x: number, y: number): boolean {
  return Number.isFinite(cellCost(grid, x, y));
}

/** Minimal binary heap keyed by f-score (ties broken by insertion order for determinism). */
class Heap {
  private items: { node: number; f: number; seq: number }[] = [];
  private seq = 0;
  get size(): number {
    return this.items.length;
  }
  push(node: number, f: number): void {
    const items = this.items;
    items.push({ node, f, seq: this.seq++ });
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(items[p]!, items[i]!)) break;
      [items[p], items[i]] = [items[i]!, items[p]!];
      i = p;
    }
  }
  pop(): number {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && this.less(items[l]!, items[m]!)) m = l;
        if (r < items.length && this.less(items[r]!, items[m]!)) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i]!, items[m]!];
        i = m;
      }
    }
    return top.node;
  }
  private less(a: { f: number; seq: number }, b: { f: number; seq: number }): boolean {
    return a.f < b.f || (a.f === b.f && a.seq < b.seq);
  }
}

/** Returns the cell path from `from` to `to` (inclusive), or null if unreachable. */
export function findPath(grid: PathGrid, from: Cell, to: Cell, maxExpanded = 20000): Cell[] | null {
  if (!isWalkable(grid, to.x, to.y) || !isWalkable(grid, from.x, from.y)) return null;
  const w = grid.width;
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  const g = new Float32Array(grid.width * grid.height).fill(Infinity);
  const parent = new Int32Array(grid.width * grid.height).fill(-1);
  const closed = new Uint8Array(grid.width * grid.height);
  const h = (n: number) => {
    const dx = Math.abs((n % w) - to.x);
    const dy = Math.abs(Math.floor(n / w) - to.y);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = new Heap();
  g[start] = 0;
  open.push(start, h(start));
  let expanded = 0;
  while (open.size > 0 && expanded < maxExpanded) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded += 1;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    for (const [dx, dy, step] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const enter = cellCost(grid, nx, ny);
      if (!Number.isFinite(enter)) continue;
      // No cutting corners past blocked cells.
      if (
        dx !== 0 &&
        dy !== 0 &&
        (!isWalkable(grid, cx + dx, cy) || !isWalkable(grid, cx, cy + dy))
      )
        continue;
      const n = ny * w + nx;
      const cand = g[cur]! + step * enter;
      if (cand < g[n]!) {
        g[n] = cand;
        parent[n] = cur;
        open.push(n, cand + h(n));
      }
    }
  }
  if (parent[goal] === -1 && goal !== start) return null;
  const path: Cell[] = [];
  for (let n = goal; n !== -1; n = parent[n]!) {
    path.push({ x: n % w, y: Math.floor(n / w) });
    if (n === start) break;
  }
  return path.reverse();
}
