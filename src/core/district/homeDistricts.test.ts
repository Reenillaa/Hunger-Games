import { describe, expect, it } from 'vitest';
import { HOME_DISTRICTS } from '../../content/homeDistricts.ts';
import { TEMPLATES } from '../../content/maps/index.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import {
  TICKS_PER_DAY,
  advanceTicks,
  buildWalkGrid,
  checkPlacement,
  createNewGame,
  entranceOf,
  findPath,
  livingCitizens,
} from '../index.ts';

describe('playable home districts', () => {
  for (const profile of Object.values(HOME_DISTRICTS)) {
    it(`${profile.id}: generates a connected town with its landmarks and families`, () => {
      const s = createNewGame({ seed: `home-${profile.id}`, homeDistrict: profile.id });
      expect(s.meta.homeDistrictId).toBe(profile.id);
      expect(s.district.templateId).toBe(profile.templateId);
      // Civic buildings exactly where planned; the rest within reach of their planned spot.
      for (const l of profile.landmarks) {
        const exact = l.kind === 'town_hall' || l.kind === 'stage';
        const found = s.district.structures.some(
          (st) =>
            st.kind === l.kind &&
            (exact
              ? st.x === l.x && st.y === l.y
              : Math.abs(st.x - l.x) <= 12 && Math.abs(st.y - l.y) <= 12),
        );
        expect(found, `${profile.id} ${l.kind}`).toBe(true);
      }
      const houses = s.district.structures.filter((st) => st.kind.startsWith('house'));
      expect(houses.length).toBeGreaterThan(15);
      expect(livingCitizens(s.population).length).toBeGreaterThan(60);
      expect(s.economy.quota.required).toBe(profile.baseQuota);
      // Every workplace can be reached on foot from the town hall.
      const template = TEMPLATES[profile.templateId]!;
      const grid = buildWalkGrid(template, s.district, STRUCTURE_FOOTPRINTS);
      const hall = entranceOf(
        s.district.structures.find((st) => st.kind === 'town_hall')!,
        STRUCTURE_FOOTPRINTS,
        grid,
      )!;
      for (const st of s.district.structures.filter((x) => x.kind === profile.signature)) {
        const door = entranceOf(st, STRUCTURE_FOOTPRINTS, grid);
        expect(door).not.toBeNull();
        expect(findPath(grid, hall, door!)).not.toBeNull();
      }
    });
  }

  it('the coast district pays its quota in food and keeps a week of food', () => {
    const s = createNewGame({ seed: 'coast', homeDistrict: 'd4' });
    s.economy.resources.food = 2000;
    advanceTicks(s, TICKS_PER_DAY * 10); // into summer: the spring quota is settled
    const last = s.economy.quota.history.at(-1)!;
    expect(last.delivered).toBe(last.required);
    expect(s.economy.resources.food).toBeGreaterThan(0);
  });

  it('a fishery must touch the water; a farm needs ordinary land', () => {
    const s = createNewGame({ seed: 'rules', homeDistrict: 'd4' });
    s.economy.resources.wood = 999;
    s.economy.resources.stone = 999;
    expect(checkPlacement(s, 'fishery', 36, 34)).toBe('requirement');
    const land = createNewGame({ seed: 'rules', homeDistrict: 'd11' });
    land.economy.resources.wood = 999;
    land.economy.resources.stone = 999;
    let spots = 0;
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) if (checkPlacement(land, 'farm', x, y) === null) spots += 1;
    expect(spots).toBeGreaterThan(20);
  });
});
