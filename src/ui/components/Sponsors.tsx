import type { Contestant } from '../../core/index.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import css from './sponsors.module.css';

/**
 * The sponsors' box (DECISIONS I-75): six patrons of the Capitol, each with a taste (scores,
 * charm, defiance, tragedy, popularity, a good costume). Their interest is read from the real
 * contestants; together their pledges are what the patronage will be. Original characters.
 */
const PATRONS: { id: string; colour: string; likes(c: Contestant): number }[] = [
  { id: 'aurelio', colour: '#F5C84C', likes: (c) => (c.shownScore ?? 0) * 9 },
  {
    id: 'minerva',
    colour: '#FF8CC6',
    likes: (c) => (c.choices.interview === 'charming' ? 45 : 0) + c.popularity * 0.5,
  },
  {
    id: 'cassio',
    colour: '#3FD4D9',
    likes: (c) => (c.choices.interview === 'defiant' ? 60 : 0) + c.attributes.strength * 3,
  },
  {
    id: 'livia',
    colour: '#B46CFF',
    likes: (c) => (c.choices.interview === 'tragic' ? 55 : 0) + (100 - c.morale) * 0.3,
  },
  { id: 'octavio', colour: '#FF7A2E', likes: (c) => c.popularity * 0.9 },
  {
    id: 'severa',
    colour: '#9FDC6A',
    likes: (c) =>
      (c.choices.outfit === 'bold' ? 40 : c.choices.outfit === 'identity' ? 30 : 10) +
      c.popularity * 0.3,
  },
];

export function Sponsors({ mine }: { mine: Contestant[] }) {
  const rows = PATRONS.map((p) => {
    const best = Math.max(0, ...mine.map((c) => p.likes(c)));
    return { ...p, interest: Math.min(100, Math.round(best)) };
  }).sort((a, b) => b.interest - a.interest);
  const pledge = mine.reduce((n, c) => n + Math.round(c.popularity * 1.5), 0);
  return (
    <section className={css.box} data-testid="sponsors">
      <header>
        <strong>{t('spo.title')}</strong>
        <span className={css.pledge}>{t('spo.pledge', { n: pledge })}</span>
      </header>
      <ul>
        {rows.map((p) => (
          <li key={p.id}>
            <span className={css.dot} style={{ background: p.colour }} />
            <span className={css.name}>
              {t(`spo.${p.id}` as LocaleKey)}
              <small>{t(`spo.${p.id}.likes` as LocaleKey)}</small>
            </span>
            <span className={css.bar}>
              <i style={{ width: `${p.interest}%`, background: p.colour }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
