import { useSyncExternalStore } from 'react';
import type { GameSession } from '../game/session.ts';
import type { UiState } from '../game/uiStore.ts';

export function useUi(session: GameSession): UiState {
  return useSyncExternalStore(session.ui.subscribe, session.ui.get);
}
