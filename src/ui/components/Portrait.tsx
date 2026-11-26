import { useId } from 'react';
import type { PortraitGenes, Sex } from '../../core/index.ts';

const SKIN = ['#EBCDB2', '#DDB293', '#C89E7D', '#A07759', '#73513A'];
const SKIN_SHADE = ['#CFAA8C', '#BE8F6E', '#A97D5E', '#80593F', '#55392A'];
const SKIN_LIGHT = ['#F7E2CE', '#EDCAAE', '#DDB494', '#B78E6F', '#8B674C'];
const HAIR = ['#1E1814', '#3A2A20', '#5A3E2A', '#7A3E22', '#A48A5C', '#2A2624'];
const EYES = ['#5A3E28', '#2A2220', '#5E7A4E', '#4E6A86'];
const CLOTHES = ['#3E4552', '#5A4A3A', '#4A4540', '#2E3446', '#5C5048', '#3A3E45'];

export type Outfit = 'miner' | 'farmer' | 'fisher' | 'tribute' | 'plain' | 'herald' | 'warden';

interface Props {
  genes: PortraitGenes;
  sex: Sex;
  age: number;
  mood?: number;
  miner?: boolean;
  outfit?: Outfit;
  dead?: boolean;
  size?: number;
  /** No backdrop and no frame: for compositing into cinematic shots. */
  bare?: boolean;
}

/** Stable pseudo-random number from the genes (freckles, scars): portraits never flicker. */
function geneHash(g: PortraitGenes, salt: number): number {
  const n =
    (g.skin * 73 +
      g.hair * 151 +
      g.face * 37 +
      g.eyes * 19 +
      g.nose * 11 +
      g.brow * 7 +
      g.hairStyle * 5 +
      salt * 97) %
    997;
  return n / 997;
}

/**
 * Procedural painted bust (ART_BIBLE §6.1): every feature comes from heritable genes, so siblings
 * look alike. Soft shading, catch-lights, six haircuts, freckles and scars; age greys and lines the
 * face; the outfit tells the trade; mood shapes brows and mouth.
 */
