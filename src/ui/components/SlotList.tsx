import { t } from '../../content/i18n.ts';
import type { SlotId, SlotMeta } from '../../persistence/saveRepository.ts';
import { formatSavedAt, seasonName } from '../format.ts';
import styles from '../ui.module.css';

export function describeSlot(meta: SlotMeta): string {
  return `${t('calendar.date', { year: meta.year, season: seasonName(meta.season), day: meta.dayOfSeason })} · ${formatSavedAt(meta.savedAt)}`;
}

export function slotName(id: SlotId): string {
  return id.startsWith('auto') ? t('save.autosave') : t('save.slot', { n: id.slice(-1) });
}

interface Props {
  slots: { id: SlotId; meta: SlotMeta | undefined }[];
  actionLabel: string;
  onAction(id: SlotId): void;
  disableEmpty?: boolean;
}

export function SlotList({ slots, actionLabel, onAction, disableEmpty = false }: Props) {
  return (
    <ul className={styles.slotList}>
      {slots.map(({ id, meta }) => (
        <li key={id} className={styles.slot} data-testid={`slot-${id}`}>
          <div className={styles.slotInfo}>
            <span className={styles.slotName}>{slotName(id)}</span>
            <span className={styles.slotMeta}>{meta ? describeSlot(meta) : t('save.empty')}</span>
          </div>
          <button
            type="button"
            className={styles.button}
            disabled={disableEmpty && !meta}
            onClick={() => onAction(id)}
          >
            {actionLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}
