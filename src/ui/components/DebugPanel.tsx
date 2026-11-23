import type { StructureKind } from '../../core/index.ts';
import { TICKS_PER_DAY, checkPlacement, nextSelectionTick } from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import styles from '../ui.module.css';

/**
 * Developer tools, only with `?debug` in the URL. They run the real simulation faster;
 * they never fabricate state.
 */
/** Test hook (debug mode only): lets E2E tests find valid spots and drive the session. */
function exposeForTests(session: GameSession): void {
  (window as unknown as { __diezmo?: unknown }).__diezmo = {
    session,
    findSpot(kind: StructureKind) {
      for (let y = 0; y < 48; y++)
        for (let x = 0; x < 48; x++)
          if (checkPlacement(session.getState(), kind, x, y) === null) return { x, y };
      return null;
    },
  };
}

export function DebugPanel({ session }: { session: GameSession }) {
  exposeForTests(session);
  const { state } = useSession(session);
  if (state.phase.kind !== 'district') return null;
  const toSelection = () =>
    session.advance(
      nextSelectionTick(state.clock.tick, state.competition.lastSelectionYear) - state.clock.tick,
    );
  return (
    <div className={`${styles.panel} ${styles.debug}`} data-testid="debug-panel">
      <span>{t('debug.title')}</span>
      <button
        type="button"
        className={styles.button}
        onClick={() => session.advance(TICKS_PER_DAY)}
      >
        {t('debug.day')}
      </button>
      <button type="button" className={styles.button} onClick={toSelection}>
        {t('debug.toSelection')}
      </button>
    </div>
  );
}