export function Portrait({
  genes,
  sex,
  age,
  mood = 50,
  miner = false,
  outfit,
  dead = false,
  size = 96,
  bare = false,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const wear: Outfit = outfit ?? (miner ? 'miner' : 'plain');
  const child = age < 13;
  const grey = age > 55;
  const s = child ? 0.86 : 1;
  const skin = SKIN[genes.skin % SKIN.length]!;
  const shade = SKIN_SHADE[genes.skin % SKIN_SHADE.length]!;
  const light = SKIN_LIGHT[genes.skin % SKIN_LIGHT.length]!;
  const hair = grey ? (age > 70 ? '#CFCAC2' : '#8E8A84') : HAIR[genes.hair % HAIR.length]!;
  const eye = EYES[genes.eyes % EYES.length]!;
  const herald = wear === 'herald';
  const warden = wear === 'warden';
  const cloth = herald
    ? '#F3E6C8'
    : warden
      ? '#3A4352'
      : CLOTHES[(genes.hair + genes.face) % CLOTHES.length]!;
  const faceRx = (25 + genes.face * 1.5) * s;
  const faceRy = (31 + (genes.face % 2) * 3) * s;
  const cy = child ? 56 : 52;
  const eyeY = cy - 4 * s;
  const eyeR = (child ? 3.7 : 3.1) + genes.eyes * 0.12;
  const smile = Math.max(-1, Math.min(1, (mood - 50) / 30));
  const worry = mood < 30 ? 1 : 0;
  const style = genes.hairStyle % 6;
  const ownHair = !herald && !warden;
  const long = ownHair && sex === 'F' && (style === 0 || style === 1 || style === 3);
  const bun = ownHair && sex === 'F' && style === 2;
  const pony = ownHair && sex === 'F' && (style === 4 || style === 5);
  const bald = sex === 'M' && age > 50 && genes.hairStyle === 5;
  const curly = ownHair && sex === 'M' && style === 3;
  const beard = ownHair && sex === 'M' && age >= 18 && (genes.brow === 2 || genes.hairStyle === 4);
  const freckles = geneHash(genes, 1) > 0.62 && age < 50;
  const scar = geneHash(genes, 2) > 0.86 && age >= 14;
  const g = (name: string) => `${name}${uid}`;

  // Hair cap over the skull: volume above the head and a hairline that tells the cut.
  const top = cy - faceRy;
  const L = 50 - faceRx;
  const R = 50 + faceRx;
  const cut: 'fringe' | 'side' | 'crop' | 'swept' =
    sex === 'F'
      ? long
        ? style === 1
          ? 'side'
          : 'fringe'
        : 'swept'
      : style === 0 || style === 5
        ? 'crop'
        : style === 1
          ? 'side'
          : style === 2
            ? 'fringe'
            : 'swept';
  const lift = cut === 'crop' ? 4 : 9;
  const outer = `M${L - 1} ${cy - 1} Q${L - 4} ${top - lift} 50 ${top - lift - 1} Q${R + 4} ${top - lift} ${R + 1} ${cy - 1}`;
  const hl = cy - faceRy * (cut === 'fringe' ? 0.42 : cut === 'crop' ? 0.62 : 0.55);
  const inner =
    cut === 'fringe'
      ? `L${R - 3} ${cy - 3} Q${R - 3} ${hl} ${50 + faceRx * 0.45} ${hl + 2} Q${50 + 4} ${hl - 3} 50 ${hl + 1} Q${50 - 6} ${hl - 3} ${50 - faceRx * 0.5} ${hl + 2} Q${L + 3} ${hl} ${L + 3} ${cy - 3}Z`
      : cut === 'side'
        ? `L${R - 3} ${cy - 4} Q${R - 4} ${hl} ${50 + 7} ${hl - 7} Q${50 - 6} ${hl + 2} ${L + 6} ${hl + 6} Q${L + 3} ${hl + 10} ${L + 3} ${cy - 3}Z`
        : cut === 'crop'
          ? `L${R - 3} ${cy - 5} Q${R - 2} ${hl} 50 ${hl - 1} Q${L + 2} ${hl} ${L + 3} ${cy - 5}Z`
          : `L${R - 3} ${cy - 6} Q${R - 5} ${top + 7} 50 ${top + 5} Q${L + 5} ${top + 7} ${L + 3} ${cy - 6}Z`;
  const hairTop = outer + inner;
  const hairEdge = '#00000055';

  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 120"
      role="img"
      aria-hidden="true"
      style={{
        filter: dead ? 'grayscale(1) brightness(0.75) contrast(0.9)' : undefined,
        borderRadius: 4,
      }}
    >
      <defs>
        <radialGradient id={g('bg')} cx="0.5" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#4A4652" />
          <stop offset="1" stopColor="#15151A" />
        </radialGradient>
        <radialGradient id={g('face')} cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={skin} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
        <linearGradient id={g('hair')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hair} />
          <stop offset="0.35" stopColor={grey ? '#E8E4DC' : `${hair}`} stopOpacity="1" />
          <stop offset="0.5" stopColor={hair} />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={g('wig')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF6FB5" />
          <stop offset="0.55" stopColor="#D6338A" />
          <stop offset="1" stopColor="#6B2BB0" />
        </linearGradient>
        <linearGradient id={g('visor')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56718C" />
          <stop offset="0.5" stopColor="#1B2632" />
          <stop offset="1" stopColor="#0B1016" />
        </linearGradient>
        <linearGradient id={g('cloth')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cloth} />
          <stop offset="1" stopColor="#101014" />
        </linearGradient>
      </defs>
      {!bare && <rect width="100" height="120" fill={`url(#${g('bg')})`} />}
      {/* The herald's sculpted wig towers behind the head. */}
      {herald && (
        <g>
          <ellipse
            cx="50"
            cy={cy - faceRy - 6}
            rx={faceRx + 13}
            ry="30"
            fill={`url(#${g('wig')})`}
          />
          {[-1, 1].map((side) => (
            <circle
              key={side}
              cx={50 + side * (faceRx + 6)}
              cy={cy - 6}
              r="11"
              fill={`url(#${g('wig')})`}
            />
          ))}
          <path
            d={`M${50 - faceRx} ${cy - faceRy - 20} q${faceRx} -22 ${faceRx * 2} 0`}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.35"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[-16, -4, 9, 20].map((dx, i) => (
            <circle
              key={i}
              cx={50 + dx}
              cy={cy - faceRy - 24 + (i % 2) * 6}
              r="2.2"
              fill="#F5C84C"
            />
          ))}
        </g>
      )}
      {/* Long hair falls behind the shoulders. */}
      {long && !bald && (
        <path
          d={`M${50 - faceRx - 5} ${cy - 2} Q50 ${cy - faceRy - 18} ${50 + faceRx + 5} ${cy - 2} L${50 + faceRx + 7} ${cy + 40} Q50 ${cy + 46} ${50 - faceRx - 7} ${cy + 40}Z`}
          fill={`url(#${g('hair')})`}
        />
      )}
      {pony && !bald && (
        <path
          d={`M${50 + faceRx - 2} ${cy - 8} q14 6 10 34 q-4 -14 -12 -22z`}
          fill={`url(#${g('hair')})`}
        />
      )}
      {/* Shoulders: the outfit tells the trade. */}
      <path
        d={`M8 120 Q12 ${cy + 40} 50 ${cy + 35} Q88 ${cy + 40} 92 120Z`}
        fill={`url(#${g('cloth')})`}
      />
      {wear === 'miner' && (
        <path
          d={`M30 ${cy + 40} L50 ${cy + 58} L70 ${cy + 40} L64 ${cy + 38} L50 ${cy + 50} L36 ${cy + 38}Z`}
          fill="#2A2A2E"
        />
      )}
      {wear === 'farmer' && (
        <path
          d={`M34 ${cy + 37} Q50 ${cy + 50} 66 ${cy + 37} L62 ${cy + 44} Q50 ${cy + 54} 38 ${cy + 44}Z`}
          fill="#9C3A2A"
        />
      )}
      {wear === 'fisher' && (
        <g stroke="#C8B48A" strokeWidth="3" fill="none" opacity="0.8">
          <path d={`M20 ${cy + 52} Q50 ${cy + 44} 80 ${cy + 52}`} />
          <path d={`M16 ${cy + 62} Q50 ${cy + 54} 84 ${cy + 62}`} />
        </g>
      )}
      {herald && (
        <g>
          <path
            d={`M22 ${cy + 44} Q30 ${cy + 16} ${50 - 9} ${cy + faceRy - 4} L${50 + 9} ${cy + faceRy - 4} Q70 ${cy + 16} 78 ${cy + 44} Q50 ${cy + 30} 22 ${cy + 44}Z`}
            fill="#FBF3DE"
            stroke="#D9A93C"
            strokeWidth="1.6"
          />
          {[-6, 0, 6].map((dx) => (
            <circle
              key={dx}
              cx={50 + dx}
              cy={cy + faceRy + 5 + Math.abs(dx) * -0.2}
              r="2.4"
              fill="#F5C84C"
            />
          ))}
        </g>
      )}
      {warden && (
        <g>
          <rect x="28" y={cy + 40} width="44" height="5" rx="2" fill="#C9A44C" opacity="0.85" />
          <path d={`M10 ${cy + 52} Q24 ${cy + 38} 36 ${cy + 40} L34 ${cy + 50}Z`} fill="#4A5466" />
          <path d={`M90 ${cy + 52} Q76 ${cy + 38} 64 ${cy + 40} L66 ${cy + 50}Z`} fill="#4A5466" />
        </g>
      )}
      {wear === 'tribute' && (
        <rect x="44" y={cy + 38} width="12" height="30" fill="#2A3324" opacity="0.8" />
      )}
      <path
        d={`M38 ${cy + 36} L50 ${cy + 46} L62 ${cy + 36}`}
        fill="none"
        stroke="#00000055"
        strokeWidth="2"
      />
      {/* Neck with shadow under the jaw. */}
      <rect x={50 - 8.5 * s} y={cy + faceRy - 10} width={17 * s} height="16" fill={shade} />
      <ellipse cx="50" cy={cy + faceRy - 6} rx={10 * s} ry="4" fill="#00000030" />
      {/* Ears, face with soft light from the upper left, cheeks. */}
      <ellipse cx={50 - faceRx + 1} cy={cy + 2} rx="4.6" ry="7" fill={shade} />
      <ellipse cx={50 + faceRx - 1} cy={cy + 2} rx="4.6" ry="7" fill={shade} />
      <ellipse
        cx="50"
        cy={cy}
        rx={faceRx}
        ry={faceRy}
        fill={`url(#${g('face')})`}
        stroke={SKIN_SHADE[Math.min(4, genes.skin + 1)]}
        strokeOpacity="0.7"
        strokeWidth="0.9"
      />
      {/* Cool rim light on the shadow side and a soft jaw shadow: a rounder, modelled head. */}
      <path
        d={`M${50 + faceRx * 0.72} ${cy - faceRy * 0.62} Q${50 + faceRx + 0.6} ${cy} ${50 + faceRx * 0.6} ${cy + faceRy * 0.72}`}
        fill="none"
        stroke="#CFE6FF"
        strokeOpacity="0.16"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d={`M${50 - faceRx * 0.62} ${cy + faceRy * 0.55} Q50 ${cy + faceRy + 1} ${50 + faceRx * 0.62} ${cy + faceRy * 0.55}`}
        fill="none"
        stroke={shade}
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse
        cx={50 - 13 * s}
        cy={cy + 9}
        rx="5"
        ry="3"
        fill="#D46A5A"
        opacity={child ? 0.28 : 0.16}
      />
      <ellipse
        cx={50 + 13 * s}
        cy={cy + 9}
        rx="5"
        ry="3"
        fill="#D46A5A"
        opacity={child ? 0.28 : 0.16}
      />
      {herald &&
        [-1, 1].map((side) => (
          <ellipse
            key={side}
            cx={50 + side * 10 * s}
            cy={eyeY - 3.2}
            rx={eyeR + 3.2}
            ry="3.4"
            fill="#22C3C9"
            opacity="0.75"
          />
        ))}
      {/* Eyes: white, iris, pupil, catch-light, upper lid. */}
      {[-1, 1].map((side) => {
        const ex = 50 + side * 10 * s;
        return (
          <g key={side}>
            <ellipse cx={ex} cy={eyeY} rx={eyeR + 1.6} ry={eyeR} fill="#F2ECE2" />
            <circle cx={ex} cy={eyeY + 0.3} r={eyeR * 0.72} fill={eye} />
            <circle cx={ex} cy={eyeY + 0.3} r={eyeR * 0.34} fill="#0C0A0A" />
            <circle
              cx={ex - eyeR * 0.3}
              cy={eyeY - eyeR * 0.3}
              r={eyeR * 0.22}
              fill="#FFFFFF"
              opacity="0.9"
            />
            <path
              d={`M${ex - eyeR - 1.8} ${eyeY - 0.4} Q${ex} ${eyeY - eyeR - 1.6} ${ex + eyeR + 1.8} ${eyeY - 0.4}`}
              fill="none"
              stroke="#2A1E1A"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path
              d={`M${ex - 5.5} ${eyeY - 7 - genes.brow * 0.4 + (side === 1 ? worry : -worry) * -1.2} Q${ex} ${eyeY - 9.5 - genes.brow * 0.5 - worry * 1.5} ${ex + 5.5} ${eyeY - 7 - genes.brow * 0.4 + (side === -1 ? worry : -worry) * -1.2}`}
              fill="none"
              stroke={grey ? '#8E8A84' : HAIR[genes.hair % HAIR.length]}
              strokeWidth={1.8 + genes.brow * 0.7}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {/* Nose: a shaded side and a soft tip. */}
      <path
        d={
          [
            `M50 ${eyeY + 2} L47 ${cy + 11} Q50 ${cy + 13} 53 ${cy + 11}`,
            `M51 ${eyeY + 1} Q46 ${cy + 9} 48 ${cy + 12} Q51 ${cy + 13} 53 ${cy + 11}`,
            `M50 ${eyeY + 3} L46 ${cy + 13} Q50 ${cy + 14.5} 54 ${cy + 13}`,
            `M49 ${eyeY + 2} Q47 ${cy + 8} 49 ${cy + 11} Q52 ${cy + 12} 53 ${cy + 11}`,
          ][genes.nose % 4]
        }
        fill="none"
        stroke={SKIN_SHADE[Math.min(4, genes.skin + 1)]}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <ellipse cx="51" cy={cy + 10} rx="2.2" ry="1.2" fill={light} opacity="0.6" />
      {freckles && (
        <g fill={shade} opacity="0.75">
          {[-15, -12, -9, 9, 12, 15, -11, 11].map((dx, i) => (
            <circle key={i} cx={50 + dx * s} cy={cy + 4 + (i % 3)} r="0.8" />
          ))}
        </g>
      )}
      {/* Lips follow the mood. */}
      <path
        d={`M${44} ${cy + 19} Q50 ${cy + 19 + smile * 4.5} ${56} ${cy + 19}`}
        fill="none"
        stroke="#8A4A40"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d={`M46 ${cy + 21 + Math.max(0, smile) * 2} Q50 ${cy + 23 + smile * 2} 54 ${cy + 21 + Math.max(0, smile) * 2}`}
        fill="none"
        stroke="#B06A5A"
        strokeWidth="1.2"
        opacity="0.6"
      />
      {herald && (
        <g>
          <path
            d={`M43 ${cy + 19} Q46.5 ${cy + 16.5} 50 ${cy + 18} Q53.5 ${cy + 16.5} 57 ${cy + 19} Q50 ${cy + 25 + smile * 2} 43 ${cy + 19}Z`}
            fill="#D81B60"
          />
          <circle cx={50 + 13} cy={cy + 6} r="0.9" fill="#3A1A20" />
          {[-1, 1].map((side) => (
            <g key={side}>
              <circle cx={50 + side * (faceRx + 0.5)} cy={cy + 10} r="1.8" fill="#F5C84C" />
              <path
                d={`M${50 + side * (faceRx + 0.5)} ${cy + 12} l0 5`}
                stroke="#F5C84C"
                strokeWidth="1.2"
              />
              <circle cx={50 + side * (faceRx + 0.5)} cy={cy + 18.5} r="2.2" fill="#3FD4D9" />
            </g>
          ))}
        </g>
      )}
      {scar && (
        <path
          d={`M${50 + 14 * s} ${cy - 8} l3 9`}
          stroke="#A0605A"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.85"
        />
      )}
      {age > 45 && (
        <g stroke={shade} strokeWidth="1.1" fill="none" opacity="0.9">
          <path d={`M${50 - 18 * s} ${eyeY + 7} q3 2 6 0`} />
          <path d={`M${50 + 12 * s} ${eyeY + 7} q3 2 6 0`} />
          <path d={`M${43} ${cy + 15} q-2 4 0 7`} />
          <path d={`M${57} ${cy + 15} q2 4 0 7`} />
          {age > 60 && <path d={`M40 ${cy - faceRy + 12} q10 -2 20 0`} />}
        </g>
      )}
      {beard && (
        <path
          d={`M${50 - faceRx + 3} ${cy + 5} Q50 ${cy + faceRy + 11} ${50 + faceRx - 3} ${cy + 5} Q50 ${cy + 24} ${50 - faceRx + 3} ${cy + 5}Z`}
          fill={`url(#${g('hair')})`}
          opacity="0.93"
        />
      )}
      {/* Hair on top: crop, side part, curls, bun. */}
      {ownHair && !bald && !curly && (
        <g>
          <path d={hairTop} fill={`url(#${g('hair')})`} stroke={hairEdge} strokeWidth="0.8" />
          <path
            d={`M${50 - faceRx * 0.55} ${top - lift + 6} Q50 ${top - lift - 1} ${50 + faceRx * 0.35} ${top - lift + 4}`}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.22"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      )}
      {curly && !bald && (
        <g fill={`url(#${g('hair')})`}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.05 + (i / 8) * 0.9);
            return (
              <circle
                key={i}
                cx={50 - Math.cos(a) * faceRx * 0.95}
                cy={cy - 6 - Math.sin(a) * faceRy * 0.85}
                r={7.5 * s}
              />
            );
          })}
        </g>
      )}
      {herald && (
        <path
          d={`M${50 - faceRx - 2} ${cy - 4} Q${50 - faceRx - 4} ${cy - faceRy - 12} 50 ${cy - faceRy - 13} Q${50 + faceRx + 4} ${cy - faceRy - 12} ${50 + faceRx + 2} ${cy - 4} Q${50 + faceRx - 2} ${cy - faceRy + 2} ${50 + 4} ${cy - faceRy + 4} Q${50 - 10} ${cy - faceRy + 9} ${50 - faceRx + 2} ${cy - 2}Z`}
          fill={`url(#${g('wig')})`}
        />
      )}
      {bun && <circle cx="50" cy={cy - faceRy - 6} r={8 * s} fill={`url(#${g('hair')})`} />}
      {/* Headgear of the trade. */}
      {wear === 'miner' && age >= 14 && (
        <g>
          <path
            d={`M${50 - faceRx - 3} ${cy - 10} Q50 ${cy - faceRy - 18} ${50 + faceRx + 3} ${cy - 10}Z`}
            fill="#8A7B4E"
          />
          <rect
            x={50 - faceRx - 5}
            y={cy - 12}
            width={faceRx * 2 + 10}
            height="4"
            rx="2"
            fill="#6E6240"
          />
          <circle
            cx="50"
            cy={cy - faceRy - 4}
            r="4"
            fill="#F2D27A"
            stroke="#4A4030"
            strokeWidth="1.2"
          />
        </g>
      )}
      {wear === 'farmer' && age >= 14 && sex === 'F' && (
        <path
          d={`M${50 - faceRx - 3} ${cy - 4} Q50 ${cy - faceRy - 16} ${50 + faceRx + 3} ${cy - 4} Q50 ${cy - faceRy - 2} ${50 - faceRx - 3} ${cy - 4}Z`}
          fill="#B85A3A"
          opacity="0.92"
        />
      )}
      {wear === 'fisher' && age >= 14 && sex === 'M' && (
        <path
          d={`M${50 - faceRx} ${cy - 12} Q50 ${cy - faceRy - 14} ${50 + faceRx} ${cy - 12} L${50 + faceRx + 2} ${cy - 8} L${50 - faceRx - 2} ${cy - 8}Z`}
          fill="#3E5A6E"
        />
      )}
      {wear === 'miner' && (
        <g fill="#1B1B1E" opacity="0.42">
          <ellipse cx={50 - 14 * s} cy={cy + 10} rx="5" ry="3" />
          <ellipse cx={50 + 9 * s} cy={cy + 14} rx="4" ry="2" />
        </g>
      )}
      {warden && (
        <g>
          <path
            d={`M${50 - faceRx - 5} ${eyeY + 1} Q${50 - faceRx - 6} ${cy - faceRy - 16} 50 ${cy - faceRy - 16} Q${50 + faceRx + 6} ${cy - faceRy - 16} ${50 + faceRx + 5} ${eyeY + 1}Z`}
            fill="#4C5668"
          />
          <path
            d={`M${50 - faceRx + 2} ${cy - faceRy - 6} Q50 ${cy - faceRy - 14} ${50 + faceRx - 6} ${cy - faceRy - 8}`}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.28"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x={50 - faceRx - 3}
            y={eyeY - 8}
            width={(faceRx + 3) * 2}
            height="14"
            rx="6"
            fill={`url(#${g('visor')})`}
          />
          <path
            d={`M${50 - faceRx + 4} ${eyeY - 5} l${faceRx * 0.9} 0`}
            stroke="#BFE3FF"
            strokeOpacity="0.45"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={`M${50 + side * (faceRx + 3)} ${eyeY + 5} Q${50 + side * (faceRx - 2)} ${cy + 18} ${50 + side * 6} ${cy + faceRy - 2}`}
              fill="none"
              stroke="#22262E"
              strokeWidth="1.6"
            />
          ))}
        </g>
      )}
      {/* Vignette frame. */}
      {!bare && (
        <rect
          x="1"
          y="1"
          width="98"
          height="118"
          rx="4"
          fill="none"
          stroke="#C9A44C"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
