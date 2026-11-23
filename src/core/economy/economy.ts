import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import type { BuildingDef } from '../../content/buildings.ts';
import {
  BASE_QUOTA,
  BASE_STORAGE,
  BUILDINGS,
  FOOD_PER_ADULT,
  FOOD_PER_CHILD,
  PRICES,
  START_RESOURCES,
  WORK_HOURS,
} from '../../content/buildings.ts';
import { TEMPLATES } from '../../content/maps/index.ts';
import type { PlacedStructure } from '../district/generate.ts';
import type { DistrictTemplate, ResourceId, StructureKind } from '../district/template.ts';
import { terrainAt } from '../district/template.ts';
import type { SimContext } from '../events.ts';
import type { GameState } from '../state/gameState.ts';
import type { CalendarDate } from '../time/calendar.ts';

export interface EconomyState {
  resources: Record<ResourceId, number>;
  /** Coal owed to the regime this season. */
  quota: {
    required: number;
    delivered: number;
    history: { year: number; season: string; required: number; delivered: number }[];
  };
  /** Abstract population until Phase 4 introduces individual citizens. */
  population: { adults: number; children: number };
  /** 0–100. Falls with hunger and failed quotas; full design in Phase 4/9. */
  morale: number;
  /** 0–100. The regime's attention on the district (Phase 9 builds on it). */
  attention: number;
  /** Days in a row without enough food. */
  hungerDays: number;
}

export const MAX_BUILDERS_PER_SITE = 4;

export function initialEconomy(): EconomyState {
  return {
    resources: { ...START_RESOURCES },
    quota: { required: BASE_QUOTA, delivered: 0, history: [] },
    population: { adults: 72, children: 48 },
    morale: 60,
    attention: 10,
    hungerDays: 0,
  };
}

export function def(kind: StructureKind): BuildingDef {
  return BUILDINGS[kind];
}

export function storageCapacity(state: Readonly<GameState>): number {
  let cap = BASE_STORAGE;
  for (const s of state.district.structures) {
    const d = def(s.kind);
    if (s.built && d.storage) cap += d.storage * s.level;
  }
  return cap;
}

export function housingCapacity(state: Readonly<GameState>): number {
  let cap = 0;
  for (const s of state.district.structures) {
    const h = def(s.kind).housing;
    if (s.built && h) cap += h[s.level - 1] ?? h[0];
  }
  return cap;
}

export function maxWorkers(s: PlacedStructure): number {
  if (!s.built) return MAX_BUILDERS_PER_SITE;
  return def(s.kind).workers[s.level - 1] ?? 0;
}

/**
 * Assigns the adult labour pool: construction sites first (in placement order), then
 * production, then services. Deterministic; recomputed daily and after every build command.
 */
export function allocateLabor(state: GameState): void {
  let free = state.economy.population.adults;
  const order = (s: PlacedStructure) =>
    !s.built
      ? 0
      : def(s.kind).category === 'production'
        ? 1
        : def(s.kind).category === 'service'
          ? 2
          : 3;
  const sorted = [...state.district.structures].sort((a, b) => order(a) - order(b));
  for (const s of sorted) {
    const want = maxWorkers(s);
    const assigned = Math.min(want, free);
    s.workers = assigned;
    free -= assigned;
  }
}

export function unemployed(state: Readonly<GameState>): number {
  return (
    state.economy.population.adults - state.district.structures.reduce((n, s) => n + s.workers, 0)
  );
}

function addResource(state: GameState, id: ResourceId, amount: number, cap: number): void {
  const r = state.economy.resources;
  r[id] = id === 'credits' ? r[id] + amount : Math.min(cap, r[id] + amount);
}

/** Hourly: production during work hours and construction progress. */
export function economyHour(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const working = date.hour >= WORK_HOURS[0] && date.hour < WORK_HOURS[1];
  if (!working) return;
  const cap = storageCapacity(state);
  const moraleFactor = 0.7 + 0.5 * (state.economy.morale / 100);
  for (const s of state.district.structures) {
    if (s.workers === 0) continue;
    if (!s.built) {
      s.progress += s.workers;
      if (s.progress >= def(s.kind).buildWork) {
        s.built = true;
        s.progress = def(s.kind).buildWork;
        allocateLabor(state);
        ctx.emit({ type: 'building/completed', id: s.id, kind: s.kind });
      }
      continue;
    }
    const d = def(s.kind);
    if (!d.produces || (d.seasonal && date.season === 'winter')) continue;
    for (const [res, rate] of Object.entries(d.produces) as [ResourceId, number][]) {
      addResource(state, res, s.workers * rate * moraleFactor, cap);
    }
  }
}

export function dailyFoodNeed(state: Readonly<GameState>): number {
  const p = state.economy.population;
  return p.adults * FOOD_PER_ADULT + p.children * FOOD_PER_CHILD;
}

