import { LAWS, MAX_ACTIVE_LAWS } from '../../content/laws.ts';
import type { LawDef } from '../../content/laws.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import { Dialog } from './Dialog.tsx';
import styles from '../ui.module.css';

function effects(law: LawDef): { text: string; good: boolean }[] {
  const out: { text: string; good: boolean }[] = [];
  const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;
  if (law.production)
    out.push({
      text: `${t('law.fx.production')} ${pct(law.production - 1)}`,
      good: law.production > 1,
    });
  if (law.foodNeed)
    out.push({ text: `${t('law.fx.foodNeed')} ${pct(law.foodNeed - 1)}`, good: law.foodNeed < 1 });
  if (law.food) out.push({ text: `${t('res.food')} +${law.food}/${t('law.fx.day')}`, good: true });
  if (law.credits)
    out.push({ text: `${t('res.credits')} +${law.credits}/${t('law.fx.day')}`, good: true });
  if (law.morale)
    out.push({
      text: `${t('hud.moraleShort')} ${law.morale > 0 ? '+' : ''}${law.morale}/${t('law.fx.day')}`,
      good: law.morale > 0,
    });
  if (law.attention)
    out.push({
      text: `${t('hud.attentionShort')} ${law.attention > 0 ? '+' : ''}${law.attention}/${t('law.fx.day')}`,
      good: law.attention < 0,
    });
  if (law.unrest)
    out.push({
      text: `${t('law.fx.unrest')} ${law.unrest}/${t('law.fx.day')}`,
      good: law.unrest < 0,
    });
  return out;
}

/** The district's standing laws: switches with visible trade-offs. */
export function LawsPanel({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  if (ui.panel !== 'laws') return null;
  const active = state.laws;
  const full = active.length >= MAX_ACTIVE_LAWS;
  return (
    <Dialog title={t('law.title')} onClose={() => session.ui.closePanel()}>
      <p className={styles.slotMeta}>
        {t('law.intro', { n: active.length, max: MAX_ACTIVE_LAWS })}
      </p>
      <div className={styles.lawList} data-testid="laws">
        {LAWS.map((law) => {
          const on = active.includes(law.id);
          return (
            <section key={law.id} className={`${styles.law} ${on ? styles.lawOn : ''}`}>
              <div className={styles.lawHead}>
                <strong>{t(`law.${law.id}` as LocaleKey)}</strong>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t(`law.${law.id}` as LocaleKey)}
                  className={styles.switch}
                  disabled={!on && (full || state.phase.kind !== 'district')}
                  onClick={() => session.dispatch({ type: 'law/toggle', id: law.id })}
                >
                  <span />
                </button>
              </div>
              <p className={styles.lawText}>{t(`law.${law.id}.desc` as LocaleKey)}</p>
              <p className={styles.lawFx}>
                {effects(law).map((e) => (
                  <span key={e.text} className={e.good ? styles.fxGood : styles.fxBad}>
                    {e.text}
                  </span>
                ))}
              </p>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
