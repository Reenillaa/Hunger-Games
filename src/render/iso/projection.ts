/**
 * Square logical grid ⇄ 2:1 isometric screen projection (DECISIONS I-11, ART_BIBLE §3).
 * World units at 1× scale: one cell is TILE_W × TILE_H on screen.
 */
export const TILE_W = 128;
export const TILE_H = 64;
export const ELEVATION_PX = 32;

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Centre of cell (cx, cy) at elevation z, in world pixels. */
export function cellToWorld(cx: number, cy: number, z = 0): ScreenPoint {
  return {
    x: (cx - cy) * (TILE_W / 2),
    y: (cx + cy) * (TILE_H / 2) - z * ELEVATION_PX,
  };
}

/** Inverse projection at elevation 0. Returns fractional cell coordinates. */
export function worldToCell(x: number, y: number): { cx: number; cy: number } {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2);
  return { cx: (a + b) / 2, cy: (b - a) / 2 };
}

/** Integer cell under a world point (cells are centred on their projected point). */
export function pickCell(x: number, y: number): { cx: number; cy: number } {
  const { cx, cy } = worldToCell(x, y);
  return { cx: Math.round(cx) + 0, cy: Math.round(cy) + 0 }; // +0 normalizes -0
}

/** Painter's order: further back (smaller cx+cy) draws first. */
export function depthOf(cx: number, cy: number, z = 0): number {
  return (cx + cy) * 16 + z;
}

/** World-space bounding box of a W×H map. */
export function mapBounds(width: number, height: number) {
  const left = cellToWorld(0, height - 1).x - TILE_W / 2;
  const right = cellToWorld(width - 1, 0).x + TILE_W / 2;
  const top = cellToWorld(0, 0).y - TILE_H / 2;
  const bottom = cellToWorld(width - 1, height - 1).y + TILE_H / 2;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
