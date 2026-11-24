import { useEffect, useRef } from 'react';
import { DISTRICT_EVENTS } from '../../content/districtEvents.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import styles from '../ui.module.css';

/** A district dilemma: the clock stops until the player decides (or it resolves itself). */
export function EventDialog({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const pending = state.phase.kind === 'district' ? state.regime.pending : null;
  const shown = useRef<string | null>(null);
  const key = pending ? `${pending.eventId}@${pending.day}` : null;
  useEffect(() => {
    // Pause once when a new dilemma arrives; the player can still resume to postpone it.
    if (key && shown.current !== key) {
      shown.current = key;
      session.setSpeed(0);
    }
  }, [key, session]);
  if (!pending || session.cinematic) return null;
  const ev = DISTRICT_EVENTS.find((d) => d.id === pending.eventId);
  if (!ev) return null;
  const credits = state.economy.resources.credits;
  return (
    <div className={styles.sheetArea}>
      <section
        className={`${styles.panel} ${styles.sheet}`}
        role="dialog"
        aria-labelledby="event-title"
        data-testid="event"
      >
        <p className={styles.regimeLine}>{t('reg.event')}</p>
        <h2 id="event-title" className={styles.sheetTitle}>
          {t(`ev.${ev.id}.title` as LocaleKey)}
        </h2>
        <p className={styles.sheetBody}>{t(`ev.${ev.id}.body` as LocaleKey)}</p>
        <div className={styles.choiceButtons}>
          {ev.options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              className={`${styles.button} ${i === 0 ? styles.primary : ''}`}
              disabled={(o.effects.credits ?? 0) < 0 && credits < -(o.effects.credits ?? 0)}
              onClick={() => session.dispatch({ type: 'event/choose', option: i })}
            >
              {t(`ev.${ev.id}.${o.id}` as LocaleKey)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
