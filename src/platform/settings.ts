/** Per-device preferences (never part of a save). Storage may be unavailable: always fall back. */
export type Quality = 'auto' | 'low' | 'high';

const KEY = 'diezmo.quality';

export function getQuality(): Quality {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'low' || v === 'high' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setQuality(q: Quality): void {
  try {
    window.localStorage.setItem(KEY, q);
  } catch {
    /* private mode: the choice lasts this visit only */
  }
}
