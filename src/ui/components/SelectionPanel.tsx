import type { ResourceId } from '../../core/index.ts';
import { livingCitizens, maxWorkers } from '../../core/index.ts';
import { BUILDINGS, PRICES } from '../../content/buildings.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { CloseIcon } from '../icons/Icons.tsx';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import { costText } from './BuildMenu.tsx';
import { PersonLink } from './CitizenCard.tsx';
import styles from '../ui.module.css';

const UPGRADE_FACTOR = [0, 1.5, 2.5];
const TRADE: Exclude<ResourceId, 'credits'>[] = ['coal', 'food', 'wood', 'stone'];

export function SelectionPanel({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  const s = state.district.structures.find((x) => x.id === ui.selectedId);
  if (!s || state.phase.kind !== 'district') return null;
  const def = BUILDINGS[s.kind];
  const upgradeCost = Object.fromEntries(
    Object.entries(def.cost).map(([r, n]) => [
      r,
      Math.ceil((n ?? 0) * (UPGRADE_FACTOR[s.level] ?? 3)),
    ]),
  );
  return (
    <section
      className={`${styles.panel} ${styles.selection}`}
      data-testid="selection"
      aria-label={t(`b.${s.kind}` as LocaleKey)}
    >
      <div className={styles.dialogHeader}>
        <h2 className={styles.dialogTitle}>{t(`b.${s.kind}` as LocaleKey)}</h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('sel.close')}
          onClick={() => session.ui.select(null)}
        >
          <CloseIcon />
        </button>
      </div>
      <p className={styles.slotMeta}>
        {t('sel.level', { level: s.level })}
        {' · '}
        {s.built
          ? t('sel.workers', { workers: s.workers, max: maxWorkers(s) })
          : t('sel.construction', { pct: Math.floor((s.progress / def.buildWork) * 100) })}
      </p>
      {def.produces &&
        Object.entries(def.produces).map(([r, rate]) => (
          <p key={r} className={styles.sheetBody}>
            {t('sel.produces', {
              amount: ((rate ?? 0) * s.workers).toFixed(1),
              res: t(`res.${r}` as LocaleKey).toLowerCase(),
            })}
          </p>
        ))}
      {def.housing && (
        <p className={styles.sheetBody}>{t('sel.housing', { n: def.housing[s.level - 1] ?? 0 })}</p>
      )}
      {def.storage && (
        <p className={styles.sheetBody}>{t('sel.storage', { n: def.storage * s.level })}</p>
      )}
      {(() => {
        const people = livingCitizens(state.population).filter(
          (c) => c.homeId === s.id || c.jobId === s.id,
        );
        if (people.length === 0) return null;
        return (
          <>
            <h3 className={styles.cardSection}>
              {def.housing
                ? t('card.residents')
                : t('sel.workers', { workers: people.length, max: maxWorkers(s) })}
            </h3>
            <div className={styles.people}>
              {people.map((c) => (
                <PersonLink key={c.id} session={session} c={c} />
              ))}
            </div>
          </>
        );
      })()}
      {s.kind === 'economato' && s.built && (
        <div className={styles.trade}>
          <p className={styles.regimeLine}>{t('trade.title')}</p>
          {TRADE.map((r) => (
            <div key={r} className={styles.tradeRow}>
              <span>
                {t(`res.${r}` as LocaleKey)}{' '}
                <small className={styles.slotMeta}>{t('trade.price', PRICES[r])}</small>
              </span>
              <button
                type="button"
                className={styles.button}
                onClick={() =>
                  session.dispatch({ type: 'trade', action: 'sell', resource: r, amount: 10 })
                }
              >
                {t('trade.sell', { n: 10 })}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() =>
                  session.dispatch({ type: 'trade', action: 'buy', resource: r, amount: 10 })
                }
              >
                {t('trade.buy', { n: 10 })}
              </button>
            </div>
          ))}
        </div>
      )}
      {def.buildable && (
        <div className={styles.selectionActions}>
          {s.built && s.level < 3 && (
            <button
              type="button"
              className={styles.button}
              onClick={() => session.dispatch({ type: 'build/upgrade', id: s.id })}
            >
              {t('sel.upgrade', { cost: costText(upgradeCost) })}
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              session.dispatch({ type: 'build/demolish', id: s.id });
              session.ui.select(null);
            }}
          >
            {t('sel.demolish')}
          </button>
        </div>
      )}
    </section>
  );
}
