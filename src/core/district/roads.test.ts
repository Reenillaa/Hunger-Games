import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../content/maps/index.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import { applyCommand, checkPlacement, createNewGame } from '../index.ts';
import { isRoad } from './roads.ts';

describe('roads that lay themselves', () => {
  it('a new building gets a path from its door to the nearest road', () => {
    const s = createNewGame({ seed: 'roads' });
    s.economy.resources.wood = 999;
    s.economy.resources.stone = 999;
    const t = TEMPLATES[s.district.templateId]!;
    // A spot away from the existing roads, in the new meadow of the bigger map.
    let spot: { x: number; y: number } | null = null;
    for (let y = 50; y < 60 && !spot; y++)
      for (let x = 40; x < 60 && !spot; x++)
        if (checkPlacement(s, 'house_shack', x, y) === null) spot = { x, y };
    expect(spot).not.toBeNull();
    expect(applyCommand(s, { type: 'build/place', kind: 'house_shack', ...spot! }).ok).toBe(true);
    expect(s.district.roads.length).toBeGreaterThan(0);
    // The path is continuous and ends next to an older road.
    const cells = new Set(s.district.roads);
    const w = t.width;
    for (const k of s.district.roads) {
      const x = k % w;
      const y = Math.floor(k / w);
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(
        ([dx, dy]) => cells.has((y + dy!) * w + x + dx!) || isRoad(t, s.district, x + dx!, y + dy!),
      );
      expect(touches).toBe(true);
    }
    // Nothing can be built on top of the new path.
    const first = s.district.roads[0]!;
    expect(checkPlacement(s, 'garden', first % w, Math.floor(first / w))).not.toBeNull();
    // No structure footprint sits on a laid road.
    for (const st of s.district.structures) {
      const { w: fw, d } = STRUCTURE_FOOTPRINTS[st.kind];
      for (let dy = 0; dy < d; dy++)
        for (let dx = 0; dx < fw; dx++) expect(cells.has((st.y + dy) * w + st.x + dx)).toBe(false);
    }
  });
});
