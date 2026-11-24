import type { PropKind, ResourceId, StructureKind } from '../core/district/template.ts';

/**
 * Playable home districts. Each one has its own terrain template, quota, signature production,
 * starting stock and dressing; everything else (plaza, town hall, Cosecha, games) is shared.
 */
export interface HomeDistrictProfile {
  id: 'd12' | 'd11' | 'd4';
  number: number;
  templateId: string;
  /** Where the pre-rendered terrain lives (chunks, manifest, heights). */
  terrainBase: string;
  /** What the Capitol demands every season. */
  quotaResource: Exclude<ResourceId, 'credits'>;
  baseQuota: number;
  /** The district's trade: the building whose count makes the quota grow. */
  signature: StructureKind;
  /** What homes burn in winter. */
  heating: 'coal' | 'wood';
  landmarks: { kind: StructureKind; x: number; y: number }[];
  houses: { house_terrace: number; house_shack: number };
  startResources: Record<ResourceId, number>;
  /** Trees grown on 'f' cells (pine woods, orchards). */
  trees: PropKind[];
  clutter: [PropKind, number, number][];
  /** A cell worth showing in the prologue (the mine, the fields, the harbour). */
  showcase: { x: number; y: number };
  /** Where the Capitol's train stops (return ceremony). */
  station: { x: number; y: number };
}

/** Town hall on the north side of the plaza with the Cosecha stage against its steps. */
function civic(plaza: { x0: number; y0: number }): { kind: StructureKind; x: number; y: number }[] {
  return [
    { kind: 'town_hall', x: plaza.x0 + 1, y: plaza.y0 - 3 },
    { kind: 'stage', x: plaza.x0 + 1, y: plaza.y0 },
  ];
}

export const HOME_DISTRICTS: Record<HomeDistrictProfile['id'], HomeDistrictProfile> = {
  d12: {
    id: 'd12',
    number: 12,
    templateId: 'd12',
    terrainBase: 'assets/district/terrain',
    quotaResource: 'coal',
    baseQuota: 120,
    signature: 'mine_headframe',
    heating: 'coal',
    landmarks: [
      ...civic({ x0: 24, y0: 20 }),
      { kind: 'warehouse', x: 38, y: 20 },
      { kind: 'economato', x: 31, y: 25 },
      { kind: 'mine_headframe', x: 15, y: 7 },
      { kind: 'lumber_camp', x: 12, y: 31 },
      { kind: 'quarry', x: 37, y: 9 },
    ],
    houses: { house_terrace: 9, house_shack: 13 },
    startResources: { food: 160, wood: 120, stone: 60, coal: 40, credits: 100 },
    trees: ['pine_a', 'pine_b', 'pine_c'],
    clutter: [
      ['coal_heap', 18, 10],
      ['coal_heap', 42, 23],
      ['coal_heap', 42, 27],
      ['supplies', 37, 23],
      ['supplies', 33, 27],
    ],
    showcase: { x: 17, y: 10 },
    station: { x: 42, y: 24 },
  },
  d11: {
    id: 'd11',
    number: 11,
    templateId: 'd11',
    terrainBase: 'assets/districts/d11/terrain',
    quotaResource: 'food',
    baseQuota: 260,
    signature: 'farm',
    heating: 'wood',
    landmarks: [
      ...civic({ x0: 9, y0: 31 }),
      { kind: 'warehouse', x: 17, y: 28 },
      { kind: 'economato', x: 13, y: 38 },
      { kind: 'farm', x: 24, y: 10 },
      { kind: 'farm', x: 32, y: 22 },
      { kind: 'lumber_camp', x: 31, y: 34 },
      { kind: 'quarry', x: 3, y: 3 },
    ],
    houses: { house_terrace: 8, house_shack: 14 },
    startResources: { food: 220, wood: 140, stone: 50, coal: 20, credits: 90 },
    trees: ['fruit_tree'],
    clutter: [
      ['supplies', 18, 31],
      ['supplies', 15, 37],
      ['supplies', 27, 12],
    ],
    showcase: { x: 25, y: 12 },
    station: { x: 42, y: 33 },
  },
  d4: {
    id: 'd4',
    number: 4,
    templateId: 'd4',
    terrainBase: 'assets/districts/d4/terrain',
    quotaResource: 'food',
    baseQuota: 240,
    signature: 'fishery',
    heating: 'wood',
    landmarks: [
      ...civic({ x0: 19, y0: 18 }),
      { kind: 'warehouse', x: 14, y: 23 },
      { kind: 'economato', x: 27, y: 23 },
      { kind: 'fishery', x: 16, y: 29 },
      { kind: 'fishery', x: 15, y: 13 },
      { kind: 'lumber_camp', x: 31, y: 7 },
      { kind: 'quarry', x: 36, y: 24 },
    ],
    houses: { house_terrace: 9, house_shack: 13 },
    startResources: { food: 200, wood: 110, stone: 60, coal: 20, credits: 110 },
    trees: ['pine_a', 'pine_b', 'pine_c'],
    clutter: [
      ['boat', 9, 21],
      ['boat', 8, 19],
      ['boat', 7, 29],
      ['boat', 10, 27],
      ['boat', 9, 11],
      ['supplies', 18, 21],
    ],
    showcase: { x: 12, y: 20 },
    station: { x: 42, y: 20 },
  },
};

export const PLAYABLE_DISTRICTS = Object.values(HOME_DISTRICTS).map((d) => d.number);

export function homeProfile(id: string): HomeDistrictProfile {
  return HOME_DISTRICTS[id as HomeDistrictProfile['id']] ?? HOME_DISTRICTS.d12;
}

export function profileByNumber(n: number): HomeDistrictProfile | undefined {
  return Object.values(HOME_DISTRICTS).find((d) => d.number === n);
}
