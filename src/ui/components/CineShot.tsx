import type { CSSProperties } from 'react';
import type { Citizen, GameState, PortraitGenes } from '../../core/index.ts';
import { ageOf, fullName } from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { Shot } from '../../game/cinematic.ts';
import { Portrait } from './Portrait.tsx';
import css from './cinema.module.css';

/** The herald and the guards are not citizens of the district: fixed, original looks. */
const HERALD_GENES: PortraitGenes = {
  skin: 0,
  hair: 0,
  face: 1,
  eyes: 3,
  nose: 1,
  brow: 0,
  hairStyle: 0,
};
const GUARD_GENES: PortraitGenes = {
  skin: 2,
  hair: 0,
  face: 2,
  eyes: 1,
  nose: 2,
  brow: 2,
  hairStyle: 1,
};

/** Deterministic pseudo-random sequence for decorative particles (no Math.random in renders). */
function scatter(n: number, seed: number): number[] {
  const out: number[] = [];
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push(x / 233280);
  }
  return out;
}

function Face({
  c,
  day,
  mood,
  outfit,
}: {
  c: Citizen;
  day: number;
  mood: number;
  outfit?: 'tribute';
}) {
  return (
    <Portrait
      genes={c.genes}
      sex={c.sex}
      age={ageOf(c, day)}
      mood={mood}
      outfit={outfit}
      dead={!c.alive}
      bare
      size={400}
    />
  );
}

function Herald({ mood }: { mood: number }) {
  return (
    <Portrait genes={HERALD_GENES} sex="F" age={34} mood={mood} outfit="herald" bare size={400} />
  );
}

function Guard() {
  return (
    <Portrait genes={GUARD_GENES} sex="M" age={30} mood={40} outfit="warden" bare size={400} />
  );
}

