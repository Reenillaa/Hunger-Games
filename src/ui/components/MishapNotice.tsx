import { useEffect, useState } from 'react';
import type { ResourceId } from '../../core/index.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { CoalIcon, CreditsIcon, FoodIcon, StoneIcon, WoodIcon } from '../icons/Icons.tsx';
import css from './notices.module.css';

const ICONS: Record<ResourceId, () => React.JSX.Element> = {
  food: FoodIcon,
  wood: WoodIcon,
  stone: StoneIcon,
  coal: CoalIcon,
  credits: CreditsIcon,
};

interface Notice {
  key: number;
  id: string;
  lost: Partial<Record<ResourceId, number>>;
}

/**
 * Damage report: a telegram pinned to the screen, with a red stamp, when a mishap takes part of
 * the stores. It goes away by itself or with a tap.
 */
export function MishapNotice({ session }: { session: GameSession }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(
    () =>
      session.events.on('regime/calamity', (e) =>
        setNotice({ key: Date.now(), id: e.id, lost: e.lost }),
      ),
    [session],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <button
      key={notice.key}
      type="button"
      className={css.telegram}
      data-testid="mishap"
      onClick={() => setNotice(null)}
    >
      <span className={css.stamp}>{t('cal.stamp')}</span>
      <strong className={css.telegramTitle}>{t(`cal.${notice.id}.title` as LocaleKey)}</strong>
      <span className={css.telegramBody}>{t(`cal.${notice.id}.body` as LocaleKey)}</span>
      <span className={css.losses} aria-label={t('cal.lost')}>
        {(Object.entries(notice.lost) as [ResourceId, number][]).map(([r, n]) => {
          const Icon = ICONS[r];
          return (
            <span key={r} className={css.loss} title={t(`res.${r}` as LocaleKey)}>
              <Icon /> −{n}
            </span>
          );
        })}
      </span>
    </button>
  );
}
