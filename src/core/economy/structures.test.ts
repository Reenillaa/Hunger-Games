import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../content/buildings.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import type { StructureKind } from '../index.ts';
import { TICKS_PER_DAY, advanceTicks, createNewGame } from '../index.ts';

const manifest = JSON.parse(
  readFileSync('public/assets/district/sprites/manifest.json', 'utf8'),
) as { assets: Record<string, { footprint: [number, number] }> };

describe('structures catalogue', () => {
  it('every structure has a footprint, a sprite with the same footprint and a build thumbnail', () => {
    for (const kind of Object.keys(BUILDINGS) as StructureKind[]) {
      const fp = STRUCTURE_FOOTPRINTS[kind];
      expect(fp, kind).toBeDefined();
      const sprite = manifest.assets[kind];
      expect(sprite, kind).toBeDefined();
      expect(sprite!.footprint).toEqual([fp.w, fp.d]);
      if (BUILDINGS[kind].buildable)
        expect(existsSync(`public/assets/ui/thumbs/${kind}.webp`), kind).toBe(true);
    }
  });

  it('a staffed tavern lifts the morale every day', () => {
    const base = createNewGame({ seed: 'tavern' });
    const withTavern = createNewGame({ seed: 'tavern' });
    withTavern.district.structures.push({
      id: 's_tav',
      kind: 'tavern',
      x: 40,
      y: 40,
      level: 1,
      built: true,
      progress: 0,
      workers: 2,
      efficiency: 1,
    });
    base.economy.morale = 40;
    withTavern.economy.morale = 40;
    advanceTicks(base, TICKS_PER_DAY * 3);
    advanceTicks(withTavern, TICKS_PER_DAY * 3);
    expect(withTavern.economy.morale).toBeGreaterThan(base.economy.morale);
  });
});
