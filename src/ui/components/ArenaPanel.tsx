import { useState } from 'react';
import type { ArenaActor, ArenaLog, Order, Stance } from '../../core/index.ts';
import { arenaDay, arenaHour, capsuleCost } from '../../core/index.ts';
import { ITEMS } from '../../content/arenaItems.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import { Portrait } from './Portrait.tsx';
import styles from '../ui.module.css';

const STANCES: Stance[] = ['cautious', 'balanced', 'aggressive'];
const PUBLIC_EVENTS = new Set([
  'arena.killed',
  'arena.died.fire',
  'arena.died.bleeding',
  'arena.died.thirst',
  'arena.died.hunger',
  'arena.died.zone',
  'arena.died.combat',
  'arena.fire',
  'arena.feast',
  'arena.victory',
  'arena.nobody',
]);

const itemName = (id: string) => t(`arena.item.${id}` as LocaleKey);

export function logLine(e: ArenaLog): string {
  const vars = { ...e.vars };
  if (vars.item) vars.item = itemName(vars.item);
  return t(e.key as LocaleKey, vars);
}

function Need({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.round(value));
  return (
    <div className={styles.statRow}>
      <span>{label}</span>
      <span className={`${styles.statBar} ${v < 30 ? styles.statLow : ''}`}>
        <span style={{ width: `${v}%` }} />
      </span>
      <span className={styles.statValue}>{v}</span>
    </div>
  );
}

function orderText(o: Order | null, names: Record<string, string>): string {
  if (!o) return t('arena.order.none');
  if (o.kind === 'move') return t('arena.order.move', { x: o.x, y: o.y });
  if (o.kind === 'attack') return t('arena.order.attack', { name: names[o.target] ?? '?' });
  return t(`arena.order.${o.kind}` as LocaleKey);
}

