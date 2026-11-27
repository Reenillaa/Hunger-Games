import { HOME_DISTRICTS } from '../../content/homeDistricts.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import css from './notices.module.css';

const profileOf = (id: string) => HOME_DISTRICTS[id as keyof typeof HOME_DISTRICTS];

/**
 * The fog at the edge of the map (DECISIONS I-61): pressing the camera against it shows which
 * district lies beyond; crossing pauses the game and shows the neighbour, read-only. While
 * visiting, a banner tells where you are and takes you home.
 */
export function FogGate({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  if (state.phase.kind !== 'district' || session.cinematic) return null;
  if (ui.visiting) {
    const p = profileOf(ui.visiting);
    return (
      <div className={css.visitBanner} data-testid="visit-banner">
        <span className={css.visitKicker}>{t('fog.visiting')}</span>
        <strong>{t('map.district', { n: p?.number ?? '?' })}</strong>
        {p && <span className={css.visitTrade}>{t(`cap.opt.identity.${p.id}` as LocaleKey)}</span>}
        <button type="button" onClick={() => session.ui.visit(null)}>
          {t('fog.home')}
        </button>
      </div>
    );
  }
  if (!ui.edge) return null;
  const p = profileOf(ui.edge.district);
  if (!p) return null;
  return (
    <button
      type="button"
      className={`${css.fogGate} ${css[`gate_${ui.edge.dir}`]}`}
      data-testid="fog-gate"
      onClick={() => {
        session.setSpeed(0);
        session.ui.visit(ui.edge!.district);
      }}
    >
      <span className={css.visitKicker}>{t('fog.beyond')}</span>
      <strong>{t('map.district', { n: p.number })}</strong>
      <span className={css.visitTrade}>{t(`cap.opt.identity.${p.id}` as LocaleKey)}</span>
      <span className={css.cross}>{t('fog.cross')} →</span>
    </button>
  );
}
