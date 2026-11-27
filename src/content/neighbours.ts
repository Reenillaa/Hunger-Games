import world from './maps/world.json' with { type: 'json' };

export type EdgeDir = 'n' | 'e' | 's' | 'w';

const MARKERS = world.markers as unknown as Record<string, [number, number]>;
const DIRS: Record<EdgeDir, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

/**
 * The district that lies beyond the fog in a direction (DECISIONS I-61): on the world map, the
 * nearest district within ±60° of that direction from home. Null at the edge of the known world.
 */
export function neighbourOf(home: string, dir: EdgeDir): string | null {
  const from = MARKERS[home];
  if (!from) return null;
  const [dx, dy] = DIRS[dir];
  let best: string | null = null;
  let bestScore = 0;
  for (const [id, [x, y]] of Object.entries(MARKERS)) {
    if (id === home || !id.startsWith('d')) continue;
    const vx = x - from[0];
    const vy = (y - from[1]) * 0.75;
    const dist = Math.hypot(vx, vy);
    const cos = (vx * dx + vy * dy) / Math.max(1e-6, dist);
    if (cos < 0.5) continue;
    const score = cos / dist;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/** Map positions of every place (fractions of the parchment), for the borders. */
export function worldMarkers(): Record<string, [number, number]> {
  return MARKERS;
}
