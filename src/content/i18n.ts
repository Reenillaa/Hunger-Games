import type { LocaleKey } from './locales/es.ts';
import { es } from './locales/es.ts';

export type { LocaleKey };

/** Translates a key, replacing `{name}` placeholders. Missing variables are left visible on purpose. */
export function t(key: LocaleKey, vars: Record<string, string | number> = {}): string {
  return es[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
