import { TICKS_PER_DAY, nextSelectionTick } from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import styles from '../ui.module.css';

/**
 * Developer tools, only with `?debug` in the URL. They run the real simulation faster;
 * they never fabricate state.
 */
export function DebugPanel({ session }: { session: GameSession }) {
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
