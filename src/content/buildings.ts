import type { ResourceId, StructureKind } from '../core/district/template.ts';

/**
 * Economic definition of every structure (docs/GAME_SYSTEMS.md §4.2). Initial design values;
 * balanced with `npm run sim` and documented there when they change.
 */
export interface BuildingDef {
  kind: StructureKind;
  category: 'housing' | 'production' | 'service' | 'landmark';
  buildable: boolean;
  cost: Partial<Record<ResourceId, number>>;
  /** Worker-hours of construction. */
  buildWork: number;
  /** Maximum workers per level (index 0 = level 1). */
  workers: [number, number, number];
  /** Output per worker per working hour. */
  produces?: Partial<Record<ResourceId, number>>;
  /** Extra storage capacity per level. */
  storage?: number;
  /** People housed per level. */
  housing?: [number, number, number];
  /** Placement rule beyond buildable land. */
  requires?: 'coalSeam' | 'nearForest' | 'nearRock';
  /** Production stops in winter (gardens). */
  seasonal?: boolean;
}

export const RESOURCE_IDS: readonly ResourceId[] = ['food', 'wood', 'stone', 'coal', 'credits'];

export const BUILDINGS: Record<StructureKind, BuildingDef> = {
  house_shack: {
    kind: 'house_shack',
    category: 'housing',
    buildable: true,
    cost: { wood: 20 },
    buildWork: 40,
    workers: [0, 0, 0],
    housing: [4, 6, 8],
  },
  house_terrace: {
    kind: 'house_terrace',
    category: 'housing',
    buildable: true,
    cost: { wood: 30, stone: 15 },
    buildWork: 70,
    workers: [0, 0, 0],
    housing: [8, 11, 14],
  },
  mine_headframe: {
    kind: 'mine_headframe',
    category: 'production',
    buildable: true,
    cost: { wood: 40, stone: 20 },
    buildWork: 120,
    workers: [6, 10, 16],
    produces: { coal: 0.25 },
    requires: 'coalSeam',
  },
  lumber_camp: {
    kind: 'lumber_camp',
    category: 'production',
    buildable: true,
    cost: { wood: 15 },
    buildWork: 30,
    workers: [3, 5, 7],
    produces: { wood: 0.3 },
    requires: 'nearForest',
  },
  quarry: {
    kind: 'quarry',
    category: 'production',
    buildable: true,
    cost: { wood: 25 },
    buildWork: 45,
    workers: [3, 5, 7],
    produces: { stone: 0.2 },
    requires: 'nearRock',
  },
  garden: {
    kind: 'garden',
    category: 'production',
    buildable: true,
    cost: { wood: 15 },
    buildWork: 25,
    workers: [4, 5, 6],
    produces: { food: 0.35 },
    seasonal: true,
  },
  warehouse: {
    kind: 'warehouse',
    category: 'service',
    buildable: true,
    cost: { wood: 30 },
    buildWork: 60,
    workers: [2, 3, 4],
    storage: 400,
  },
  economato: {
    kind: 'economato',
    category: 'service',
    buildable: false,
    cost: { wood: 40, stone: 20 },
    buildWork: 80,
    workers: [2, 3, 4],
  },
  infirmary: {
    kind: 'infirmary',
    category: 'service',
    buildable: true,
    cost: { wood: 30, stone: 20, credits: 30 },
    buildWork: 80,
    workers: [2, 3, 5],
  },
  school: {
    kind: 'school',
    category: 'service',
    buildable: true,
    cost: { wood: 50, stone: 30 },
    buildWork: 110,
    workers: [2, 3, 5],
  },
  town_hall: {
    kind: 'town_hall',
    category: 'landmark',
    buildable: false,
    cost: {},
    buildWork: 0,
    workers: [2, 4, 6],
  },
  stage: {
    kind: 'stage',
    category: 'landmark',
    buildable: false,
    cost: {},
    buildWork: 0,
    workers: [0, 0, 0],
  },
};

/** Fixed regime prices at the economato (credits per unit). The black market comes in Phase 9. */
export const PRICES: Record<Exclude<ResourceId, 'credits'>, { sell: number; buy: number }> = {
  food: { sell: 1, buy: 2 },
  wood: { sell: 1, buy: 3 },
  stone: { sell: 1, buy: 3 },
  coal: { sell: 3, buy: 6 },
};

export const BASE_STORAGE = 300;
export const START_RESOURCES: Record<ResourceId, number> = {
  food: 160,
  wood: 120,
  stone: 60,
  coal: 40,
  credits: 100,
};
export const WORK_HOURS: [number, number] = [6, 18];
/** Daily food per person (abstract population until Phase 4 brings real citizens). */
export const FOOD_PER_ADULT = 0.5;
export const FOOD_PER_CHILD = 0.3;
export const BASE_QUOTA = 120;
