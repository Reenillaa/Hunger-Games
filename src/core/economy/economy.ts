import { lawById } from '../../content/laws.ts';
import type { HomeDistrictProfile } from '../../content/homeDistricts.ts';
import { HOME_DISTRICTS, canBuildIn, homeProfile } from '../../content/homeDistricts.ts';
import { decreeFactor } from '../regime/regime.ts';
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
import { assignJobs, syncCounts } from '../population/simulate.ts';

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
  /** Fraction of yesterday's food need that could not be met (0 = fed, 1 = nothing). */
  shortage: number;
}

export const MAX_BUILDERS_PER_SITE = 4;

export function initialEconomy(profile: HomeDistrictProfile = HOME_DISTRICTS.d12): EconomyState {
  return {
    resources: { ...(profile.startResources ?? START_RESOURCES) },
    quota: { required: profile.baseQuota ?? BASE_QUOTA, delivered: 0, history: [] },
    population: { adults: 72, children: 48 },
    morale: 60,
    attention: 10,
    hungerDays: 0,
    shortage: 0,
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
  const order = (s: PlacedStructure) =>
    !s.built
      ? 0
      : def(s.kind).category === 'production'
        ? 1
        : def(s.kind).category === 'service'
          ? 2
          : 3;
  if (state.population && Object.keys(state.population.citizens).length > 0) {
    assignJobs(state, maxWorkers, order);
    return;
  }
  let free = state.economy.population.adults;
  const sorted = [...state.district.structures].sort((a, b) => order(a) - order(b));
  for (const s of sorted) {
    const assigned = Math.min(maxWorkers(s), free);
    s.workers = assigned;
    s.efficiency = 1;
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
  const moraleFactor =
    (0.7 + 0.5 * (state.economy.morale / 100)) * decreeFactor(state) * lawProduction(state);
  for (const s of state.district.structures) {
    if (s.workers === 0) continue;
    if (!s.built) {
      s.progress += s.workers * (s.efficiency || 1);
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
      addResource(state, res, s.workers * rate * moraleFactor * (s.efficiency || 1), cap);
    }
  }
}

export function dailyFoodNeed(state: Readonly<GameState>): number {
  const p = state.economy.population;
  return lawFoodNeed(state) * (p.adults * FOOD_PER_ADULT + p.children * FOOD_PER_CHILD);
}

/** Daily: eating, morale drift, labour allocation, and the seasonal coal quota. */
export function economyDay(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const e = state.economy;
  if (state.population) syncCounts(state);
  const need = dailyFoodNeed(state);
  // Whatever there is gets shared: hunger is proportional to the shortfall.
  const eaten = Math.min(e.resources.food, need);
  e.resources.food -= eaten;
  e.shortage = need > 0 ? 1 - eaten / need : 0;
  if (e.shortage < 0.02) {
    e.hungerDays = 0;
    e.morale = Math.min(100, e.morale + 0.5);
  } else {
    e.hungerDays += 1;
    e.morale = Math.max(0, e.morale - 1 - 6 * e.shortage);
    ctx.emit({ type: 'economy/hunger', days: e.hungerDays });
  }
  // Winter: homes burn a little coal (or wood, where there is no mine) for heat.
  const profile = homeProfile(state.meta.homeDistrictId);
  if (date.season === 'winter') {
    const fuel = profile.heating;
    e.resources[fuel] = Math.max(
      0,
      e.resources[fuel] -
        state.district.structures.filter((s) => s.built && def(s.kind).housing).length * 0.5,
    );
  }
  // Taverns and wells: small daily comforts (staffed taverns only).
  let comfort = 0;
  for (const s of state.district.structures) {
    const m = def(s.kind).morale;
    if (!s.built || !m) continue;
    const staffed = def(s.kind).workers[0] === 0 || s.workers > 0;
    if (staffed) comfort += m * s.level;
  }
  if (comfort > 0) e.morale = Math.min(100, e.morale + comfort);
  // Laws in force: their daily trade-offs.
  for (const id of state.laws ?? []) {
    const law = lawById(id);
    if (!law) continue;
    if (law.morale) e.morale = Math.max(0, Math.min(100, e.morale + law.morale));
    if (law.attention) e.attention = Math.max(0, Math.min(100, e.attention + law.attention));
    if (law.food) e.resources.food += law.food;
    if (law.credits) e.resources.credits += law.credits;
    if (law.unrest && state.regime)
      state.regime.unrest = Math.max(0, Math.min(100, state.regime.unrest + law.unrest));
  }
  if (date.dayOfSeason === 1 && date.absoluteDay > 0) settleQuota(state, date, ctx);
  allocateLabor(state);
}

/** At the start of each season the previous season's quota is delivered (or not). */
function settleQuota(state: GameState, date: CalendarDate, ctx: SimContext): void {
  const e = state.economy;
  const profile = homeProfile(state.meta.homeDistrictId);
  const res = profile.quotaResource;
  // Food quotas leave the district a week of food: nobody is ordered to starve outright.
  const reserve = res === 'food' ? dailyFoodNeed(state) * 7 : 0;
  const delivered = Math.max(0, Math.min(e.resources[res] - reserve, e.quota.required));
  e.resources[res] -= delivered;
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
  // Prosperity attracts demands: the quota grows with the district's trade and its size.
  const trade = state.district.structures.filter(
    (s) => s.kind === profile.signature && s.built,
  ).length;
  e.quota.required = Math.round(
    profile.baseQuota * (0.8 + 0.35 * trade) + state.district.structures.length * 0.8,
  );
  e.quota.delivered = 0;
}

// ------------------------------------------------------------------ placement

export type PlacementError =
  'out-of-map' | 'blocked' | 'occupied' | 'requirement' | 'cost' | 'not-buildable' | 'not-here';

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
  if (!canBuildIn(state.meta.homeDistrictId, kind)) return 'not-here';
  const t = TEMPLATES[state.district.templateId];
  if (!t) return 'out-of-map';
  const cells = footprintCells(kind, x, y);
  const occupied = new Set<string>();
  for (const s of state.district.structures)
    for (const [cx, cy] of footprintCells(s.kind, s.x, s.y)) occupied.add(`${cx},${cy}`);
  for (const k of state.district.roads) occupied.add(`${k % t.width},${Math.floor(k / t.width)}`);
  for (const [cx, cy] of cells) {
    const code = terrainAt(t, cx, cy);
    if (code === null) return 'out-of-map';
    const allowed = d.requires === 'coalSeam' ? 'vsgdc' : 'gdc';
    if (!allowed.includes(code)) return 'blocked';
    if (occupied.has(`${cx},${cy}`)) return 'occupied';
  }
  if (d.requires === 'coalSeam' && !cells.some(([cx, cy]) => terrainAt(t, cx, cy) === 'v'))
    return 'requirement';
  if (d.requires === 'nearForest' && !near(t, cells, 'f', 2)) return 'requirement';
  if (d.requires === 'nearRock' && !near(t, cells, 'Rs', 2)) return 'requirement';
  if (d.requires === 'nearWater' && !near(t, cells, 'w', 1)) return 'requirement';
  if (!canAfford(state, kind)) return 'cost';
  return null;
}

export function sellPrice(res: Exclude<ResourceId, 'credits'>): number {
  return PRICES[res].sell;
}

/** Production multiplier of the laws in force. */
export function lawProduction(state: Readonly<GameState>): number {
  return (state.laws ?? []).reduce((f, id) => f * (lawById(id)?.production ?? 1), 1);
}

/** Food eaten multiplier of the laws in force (rationing). */
export function lawFoodNeed(state: Readonly<GameState>): number {
  return (state.laws ?? []).reduce((f, id) => f * (lawById(id)?.foodNeed ?? 1), 1);
}
