import type { GameState } from '../core/index.ts';
import type { GameSession } from './session.ts';

/** Implemented by the persistence layer; kept as an interface so `game` stays testable. */
export interface AutosaveTarget {
  autosave(state: Readonly<GameState>): Promise<unknown>;
}

/**
 * Autosaves at every new day and every phase change (docs/TECHNICAL_ARCHITECTURE.md §8).
 * Saves are serialized: if one is in flight, only the latest pending request runs next.
 */
export function attachAutosave(
  session: GameSession,
  target: AutosaveTarget,
  onError: (error: unknown) => void = () => {},
): () => void {
  let running = false;
  let pending = false;

  const run = async (): Promise<void> => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      do {
        pending = false;
        await target.autosave(session.getState());
      } while (pending);
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };

  const offDay = session.events.on('time/day-started', () => void run());
  const offPhase = session.events.on('phase/changed', () => void run());
  return () => {
    offDay();
    offPhase();
  };
}
