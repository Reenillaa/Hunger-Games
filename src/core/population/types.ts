import type { TraitId } from '../../content/traits.ts';
import { DAYS_PER_YEAR } from '../time/calendar.ts';

export type Sex = 'F' | 'M';

export const ATTRIBUTE_IDS = [
  'strength',
  'agility',
  'endurance',
  'intellect',
  'charisma',
  'perception',
] as const;
export type AttributeId = (typeof ATTRIBUTE_IDS)[number];

export const SKILL_IDS = [
  'mining',
  'construction',
  'farming',
  'survival',
  'crafting',
  'medicine',
  'teaching',
  'combat',
  'stealth',
  'social',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/** Heritable portrait features (indices into the portrait part sets). */
export interface PortraitGenes {
  skin: number;
  hair: number;
  hairStyle: number;
  face: number;
  eyes: number;
  nose: number;
  brow: number;
}

export interface Relation {
  /** −100 (enemy) … 100 (inseparable). */
  opinion: number;
}

export interface HistoryEntry {
  day: number;
  key: string;
  vars?: Record<string, string>;
}

export interface Citizen {
  id: string;
  firstName: string;
  lastNames: [string, string];
  sex: Sex;
  /** Absolute day of birth (negative = before the game started). */
  birthDay: number;
  alive: boolean;
  deathDay?: number;
  deathCause?: 'age' | 'hunger' | 'illness' | 'accident' | 'games' | 'regime';
  /** Edition the citizen won (Laureados live on in the district's memory). */
  laureate?: number;
  genes: PortraitGenes;
  motherId: string | null;
  fatherId: string | null;
  partnerId: string | null;
  childrenIds: string[];
  /** Structure id of the home (null for the deceased). */
  homeId: string | null;
  /** Structure id of the workplace (assigned by the labour allocator). */
  jobId: string | null;
  attributes: Record<AttributeId, number>;
  skills: Record<SkillId, number>;
  traits: TraitId[];
  health: number;
  mood: number;
  regimeOpinion: number;
  /** Sparse social graph: only meaningful non-family relations (max 12). */
  relations: Record<string, Relation>;
  /** Temporary mood modifiers (grief, celebration…). */
  moodModifiers: { key: string; value: number; untilDay: number }[];
  history: HistoryEntry[];
}

export interface PopulationState {
  citizens: Record<string, Citizen>;
}

export const ADULT_AGE = 16;
export const ELDER_AGE = 65;

export function ageOf(c: Citizen, day: number): number {
  return Math.floor((day - c.birthDay) / DAYS_PER_YEAR);
}

export function fullName(c: Citizen): string {
  return `${c.firstName} ${c.lastNames[0]} ${c.lastNames[1]}`;
}

export function livingCitizens(pop: PopulationState): Citizen[] {
  return Object.values(pop.citizens).filter((c) => c.alive);
}
