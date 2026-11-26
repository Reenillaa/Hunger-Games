import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { LAWS, MAX_ACTIVE_LAWS } from '../../content/laws.ts';
import type { LawDef } from '../../content/laws.ts';
import type { LocaleKey } from '../../content/i18n.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { CloseIcon } from '../icons/Icons.tsx';
import { useSession } from '../useSession.ts';
import { useUi } from '../useUi.ts';
import css from './laws.module.css';

function effects(law: LawDef): { text: string; good: boolean }[] {
  const out: { text: string; good: boolean }[] = [];
  const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;
  if (law.production)
    out.push({
      text: `${t('law.fx.production')} ${pct(law.production - 1)}`,
      good: law.production > 1,
    });
  if (law.foodNeed)
    out.push({ text: `${t('law.fx.foodNeed')} ${pct(law.foodNeed - 1)}`, good: law.foodNeed < 1 });
  if (law.food) out.push({ text: `${t('res.food')} +${law.food}/${t('law.fx.day')}`, good: true });
  if (law.credits)
    out.push({ text: `${t('res.credits')} +${law.credits}/${t('law.fx.day')}`, good: true });
  if (law.morale)
    out.push({
      text: `${t('hud.moraleShort')} ${law.morale > 0 ? '+' : ''}${law.morale}/${t('law.fx.day')}`,
      good: law.morale > 0,
    });
  if (law.attention)
    out.push({
      text: `${t('hud.attentionShort')} ${law.attention > 0 ? '+' : ''}${law.attention}/${t('law.fx.day')}`,
      good: law.attention < 0,
    });
  if (law.unrest)
    out.push({
      text: `${t('law.fx.unrest')} ${law.unrest}/${t('law.fx.day')}`,
      good: law.unrest < 0,
    });
  return out;
}

type Point = [number, number];

/** A flourish for those who sign with the keyboard: drawn stroke by stroke like real ink. */
const AUTO_SIGNATURE: Point[] = [
  [20, 62],
  [34, 30],
  [44, 66],
  [56, 28],
  [64, 60],
  [80, 40],
  [96, 58],
  [112, 36],
  [128, 60],
  [146, 44],
  [160, 58],
  [180, 40],
  [200, 60],
  [226, 46],
  [250, 54],
  [280, 44],
];

/**
 * Signature pad: the player signs with a finger or the mouse. Enough ink and the decree can be
 * sealed and sent.
 */
function SignaturePad({ onSigned }: { onSigned(): void }) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const drawing = useRef(false);
  const ink = useRef(0);
  const lastPoint = useRef<Point | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const toLocal = (e: ReactPointerEvent): Point => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 300, ((e.clientY - r.top) / r.height) * 90];
  };
  const addInk = (a: Point, b: Point) => {
    ink.current += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (ink.current > 160) onSigned();
  };
  return (
    <div className={css.signArea}>
      <svg
        ref={svg}
        className={css.signPad}
        viewBox="0 0 300 90"
        data-testid="signature-pad"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          const p = toLocal(e);
          lastPoint.current = p;
          setStrokes((s) => [...s, [p]]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !lastPoint.current) return;
          const p = toLocal(e);
          addInk(lastPoint.current, p);
          lastPoint.current = p;
          setStrokes((s) => {
            const last = s.at(-1);
            return last ? [...s.slice(0, -1), [...last, p]] : s;
          });
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerCancel={() => (drawing.current = false)}
      >
        <line x1="10" y1="74" x2="290" y2="74" className={css.signLine} />
        {strokes.map((s, i) => (
          <polyline key={i} points={s.map((p) => p.join(',')).join(' ')} className={css.ink} />
        ))}
      </svg>
      <button
        type="button"
        className={css.autoSign}
        onClick={() => {
          setStrokes([AUTO_SIGNATURE]);
          ink.current = 999;
          onSigned();
        }}
      >
        {t('law.signForMe')}
      </button>
    </div>
  );
}

type Stage = 'reading' | 'signed' | 'sending';

