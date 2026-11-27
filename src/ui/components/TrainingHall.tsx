import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Contestant } from '../../core/index.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import css from './training.module.css';

/**
 * The training centre (DECISIONS I-74): a hall seen from above with six stations made of real
 * models. Pick a tribute, then a station: they walk there (real walk cycle) and train; rivals
 * train at their own stations. Original design.
 */
export const STATIONS: { id: string; x: number; y: number; props: string[]; skill: string }[] = [
  {
    id: 'combat',
    x: 22,
    y: 30,
    props: ['k_sword', 'k_spear', 'k_workbench'],
    skill: 'skill.combat',
  },
  {
    id: 'survival',
    x: 50,
    y: 20,
    props: ['k_campfire', 'k_tent', 'k_wood_pile'],
    skill: 'skill.survival',
  },
  {
    id: 'stealth',
    x: 78,
    y: 30,
    props: ['k_bush_large', 'k_bush', 'k_bush_detailed'],
    skill: 'skill.stealth',
  },
  {
    id: 'endurance',
    x: 22,
    y: 66,
    props: ['k_frame', 'k_rock_large', 'k_log_stack'],
    skill: 'attr.strength',
  },
  { id: 'allies', x: 50, y: 76, props: ['k_bench', 'k_bench', 'k_lantern'], skill: 'cap.ally' },
  {
    id: 'scout',
    x: 78,
    y: 66,
    props: ['k_signpost', 'k_lightpost', 'k_crates'],
    skill: 'cap.opt.scout',
  },
];

const SHEET = { w: 104, h: 208, cols: 9 };

/** A character from its spritesheet: idle frame, or a looping walk while moving. */
function Walker({
  sheet,
  dir,
  walking,
  scale = 0.55,
}: {
  sheet: string;
  dir: number;
  walking: boolean;
  scale?: number;
}) {
  const style = {
    width: SHEET.w,
    height: SHEET.h,
    backgroundImage: `url(assets/district/characters/${sheet}.webp)`,
    backgroundPositionY: `${-dir * SHEET.h}px`,
    scale: String(scale),
  } as CSSProperties;
  return <span className={`${css.walker} ${walking ? css.walking : ''}`} style={style} />;
}

/** Iso-ish direction (0 = s … 7 = se, like the sheets) for a move on screen. */
function dirFor(dx: number, dy: number): number {
  const a = Math.atan2(dy, dx); // screen: +x right, +y down
  const idx = Math.round(((a - Math.PI / 2) / (Math.PI / 4)) % 8);
  return ((idx % 8) + 8) % 8;
}

export function TrainingHall({
  mine,
  rivals,
  day,
  current,
  onChoose,
}: {
  mine: Contestant[];
  rivals: Contestant[];
  day: number;
  current(c: Contestant): string | undefined;
  onChoose(c: Contestant, station: string): void;
}) {
  const [selected, setSelected] = useState(mine[0]?.id ?? '');
  const [moving, setMoving] = useState<Record<string, { from: string; dir: number }>>({});
  const stationOf = (id: string | undefined) => STATIONS.find((s) => s.id === id);
  const go = (station: (typeof STATIONS)[number]) => {
    const c = mine.find((m) => m.id === selected);
    if (!c) return;
    const from = stationOf(current(c)) ?? { x: 50, y: 48 };
    setMoving((m) => ({
      ...m,
      [c.id]: { from: current(c) ?? '', dir: dirFor(station.x - from.x, station.y - from.y) },
    }));
    onChoose(c, station.id);
    window.setTimeout(() => setMoving((m) => ({ ...m, [c.id]: { from: '', dir: 0 } })), 950);
  };
  // Rivals spread over the stations, the same every day for a given rival.
  const rivalAt = (r: Contestant, i: number) =>
    STATIONS[(r.district * 7 + i + day * 3) % STATIONS.length]!;
  return (
    <div className={css.hall} data-testid="training-hall">
      <div className={css.floor} />
      {STATIONS.map((s) => {
        const here = mine.filter((c) => current(c) === s.id);
        return (
          <button
            key={s.id}
            type="button"
            className={`${css.station} ${here.length ? css.occupied : ''}`}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            onClick={() => go(s)}
            aria-label={t(`cap.opt.${s.id}` as LocaleKey)}
            data-testid={`station-${s.id}`}
          >
            <span className={css.pad} />
            <span className={css.anchor}>
              {s.props.map((p, i) => (
                <img
                  key={i}
                  src={`assets/district/sprites/${p}.webp`}
                  alt=""
                  className={css.prop}
                  style={{ left: `${-34 + i * 34}px`, top: `${-30 + (i % 2) * 18}px` }}
                />
              ))}
              <span className={css.label}>{t(`cap.opt.${s.id}` as LocaleKey)}</span>
            </span>
          </button>
        );
      })}
      {rivals.slice(0, 14).map((r, i) => {
        const s = rivalAt(r, i);
        return (
          <span
            key={r.id}
            className={css.rival}
            style={{
              left: `calc(${s.x}% + ${((i % 3) - 1) * 26}px)`,
              top: `calc(${s.y}% + ${18 + (i % 2) * 10}px)`,
            }}
            title={r.name}
          >
            <Walker
              sheet={r.sex === 'F' ? 'contestant_f' : 'contestant'}
              dir={(i * 3) % 8}
              walking={false}
              scale={0.42}
            />
          </span>
        );
      })}
      {mine.map((c, i) => {
        const s = stationOf(current(c));
        const pos = s ?? { x: 44 + i * 12, y: 48 };
        const mv = moving[c.id];
        return (
          <button
            key={c.id}
            type="button"
            className={`${css.tribute} ${selected === c.id ? css.selectedTribute : ''}`}
            style={{ left: `calc(${pos.x}% + ${i * 22 - 11}px)`, top: `calc(${pos.y}% + 26px)` }}
            onClick={() => setSelected(c.id)}
            aria-pressed={selected === c.id}
            aria-label={c.name}
          >
            <Walker
              sheet={c.sex === 'F' ? 'contestant_f' : 'contestant'}
              dir={mv?.from !== undefined && mv.from !== '' ? mv.dir : 0}
              walking={!!mv && mv.from !== ''}
            />
            <span className={css.name}>{c.name.split(' ')[0]}</span>
          </button>
        );
      })}
      <p className={css.help}>{t('train.help')}</p>
    </div>
  );
}
