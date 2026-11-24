import { useEffect, useRef, useState } from 'react';
import { DISTRICTS, HOME_DISTRICT_NUMBER } from '../../content/districts.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import world from '../../content/maps/world.json' with { type: 'json' };
import type { SlotMeta } from '../../persistence/saveRepository.ts';
import type { Quality } from '../../platform/settings.ts';
import { getQuality, setQuality } from '../../platform/settings.ts';
import { isStoragePersistent } from '../../platform/storage.ts';
import { describeSlot } from '../components/SlotList.tsx';
import { EmblemIcon } from '../icons/Icons.tsx';
import { useServices } from '../services.ts';
import styles from '../ui.module.css';

interface Props {
  onNewGame(): void;
  onContinue(): void;
  onLoad(): void;
}

type PlaceId = 'aurea' | `d${number}`;
const MARKERS = world.markers as unknown as Record<string, [number, number]>;

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.inkBar}>
      <span>{label}</span>
      <span className={styles.inkTrack}>
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </div>
  );
}

/**
 * The start screen: the painted map of La Concordia. Every district and the capital can be
 * inspected; the playable one (District XII) starts or continues the game.
 */
export function MainMenu({ onNewGame, onContinue, onLoad }: Props) {
  const { repository } = useServices();
  const [latest, setLatest] = useState<SlotMeta | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [quality, setQ] = useState<Quality>(getQuality);
  const [selected, setSelected] = useState<PlaceId>(`d${HOME_DISTRICT_NUMBER}`);
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void repository?.latest().then((m) => alive && setLatest(m));
    void isStoragePersistent().then((p) => alive && setPersistent(p));
    return () => {
      alive = false;
    };
  }, [repository]);

  // On narrow screens the map is wider than the viewport: start centred on the home district.
  useEffect(() => {
    const vp = viewport.current;
    const home = MARKERS[`d${HOME_DISTRICT_NUMBER}`];
    if (!vp || !home) return;
    const narrow = vp.scrollWidth - vp.clientWidth > vp.clientWidth * 0.3;
    // Wide screens see the whole map centred; narrow ones start on the home district.
    vp.scrollLeft = narrow
      ? Math.max(0, vp.scrollWidth * home[0] - vp.clientWidth * 0.55)
      : (vp.scrollWidth - vp.clientWidth) / 2;
    vp.scrollTop = (vp.scrollHeight - vp.clientHeight) / 2;
  }, []);

  // A slight parallax with the pointer: the sheet feels like an object on the table.
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !stage.current) return;
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    stage.current.style.setProperty('--px', `${(-x * 10).toFixed(1)}px`);
    stage.current.style.setProperty('--py', `${(-y * 8).toFixed(1)}px`);
  };

  const district = selected === 'aurea' ? null : DISTRICTS[Number(selected.slice(1)) - 1]!;
  const isHome = district?.id === HOME_DISTRICT_NUMBER;
  const small =
    typeof window !== 'undefined' && Math.max(window.innerWidth, window.innerHeight) < 900;

  return (
    <main className={styles.worldMenu} data-testid="main-menu" onPointerMove={onPointerMove}>
      <div className={styles.mapViewport} ref={viewport}>
        <div className={styles.mapStage} ref={stage}>
          <img
            className={styles.mapImage}
            src={small ? 'assets/ui/worldmap_small.jpg' : world.image}
            alt={t('map.title')}
            draggable={false}
          />
          <div className={styles.candle} aria-hidden="true" />
          {Object.entries(MARKERS).map(([id, [x, y]]) => {
            const d = id === 'aurea' ? null : DISTRICTS[Number(id.slice(1)) - 1]!;
            const home = d?.id === HOME_DISTRICT_NUMBER;
            return (
              <button
                key={id}
                type="button"
                className={`${styles.seal} ${id === 'aurea' ? styles.sealCapital : ''} ${home ? styles.sealHome : ''}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                aria-pressed={selected === id}
                aria-label={d ? `${t('map.district', { n: d.numeral })} · ${d.name}` : 'Áurea'}
                onClick={() => setSelected(id as PlaceId)}
              >
                <span className={styles.sealWax}>{d ? d.numeral : '✦'}</span>
                <span className={styles.sealLabel}>{d ? d.name : 'Áurea'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <header className={styles.mapHeader}>
        <EmblemIcon className={styles.emblemSmall} />
        <div>
          <h1 className={styles.mapGameTitle}>{t('game.title')}</h1>
          <p className={styles.tagline}>{t('game.tagline')}</p>
        </div>
        <div className={styles.mapHeaderActions}>
          {latest && (
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={onContinue}
            >
              {t('menu.continue')}
              <span className="visually-hidden"> · </span>
              <small className={styles.continueMeta}>{describeSlot(latest)}</small>
            </button>
          )}
          <button type="button" className={styles.button} onClick={onLoad}>
            {t('menu.load')}
          </button>
        </div>
      </header>

      <aside className={styles.mapCard} aria-live="polite" data-testid="place-card">
        <p className={styles.mapCardKicker}>
          {district ? t('map.district', { n: district.numeral }) : t('map.capital')}
          {isHome && <span className={styles.homeTag}>{t('map.home')}</span>}
        </p>
        <h2 className={styles.mapCardTitle}>{district ? district.name : 'Áurea'}</h2>
        {district && (
          <p className={styles.mapCardMeta}>{t('map.industry', { industry: district.industry })}</p>
        )}
        <p className={styles.mapCardText}>
          {t((district ? `dist.${district.id}` : 'dist.aurea') as LocaleKey)}
        </p>
        {district && (
          <div className={styles.mapCardBars}>
            <Bar label={t('map.wealth')} value={district.wealth} />
            <Bar label={t('map.academies')} value={district.training} />
          </div>
        )}
        {isHome ? (
          <button
            type="button"
            className={`${styles.button} ${latest ? '' : styles.primary} ${styles.mapPlay}`}
            onClick={onNewGame}
          >
            {t('map.play')}
          </button>
        ) : (
          district && <p className={styles.mapLocked}>{t('map.locked')}</p>
        )}
      </aside>

      <footer className={styles.mapFooter}>
        <div className={styles.segmented} role="group" aria-label={t('menu.quality')}>
          {(['auto', 'low', 'high'] as const).map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={quality === q}
              onClick={() => {
                setQuality(q);
                setQ(q);
              }}
            >
              {t(`menu.quality.${q}`)}
            </button>
          ))}
        </div>
        {!repository && <p className={styles.warning}>{t('menu.storageWarning')}</p>}
        {repository && !persistent && latest && (
          <p className={styles.note}>{t('menu.storageWarning')}</p>
        )}
        <p className={styles.note}>{t('game.placeholderNotice')}</p>
      </footer>
    </main>
  );
}
