import arena from '../../content/maps/arena_forest.json' with { type: 'json' };
import type { PathGrid } from '../path/astar.ts';

export type ArenaCode = 'c' | 'F' | 'D' | 'b' | 'r' | 'R' | 'w' | 'W' | 'v' | 'u' | 'X';

export interface ArenaTemplate {
  id: string;
  width: number;
  height: number;
  terrain: string[];
  elevation: number[][];
}

export const ARENA: ArenaTemplate = arena as ArenaTemplate;
export const ARENA_SIZE = ARENA.width;

export function codeAt(x: number, y: number): ArenaCode | null {
  if (x < 0 || y < 0 || x >= ARENA.width || y >= ARENA.height) return null;
  return (ARENA.terrain[y]?.[x] as ArenaCode | undefined) ?? null;
}

/** Movement points to enter a cell (GAME_SYSTEMS §10.2). Infinity = impassable. */
export const MOVE_COST: Record<ArenaCode, number> = {
  c: 2,
  X: 2,
  b: 4,
  F: 3,
  D: 5,
  r: 4,
  u: 3,
  v: 3,
  w: 5,
  W: Infinity,
  R: Infinity,
};

/** How much a cell blocks the line of sight (accumulated along the ray). */
export const OPACITY: Record<ArenaCode, number> = {
  c: 0,
  X: 0,
  b: 0.25,
  F: 0.2,
  D: 0.5,
  r: 0.45,
  u: 0.4,
  v: 0.6,
  w: 0,
  W: 0,
  R: 1,
};

/** Cover against attacks (percentage points off the hit chance). */
export const COVER: Record<ArenaCode, number> = {
  c: 0,
  X: 0,
  b: 15,
  F: 10,
  D: 25,
  r: 30,
  u: 25,
  v: 35,
  w: 0,
  W: 0,
  R: 0,
};

export function arenaGrid(): PathGrid {
  const cost = new Float32Array(ARENA.width * ARENA.height);
  for (let y = 0; y < ARENA.height; y++)
    for (let x = 0; x < ARENA.width; x++)
      cost[y * ARENA.width + x] = MOVE_COST[codeAt(x, y) ?? 'R'];
  return { width: ARENA.width, height: ARENA.height, cost };
}

/** Bresenham line of sight with accumulated opacity (forest thins vision, rock blocks it). */
export function lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let opacity = 0;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) break;
    opacity += OPACITY[codeAt(x, y) ?? 'R'];
    if (opacity >= 1) return false;
  }
  return true;
}

export const isWater = (x: number, y: number) => codeAt(x, y) === 'w' || codeAt(x, y) === 'W';
export const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));
