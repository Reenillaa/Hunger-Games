import { useState } from 'react';
import type { Contestant } from '../../core/index.ts';
import { DISTRICTS } from '../../content/districts.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { Portrait } from './Portrait.tsx';
import styles from '../ui.module.css';

type Choice = 'posture' | 'outfit' | 'training' | 'hidden' | 'interview' | 'plan';

const CHOICES_BY_DAY: Record<number, Choice[]> = {
  1: ['posture'],
  2: ['outfit'],
  3: ['training'],
  4: ['training'],
  5: ['training', 'hidden'],
  6: ['interview'],
  7: ['plan'],
};

const OPTIONS: Record<Choice, string[]> = {
  posture: ['reserved', 'friendly', 'intimidating'],
  outfit: ['identity', 'bold', 'traditional'],
  training: ['combat', 'survival', 'stealth', 'endurance', 'allies', 'scout'],
  hidden: ['no', 'yes'],
  interview: ['humble', 'charming', 'defiant', 'mysterious', 'tragic'],
  plan: ['flee', 'fight'],
};

function current(c: Contestant, choice: Choice, day: number): string | undefined {
  const ch = c.choices;
  if (choice === 'training') return ch.training[day - 3];
  if (choice === 'hidden') return ch.hidden === undefined ? undefined : ch.hidden ? 'yes' : 'no';
  return ch[choice] as string | undefined;
}

function Stat({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className={styles.statRow}>
      <span>{label}</span>
      <span className={styles.statBar}>
        <span style={{ width: `${Math.min(1, value / max) * 100}%` }} />
      </span>
      <span className={styles.statValue}>{Math.round(value)}</span>
    </div>
  );
}

/** The seven days in Áurea: one decision screen per day, built on the real contestants. */
export function CapitalPanel({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const [budget, setBudget] = useState(0);
  const [showRivals, setShowRivals] = useState(false);
  const phase = state.phase;
  const games = state.games;
  if (phase.kind !== 'capital' || !games || session.cinematic) return null;
  const day = phase.day;
  const mine = games.order.map((id) => games.contestants[id]!).filter((c) => c.player);
  const rivals = games.order.map((id) => games.contestants[id]!).filter((c) => !c.player);
  const scouted = mine.some((c) => c.scouted) || day > 5;
  const choose = (c: Contestant, choice: Choice, value: string) =>
    session.dispatch({
      type: 'capital/choose',
      contestantId: c.id,
      choice,
      value,
      ...(choice === 'outfit' ? { budget } : {}),
    });
  return (
    <div className={styles.capital} data-testid="capital">
      <header className={`${styles.panel} ${styles.capitalHead}`}>
        <p className={styles.regimeLine}>
          {t('capital.name')} ·{' '}
          {t('calendar.edition', { games: t('games.name'), edition: games.edition })}
        </p>
        <h2 className={styles.sheetTitle}>
          {t('phase.capital.body', { day, total: 7 }).split('.')[0]} —{' '}
          {t(`cap.day.${day}` as LocaleKey)}
        </h2>
        <p className={styles.sheetBody}>{t(`cap.desc.${day}` as LocaleKey)}</p>
      </header>
      <div className={styles.capitalBody}>
        {mine.map((c) => (
          <section
            key={c.id}
            className={`${styles.panel} ${styles.contestant}`}
            data-testid="contestant"
          >
            <div className={styles.cardHead}>
              <Portrait genes={c.genes} sex={c.sex} age={c.age} mood={c.morale} size={78} />
              <div className={styles.cardFacts}>
                <p className={styles.slotName}>{c.name}</p>
                <p className={styles.slotMeta}>
                  {t('pop.age', { n: c.age })}
                  {c.score !== null &&
                    ` · ${t('cap.score', { n: c.score })}${c.shownScore !== c.score ? ` (${c.shownScore})` : ''}`}
                </p>
                <Stat label={t('cap.popularity')} value={c.popularity} max={100} />
              </div>
            </div>
            <Stat label={t('attr.strength')} value={c.attributes.strength} max={10} />
            <Stat label={t('attr.agility')} value={c.attributes.agility} max={10} />
            <Stat label={t('skill.combat')} value={c.skills.combat} max={20} />
            <Stat label={t('skill.survival')} value={c.skills.survival} max={20} />
            <Stat label={t('skill.stealth')} value={c.skills.stealth} max={20} />
            {CHOICES_BY_DAY[day]!.map((choice) => (
              <div key={choice} className={styles.choiceGroup}>
                <p className={styles.cardSection}>{t(`cap.choice.${choice}` as LocaleKey)}</p>
                {choice === 'outfit' && (
                  <label className={styles.budget}>
                    {t('cap.budget', { n: budget })}
                    <input
                      type="range"
                      min={0}
                      max={Math.max(
                        0,
                        Math.floor(state.economy.resources.credits + games.outfitBudget),
                      )}
                      step={10}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.currentTarget.value))}
                    />
                  </label>
                )}
                <div className={styles.choiceButtons}>
                  {OPTIONS[choice].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={styles.button}
                      aria-pressed={current(c, choice, day) === value}
                      onClick={() => choose(c, choice, value)}
                    >
                      {t(`cap.opt.${value}` as LocaleKey)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
        <section className={`${styles.panel} ${styles.journal}`}>
          <p className={styles.cardSection}>{t('cap.journal')}</p>
          <ul className={styles.history}>
            {[...games.log]
              .reverse()
              .slice(0, 12)
              .map((entry, i) => (
                <li key={i}>{t(entry.key as LocaleKey, entry.vars ?? {})}</li>
              ))}
          </ul>
          <button
            type="button"
            className={styles.button}
            onClick={() => setShowRivals((v) => !v)}
            aria-expanded={showRivals}
          >
            {t('cap.rivals')} ({rivals.length})
          </button>
          {showRivals && (
            <ul className={styles.popList}>
              {rivals.map((r) => {
                const view = mine[0]?.opinions[r.id] ?? 0;
                const d = DISTRICTS[r.district - 1]!;
                return (
                  <li key={r.id} className={styles.rival}>
                    <Portrait genes={r.genes} sex={r.sex} age={r.age} size={30} />
                    <span>
                      <span>{r.name}</span>
                      <small className={styles.slotMeta}>
                        {t('cap.district', { n: d.numeral, name: d.name })} ·{' '}
                        {t('pop.age', { n: r.age })}
                        {scouted && r.shownScore !== null
                          ? ` · ${t('cap.score', { n: r.shownScore })}`
                          : ''}
                        {view > 35
                          ? ` · ${t('cap.ally')}`
                          : view < -20
                            ? ` · ${t('cap.enemy')}`
                            : ''}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <button
        type="button"
        className={`${styles.button} ${styles.primary} ${styles.capitalNext}`}
        onClick={() => {
          setBudget(0);
          session.dispatch({ type: 'capital/advance-day' });
        }}
      >
        {day < 7 ? t('cap.next') : t('cap.launch')}
      </button>
    </div>
  );
}
