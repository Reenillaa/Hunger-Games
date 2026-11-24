/** Per-device preferences (never part of a save). Storage may be unavailable: always fall back. */
export type Quality = 'auto' | 'low' | 'high';

export interface Settings {
  quality: Quality;
  /** UI zoom: 1 = normal, 1.15 = large, 1.3 = extra large. */
  textScale: number;
  reducedMotion: boolean;
  volume: number;
  muted: boolean;
}

const KEY = 'diezmo.settings';
const LEGACY_QUALITY = 'diezmo.quality';
const listeners = new Set<(s: Settings) => void>();

function osReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const DEFAULTS = (): Settings => ({
  quality: 'auto',
  textScale: 1,
  reducedMotion: osReducedMotion(),
  volume: 0.6,
  muted: false,
});

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    const legacy = window.localStorage.getItem(LEGACY_QUALITY);
    if (!stored.quality && (legacy === 'low' || legacy === 'high')) stored.quality = legacy;
  } catch {
    /* private mode or corrupt value: defaults */
  }
  cache = { ...DEFAULTS(), ...stored };
  return cache;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* the choice lasts this visit only */
  }
  applySettingsToDocument(cache);
  listeners.forEach((l) => l(cache!));
  return cache;
}

export function onSettingsChange(listener: (s: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Text size and reduced motion are document-wide (CSS reads them). */
export function applySettingsToDocument(s: Settings = getSettings()): void {
  const root = document.documentElement;
  root.style.setProperty('--ui-zoom', String(s.textScale));
  root.classList.toggle('reduce-motion', s.reducedMotion);
}

export function getQuality(): Quality {
  return getSettings().quality;
}

export function setQuality(q: Quality): void {
  updateSettings({ quality: q });
}
