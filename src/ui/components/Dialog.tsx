import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { t } from '../../content/i18n.ts';
import { CloseIcon } from '../icons/Icons.tsx';
import styles from '../ui.module.css';

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  // Registered once: re-subscribing on every render could drop the listener in the middle of
  // the very key event that triggered the render (another handler updating the store first).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section
        className={`${styles.panel} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>{title}</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('save.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
