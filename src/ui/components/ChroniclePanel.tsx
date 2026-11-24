import { t } from '../../content/i18n.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import { Dialog } from './Dialog.tsx';
import { Portrait } from './Portrait.tsx';
import styles from '../ui.module.css';

/** The district's memory of every edition: who went, who fell, who came back. */
export function ChroniclePanel({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  if (ui.panel !== 'chronicle') return null;
  const editions = [...state.competition.history].reverse();
  const laureates = Object.values(state.population.citizens).filter(
    (c) => c.laureate !== undefined,
  );
  return (
    <Dialog title={t('chr.title')} onClose={() => session.ui.closePanel()}>
      <p className={styles.slotMeta}>
        {t('chr.summary', { editions: editions.length, laureates: laureates.length })}
      </p>
      <div className={styles.chronicleList} data-testid="chronicle">
        {editions.length === 0 && <p className={styles.note}>{t('chr.empty')}</p>}
        {editions.map((h) => (
          <section key={h.edition} className={styles.edition}>
            <h3>{t('chr.edition', { edition: h.edition, year: h.year })}</h3>
            {h.result ? (
              <small>
                {h.result.winnerName
                  ? t('chr.winner', {
                      name: h.result.winnerName,
                      district: String(h.result.winnerDistrict),
                    })
                  : t('aft.nobody')}
              </small>
            ) : (
              <small>{t('chr.ongoing')}</small>
            )}
            {h.participants.map((id) => {
              const c = state.population.citizens[id];
              const r = h.result?.home.find((x) => x.citizenId === id);
              if (!c) return null;
              return (
                <div key={id} className={styles.rival}>
                  <Portrait genes={c.genes} sex={c.sex} age={18} dead={!c.alive} size={36} />
                  <span>
                    <strong className={r?.alive ? styles.laureate : undefined}>
                      {c.firstName} {c.lastNames[0]}
                    </strong>
                    <small>
                      {r
                        ? r.alive
                          ? t('chr.came.back')
                          : t('aft.dead', {
                              place: r.place,
                              cause: t(`aft.cause.${r.cause ?? 'combat'}` as LocaleKey),
                            })
                        : t('chr.chosen')}
                    </small>
                  </span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
