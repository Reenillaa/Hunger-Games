import { useState } from 'react';
import type { ResourceId, StructureKind } from '../../core/index.ts';
import { canAfford } from '../../core/index.ts';
import { BUILDINGS } from '../../content/buildings.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { HammerIcon } from '../icons/Icons.tsx';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import styles from '../ui.module.css';

export function costText(cost: Partial<Record<ResourceId, number>>): string {
  return Object.entries(cost)
    .map(([r, n]) => `${n} ${t(`res.${r}` as LocaleKey).toLowerCase()}`)
    .join(' · ');
}

const BUILDABLE = (Object.keys(BUILDINGS) as StructureKind[]).filter((k) => BUILDINGS[k].buildable);

export function BuildMenu({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  const [open, setOpen] = useState(false);
  if (state.phase.kind !== 'district') return null;
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
  return (
    <div className={styles.buildArea}>
      {open && (
        <div className={`${styles.panel} ${styles.buildMenu}`} role="menu" data-testid="build-menu">
          {BUILDABLE.map((kind) => {
            const def = BUILDINGS[kind];
            const affordable = canAfford(state, kind);
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className={styles.buildItem}
                disabled={!affordable}
                onClick={() => {
                  setOpen(false);
                  session.ui.startPlacing(kind);
                }}
              >
                <span className={styles.slotName}>{t(`b.${kind}` as LocaleKey)}</span>
                <span className={styles.slotMeta}>{costText(def.cost)}</span>
                <span className={styles.buildDesc}>{t(`bd.${kind}` as LocaleKey)}</span>
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className={`${styles.button} ${styles.primary} ${styles.buildButton}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <HammerIcon /> {t('hud.build')}
      </button>
    </div>
  );
}
