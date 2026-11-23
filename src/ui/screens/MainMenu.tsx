import { useEffect, useState } from 'react';
import { t } from '../../content/i18n.ts';
import type { SlotMeta } from '../../persistence/saveRepository.ts';
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

export function MainMenu({ onNewGame, onContinue, onLoad }: Props) {
  const { repository } = useServices();
  const [latest, setLatest] = useState<SlotMeta | null>(null);
  const [persistent, setPersistent] = useState(true);

  useEffect(() => {
    let alive = true;
    void repository?.latest().then((m) => alive && setLatest(m));
    void isStoragePersistent().then((p) => alive && setPersistent(p));
    return () => {
      alive = false;
    };
  }, [repository]);

  return (
    <main className={styles.menu} data-testid="main-menu">
      <div className={styles.menuInner}>
        <EmblemIcon className={styles.emblem} />
        <div>
          <h1 className={styles.title}>{t('game.title')}</h1>
          <p className={styles.tagline}>{t('game.tagline')}</p>
        </div>
        <div className={styles.menuButtons}>
          {latest && (
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={onContinue}
            >
              {t('menu.continue')}
              <span className="visually-hidden"> · </span>
              <br />
              <small>{describeSlot(latest)}</small>
            </button>
          )}
          <button
            type="button"
            className={`${styles.button} ${latest ? '' : styles.primary}`}
            onClick={onNewGame}
          >
            {t('menu.newGame')}
          </button>
          <button type="button" className={styles.button} onClick={onLoad}>
            {t('menu.load')}
          </button>
        </div>
        {!repository && <p className={styles.warning}>{t('menu.storageWarning')}</p>}
        {repository && !persistent && latest && (
          <p className={styles.note}>{t('menu.storageWarning')}</p>
        )}
        <p className={styles.note}>{t('game.placeholderNotice')}</p>
      </div>
    </main>
  );
}
