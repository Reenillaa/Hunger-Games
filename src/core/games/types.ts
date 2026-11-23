import type { TraitId } from '../../content/traits.ts';
import type { AttributeId, PortraitGenes, Sex, SkillId } from '../population/types.ts';

export type Posture = 'reserved' | 'friendly' | 'intimidating';
export type Outfit = 'identity' | 'bold' | 'traditional';
export type TrainingFocus = 'combat' | 'survival' | 'stealth' | 'endurance' | 'allies' | 'scout';
export type Interview = 'humble' | 'charming' | 'defiant' | 'mysterious' | 'tragic';
export type OpeningPlan = 'flee' | 'fight';

/** A participant of the games: a real citizen (home district) or a generated rival. */
export interface Contestant {
  id: string;
  citizenId: string | null;
  district: number;
  name: string;
  sex: Sex;
  age: number;
  genes: PortraitGenes;
  traits: TraitId[];
  attributes: Record<AttributeId, number>;
  skills: Record<SkillId, number>;
  /** 0–100: how much the capital's audience loves them. */
  popularity: number;
  /** Private evaluation (1–12) and what the public was shown. */
  score: number | null;
  shownScore: number | null;
  /** Opinion of other contestants (−100…100): alliances and grudges start here. */
  opinions: Record<string, number>;
  /** 0–100 (low = panic). */
  morale: number;
  choices: {
    posture?: Posture;
    outfit?: Outfit;
    training: TrainingFocus[];
    interview?: Interview;
    plan?: OpeningPlan;
    hidden?: boolean;
  };
  /** True when the home player directs them. */
  player: boolean;
  /** Knows the evaluation of the others (scouting). */
  scouted: boolean;
}

export interface GamesState {
  edition: number;
  contestants: Record<string, Contestant>;
  order: string[];
  /** Points the home district's patrons have pledged (spent on capsules in the arena). */
  patronage: number;
  /** Credits spent on the outfit. */
  outfitBudget: number;
  /** Narrative journal of the week (localisation keys with variables). */
  log: { day: number; key: string; vars?: Record<string, string> }[];
}
