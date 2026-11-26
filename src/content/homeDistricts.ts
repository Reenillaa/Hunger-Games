import type { PropKind, ResourceId, StructureKind } from '../core/district/template.ts';

/**
 * Playable home districts. Each one has its own terrain template, quota, signature production,
 * starting stock and dressing; everything else (plaza, town hall, Cosecha, games) is shared.
 */
export interface HomeDistrictProfile {
  id: 'd12' | 'd11' | 'd4' | 'd7' | 'd2' | 'd1' | 'd3' | 'd5' | 'd6' | 'd8' | 'd9' | 'd10';
  number: number;
  templateId: string;
  /** Where the pre-rendered terrain lives (chunks, manifest, heights). */
  terrainBase: string;
  /** What the Capitol demands every season. */
  quotaResource: ResourceId;
  baseQuota: number;
  /** The district's trade: the building whose count makes the quota grow. */
  signature: StructureKind;
  /** Production buildings of the district's trade (housing and services are common to all). */
  trades: StructureKind[];
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
    trades: ['mine_headframe', 'lumber_camp'],
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
    trades: ['farm', 'windmill', 'bakery'],
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
    trades: ['fishery', 'smokehouse', 'market'],
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
  d7: {
    id: 'd7',
    number: 7,
    templateId: 'd7',
    terrainBase: 'assets/districts/d7/terrain',
    quotaResource: 'wood',
    baseQuota: 230,
    signature: 'lumber_camp',
    trades: ['lumber_camp', 'market'],
    heating: 'wood',
    landmarks: [
      ...civic({ x0: 21, y0: 22 }),
      { kind: 'warehouse', x: 30, y: 26 },
      { kind: 'economato', x: 17, y: 25 },
      { kind: 'lumber_camp', x: 14, y: 13 },
      { kind: 'lumber_camp', x: 33, y: 33 },
      { kind: 'garden', x: 12, y: 24 },
      { kind: 'quarry', x: 4, y: 20 },
    ],
    houses: { house_terrace: 8, house_shack: 14 },
    startResources: { food: 170, wood: 220, stone: 40, coal: 10, credits: 90 },
    trees: ['pine_a', 'pine_b', 'pine_c', 'pine_a'],
    clutter: [
      ['supplies', 29, 30],
      ['supplies', 16, 15],
      ['supplies', 35, 31],
    ],
    showcase: { x: 30, y: 30 },
    station: { x: 42, y: 24 },
  },
  d2: {
    id: 'd2',
    number: 2,
    templateId: 'd2',
    terrainBase: 'assets/districts/d2/terrain',
    quotaResource: 'stone',
    baseQuota: 200,
    signature: 'quarry',
    trades: ['quarry', 'lumber_camp'],
    heating: 'coal',
    landmarks: [
      ...civic({ x0: 22, y0: 26 }),
      { kind: 'warehouse', x: 29, y: 30 },
      { kind: 'economato', x: 17, y: 28 },
      { kind: 'quarry', x: 13, y: 14 },
      { kind: 'quarry', x: 30, y: 13 },
      { kind: 'garden', x: 17, y: 38 },
      { kind: 'lumber_camp', x: 16, y: 34 },
    ],
    houses: { house_terrace: 10, house_shack: 11 },
    startResources: { food: 170, wood: 100, stone: 140, coal: 40, credits: 130 },
    trees: ['pine_b', 'pine_c'],
    clutter: [
      ['supplies', 15, 17],
      ['supplies', 28, 34],
      ['supplies', 32, 16],
    ],
    showcase: { x: 14, y: 15 },
    station: { x: 42, y: 28 },
  },
  d1: {
    id: 'd1',
    number: 1,
    templateId: 'd1',
    terrainBase: 'assets/districts/d1/terrain',
    quotaResource: 'credits',
    baseQuota: 260,
    signature: 'market',
    trades: ['market', 'bakery'],
    heating: 'wood',
    landmarks: [
      ...civic({ x0: 21, y0: 14 }),
      { kind: 'warehouse', x: 30, y: 18 },
      { kind: 'economato', x: 17, y: 20 },
      { kind: 'market', x: 28, y: 23 },
      { kind: 'market', x: 14, y: 10 },
      { kind: 'garden', x: 33, y: 28 },
      { kind: 'quarry', x: 8, y: 6 },
    ],
    houses: { house_terrace: 9, house_shack: 12 },
    startResources: { food: 200, wood: 120, stone: 80, coal: 20, credits: 220 },
    trees: ['oak_a', 'birch', 'oak_b'],
    clutter: [],
    showcase: { x: 16, y: 34 },
    station: { x: 42, y: 16 },
  },
  d3: {
    id: 'd3',
    number: 3,
    templateId: 'd3',
    terrainBase: 'assets/districts/d3/terrain',
    quotaResource: 'credits',
    baseQuota: 240,
    signature: 'market',
    trades: ['market', 'quarry'],
    heating: 'coal',
    landmarks: [
      ...civic({ x0: 24, y0: 28 }),
      { kind: 'warehouse', x: 30, y: 24 },
      { kind: 'economato', x: 20, y: 25 },
      { kind: 'market', x: 22, y: 36 },
      { kind: 'market', x: 30, y: 34 },
      { kind: 'garden', x: 12, y: 24 },
      { kind: 'lumber_camp', x: 6, y: 10 },
    ],
    houses: { house_terrace: 9, house_shack: 12 },
    startResources: { food: 170, wood: 110, stone: 90, coal: 60, credits: 160 },
    trees: ['pine_b', 'oak_b'],
    clutter: [],
    showcase: { x: 26, y: 22 },
    station: { x: 42, y: 30 },
  },
  d5: {
    id: 'd5',
    number: 5,
    templateId: 'd5',
    terrainBase: 'assets/districts/d5/terrain',
    quotaResource: 'coal',
    baseQuota: 140,
    signature: 'mine_headframe',
    trades: ['mine_headframe', 'quarry'],
    heating: 'coal',
    landmarks: [
      ...civic({ x0: 12, y0: 22 }),
      { kind: 'warehouse', x: 20, y: 26 },
      { kind: 'economato', x: 8, y: 28 },
      { kind: 'mine_headframe', x: 9, y: 8 },
      { kind: 'mine_headframe', x: 21, y: 7 },
      { kind: 'garden', x: 6, y: 33 },
      { kind: 'lumber_camp', x: 30, y: 36 },
    ],
    houses: { house_terrace: 9, house_shack: 12 },
    startResources: { food: 170, wood: 110, stone: 60, coal: 60, credits: 110 },
    trees: ['pine_a', 'pine_b'],
    clutter: [],
    showcase: { x: 30, y: 24 },
    station: { x: 42, y: 34 },
  },
  d6: {
    id: 'd6',
    number: 6,
    templateId: 'd6',
    terrainBase: 'assets/districts/d6/terrain',
    quotaResource: 'wood',
    baseQuota: 220,
    signature: 'lumber_camp',
    trades: ['lumber_camp', 'quarry', 'market'],
    heating: 'coal',
    landmarks: [
      ...civic({ x0: 22, y0: 20 }),
      { kind: 'warehouse', x: 32, y: 24 },
      { kind: 'economato', x: 17, y: 23 },
      { kind: 'lumber_camp', x: 10, y: 30 },
      { kind: 'lumber_camp', x: 30, y: 10 },
      { kind: 'garden', x: 14, y: 14 },
      { kind: 'quarry', x: 6, y: 6 },
    ],
    houses: { house_terrace: 9, house_shack: 12 },
    startResources: { food: 170, wood: 160, stone: 70, coal: 40, credits: 120 },
    trees: ['pine_a', 'oak_a', 'pine_c'],
    clutter: [],
    showcase: { x: 39, y: 30 },
    station: { x: 42, y: 22 },
  },
  d8: {
    id: 'd8',
    number: 8,
    templateId: 'd8',
    terrainBase: 'assets/districts/d8/terrain',
    quotaResource: 'credits',
    baseQuota: 240,
    signature: 'market',
    trades: ['farm', 'market'],
    heating: 'coal',
    landmarks: [
      ...civic({ x0: 18, y0: 24 }),
      { kind: 'warehouse', x: 24, y: 30 },
      { kind: 'economato', x: 13, y: 27 },
      { kind: 'market', x: 12, y: 16 },
      { kind: 'market', x: 26, y: 18 },
      { kind: 'garden', x: 8, y: 34 },
      { kind: 'lumber_camp', x: 38, y: 40 },
    ],
    houses: { house_terrace: 9, house_shack: 12 },
    startResources: { food: 170, wood: 110, stone: 70, coal: 50, credits: 150 },
    trees: ['oak_b', 'pine_b'],
    clutter: [],
    showcase: { x: 30, y: 26 },
    station: { x: 42, y: 26 },
  },
  d9: {
    id: 'd9',
    number: 9,
    templateId: 'd9',
    terrainBase: 'assets/districts/d9/terrain',
    quotaResource: 'food',
    baseQuota: 280,
    signature: 'farm',
    trades: ['farm', 'windmill', 'bakery'],
    heating: 'wood',
    landmarks: [
      ...civic({ x0: 30, y0: 10 }),
      { kind: 'warehouse', x: 36, y: 16 },
      { kind: 'economato', x: 26, y: 14 },
      { kind: 'farm', x: 20, y: 24 },
      { kind: 'farm', x: 30, y: 32 },
      { kind: 'windmill', x: 24, y: 18 },
      { kind: 'lumber_camp', x: 4, y: 40 },
    ],
    houses: { house_terrace: 9, house_shack: 12 },
    startResources: { food: 240, wood: 130, stone: 50, coal: 20, credits: 90 },
    trees: ['fruit_tree', 'oak_a'],
    clutter: [],
    showcase: { x: 22, y: 26 },
    station: { x: 42, y: 12 },
  },
  d10: {
    id: 'd10',
    number: 10,
    templateId: 'd10',
    terrainBase: 'assets/districts/d10/terrain',
    quotaResource: 'food',
    baseQuota: 250,
    signature: 'farm',
    trades: ['farm', 'smokehouse', 'market'],
    heating: 'wood',
    landmarks: [
      ...civic({ x0: 14, y0: 14 }),
      { kind: 'warehouse', x: 22, y: 16 },
      { kind: 'economato', x: 10, y: 18 },
      { kind: 'farm', x: 26, y: 26 },
      { kind: 'farm', x: 10, y: 30 },
      { kind: 'tavern', x: 20, y: 22 },
      { kind: 'lumber_camp', x: 4, y: 44 },
    ],
    houses: { house_terrace: 9, house_shack: 12 },
    startResources: { food: 230, wood: 130, stone: 50, coal: 20, credits: 90 },
    trees: ['oak_a', 'oak_b'],
    clutter: [],
    showcase: { x: 24, y: 28 },
    station: { x: 42, y: 16 },
  },
};

export const PLAYABLE_DISTRICTS = Object.values(HOME_DISTRICTS).map((d) => d.number);

export function homeProfile(id: string): HomeDistrictProfile {
  return HOME_DISTRICTS[id as HomeDistrictProfile['id']] ?? HOME_DISTRICTS.d12;
}

export function profileByNumber(n: number): HomeDistrictProfile | undefined {
  return Object.values(HOME_DISTRICTS).find((d) => d.number === n);
}

/** Housing, storage and services every district may build; production depends on the trade. */
export const COMMON_BUILDINGS: readonly StructureKind[] = [
  'house_shack',
  'house_terrace',
  'warehouse',
  'infirmary',
  'school',
  'tavern',
  'well',
  'garden',
];

/** True when this district's trade allows the structure (the Capitol assigns each one its work). */
export function canBuildIn(homeDistrictId: string, kind: StructureKind): boolean {
  return COMMON_BUILDINGS.includes(kind) || homeProfile(homeDistrictId).trades.includes(kind);
}
