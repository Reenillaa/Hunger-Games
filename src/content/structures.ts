import type { PropKind, StructureKind } from '../core/district/template.ts';

/**
 * Footprints in cells (w along x, d along y). Must match tools/art/render_district_assets.py,
 * which renders a sprite with the same name for every entry.
 */
export const STRUCTURE_FOOTPRINTS: Record<StructureKind, { w: number; d: number }> = {
  house_shack: { w: 2, d: 2 },
  house_terrace: { w: 3, d: 2 },
  mine_headframe: { w: 3, d: 3 },
  town_hall: { w: 3, d: 3 },
  warehouse: { w: 3, d: 3 },
  economato: { w: 2, d: 2 },
  stage: { w: 3, d: 2 },
  lumber_camp: { w: 2, d: 2 },
  quarry: { w: 2, d: 2 },
  garden: { w: 2, d: 2 },
  infirmary: { w: 2, d: 2 },
  school: { w: 3, d: 2 },
  farm: { w: 3, d: 3 },
  fishery: { w: 3, d: 2 },
  tavern: { w: 2, d: 2 },
  bakery: { w: 2, d: 2 },
  windmill: { w: 2, d: 2 },
  smokehouse: { w: 2, d: 2 },
  market: { w: 2, d: 2 },
  well: { w: 1, d: 1 },
};

export const PROP_KINDS: readonly PropKind[] = [
  'pine_a',
  'pine_b',
  'pine_c',
  'dead_tree',
  'rock_a',
  'rock_b',
  'rock_c',
  'lamp',
  'coal_heap',
  'supplies',
  'poster_a',
  'poster_b',
  'fruit_tree',
  'boat',
];
