import type { ResourceId } from '../core/district/template.ts';
import type { Season } from '../core/time/calendar.ts';

/**
 * Mishaps (GAME_SYSTEMS §12): unavoidable losses that keep stocks from only ever climbing.
 * Losses are a share of what the district holds, so a rich warehouse loses more. The fuller the
 * stores, the likelier a mishap (rats, thieves and the Capitol's clerks all smell plenty).
 * Texts live under `cal.<id>.title` / `cal.<id>.body`.
 */
export interface CalamityDef {
  id: string;
  weight: number;
  /** Only in these seasons. */
  seasons?: Season[];
  /** Share of each stock lost (0–1). `heating` is the district's heating fuel. */
  losses: Partial<Record<ResourceId | 'heating', number>>;
  /** Morale change for the district. */
  morale?: number;
  /** Only in these home districts. */
  districts?: string[];
}

export const CALAMITIES: CalamityDef[] = [
  { id: 'rats', weight: 3, losses: { food: 0.1 } },
  { id: 'thieves', weight: 2, losses: { credits: 0.15 }, morale: -2 },
  { id: 'storehouse_fire', weight: 1.5, losses: { wood: 0.22, food: 0.06 }, morale: -4 },
  { id: 'heat_spoil', weight: 2.5, seasons: ['summer'], losses: { food: 0.1 } },
  { id: 'frost', weight: 2.5, seasons: ['winter'], losses: { heating: 0.15, food: 0.05 } },
  { id: 'requisition', weight: 1.5, losses: { food: 0.08, wood: 0.08, stone: 0.08, coal: 0.08 } },
  { id: 'storm', weight: 1.5, seasons: ['autumn', 'spring'], losses: { wood: 0.12, stone: 0.08 } },
  { id: 'cave_in_stock', weight: 1.5, districts: ['d12', 'd5', 'd2'], losses: { coal: 0.15 } },
  { id: 'rot_nets', weight: 1.5, districts: ['d4'], losses: { food: 0.1, wood: 0.05 } },
  { id: 'beetles', weight: 1.5, districts: ['d7', 'd6'], losses: { wood: 0.15 } },
  { id: 'locusts', weight: 1.5, districts: ['d9', 'd11', 'd10', 'd8'], losses: { food: 0.15 } },
];

/** Daily chance of a mishap: low with empty stores, higher with full ones. */
export const CALAMITY_BASE_CHANCE = 0.03;
export const CALAMITY_FULLNESS_CHANCE = 0.09;

/** Above this share of the storage capacity, food and wood spoil a little every day. */
export const SPOIL_THRESHOLD = 0.6;
export const SPOIL_RATE = { food: 0.03, wood: 0.012 } as const;
