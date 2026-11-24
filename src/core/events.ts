import type { CalendarDate } from './time/calendar.ts';
import type { PhaseKind } from './state/gameState.ts';

/** Domain events leave the core through the session's event bus (UI, render, audio, autosave react to them). */
export type DomainEvent =
  | { type: 'time/day-started'; tick: number; date: CalendarDate }
  | { type: 'time/season-started'; tick: number; date: CalendarDate }
  | { type: 'time/year-started'; tick: number; date: CalendarDate }
  | { type: 'phase/changed'; from: PhaseKind; to: PhaseKind; edition: number | null }
  | { type: 'autopilot/completed'; days: number }
  | { type: 'building/placed'; id: string; kind: string }
  | { type: 'building/completed'; id: string; kind: string }
  | { type: 'building/removed'; id: string }
  | { type: 'economy/hunger'; days: number }
  | { type: 'economy/quota'; required: number; delivered: number }
  | { type: 'citizen/born'; id: string; name: string }
  | { type: 'citizen/died'; id: string; name: string; cause: string }
  | { type: 'citizen/coupled'; a: string; b: string }
  | { type: 'selection/drawn'; edition: number; participants: string[] }
  | { type: 'regime/event'; eventId: string }
  | { type: 'regime/event-resolved'; eventId: string; option: string }
  | { type: 'regime/decree'; id: string }
  | { type: 'games/homecoming'; edition: number; laureate: string | null; fallen: string[] };

export type DomainEventType = DomainEvent['type'];

export interface SimContext {
  emit(event: DomainEvent): void;
  /** True while the district runs unattended (catch-up after the games). */
  autopilot: boolean;
}

export function collectingContext(autopilot = false): SimContext & { events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  return { events, autopilot, emit: (e) => events.push(e) };
}
