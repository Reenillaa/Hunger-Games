import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import { LAUREATE_REWARD } from '../../core/index.ts';
import { Portrait } from './Portrait.tsx';
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
  if (
    phase.kind === 'district' ||
    phase.kind === 'capital' ||
    phase.kind === 'arena' ||
    session.cinematic
  )
    return null;

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
    case 'aftermath':
      body = t('phase.aftermath.body', { days: state.away.days });
      action = 'phase.aftermath.action';
      onAction = () => session.dispatch({ type: 'home/return' });
      break;
  }

  const result =
    phase.kind === 'aftermath'
      ? state.competition.history.find((h) => h.edition === phase.edition)?.result
      : undefined;

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
        {result && (
          <div className={styles.results} data-testid="results">
            <p className={styles.sheetBody}>
              {result.winnerName
                ? t('aft.winner', {
                    name: result.winnerName,
                    district: String(result.winnerDistrict),
                  })
                : t('aft.nobody')}
            </p>
            {result.home.map((r) => {
              const c = state.population.citizens[r.citizenId];
              return (
                <div key={r.citizenId} className={styles.rival}>
                  {c && <Portrait genes={c.genes} sex={c.sex} age={18} dead={!r.alive} size={40} />}
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.alive
                        ? t('aft.alive', { kills: r.kills })
                        : t('aft.dead', {
                            place: r.place,
                            cause: t(`aft.cause.${r.cause ?? 'combat'}` as LocaleKey),
                          })}
                      {r.killer ? ` ${t('aft.killedBy', { killer: r.killer })}` : ''}
                    </small>
                  </span>
                </div>
              );
            })}
            <p className={styles.regimeLine}>
              {result.home.some((r) => r.alive)
                ? t('aft.reward', { food: LAUREATE_REWARD.food, credits: LAUREATE_REWARD.credits })
                : t('aft.grief')}
            </p>
          </div>
        )}
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onAction}>
          {t(action)}
        </button>
      </section>
    </div>
  );
}
