import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../content/maps/index.ts';
import { terrainAt } from '../../core/district/template.ts';
import { Relief } from './relief.ts';

describe('district relief (visual heights)', () => {
  const template = TEMPLATES.d12!;
  const relief = new Relief(template, 31);

  it('keeps every cell the town uses perfectly flat', () => {
    for (let y = 0; y < template.height; y++)
      for (let x = 0; x < template.width; x++) {
        const c = terrainAt(template, x, y);
        if (c === 'R' || c === 'f') continue;
        expect(relief.flat(x, y), `${c} at ${x},${y}`).toBe(true);
        expect(relief.cell(x, y)).toBe(0);
      }
  });

  it('raises the mountain into a clear cliff above the valley', () => {
    let raised = 0;
    for (let y = 0; y < 10; y++)
      for (let x = 20; x < 40; x++) if (relief.cell(x, y) > 1) raised++;
    expect(raised).toBeGreaterThan(150);
    expect(relief.peak).toBeGreaterThan(3);
  });

  it('is deterministic for a seed', () => {
    const again = new Relief(template, 31);
    expect(again.at(30.3, 5.7)).toBe(relief.at(30.3, 5.7));
  });

  it('lights the slopes by their facing and darkens the foot of the cliffs', () => {
    // The cliff faces turned away from the sun (north-east) are darker than those facing it.
    const facing = (x: number, y: number) => {
      const n = relief.normal(x, y);
      return n.x * -0.44 + n.y * 0.11 + n.z * 0.89;
    };
    let lit = 0;
    let dim = 0;
    for (let y = 0; y < 34; y += 0.5)
      for (let x = 0; x < 64; x += 0.5) {
        if (relief.at(x, y) <= 0.2) continue;
        const f = facing(x, y);
        if (f > 0.95) lit++;
        if (f < 0.75) dim++;
      }
    expect(lit).toBeGreaterThan(0);
    expect(dim).toBeGreaterThan(0);
    // The foot of the west cliffs is a hollow; the open valley is neither shaded nor enclosed.
    expect(relief.occlusion(13.6, 28)).toBeGreaterThan(0);
    expect(relief.sunlit(35, 40, 0)).toBe(1);
    expect(relief.occlusion(35, 40)).toBe(0);
  });
});
