import { useEffect, useState } from 'react';
import { t } from '../../content/i18n.ts';
import type { Settings } from '../../platform/settings.ts';
import { getSettings, onSettingsChange, updateSettings } from '../../platform/settings.ts';
import { Dialog } from './Dialog.tsx';
import styles from '../ui.module.css';

const SCALES = [
  [1, 'set.text.normal'],
  [1.15, 'set.text.large'],
  [1.3, 'set.text.xl'],
] as const;

/** Per-device settings: quality, text size, motion and sound. */
export function SettingsDialog({ onClose }: { onClose(): void }) {
  const [s, setS] = useState<Settings>(getSettings);
  useEffect(() => onSettingsChange(setS), []);
  return (
    <Dialog title={t('set.title')} onClose={onClose}>
      <div className={styles.settingsGrid} data-testid="settings">
        <div className={styles.settingRow}>
          <span>{t('menu.quality')}</span>
          <div className={styles.segmented}>
            {(['auto', 'low', 'high'] as const).map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={s.quality === q}
                onClick={() => updateSettings({ quality: q })}
              >
                {t(`menu.quality.${q}`)}
              </button>
            ))}
          </div>
          <small className={styles.note}>{t('set.quality.note')}</small>
        </div>
        <div className={styles.settingRow}>
          <span>{t('set.text')}</span>
          <div className={styles.segmented}>
            {SCALES.map(([v, key]) => (
              <button
                key={v}
                type="button"
                aria-pressed={s.textScale === v}
                onClick={() => updateSettings({ textScale: v })}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.settingRow}>
          <span>{t('set.motion')}</span>
          <div className={styles.segmented}>
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={s.reducedMotion === v}
                onClick={() => updateSettings({ reducedMotion: v })}
              >
                {t(v ? 'set.motion.reduced' : 'set.motion.full')}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.settingRow}>
          <span>
            {t('set.volume')} · {s.muted ? t('set.muted') : `${Math.round(s.volume * 100)} %`}
          </span>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            aria-label={t('set.volume')}
            onChange={(e) => updateSettings({ volume: Number(e.target.value), muted: false })}
          />
          <div className={styles.segmented}>
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={s.muted === v}
                onClick={() => updateSettings({ muted: v })}
              >
                {t(v ? 'set.sound.off' : 'set.sound.on')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
