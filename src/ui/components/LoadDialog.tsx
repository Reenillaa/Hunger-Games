import { useEffect, useRef, useState } from 'react';
import { t } from '../../content/i18n.ts';
import type { GameState } from '../../core/index.ts';
import type { SlotMeta } from '../../persistence/saveRepository.ts';
import { importSaveBytes } from '../../persistence/saveRepository.ts';
import { readFileBytes } from '../../platform/files.ts';
import { useServices } from '../services.ts';
import styles from '../ui.module.css';
import { Dialog } from './Dialog.tsx';
import { SlotList } from './SlotList.tsx';

interface Props {
  onClose(): void;
  onLoaded(state: GameState): void;
  notify(message: string): void;
}

export function LoadDialog({ onClose, onLoaded, notify }: Props) {
  const { repository } = useServices();
  const [metas, setMetas] = useState<SlotMeta[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void repository?.listSlots().then((list) => alive && setMetas(list));
    return () => {
      alive = false;
    };
  }, [repository]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onLoaded(await importSaveBytes(await readFileBytes(file)));
    } catch {
      notify(t('load.importFailed'));
    }
  };

  return (
    <Dialog title={t('load.title')} onClose={onClose}>
      {metas && metas.length === 0 && <p className={styles.note}>{t('load.empty')}</p>}
      {metas && metas.length > 0 && (
        <SlotList
          slots={metas.map((m) => ({ id: m.id, meta: m }))}
          actionLabel={t('menu.load')}
          onAction={(id) => {
            void repository
              ?.load(id)
              .then(onLoaded)
              .catch(() => notify(t('load.importFailed')));
          }}
        />
      )}
      <button type="button" className={styles.button} onClick={() => fileInput.current?.click()}>
        {t('menu.import')}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".diezmo,.gz,.json,application/octet-stream,application/json"
        className="visually-hidden"
        data-testid="import-input"
        onChange={(e) => void onFile(e.currentTarget.files?.[0])}
      />
    </Dialog>
  );
}
