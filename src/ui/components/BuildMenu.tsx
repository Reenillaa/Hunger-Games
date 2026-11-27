import { useState } from 'react';
import type { PlacedStructure, ResourceId, StructureKind } from '../../core/index.ts';
import { canAfford, upgradeCost } from '../../core/index.ts';
import { BUILDINGS } from '../../content/buildings.ts';
import { COMMON_BUILDINGS, homeProfile } from '../../content/homeDistricts.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import {
  CoalIcon,
  CreditsIcon,
  FoodIcon,
  HammerIcon,
  StoneIcon,
  WoodIcon,
} from '../icons/Icons.tsx';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import styles from '../ui.module.css';
import css from './build.module.css';

const COST_ICONS: Record<ResourceId, () => React.JSX.Element> = {
  food: FoodIcon,
  wood: WoodIcon,
  stone: StoneIcon,
  coal: CoalIcon,
  credits: CreditsIcon,
};

function CostChips({
  cost,
  have,
}: {
  cost: Partial<Record<ResourceId, number>>;
  have: Record<ResourceId, number>;
}) {
  return (
    <span className={css.costs}>
      {Object.entries(cost).map(([r, n]) => {
        const Icon = COST_ICONS[r as ResourceId];
        const short = have[r as ResourceId] < (n ?? 0);
        return (
          <span
            key={r}
            className={`${css.cost} ${short ? css.short : ''}`}
            title={t(`res.${r}` as LocaleKey)}
          >
            <Icon /> {n}
          </span>
        );
      })}
    </span>
  );
}

export function costText(cost: Partial<Record<ResourceId, number>>): string {
  return Object.entries(cost)
    .map(([r, n]) => `${n} ${t(`res.${r}` as LocaleKey).toLowerCase()}`)
    .join(' · ');
}

type Tab = 'trade' | 'housing' | 'services' | 'upgrades';

/** What a building does, in one short line (produces, houses, staff). */
function facts(kind: StructureKind): string {
  const d = BUILDINGS[kind];
  const out: string[] = [];
  if (d.produces)
    for (const [r, v] of Object.entries(d.produces))
      out.push(
        `+${((v ?? 0) * 8).toFixed(1)} ${t(`res.${r}` as LocaleKey).toLowerCase()}/${t('build.perWorkerDay')}`,
      );
  if (d.housing) out.push(t('build.houses', { n: d.housing[0] }));
  if (d.workers[0] > 0) out.push(t('build.staff', { n: d.workers[0] }));
  if (d.storage) out.push(t('build.storage', { n: d.storage }));
  return out.join(' · ');
}

/**
 * The works dock (DECISIONS I-72): build the district from a panel, not a single button. Tabs
 * for the district's trade, housing, services and upgrades; cards with a thumbnail, what the
 * building does and what it costs (missing resources in red); works under way with progress.
 */
export function BuildMenu({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('trade');
  if (state.phase.kind !== 'district') return null;
  const have = state.economy.resources;
  if (ui.mode === 'place' && ui.placeKind) {
    return (
      <div className={`${styles.panel} ${styles.placeHint}`} data-testid="place-hint">
        <strong>{t(`b.${ui.placeKind}` as LocaleKey)}</strong>
        <span>
          {ui.placementHint ? t(`place.${ui.placementHint}` as LocaleKey) : t('place.hint')}
        </span>
        <button type="button" className={styles.button} onClick={() => session.ui.cancel()}>
          {t('sel.close')}
        </button>
      </div>
    );
  }
  const trades = homeProfile(state.meta.homeDistrictId).trades.filter(
    (k) => BUILDINGS[k].buildable,
  );
  const common = COMMON_BUILDINGS.filter((k) => BUILDINGS[k].buildable);
  const kinds: Record<Exclude<Tab, 'upgrades'>, StructureKind[]> = {
    // The trade tab is production: the district's trade plus the common vegetable gardens.
    trade: [...trades, ...common.filter((k) => BUILDINGS[k].category === 'production')],
    housing: common.filter((k) => BUILDINGS[k].category === 'housing'),
    services: common.filter((k) => BUILDINGS[k].category === 'service'),
  };
  const works = state.district.structures.filter((s) => !s.built);
  const upgradable = state.district.structures.filter(
    (s) => s.built && s.level < 3 && BUILDINGS[s.kind].buildable,
  );
  const tabs: [Tab, string][] = [
    ['trade', t('build.trade')],
    ['housing', t('build.tab.housing')],
    ['services', t('build.tab.services')],
    ['upgrades', t('build.tab.upgrades')],
  ];
  const card = (kind: StructureKind) => {
    const def = BUILDINGS[kind];
    const affordable = canAfford(state, kind);
    return (
      <button
        key={kind}
        type="button"
        role="menuitem"
        className={`${css.card} ${affordable ? '' : css.locked}`}
        disabled={!affordable}
        onClick={() => {
          setOpen(false);
          session.ui.startPlacing(kind);
        }}
      >
        <img className={css.thumb} src={`assets/ui/thumbs/${kind}.webp`} alt="" loading="lazy" />
        <span className={css.name}>{t(`b.${kind}` as LocaleKey)}</span>
        <span className={css.facts}>{facts(kind)}</span>
        <CostChips cost={def.cost} have={have} />
      </button>
    );
  };
  const upgradeCard = (s: PlacedStructure) => {
    const cost = upgradeCost(s.kind, s.level + 1);
    const ok = Object.entries(cost).every(([r, n]) => have[r as ResourceId] >= (n ?? 0));
    return (
      <button
        key={s.id}
        type="button"
        role="menuitem"
        className={`${css.card} ${ok ? '' : css.locked}`}
        disabled={!ok}
        onClick={() => session.dispatch({ type: 'build/upgrade', id: s.id })}
      >
        <img className={css.thumb} src={`assets/ui/thumbs/${s.kind}.webp`} alt="" loading="lazy" />
        <span className={css.name}>
          {t(`b.${s.kind}` as LocaleKey)} · {t('build.toLevel', { n: s.level + 1 })}
        </span>
        <span className={css.facts}>{facts(s.kind)}</span>
        <CostChips cost={cost} have={have} />
      </button>
    );
  };
  return (
    <div className={css.dock}>
      {open && (
        <section className={css.panel} role="menu" data-testid="build-menu">
          <nav className={css.tabs} role="tablist">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={css.tab}
                onClick={() => setTab(id)}
              >
                {label}
                {id === 'upgrades' && upgradable.length > 0 && (
                  <b className={css.badge}>{upgradable.length}</b>
                )}
              </button>
            ))}
          </nav>
          <div className={css.cards} key={tab}>
            {tab === 'upgrades' ? (
              upgradable.length > 0 ? (
                upgradable.slice(0, 24).map(upgradeCard)
              ) : (
                <p className={css.empty}>{t('build.noUpgrades')}</p>
              )
            ) : (
              kinds[tab].map(card)
            )}
          </div>
        </section>
      )}
      <div className={css.bar}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary} ${css.main}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <HammerIcon /> {t('hud.build')}
        </button>
        {works.length > 0 && (
          <div className={css.works} data-testid="works" aria-label={t('build.works')}>
            {works.slice(0, 4).map((s) => {
              const pct = Math.min(1, s.progress / Math.max(1, BUILDINGS[s.kind].buildWork));
              return (
                <span key={s.id} className={css.work} title={t(`b.${s.kind}` as LocaleKey)}>
                  <img src={`assets/ui/thumbs/${s.kind}.webp`} alt="" />
                  <i style={{ width: `${pct * 100}%` }} />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
