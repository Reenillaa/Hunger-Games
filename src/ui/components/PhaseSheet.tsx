import { CAPITAL_DAYS } from '../../core/index.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import styles from '../ui.module.css';

/**
 * Walking-skeleton panel for the phases that later get their own scenes (Phases 5–8).
 * Clearly marked as provisional; it only drives real phase transitions.
 */
export function PhaseSheet({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const phase = state.phase;
  if (phase.kind === 'district' || session.cinematic) return null;

  let body = '';
  let action: LocaleKey;
  let onAction: () => void;
  switch (phase.kind) {
    case 'selection':
      body = t('phase.selection.chosen', {
        names: (state.competition.current?.participants ?? [])
          .map((id) => state.population.citizens[id])
          .filter((c) => !!c)
          .map((c) => `${c!.firstName} ${c!.lastNames[0]}`)
          .join(' · '),
      });
      action = 'phase.selection.action';
      onAction = () => session.dispatch({ type: 'capital/depart' });
      break;
    case 'capital':
      body = t('phase.capital.body', { day: phase.day, total: CAPITAL_DAYS });
      action = phase.day < CAPITAL_DAYS ? 'phase.capital.action' : 'phase.capital.launch';
      onAction = () => session.dispatch({ type: 'capital/advance-day' });
      break;
    case 'arena':
      body = t('phase.arena.body');
      action = 'phase.arena.action';
      onAction = () => session.dispatch({ type: 'arena/conclude' });
      break;
    case 'aftermath':
      body = t('phase.aftermath.body', { days: state.away.days });
      action = 'phase.aftermath.action';
      onAction = () => session.dispatch({ type: 'home/return' });
      break;
  }

  return (
    <div className={styles.sheetArea}>
      <section
        className={`${styles.panel} ${styles.sheet}`}
        data-testid="phase-sheet"
        data-phase={phase.kind}
        aria-live="polite"
      >
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>{t(`phase.${phase.kind}` as LocaleKey)}</h2>
          <span className={styles.tag}>{t('phase.placeholder')}</span>
        </div>
        <p className={styles.regimeLine}>
          {t('calendar.edition', { games: t('games.name'), edition: phase.edition })}
        </p>
        <p className={styles.sheetBody}>{body}</p>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onAction}>
          {t(action)}
        </button>
      </section>
    </div>
  );
}