/** Depth of field: the live district behind, out of focus, with soft bokeh. */
function Dof({ tone }: { tone: 'warm' | 'cold' | 'neutral' }) {
  const r = scatter(24, tone.length * 31 + 7);
  return (
    <>
      <div className={`${css.dof} ${css[tone]}`} />
      <div className={css.bokeh} aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${r[i * 3]! * 100}%`,
              top: `${10 + r[i * 3 + 1]! * 70}%`,
              width: `${6 + r[i * 3 + 2]! * 10}vmin`,
              height: `${6 + r[i * 3 + 2]! * 10}vmin`,
              animationDelay: `${-r[i * 3]! * 6}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

function LowerThird({ name, role }: { name: string; role?: string }) {
  return (
    <div className={css.lowerThird}>
      <strong>{name}</strong>
      {role && <span>{role}</span>}
    </div>
  );
}

function Confetti() {
  const r = scatter(60, 11);
  const colors = ['#FF4FA3', '#F5C84C', '#3FD4D9', '#B46CFF', '#FFFFFF'];
  return (
    <div className={css.confetti} aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${r[i * 3]! * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${-r[i * 3 + 1]! * 4}s`,
            animationDuration: `${3 + r[i * 3 + 2]! * 3}s`,
          }}
        />
      ))}
    </div>
  );
}

/** The glass urn and the gloved hand: a slip comes out and unfolds with the name. */
function Urn({ name }: { name: string }) {
  const r = scatter(90, 5);
  return (
    <div className={css.urnShot}>
      <svg className={css.urn} viewBox="0 0 400 300" aria-hidden="true">
        <defs>
          <linearGradient id="urnGlass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#CFE8F2" stopOpacity="0.55" />
            <stop offset="0.25" stopColor="#FFFFFF" stopOpacity="0.15" />
            <stop offset="0.7" stopColor="#9CC4D6" stopOpacity="0.2" />
            <stop offset="1" stopColor="#E6F4FA" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <ellipse cx="200" cy="286" rx="120" ry="12" fill="#000" opacity="0.35" />
        <path d="M70 90 Q60 250 200 280 Q340 250 330 90Z" fill="#F4EEDD" opacity="0.92" />
        {Array.from({ length: 30 }, (_, i) => (
          <rect
            key={i}
            x={95 + r[i * 3]! * 200}
            y={110 + r[i * 3 + 1]! * 140}
            width="26"
            height="12"
            rx="1.5"
            fill={i % 4 === 0 ? '#E7DEC6' : '#FFFDF6'}
            stroke="#C8BC9C"
            strokeWidth="0.8"
            transform={`rotate(${(r[i * 3 + 2]! - 0.5) * 80} ${108 + r[i * 3]! * 200} ${116 + r[i * 3 + 1]! * 140})`}
          />
        ))}
        <path d="M70 90 Q60 250 200 280 Q340 250 330 90Z" fill="url(#urnGlass)" />
        <ellipse
          cx="200"
          cy="90"
          rx="130"
          ry="22"
          fill="none"
          stroke="#E6F4FA"
          strokeWidth="5"
          opacity="0.8"
        />
        <path
          d="M95 120 Q88 210 140 255"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.6"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <svg className={css.hand} viewBox="0 0 200 260" aria-hidden="true">
        <path d="M150 0 L196 0 L170 120 L120 120Z" fill="#D6338A" />
        <path d="M118 112 L172 112 L176 128 L114 128Z" fill="#F5C84C" />
        <path
          d="M120 126 Q96 150 98 190 Q100 214 120 222 Q150 226 166 200 Q178 170 172 128Z"
          fill="#FBF8F2"
          stroke="#D9D2C2"
          strokeWidth="2"
        />
        <rect
          x="104"
          y="214"
          width="46"
          height="22"
          rx="2"
          fill="#FFFDF6"
          stroke="#C8BC9C"
          transform="rotate(-8 127 225)"
        />
      </svg>
      <div className={css.slip}>
        <span>{name}</span>
      </div>
    </div>
  );
}

/** A room of the town hall: dark panelling, one tall window, a bench. */
function Room() {
  return (
    <svg
      className={css.backdrop}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="roomWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A2A22" />
          <stop offset="1" stopColor="#1C1411" />
        </linearGradient>
        <linearGradient id="roomBeam" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE7B0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFE7B0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="roomWindow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8F0D8" />
          <stop offset="1" stopColor="#C9D8E0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#roomWall)" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect
          key={i}
          x={i * 100 + 6}
          y="430"
          width="88"
          height="330"
          rx="6"
          fill="#2E211B"
          stroke="#4A372C"
          strokeWidth="3"
        />
      ))}
      <rect x="0" y="410" width="1600" height="20" fill="#5A4234" />
      <rect x="0" y="760" width="1600" height="140" fill="#140E0C" />
      <rect x="660" y="70" width="280" height="400" rx="140" fill="url(#roomWindow)" />
      <path d="M800 70 L800 470 M660 270 L940 270" stroke="#3A2A22" strokeWidth="12" />
      <path d="M600 40 Q650 280 620 520 L560 520 Q570 280 540 40Z" fill="#6E1E2A" />
      <path d="M1000 40 Q950 280 980 520 L1040 520 Q1030 280 1060 40Z" fill="#6E1E2A" />
      <polygon
        points="680,120 920,120 1280,900 420,900"
        fill="url(#roomBeam)"
        className={css.beam}
      />
      <rect x="980" y="640" width="520" height="40" rx="8" fill="#4A3226" />
      <rect x="1000" y="680" width="20" height="90" fill="#33231B" />
      <rect x="1460" y="680" width="20" height="90" fill="#33231B" />
    </svg>
  );
}

/**
 * The Capitol train: velvet, brass and polished wood. The window is a hole: through it the real
 * district (the live map) pulls away while posts flash past.
 */
function Train() {
  const r = scatter(12, 3);
  return (
    <>
      <div className={css.trainWindowFx} aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${-r[i]! * 1.6}s` }} />
        ))}
      </div>
      <svg
        className={`${css.backdrop} ${css.sway}`}
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="trainWood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5A2E1E" />
            <stop offset="1" stopColor="#2A140D" />
          </linearGradient>
          <linearGradient id="trainSeat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8E1F3A" />
            <stop offset="1" stopColor="#4A0E1E" />
          </linearGradient>
          <linearGradient id="trainGlass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
            <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path
          fillRule="evenodd"
          d="M0 0H1600V900H0Z M420 150 H1180 Q1230 150 1230 200 V520 Q1230 570 1180 570 H420 Q370 570 370 520 V200 Q370 150 420 150Z"
          fill="url(#trainWood)"
        />
        <path
          fillRule="evenodd"
          d="M400 130 H1200 Q1250 130 1250 180 V540 Q1250 590 1200 590 H400 Q350 590 350 540 V180 Q350 130 400 130Z M420 150 H1180 Q1230 150 1230 200 V520 Q1230 570 1180 570 H420 Q370 570 370 520 V200 Q370 150 420 150Z"
          fill="#C9A44C"
        />
        <rect x="370" y="150" width="860" height="420" rx="50" fill="url(#trainGlass)" />
        <rect x="300" y="600" width="1000" height="26" rx="6" fill="#C9A44C" />
        <rect x="0" y="640" width="1600" height="260" fill="#1A0D09" />
        <rect x="560" y="610" width="480" height="30" rx="10" fill="#3A1D12" />
        <circle cx="700" cy="598" r="22" fill="#D6A04A" />
        <circle cx="742" cy="600" r="18" fill="#B8322E" />
        <circle cx="780" cy="602" r="16" fill="#7FB04A" />
        <path d="M60 900 V420 Q60 330 180 330 H300 V900Z" fill="url(#trainSeat)" />
        <path d="M1540 900 V420 Q1540 330 1420 330 H1300 V900Z" fill="url(#trainSeat)" />
        {[120, 220, 1380, 1480].map((x) => (
          <circle key={x} cx={x} cy="430" r="7" fill="#C9A44C" />
        ))}
        <g>
          <rect x="770" y="40" width="60" height="70" rx="12" fill="#C9A44C" />
          <ellipse cx="800" cy="112" rx="70" ry="16" fill="#FFE7B0" opacity="0.5" />
        </g>
      </svg>
    </>
  );
}