/** The arena HUD: clock, team cards with needs and orders, stance, patrons' capsules, journal. */
export function ArenaPanel({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  const [collapsed, setCollapsed] = useState(
    () => window.matchMedia?.('(max-width: 700px), (max-height: 500px)').matches ?? false,
  );
  const [tab, setTab] = useState<'team' | 'log'>('team');
  const arena = state.arena;
  const games = state.games;
  if (state.phase.kind !== 'arena' || !arena || !games) return null;
  const playing = session.isArenaPlaying();
  const names = Object.fromEntries(
    Object.values(games.contestants).map((c) => [c.id, c.name.split(' ')[0]!]),
  );
  const team = Object.values(arena.actors).filter((a) => a.player);
  const alive = Object.values(arena.actors).filter((a) => a.alive).length;
  const selected = ui.arenaActorId ? arena.actors[ui.arenaActorId] : null;
  const teamIds = new Set(team.map((a) => a.id));
  const journal = arena.log
    .filter(
      (e) =>
        PUBLIC_EVENTS.has(e.key) ||
        (e.actorId && teamIds.has(e.actorId)) ||
        e.key === 'arena.capsule',
    )
    .slice(-30)
    .reverse();
  const order = (a: ArenaActor, o: Order | null) =>
    session.dispatch({ type: 'arena/order', actorId: a.id, order: o });
  const hour = `${String(arenaHour(arena.round)).padStart(2, '0')}:00`;

  const memberCard = (a: ArenaActor) => {
    const c = games.contestants[a.id]!;
    const isSel = selected?.id === a.id;
    const status = a.alive
      ? [
          a.hidden && t('arena.status.hidden'),
          a.bleeding > 0 && t('arena.status.bleeding'),
          a.fracture && t('arena.status.fracture'),
        ]
          .filter(Boolean)
          .join(' · ') || orderText(a.order, names)
      : t('arena.status.dead');
    return (
      <section
        key={a.id}
        className={`${styles.member} ${isSel ? styles.selectedCard : ''} ${a.alive ? '' : styles.memberDead}`}
        data-testid="arena-member"
      >
        <button
          type="button"
          className={styles.memberHead}
          onClick={() => session.ui.selectArenaActor(isSel ? null : a.id)}
          aria-pressed={isSel}
          aria-expanded={isSel}
        >
          <Portrait
            genes={c.genes}
            sex={c.sex}
            age={c.age}
            mood={100 - a.stress}
            dead={!a.alive}
            size={48}
          />
          <span className={styles.memberInfo}>
            <strong>{c.name}</strong>
            <small>{status}</small>
            {a.alive && (
              <span className={styles.miniBars} aria-hidden="true">
                {[a.hp, a.hunger, a.thirst, a.energy].map((v, i) => (
                  <span key={i} className={`${styles.statBar} ${v < 30 ? styles.statLow : ''}`}>
                    <span style={{ width: `${Math.max(0, v)}%` }} />
                  </span>
                ))}
              </span>
            )}
          </span>
        </button>
        {a.alive && isSel && (
          <div className={styles.memberBody}>
            <Need label={t('arena.need.hp')} value={a.hp} />
            <Need label={t('arena.need.hunger')} value={a.hunger} />
            <Need label={t('arena.need.thirst')} value={a.thirst} />
            <Need label={t('arena.need.energy')} value={a.energy} />
            <p className={styles.arenaMeta}>
              <span>
                {t('arena.weapon', { w: a.weapon ? itemName(a.weapon) : t('arena.fists') })}
              </span>
              <span>
                {t('arena.items', {
                  items: a.items.length ? a.items.map(itemName).join(', ') : t('arena.nothing'),
                })}
              </span>
            </p>
            <p className={styles.arenaMeta}>
              <strong>{t('arena.order')}:</strong> {orderText(a.order, names)}
            </p>
            <div className={styles.choiceButtons}>
              {(['hide', 'rest', 'forage'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={styles.button}
                  aria-pressed={a.order?.kind === k}
                  onClick={() => order(a, { kind: k })}
                >
                  {t(`arena.order.${k}` as LocaleKey)}
                </button>
              ))}
              <button
                type="button"
                className={styles.button}
                aria-pressed={!a.order}
                onClick={() => order(a, null)}
              >
                {t('arena.order.clear')}
              </button>
            </div>
            <p className={styles.arenaHint}>{t('arena.order.hint')}</p>
            <div className={styles.choiceGroup}>
              <strong className={styles.regimeLine}>{t('arena.gift')}</strong>
              <div className={styles.giftGrid}>
                {Object.keys(ITEMS).map((item) => {
                  const cost = capsuleCost(item, arena.round);
                  return (
                    <button
                      key={item}
                      type="button"
                      className={styles.giftItem}
                      disabled={cost > arena.patronage}
                      onClick={() => session.dispatch({ type: 'arena/gift', actorId: a.id, item })}
                    >
                      <span>{itemName(item)}</span>
                      <small>{cost}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div
      className={`${styles.arena} ${collapsed ? styles.arenaCollapsed : ''}`}
      data-testid="arena"
    >
      <header className={`${styles.panel} ${styles.arenaHead}`}>
        <div className={styles.arenaTitleRow}>
          <div>
            <p className={styles.regimeLine}>
              {t('calendar.edition', { games: t('games.name'), edition: games.edition })}
            </p>
            <h2 className={styles.arenaClock} data-testid="arena-clock">
              {t('arena.title', { day: arenaDay(arena.round), hour })}
            </h2>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('arena.expand') : t('arena.collapse')}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
        <p className={styles.arenaMeta}>
          <span className={styles.resourceMeta}>{t('arena.alive', { n: alive })}</span>
          <span className={styles.resourceMeta}>
            {t('arena.patronage', { n: arena.patronage })}
          </span>
          <span className={styles.spectacle} title={t('arena.spectacle')}>
            {t('arena.spectacle')}
            <span className={styles.statBar}>
              <span style={{ width: `${arena.spectacle}%` }} />
            </span>
          </span>
        </p>
        <div className={styles.arenaControls}>
          {arena.finished ? (
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={() => session.dispatch({ type: 'arena/conclude' })}
            >
              {t('phase.arena.action')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={() => session.setArenaPlaying(!playing)}
                data-testid="arena-play"
              >
                {playing ? `❚❚ ${t('arena.pause')}` : `▶ ${t('arena.play')}`}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => session.dispatch({ type: 'arena/conclude' })}
              >
                {t('phase.arena.action')}
              </button>
            </>
          )}
        </div>
        {(arena.interrupt || arena.finished) && (
          <p className={styles.arenaAlert} role="status" data-testid="arena-alert">
            {arena.finished
              ? `${t('arena.over')}. ${logLine(arena.log.at(-1)!)}`
              : logLine(arena.interrupt!)}
          </p>
        )}
      </header>

      {!collapsed && (
        <div className={`${styles.panel} ${styles.arenaBody}`}>
          <div className={styles.segmented} role="tablist">
            {(['team', 'log'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                aria-pressed={tab === k}
                onClick={() => setTab(k)}
              >
                {t(k === 'team' ? 'arena.tab.team' : 'arena.log')}
              </button>
            ))}
          </div>
          {tab === 'team' ? (
            <>
              <div className={styles.setting}>
                <span className={styles.regimeLine}>{t('arena.stance')}</span>
                <div className={styles.segmented}>
                  {STANCES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      aria-pressed={arena.stance === st}
                      onClick={() => session.dispatch({ type: 'arena/stance', stance: st })}
                    >
                      {t(`arena.stance.${st}` as LocaleKey)}
                    </button>
                  ))}
                </div>
              </div>
              {team.map(memberCard)}
            </>
          ) : (
            <ol className={styles.arenaLog} data-testid="arena-log">
              {journal.map((e, i) => (
                <li key={`${e.round}-${i}`}>
                  <span className={styles.logHour}>
                    D{arenaDay(e.round)} {String(arenaHour(e.round)).padStart(2, '0')}h
                  </span>{' '}
                  {logLine(e)}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
