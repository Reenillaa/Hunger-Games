import { describe, expect, it } from 'vitest';
import type { PathGrid } from './astar.ts';
import { findPath } from './astar.ts';

function grid(rows: string[]): PathGrid {
  const height = rows.length;
  const width = rows[0]!.length;
  const cost = new Float32Array(width * height);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => (cost[y * width + x] = ch === '#' ? Infinity : ch === '~' ? 5 : 1)),
  );
  return { width, height, cost };
}

describe('findPath', () => {
  it('finds a straight path', () => {
    const p = findPath(grid(['.....']), { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(p?.map((c) => c.x)).toEqual([0, 1, 2, 3, 4]);
  });

  it('goes around walls and never cuts corners', () => {
    const g = grid(['.....', '.###.', '.....']);
    const p = findPath(g, { x: 0, y: 1 }, { x: 4, y: 1 })!;
    expect(p[0]).toEqual({ x: 0, y: 1 });
    expect(p.at(-1)).toEqual({ x: 4, y: 1 });
    for (const c of p) expect(g.cost[c.y * 5 + c.x]).not.toBe(Infinity);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1]!;
      const b = p[i]!;
      if (a.x !== b.x && a.y !== b.y) {
        expect(g.cost[a.y * 5 + b.x]).not.toBe(Infinity);
        expect(g.cost[b.y * 5 + a.x]).not.toBe(Infinity);
      }
    }
  });

  it('prefers cheap terrain', () => {
    const p = findPath(grid(['.~~~.', '.....']), { x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(p.some((c) => c.y === 1)).toBe(true);
  });

  it('returns null when unreachable or blocked', () => {
    expect(findPath(grid(['..#..']), { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
    expect(findPath(grid(['..#..']), { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('is deterministic', () => {
    const g = grid(['......', '......', '......']);
    expect(findPath(g, { x: 0, y: 0 }, { x: 5, y: 2 })).toEqual(
      findPath(g, { x: 0, y: 0 }, { x: 5, y: 2 }),
    );
  });
});
