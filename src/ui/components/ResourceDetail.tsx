import { BUILDINGS } from '../../content/buildings.ts';
import { homeProfile } from '../../content/homeDistricts.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameState, ResourceId } from '../../core/index.ts';
import { dailyFoodNeed, lawProduction, storageCapacity } from '../../core/index.ts';
import css from './resources.module.css';

/** Working hours a day of the trades (estimate shown with ≈). */
const WORK_HOURS = 8;

/** Daily snapshots per resource, kept by the UI to show the trend (never saved). */
const history = new Map<number, Record<ResourceId, number>>();

export function trendOf(state: Readonly<GameState>, id: ResourceId): number | null {
  const day = Math.floor(state.clock.tick / 24);
  if (!history.has(day)) history.set(day, { ...state.economy.resources });
  for (const d of [...history.keys()]) if (d < day - 3) history.delete(d);
  const prev = history.get(day - 1);
  return prev ? state.economy.resources[id] - prev[id] : null;
}

/**
 * The detail of one resource (DECISIONS I-71): stock and storage, an estimate of what is made
 * and eaten per day, who makes it (each staffed building), and what the Capitol's quota takes.
 */
export function ResourceDetail({
  state,
  id,
  onClose,
}: {
  state: Readonly<GameState>;
  id: ResourceId;
  onClose(): void;
}) {
  const e = state.economy;
  const cap = storageCapacity(state);
  const law = lawProduction(state);
  const producers = state.district.structures
    .filter((s) => s.built && BUILDINGS[s.kind].produces?.[id])
    .map((s) => ({
      s,
      perDay: (BUILDINGS[s.kind].produces?.[id] ?? 0) * s.workers * s.efficiency * WORK_HOURS * law,
    }))
    .sort((a, b) => b.perDay - a.perDay);
  const made = producers.reduce((n, p) => n + p.perDay, 0);
  const eaten = id === 'food' ? dailyFoodNeed(state) : 0;
  const net = made - eaten;
  const quotaRes = homeProfile(state.meta.homeDistrictId).quotaResource;
  const trend = trendOf(state, id);
  return (
    <div
      className={css.detail}
      role="dialog"
      aria-label={t(`res.${id}` as LocaleKey)}
      data-testid="resource-detail"
    >
      <header>
        <strong>{t(`res.${id}` as LocaleKey)}</strong>
        <button type="button" onClick={onClose} aria-label={t('save.close')}>
          ×
        </button>
      </header>
      <div className={css.big}>
        {Math.floor(e.resources[id])}
        {id !== 'credits' && <small> / {cap}</small>}
      </div>
      {id !== 'credits' && (
        <div className={css.store}>
          <i style={{ width: `${Math.min(100, (e.resources[id] / cap) * 100)}%` }} />
        </div>
      )}
      <dl className={css.rows}>
        <dt>{t('res.made')}</dt>
        <dd className={css.good}>≈ +{made.toFixed(0)}</dd>
        {eaten > 0 && (
          <>
            <dt>{t('res.eaten')}</dt>
            <dd className={css.bad}>−{eaten.toFixed(0)}</dd>
          </>
        )}
        <dt>{t('res.net')}</dt>
        <dd className={net >= 0 ? css.good : css.bad}>
          ≈ {net >= 0 ? '+' : ''}
          {net.toFixed(0)}
        </dd>
        {trend !== null && (
          <>
            <dt>{t('res.yesterday')}</dt>
            <dd className={trend >= 0 ? css.good : css.bad}>
              {trend >= 0 ? '▲ +' : '▼ '}
              {Math.round(trend)}
            </dd>
          </>
        )}
        {id === quotaRes && (
          <>
            <dt>{t('res.quota')}</dt>
            <dd>
              {Math.floor(e.resources[id])} / {e.quota.required}
            </dd>
          </>
        )}
      </dl>
      {producers.length > 0 ? (
        <ul className={css.makers}>
          {producers.slice(0, 6).map(({ s, perDay }) => (
            <li key={s.id}>
              <span>{t(`b.${s.kind}` as LocaleKey)}</span>
              <small>
                {t('res.workers', { n: s.workers })} · ≈ +{perDay.toFixed(0)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className={css.none}>{t('res.noMakers')}</p>
      )}
    </div>
  );
}
