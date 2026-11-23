import { useSyncExternalStore } from 'react';
import type { GameSession, SessionSnapshot } from '../game/session.ts';

/** Subscribes a component to session snapshots (re-renders on every state change). */
export function useSession(session: GameSession): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}
