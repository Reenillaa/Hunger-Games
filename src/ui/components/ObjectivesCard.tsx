import { useState } from 'react';
import { homeProfile } from '../../content/homeDistricts.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import { dailyFoodNeed } from '../../core/index.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import styles from '../ui.module.css';

interface Goal {
  key: string;
  done: boolean;
  progress: number;
  vars?: Record<string, string | number>;
}

/** A short, live checklist that keeps the player moving (computed from the state, never saved). */
export function ObjectivesCard({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const [open, setOpen] = useState(true);
  if (state.phase.kind !== 'district' || session.cinematic) return null;
  const e = state.economy;
  const profile = homeProfile(state.meta.homeDistrictId);
  const res = profile.quotaResource;
  // Player-made structures are the ones that went through construction (progress > 0).
  const playerBuilt = state.district.structures.some((s) => !s.built || s.progress > 0);
  const foodDays = e.resources.food / Math.max(1, dailyFoodNeed(state));
  const goals: Goal[] = [
    {
      key: 'obj.quota',
      done: e.resources[res] >= e.quota.required,
      progress: e.resources[res] / Math.max(1, e.quota.required),
      vars: { res: t(`res.${res}` as LocaleKey).toLowerCase(), n: e.quota.required },
    },
    { key: 'obj.food', done: foodDays >= 7, progress: foodDays / 7 },
    { key: 'obj.morale', done: e.morale >= 55, progress: e.morale / 55 },
    { key: 'obj.build', done: playerBuilt, progress: playerBuilt ? 1 : 0 },
    { key: 'obj.laws', done: state.laws.length > 0, progress: state.laws.length > 0 ? 1 : 0 },
  ];
  const done = goals.filter((g) => g.done).length;
  return (
    <aside className={`${styles.panel} ${styles.objectives}`} data-testid="objectives">
      <button
        type="button"
        className={styles.objHead}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <strong>{t('obj.title')}</strong>
        <span className={styles.objCount}>
          {done}/{goals.length}
        </span>
      </button>
      {open && (
        <ul className={styles.objList}>
          {goals.map((g) => (
            <li key={g.key} className={g.done ? styles.objDone : undefined}>
              <span className={styles.objCheck} aria-hidden="true">
                {g.done ? '✓' : ''}
              </span>
              <span className={styles.objText}>
                {t(g.key as LocaleKey, g.vars)}
                {!g.done && (
                  <span className={styles.objBar}>
                    <i style={{ width: `${Math.min(100, Math.round(g.progress * 100))}%` }} />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
