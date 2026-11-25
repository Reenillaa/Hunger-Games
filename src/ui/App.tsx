import type { HomeDistrictProfile } from '../content/homeDistricts.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../content/i18n.ts';
import type { GameState } from '../core/index.ts';
import { createNewGame, dateFromTick } from '../core/index.ts';
import { attachAutosave } from '../game/autosave.ts';
import { GameSession } from '../game/session.ts';
import { encodeSave } from '../persistence/codec.ts';
import { downloadBytes, randomSeed } from '../platform/files.ts';
import { installGlobalErrorHandlers } from '../platform/errors.ts';
import { requestPersistentStorage } from '../platform/storage.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { LoadDialog } from './components/LoadDialog.tsx';
import { ErrorScreen } from './screens/ErrorScreen.tsx';
import { GameScreen } from './screens/GameScreen.tsx';
import { MainMenu } from './screens/MainMenu.tsx';
import { useServices } from './services.ts';
import styles from './ui.module.css';

export function App() {
  const { repository } = useServices();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fatal, setFatal] = useState<unknown>(null);
  const detachAutosave = useRef<(() => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => installGlobalErrorHandlers(setFatal), []);

  const start = useCallback(
    (state: GameState, fresh = false) => {
      detachAutosave.current?.();
      const next = new GameSession(state);
      if (repository) {
        detachAutosave.current = attachAutosave(next, repository, () => notify(t('save.failed')));
        void repository.autosave(next.getState()).catch(() => notify(t('save.failed')));
      }
      if (fresh) next.playPrologue();
      setLoadOpen(false);
      setSession(next);
    },
    [repository, notify],
  );

  const newGame = (homeDistrict: HomeDistrictProfile['id'] = 'd12') => {
    void requestPersistentStorage();
    start(createNewGame({ seed: randomSeed(), homeDistrict }), true);
  };

  const continueLatest = async () => {
    const latest = await repository?.loadLatestValid();
    if (latest) start(latest.state);
    else notify(t('load.importFailed'));
  };

  const exportCurrent = useCallback(async () => {
    if (!session) return;
    const state = session.getState();
    const bytes = repository
      ? await repository.exportBytes(state)
      : await encodeSave(state, new Date());
    const d = dateFromTick(state.clock.tick);
    downloadBytes(bytes, `diezmo-a${d.year}-${d.season}-d${d.dayOfSeason}.diezmo`);
  }, [session, repository]);

  const exitToMenu = async () => {
    if (session && repository) await repository.autosave(session.getState()).catch(() => undefined);
    detachAutosave.current?.();
    detachAutosave.current = null;
    setSession(null);
  };

  return (
    <>
      <ErrorBoundary onError={setFatal}>
        {session ? (
          <GameScreen
            key={session.getState().meta.seed + session.getState().clock.tick}
            session={session}
            onExit={() => void exitToMenu()}
            onExport={() => void exportCurrent()}
            notify={notify}
          />
        ) : (
          <MainMenu
            onNewGame={newGame}
            onContinue={() => void continueLatest()}
            onLoad={() => setLoadOpen(true)}
          />
        )}
        {loadOpen && (
          <LoadDialog onClose={() => setLoadOpen(false)} onLoaded={start} notify={notify} />
        )}
        {toast && (
          <div className={`${styles.panel} ${styles.toast}`} role="status" data-testid="toast">
            {toast}
          </div>
        )}
      </ErrorBoundary>
      {fatal !== null && (
        <ErrorScreen error={fatal} onExport={session ? () => void exportCurrent() : undefined} />
      )}
    </>
  );
}
