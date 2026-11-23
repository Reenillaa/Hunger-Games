import type { ResourceId } from '../../core/index.ts';
import { dailyFoodNeed, storageCapacity, unemployed } from '../../core/index.ts';
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

export function ResourceBar({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  if (state.phase.kind !== 'district') return null;
  const e = state.economy;
  const cap = storageCapacity(state);
  const foodDays = e.resources.food / Math.max(1, dailyFoodNeed(state));
  return (
    <div className={`${styles.panel} ${styles.resources}`} data-testid="resources">
      {ORDER.map((id) => {
        const Icon = ICONS[id];
        const value = Math.floor(e.resources[id]);
        const warn =
          (id === 'food' && foodDays < 2) || (id === 'coal' && value < e.quota.required * 0.5);
        return (
          <span
            key={id}
            className={`${styles.resource} ${warn ? styles.resourceWarn : ''}`}
            title={`${t(`res.${id}`)}${id === 'credits' ? '' : ` · ${value}/${cap}`}`}
            data-testid={`res-${id}`}
          >
            <Icon />
            <span>{value}</span>
          </span>
        );
      })}
      <span className={styles.resourceMeta} title={t('hud.quota', { required: e.quota.required })}>
        {t('res.coal')} → {e.quota.required}
      </span>
      <span
        className={styles.resourceMeta}
        title={t('hud.workers', { free: unemployed(state), adults: e.population.adults })}
      >
        {t('hud.morale', { value: Math.round(e.morale) })}
      </span>
      {e.hungerDays > 0 && (
        <span className={`${styles.resourceMeta} ${styles.resourceWarn}`}>
          {t('hud.hunger', { days: e.hungerDays })}
        </span>
      )}
    </div>
  );
}
