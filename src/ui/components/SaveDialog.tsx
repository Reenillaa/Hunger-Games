import { useEffect, useState } from 'react';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import type { SlotId, SlotMeta } from '../../persistence/saveRepository.ts';
import { MANUAL_SLOTS } from '../../persistence/saveRepository.ts';
import { useServices } from '../services.ts';
import styles from '../ui.module.css';
import { Dialog } from './Dialog.tsx';
import { SlotList } from './SlotList.tsx';

interface Props {
  session: GameSession;
  onClose(): void;
  onExport(): void;
  notify(message: string): void;
}

export function SaveDialog({ session, onClose, onExport, notify }: Props) {
  const { repository } = useServices();
  const [metas, setMetas] = useState<SlotMeta[]>([]);

  useEffect(() => {
    let alive = true;
    void repository?.listSlots().then((list) => alive && setMetas(list));
    return () => {
      alive = false;
    };
  }, [repository]);

  const save = async (id: SlotId) => {
    if (!repository) return;
    try {
      const meta = await repository.save(id, session.getState());
      setMetas((prev) => [meta, ...prev.filter((m) => m.id !== id)]);
      notify(t('save.saved'));
    } catch {
      notify(t('save.failed'));
    }
  };

  return (
    <Dialog title={t('save.title')} onClose={onClose}>
      <SlotList
        slots={MANUAL_SLOTS.map((id) => ({ id, meta: metas.find((m) => m.id === id) }))}
        actionLabel={t('save.saveHere')}
        onAction={(id) => void save(id)}
      />
      <button type="button" className={styles.button} onClick={onExport}>
        {t('save.export')}
      </button>
    </Dialog>
  );
}
