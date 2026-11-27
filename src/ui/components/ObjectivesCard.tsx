import { useState } from 'react';
import { homeProfile } from '../../content/homeDistricts.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import { dailyFoodNeed, housingCapacity, storageCapacity } from '../../core/index.ts';
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
  // The longer road (DECISIONS I-73): a chain of tasks that unfold as the district grows.
  const built = state.district.structures.filter((s) => s.built);
  const tradeCount = built.filter((s) => profile.trades.includes(s.kind) && s.progress > 0).length;
  const maxHouse = Math.max(
    0,
    ...built.filter((s) => s.kind.startsWith('house')).map((s) => s.level),
  );
  const has = (k: string) => built.some((s) => s.kind === k && s.progress > 0);
  const more: Goal[] = [
    { key: 'obj.trade1', done: tradeCount >= 1, progress: Math.min(1, tradeCount) },
    { key: 'obj.house2', done: maxHouse >= 2, progress: maxHouse >= 2 ? 1 : 0 },
    { key: 'obj.trade3', done: tradeCount >= 3, progress: tradeCount / 3 },
    {
      key: 'obj.storage',
      done: storageCapacity(state) >= 1000,
      progress: storageCapacity(state) / 1000,
    },
    {
      key: 'obj.comfort',
      done: has('tavern') || has('well'),
      progress: has('tavern') || has('well') ? 1 : 0,
    },
    { key: 'obj.laws2', done: state.laws.length >= 2, progress: state.laws.length / 2 },
    { key: 'obj.credits', done: e.resources.credits >= 400, progress: e.resources.credits / 400 },
    {
      key: 'obj.housing',
      done: housingCapacity(state) >= 120,
      progress: housingCapacity(state) / 120,
      vars: { n: 120 },
    },
    { key: 'obj.house3', done: maxHouse >= 3, progress: maxHouse >= 3 ? 1 : 0 },
  ];
  const all = [...goals, ...more];
  const done = all.filter((g) => g.done).length;
  const pending = all.filter((g) => !g.done);
  const shown = [...pending.slice(0, 5), ...all.filter((g) => g.done)].slice(0, 5);
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
          {done}/{all.length}
        </span>
      </button>
      {open && (
        <ul className={styles.objList}>
          {shown.map((g) => (
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
