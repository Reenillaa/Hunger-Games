import { useState } from 'react';
import { ageOf, fullName, livingCitizens } from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import { jobLabel } from './CitizenCard.tsx';
import { Dialog } from './Dialog.tsx';
import { Portrait } from './Portrait.tsx';
import styles from '../ui.module.css';

export function PopulationPanel({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  const [query, setQuery] = useState('');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const day = Math.floor(state.clock.tick / 24);
  // State is mutated in place by the simulation: recompute on every render.
  const living = livingCitizens(state.population);
  if (ui.panel !== 'population') return null;
  const adults = living.filter((c) => ageOf(c, day) >= 16).length;
  const list = living
    .filter((c) => !eligibleOnly || (ageOf(c, day) >= 12 && ageOf(c, day) <= 18))
    .filter((c) => fullName(c).toLowerCase().includes(query.toLowerCase()))
    .sort(
      (a, b) =>
        a.lastNames[0].localeCompare(b.lastNames[0]) || a.firstName.localeCompare(b.firstName),
    );
  return (
    <Dialog title={t('pop.title')} onClose={() => session.ui.closePanel()}>
      <p className={styles.slotMeta}>
        {t('pop.count', { n: living.length, adults, children: living.length - adults })}
      </p>
      <div className={styles.popFilters}>
        <input
          className={styles.input}
          placeholder={t('pop.search')}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          aria-label={t('pop.search')}
        />
        <button
          type="button"
          className={styles.button}
          aria-pressed={eligibleOnly}
          onClick={() => setEligibleOnly((v) => !v)}
        >
          {eligibleOnly ? t('pop.eligible') : t('pop.all')}
        </button>
      </div>
      <ul className={styles.popList} data-testid="population-list">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={styles.personLink}
              onClick={() => session.ui.openCitizen(c.id)}
            >
              <Portrait genes={c.genes} sex={c.sex} age={ageOf(c, day)} mood={c.mood} size={34} />
              <span>
                <span>{fullName(c)}</span>
                <small className={styles.slotMeta}>
                  {t('pop.age', { n: ageOf(c, day) })} · {jobLabel(state, c)}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
