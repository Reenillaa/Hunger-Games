import { describe, expect, it } from 'vitest';
import {
  TILE_H,
  TILE_W,
  cellToWorld,
  depthOf,
  mapBounds,
  pickCell,
  worldToCell,
} from './projection.ts';

describe('isometric projection', () => {
  it('projects the origin to (0,0) and steps half a tile per cell', () => {
    expect(cellToWorld(0, 0)).toEqual({ x: 0, y: 0 });
    expect(cellToWorld(1, 0)).toEqual({ x: TILE_W / 2, y: TILE_H / 2 });
    expect(cellToWorld(0, 1)).toEqual({ x: -TILE_W / 2, y: TILE_H / 2 });
  });

  it('round-trips cells through the inverse projection', () => {
    for (let cx = 0; cx < 20; cx++) {
      for (let cy = 0; cy < 20; cy++) {
        const p = cellToWorld(cx, cy);
        const back = worldToCell(p.x, p.y);
        expect(back.cx).toBeCloseTo(cx);
        expect(back.cy).toBeCloseTo(cy);
        expect(pickCell(p.x + 10, p.y - 5)).toEqual({ cx, cy });
      }
    }
  });

  it('orders depth back-to-front', () => {
    expect(depthOf(0, 0)).toBeLessThan(depthOf(1, 0));
    expect(depthOf(3, 2)).toBeLessThan(depthOf(3, 3));
  });

  it('computes map bounds containing all cells', () => {
    const b = mapBounds(48, 48);
    for (const [cx, cy] of [
      [0, 0],
      [47, 0],
      [0, 47],
      [47, 47],
    ] as const) {
      const p = cellToWorld(cx, cy);
      expect(p.x).toBeGreaterThanOrEqual(b.x);
      expect(p.x).toBeLessThanOrEqual(b.x + b.width);
      expect(p.y).toBeGreaterThanOrEqual(b.y);
      expect(p.y).toBeLessThanOrEqual(b.y + b.height);
    }
  });
});
