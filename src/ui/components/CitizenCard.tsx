import type { Citizen, GameState } from '../../core/index.ts';
import { ATTRIBUTE_IDS, SKILL_IDS, ageOf, fullName } from '../../core/index.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import { Dialog } from './Dialog.tsx';
import { Portrait } from './Portrait.tsx';
import styles from '../ui.module.css';

export function jobLabel(state: Readonly<GameState>, c: Citizen): string {
  const day = Math.floor(state.clock.tick / 24);
  const age = ageOf(c, day);
  if (!c.alive) return t('pop.deceased');
  const job = c.jobId ? state.district.structures.find((s) => s.id === c.jobId) : null;
  if (job) return t(`b.${job.kind}` as LocaleKey);
  if (age < 6) return t('pop.child');
  if (age < 16) return t('pop.student');
  if (age >= 65) return t('pop.elder');
  return t('pop.unemployed');
}

function Bar({
  label,
  value,
  max,
  shown,
}: {
  label: string;
  value: number;
  max: number;
  shown?: number;
}) {
  return (
    <div className={styles.statRow}>
      <span>{label}</span>
      <span className={styles.statBar}>
        <span style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} />
      </span>
      <span className={styles.statValue}>{Math.round(shown ?? value)}</span>
    </div>
  );
}

export function PersonLink({
  session,
  c,
  label,
}: {
  session: GameSession;
  c: Citizen | undefined;
  label?: string;
}) {
  if (!c) return null;
  const day = Math.floor(session.getState().clock.tick / 24);
  return (
    <button
      type="button"
      className={styles.personLink}
      onClick={() => session.ui.openCitizen(c.id)}
    >
      <Portrait
        genes={c.genes}
        sex={c.sex}
        age={ageOf(c, day)}
        mood={c.mood}
        dead={!c.alive}
        size={36}
      />
      <span>
        {label && <small className={styles.slotMeta}>{label}</small>}
        <span>{fullName(c)}</span>
        <small className={styles.slotMeta}>
          {c.alive ? t('pop.age', { n: ageOf(c, day) }) : t('pop.deceased')}
        </small>
      </span>
    </button>
  );
}

export function CitizenCard({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  const c = ui.citizenId ? state.population.citizens[ui.citizenId] : null;
  if (!c) return null;
  const day = Math.floor(state.clock.tick / 24);
  const age = ageOf(c, c.alive ? day : (c.deathDay ?? day));
  const all = state.population.citizens;
  const mother = c.motherId ? all[c.motherId] : undefined;
  const father = c.fatherId ? all[c.fatherId] : undefined;
  const siblings = [...new Set([...(mother?.childrenIds ?? []), ...(father?.childrenIds ?? [])])]
    .filter((id) => id !== c.id)
    .map((id) => all[id]);
  const relations = Object.entries(c.relations)
    .filter(([, r]) => Math.abs(r.opinion) >= 30)
    .sort((a, b) => Math.abs(b[1].opinion) - Math.abs(a[1].opinion))
    .slice(0, 6);
  const home = c.homeId ? state.district.structures.find((s) => s.id === c.homeId) : null;
  const topSkills = [...SKILL_IDS].sort((a, b) => c.skills[b] - c.skills[a]).slice(0, 5);
  const miner =
    !!c.jobId && state.district.structures.find((s) => s.id === c.jobId)?.kind === 'mine_headframe';
  return (
    <Dialog title={fullName(c)} onClose={() => session.ui.openCitizen(null)}>
      <div className={styles.cardHead} data-testid="citizen-card">
        <Portrait
          genes={c.genes}
          sex={c.sex}
          age={age}
          mood={c.mood}
          miner={miner}
          dead={!c.alive}
          size={104}
        />
        <div className={styles.cardFacts}>
          <p className={styles.slotName}>
            {t('pop.age', { n: age })} · {jobLabel(state, c)}
          </p>
          {home && (
            <p className={styles.slotMeta}>
              {t('card.home', { home: t(`b.${home.kind}` as LocaleKey) })}
            </p>
          )}
          <p className={styles.traits}>
            {c.traits.map((tr) => t(`trait.${tr}` as LocaleKey)).join(' · ')}
          </p>
          {c.alive && (
            <>
              <Bar label={t('card.health', { v: '' })} value={c.health} max={100} />
              <Bar label={t('card.mood', { v: '' })} value={c.mood} max={100} />
              <Bar
                label={t('card.regime', { v: '' })}
                value={c.regimeOpinion + 100}
                max={200}
                shown={c.regimeOpinion}
              />
            </>
          )}
        </div>
      </div>
      <h3 className={styles.cardSection}>{t('card.attributes')}</h3>
      {ATTRIBUTE_IDS.map((a) => (
        <Bar key={a} label={t(`attr.${a}` as LocaleKey)} value={c.attributes[a]} max={10} />
      ))}
      <h3 className={styles.cardSection}>{t('card.skills')}</h3>
      {topSkills.map((sk) => (
        <Bar key={sk} label={t(`skill.${sk}` as LocaleKey)} value={c.skills[sk]} max={20} />
      ))}
      <h3 className={styles.cardSection}>{t('card.family')}</h3>
      <div className={styles.people}>
        <PersonLink session={session} c={mother} label={t('card.mother')} />
        <PersonLink session={session} c={father} label={t('card.father')} />
        <PersonLink
          session={session}
          c={c.partnerId ? all[c.partnerId] : undefined}
          label={t('card.partner')}
        />
        {siblings.map((sib) => (
          <PersonLink key={sib?.id} session={session} c={sib} label={t('card.siblings')} />
        ))}
        {c.childrenIds.map((id) => (
          <PersonLink key={id} session={session} c={all[id]} label={t('card.children')} />
        ))}
      </div>
      {relations.length > 0 && (
        <>
          <h3 className={styles.cardSection}>{t('card.relations')}</h3>
          <div className={styles.people}>
            {relations.map(([id, r]) => (
              <PersonLink
                key={id}
                session={session}
                c={all[id]}
                label={`${r.opinion > 0 ? t('card.friend') : t('card.rival')} (${Math.round(r.opinion)})`}
              />
            ))}
          </div>
        </>
      )}
      {c.history.length > 0 && (
        <>
          <h3 className={styles.cardSection}>{t('card.history')}</h3>
          <ul className={styles.history}>
            {[...c.history]
              .reverse()
              .slice(0, 10)
              .map((h, i) => (
                <li key={i}>
                  <span className={styles.slotMeta}>
                    {t('calendar.date', {
                      year: Math.floor(h.day / 40) + 1,
                      season: '',
                      day: (h.day % 10) + 1,
                    }).replace(' ·  · ', ' · ')}
                  </span>{' '}
                  {t(
                    h.key as LocaleKey,
                    Object.fromEntries(
                      Object.entries(h.vars ?? {}).map(([k, v]) => [
                        k,
                        k === 'job'
                          ? t(`b.${v}` as LocaleKey)
                          : k === 'cause'
                            ? t(`cause.${v}` as LocaleKey)
                            : v,
                      ]),
                    ),
                  )}
                </li>
              ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