/** Daily: eating, morale drift, labour allocation, and the seasonal coal quota. */
export function economyDay(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const e = state.economy;
  const need = dailyFoodNeed(state);
  if (e.resources.food >= need) {
    e.resources.food -= need;
    e.hungerDays = 0;
    e.morale = Math.min(100, e.morale + 0.5);
  } else {
    e.resources.food = 0;
    e.hungerDays += 1;
    e.morale = Math.max(0, e.morale - 4 - e.hungerDays);
    ctx.emit({ type: 'economy/hunger', days: e.hungerDays });
  }
  // Winter: homes burn a little coal for heat.
  if (date.season === 'winter')
    e.resources.coal = Math.max(
      0,
      e.resources.coal -
        state.district.structures.filter((s) => s.built && def(s.kind).housing).length * 0.5,
    );
  if (date.dayOfSeason === 1 && date.absoluteDay > 0) settleQuota(state, date, ctx);
  allocateLabor(state);
}

/** At the start of each season the previous season's quota is delivered (or not). */
function settleQuota(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const e = state.economy;
  const delivered = Math.min(e.resources.coal, e.quota.required);
  e.resources.coal -= delivered;
  const shortfall = e.quota.required - delivered;
  const prevSeason = ['winter', 'spring', 'summer', 'autumn'][date.seasonIndex] ?? 'winter';
  e.quota.history.push({
    year: date.seasonIndex === 0 ? date.year - 1 : date.year,
    season: prevSeason,
    required: e.quota.required,
    delivered,
  });
  if (shortfall > 0) {
    e.attention = Math.min(100, e.attention + Math.round((shortfall / e.quota.required) * 25));
    e.morale = Math.max(0, e.morale - 5);
  } else {
    e.attention = Math.max(0, e.attention - 3);
  }
  ctx.emit({ type: 'economy/quota', required: e.quota.required, delivered });
  // Prosperity attracts demands: the quota grows with the number of mines and the district size.
  const mines = state.district.structures.filter(
    (s) => s.kind === 'mine_headframe' && s.built,
  ).length;
  e.quota.required = Math.round(
    BASE_QUOTA * (0.8 + 0.35 * mines) + state.district.structures.length * 0.8,
  );
  e.quota.delivered = 0;
}

// ------------------------------------------------------------------ placement

export type PlacementError =
  'out-of-map' | 'blocked' | 'occupied' | 'requirement' | 'cost' | 'not-buildable';

function footprintCells(kind: StructureKind, x: number, y: number): [number, number][] {
  const { w, d } = STRUCTURE_FOOTPRINTS[kind];
  const cells: [number, number][] = [];
  for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) cells.push([x + dx, y + dy]);
  return cells;
}

function near(
  t: DistrictTemplate,
  cells: [number, number][],
  codes: string,
  radius: number,
): boolean {
  for (const [x, y] of cells) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = terrainAt(t, x + dx, y + dy);
        if (c && codes.includes(c)) return true;
      }
    }
  }
  return false;
}

export function canAfford(state: Readonly<GameState>, kind: StructureKind): boolean {
  return Object.entries(def(kind).cost).every(
    ([r, n]) => state.economy.resources[r as ResourceId] >= (n ?? 0),
  );
}

export function checkPlacement(
  state: Readonly<GameState>,
  kind: StructureKind,
  x: number,
  y: number,
): PlacementError | null {
  const d = def(kind);
  if (!d.buildable) return 'not-buildable';
  const t = TEMPLATES[state.district.templateId];
  if (!t) return 'out-of-map';
  const cells = footprintCells(kind, x, y);
  const occupied = new Set<string>();
  for (const s of state.district.structures)
    for (const [cx, cy] of footprintCells(s.kind, s.x, s.y)) occupied.add(`${cx},${cy}`);
  for (const [cx, cy] of cells) {
    const code = terrainAt(t, cx, cy);
    if (code === null) return 'out-of-map';
    const allowed = d.requires === 'coalSeam' ? 'vsgd' : 'gd';
    if (!allowed.includes(code)) return 'blocked';
    if (occupied.has(`${cx},${cy}`)) return 'occupied';
  }
  if (d.requires === 'coalSeam' && !cells.some(([cx, cy]) => terrainAt(t, cx, cy) === 'v'))
    return 'requirement';
  if (d.requires === 'nearForest' && !near(t, cells, 'f', 2)) return 'requirement';
  if (d.requires === 'nearRock' && !near(t, cells, 'Rs', 2)) return 'requirement';
  if (!canAfford(state, kind)) return 'cost';
  return null;
}

export function sellPrice(res: Exclude<ResourceId, 'credits'>): number {
  return PRICES[res].sell;
}