interface Props {
  shot: Shot;
  state: Readonly<GameState>;
  ms: number;
}

/** One composed close shot of a cinematic, keyed by step so its animations restart. */
export function CineShot({ shot, state, ms }: Props) {
  const day = Math.floor(state.clock.tick / 24);
  const cit = (id: string) => state.population.citizens[id];
  const style = { '--shot-ms': `${ms}ms` } as CSSProperties;
  switch (shot.type) {
    case 'herald':
      return (
        <div className={`${css.shot} ${css.pushIn}`} style={style} data-shot="herald">
          <Dof tone="warm" />
          <Confetti />
          <div className={`${css.subject} ${css.right}`}>
            <Herald mood={shot.mood ?? 80} />
          </div>
          <LowerThird name={t('cri.herald')} role={t('cri.herald.role')} />
        </div>
      );
    case 'guard':
      return (
        <div className={`${css.shot} ${css.pushIn}`} style={style} data-shot="guard">
          <Dof tone="cold" />
          <div className={`${css.subject} ${css.far} ${css.farLeft}`}>
            <Guard />
          </div>
          <div className={`${css.subject} ${css.far} ${css.farRight}`}>
            <Guard />
          </div>
          <div className={`${css.subject} ${css.left}`}>
            <Guard />
          </div>
          <LowerThird name={t('cri.guard.role')} />
        </div>
      );
    case 'faces':
      return (
        <div className={css.shot} style={style} data-shot="faces">
          <Dof tone="neutral" />
          <div className={css.strip}>
            {shot.citizenIds.map((id, i) => {
              const c = cit(id);
              return c ? (
                <div key={id} className={css.crop} style={{ animationDelay: `${i * 0.45}s` }}>
                  <Face c={c} day={day} mood={18} />
                </div>
              ) : null;
            })}
          </div>
        </div>
      );
    case 'face': {
      const c = cit(shot.citizenId);
      if (!c) return null;
      return (
        <div className={`${css.shot} ${css.pushIn}`} style={style} data-shot="face">
          <Dof tone="neutral" />
          <div className={css.heartbeat} />
          <div className={`${css.subject} ${css.center} ${css.tight}`}>
            <Face c={c} day={day} mood={shot.mood ?? 30} />
          </div>
          {shot.caption && <LowerThird name={fullName(c)} role={shot.caption} />}
        </div>
      );
    }
    case 'urn': {
      const c = cit(shot.citizenId);
      return (
        <div className={css.shot} style={style} data-shot="urn">
          <Dof tone="warm" />
          <Urn name={c ? fullName(c) : ''} />
        </div>
      );
    }
    case 'pair':
      return (
        <div className={`${css.shot} ${css.pushIn}`} style={style} data-shot="pair">
          <Dof tone="warm" />
          <div className={css.spot} />
          <div className={`${css.subject} ${css.behind}`}>
            <Herald mood={90} />
          </div>
          <div className={css.pair}>
            {shot.citizenIds.map((id) => {
              const c = cit(id);
              return c ? (
                <div key={id} className={css.pairOne}>
                  <Face c={c} day={day} mood={14} outfit="tribute" />
                </div>
              ) : null;
            })}
          </div>
        </div>
      );
    case 'farewell': {
      const c = cit(shot.citizenId);
      const v = shot.visitorId ? cit(shot.visitorId) : null;
      if (!c) return null;
      return (
        <div
          className={`${css.shot} ${css.opaque} ${css.pushIn}`}
          style={style}
          data-shot="farewell"
        >
          <Room />
          {v && (
            <div className={`${css.subject} ${css.left} ${css.lean}`}>
              <Face c={v} day={day} mood={8} />
            </div>
          )}
          <div className={`${css.subject} ${v ? css.right : css.center}`}>
            <Face c={c} day={day} mood={v ? 12 : 20} outfit="tribute" />
          </div>
          <div className={css.dust} />
        </div>
      );
    }
    case 'coffin': {
      const c = cit(shot.citizenId);
      const m = shot.mournerId ? cit(shot.mournerId) : null;
      if (!c) return null;
      return (
        <div className={`${css.shot} ${css.pushIn}`} style={style} data-shot="coffin">
          <Dof tone="cold" />
          <svg className={css.coffin} viewBox="0 0 600 300" aria-hidden="true">
            <defs>
              <linearGradient id="pineTop" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#D9AE78" />
                <stop offset="1" stopColor="#A87C4C" />
              </linearGradient>
              <linearGradient id="pineSide" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9A6E40" />
                <stop offset="1" stopColor="#5E3F22" />
              </linearGradient>
            </defs>
            <ellipse cx="300" cy="282" rx="280" ry="16" fill="#000" opacity="0.4" />
            <path d="M40 150 L120 90 L560 90 L560 140 L480 200 L40 200Z" fill="url(#pineSide)" />
            <path d="M40 150 L120 90 L560 90 L480 150Z" fill="url(#pineTop)" />
            <path d="M40 150 L480 150 L480 270 L40 270Z" fill="url(#pineSide)" />
            <path d="M480 150 L560 90 L560 210 L480 270Z" fill="#4E331C" />
            <path
              d="M330 90 L370 90 L290 150 L250 150Z M250 150 L290 150 L290 270 L250 270Z"
              fill="#1E1C20"
            />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                d={`M${60 + i * 70} ${170 + (i % 2) * 30} l60 0`}
                stroke="#6E4A28"
                strokeWidth="2"
                opacity="0.6"
              />
            ))}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <circle
                key={i}
                cx={150 + (i % 4) * 22 + (i > 3 ? 11 : 0)}
                cy={120 - (i > 3 ? 10 : 0)}
                r="11"
                fill={['#F4F1EA', '#F2C94C', '#E9877A', '#F4F1EA'][i % 4]}
              />
            ))}
            <path d="M140 132 q40 -24 90 0" stroke="#4F8A3A" strokeWidth="6" fill="none" />
          </svg>
          <div className={css.coffinPortrait}>
            <Face c={c} day={day} mood={45} />
          </div>
          {m && (
            <div className={`${css.subject} ${css.left} ${css.mourner}`}>
              <Face c={m} day={day} mood={3} />
            </div>
          )}
          <div className={css.dust} />
        </div>
      );
    }
    case 'train':
      return (
        <div className={css.shot} style={style} data-shot="train">
          <Train />
          <div className={css.trainSeats}>
            {shot.citizenIds.map((id, i) => {
              const c = cit(id);
              return c ? (
                <div key={id} className={i === 0 ? css.seatLeft : css.seatRight}>
                  <Face c={c} day={day} mood={22} outfit="tribute" />
                </div>
              ) : null;
            })}
          </div>
        </div>
      );
  }
}
