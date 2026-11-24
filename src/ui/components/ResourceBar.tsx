import { homeProfile } from '../../content/homeDistricts.ts';
import type { ResourceId } from '../../core/index.ts';
import { dailyFoodNeed, storageCapacity } from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { CoalIcon, CreditsIcon, FoodIcon, StoneIcon, WoodIcon } from '../icons/Icons.tsx';
import { useSession } from '../useSession.ts';
import styles from '../ui.module.css';

const ICONS: Record<ResourceId, () => React.JSX.Element> = {
  food: FoodIcon,
  wood: WoodIcon,
  stone: StoneIcon,
  coal: CoalIcon,
  credits: CreditsIcon,
};
const ORDER: ResourceId[] = ['food', 'wood', 'stone', 'coal', 'credits'];

function Ring({
  value,
  label,
  tone,
  testId,
}: {
  value: number;
  label: string;
  tone: string;
  testId?: string;
}) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className={styles.ring} title={label} data-testid={testId}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={r} className={styles.ringTrack} />
        <circle
          cx="20"
          cy="20"
          r={r}
          className={styles.ringValue}
          style={{ stroke: tone, strokeDasharray: `${(v / 100) * c} ${c}` }}
        />
      </svg>
      <b>{Math.round(v)}</b>
      <small>{label}</small>
    </span>
  );
}

export function ResourceBar({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  if (state.phase.kind !== 'district') return null;
  const e = state.economy;
  const cap = storageCapacity(state);
  const foodDays = e.resources.food / Math.max(1, dailyFoodNeed(state));
  const profile = homeProfile(state.meta.homeDistrictId);
  const quotaRes = profile.quotaResource;
  const quota = Math.min(1, e.resources[quotaRes] / Math.max(1, e.quota.required));
  const QuotaIcon = ICONS[quotaRes];
  const attention = e.attention;
  return (
    <div className={styles.resources} data-testid="resources">
      <div className={styles.resSlots}>
        {ORDER.map((id) => {
          const Icon = ICONS[id];
          const value = Math.floor(e.resources[id]);
          const warn =
            (id === 'food' && foodDays < 2) ||
            (id === quotaRes && id !== 'food' && value < e.quota.required * 0.5);
          return (
            <span
              key={id}
              className={`${styles.resource} ${warn ? styles.resourceWarn : ''}`}
              title={`${t(`res.${id}`)}${id === 'credits' ? '' : ` · ${value}/${cap}`}`}
              data-testid={`res-${id}`}
            >
              <span className={styles.resIcon}>
                <Icon />
              </span>
              <span>{value}</span>
              {id !== 'credits' && (
                <i
                  className={styles.resCap}
                  style={{ width: `${Math.min(100, (value / cap) * 100)}%` }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div className={styles.gauges}>
        <span className={styles.quota} title={t('hud.quota', { required: e.quota.required })}>
          <small className={styles.quotaLabel}>
            <QuotaIcon /> {t('hud.quotaShort')}
          </small>
          <span className={styles.quotaBar}>
            <i style={{ width: `${quota * 100}%` }} />
          </span>
          <b>
            {Math.floor(e.resources[quotaRes])}/{e.quota.required}
          </b>
        </span>
        <Ring
          value={e.morale}
          label={t('hud.moraleShort')}
          tone={e.morale < 30 ? '#d0453b' : '#8fbf5a'}
        />
        <Ring
          value={attention}
          label={t('hud.attentionShort')}
          tone={attention >= 60 ? '#d0453b' : attention >= 35 ? '#e8a24a' : '#9aa0a6'}
          testId="attention"
        />
        {state.regime.decrees.map((d) => (
          <span key={d.id} className={`${styles.resourceMeta} ${styles.resourceWarn}`}>
            {t(`reg.decree.${d.id}`)}
          </span>
        ))}
        {e.hungerDays > 0 && (
          <span className={`${styles.resourceMeta} ${styles.resourceWarn}`}>
            {t('hud.hunger', { days: e.hungerDays })}
          </span>
        )}
      </div>
    </div>
  );
}