/** One decree unrolled on the desk. */
function Decree({
  law,
  active,
  canEnact,
  onDone,
  onBack,
}: {
  law: LawDef;
  active: boolean;
  canEnact: boolean;
  onDone(): void;
  onBack(): void;
}) {
  const [stage, setStage] = useState<Stage>('reading');
  useEffect(() => {
    if (stage !== 'sending') return;
    const timer = setTimeout(onDone, 950);
    return () => clearTimeout(timer);
  }, [stage, onDone]);
  return (
    <div className={`${css.decree} ${stage === 'sending' ? css.sending : ''}`} data-testid="decree">
      <div className={css.roller} />
      <article className={css.paper}>
        <p className={css.decreeKicker}>{t('law.kicker')}</p>
        <h3 className={css.decreeTitle}>{t(`law.${law.id}` as LocaleKey)}</h3>
        <p className={css.decreeText}>{t(`law.${law.id}.desc` as LocaleKey)}</p>
        <p className={css.clauses}>{t('law.clauses')}</p>
        <ul className={css.fx}>
          {effects(law).map((e) => (
            <li key={e.text} className={e.good ? css.good : css.bad}>
              {e.text}
            </li>
          ))}
        </ul>
        {active ? (
          <>
            <div className={css.seal} aria-hidden="true">
              <span>{t('law.inForce')}</span>
            </div>
            <div className={css.actions}>
              <button type="button" className={css.ghost} onClick={onBack}>
                {t('law.back')}
              </button>
              <button type="button" className={css.repeal} onClick={() => setStage('sending')}>
                {t('law.repeal')}
              </button>
            </div>
          </>
        ) : canEnact ? (
          <>
            <SignaturePad onSigned={() => setStage((s) => (s === 'reading' ? 'signed' : s))} />
            {stage !== 'reading' && (
              <div className={`${css.seal} ${css.sealFresh}`} aria-hidden="true">
                <span>{t('law.sealed')}</span>
              </div>
            )}
            <div className={css.actions}>
              <button type="button" className={css.ghost} onClick={onBack}>
                {t('law.back')}
              </button>
              <button
                type="button"
                className={css.send}
                disabled={stage === 'reading'}
                onClick={() => setStage('sending')}
              >
                {t('law.send')}
              </button>
            </div>
          </>
        ) : (
          <div className={css.actions}>
            <p className={css.full}>{t('law.full', { max: MAX_ACTIVE_LAWS })}</p>
            <button type="button" className={css.ghost} onClick={onBack}>
              {t('law.back')}
            </button>
          </div>
        )}
      </article>
      <div className={css.roller} />
    </div>
  );
}

/**
 * The district's laws as rolled decrees on a desk: open one, sign it and send it to be enacted;
 * a decree in force carries the wax seal and can be repealed.
 */
export function LawsPanel({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const ui = useUi(session);
  const [open, setOpen] = useState<string | null>(null);
  const close = useRef(() => session.ui.closePanel());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (ui.panel !== 'laws') return null;
  const active = state.laws;
  const inDistrict = state.phase.kind === 'district';
  const law = open ? LAWS.find((l) => l.id === open) : undefined;
  return (
    <div className={css.desk} role="dialog" aria-modal="true" aria-label={t('law.title')}>
      <header className={css.deskHead}>
        <div>
          <h2>{t('law.title')}</h2>
          <p>{t('law.intro', { n: active.length, max: MAX_ACTIVE_LAWS })}</p>
        </div>
        <button
          type="button"
          className={css.close}
          aria-label={t('save.close')}
          onClick={() => session.ui.closePanel()}
        >
          <CloseIcon />
        </button>
      </header>
      {law ? (
        <Decree
          key={law.id}
          law={law}
          active={active.includes(law.id)}
          canEnact={inDistrict && active.length < MAX_ACTIVE_LAWS}
          onBack={() => setOpen(null)}
          onDone={() => {
            session.dispatch({ type: 'law/toggle', id: law.id });
            setOpen(null);
          }}
        />
      ) : (
        <div className={css.rack} data-testid="laws">
          {LAWS.map((l) => {
            const on = active.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                className={`${css.scroll} ${on ? css.scrollOn : ''}`}
                aria-pressed={on}
                onClick={() => setOpen(l.id)}
              >
                <span className={css.scrollBody} aria-hidden="true" />
                <span className={css.scrollTag}>{t(`law.${l.id}` as LocaleKey)}</span>
                {on && <span className={css.miniSeal}>{t('law.inForce')}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
