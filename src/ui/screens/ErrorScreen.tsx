import { t } from '../../content/i18n.ts';
import styles from '../ui.module.css';

export function ErrorScreen({ error, onExport }: { error: unknown; onExport?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      className={styles.error}
      role="alertdialog"
      aria-label={t('error.title')}
      data-testid="error-screen"
    >
      <section className={`${styles.panel} ${styles.dialog}`}>
        <h2 className={styles.dialogTitle}>{t('error.title')}</h2>
        <p className={styles.sheetBody}>{t('error.body')}</p>
        <pre className={styles.slotMeta} style={{ whiteSpace: 'pre-wrap' }}>
          {message}
        </pre>
        {onExport && (
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onExport}>
            {t('error.export')}
          </button>
        )}
        <button type="button" className={styles.button} onClick={() => window.location.reload()}>
          {t('error.reload')}
        </button>
      </section>
    </div>
  );
}
