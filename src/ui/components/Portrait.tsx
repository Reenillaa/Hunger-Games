import { useId } from 'react';
import type { PortraitGenes, Sex } from '../../core/index.ts';

/**
 * Procedural painted bust, v3 (ART_BIBLE §6.1, DECISIONS I-58): every feature comes from
 * heritable genes, so siblings look alike. A shaped head with jaw and chin, modelled skin (key
 * light from the upper left, cool rim on the right), almond eyes with lids, lashes and a
 * gradient iris, tapered brows, a nose with wings and nostrils, real lips, layered hair with
 * strands and sheen, ears, neck and clothes that tell the trade. Age lines the face and greys
 * the hair; mood moves brows, lids and mouth.
 */

const SKIN = ['#F1D2BC', '#E3B595', '#C99470', '#9C6B4A', '#6E4632'];
const SKIN_SHADE = ['#D6A88E', '#C38E6E', '#A6714F', '#7B5034', '#4F3022'];
const SKIN_LIGHT = ['#FCE9DC', '#F3D0B6', '#E2B591', '#B98A66', '#8E6248'];
const BLUSH = ['#E9877A', '#DC7A66', '#C66A55', '#A0523E', '#7C3F31'];
const LIPS = ['#C9706A', '#BC6556', '#A65848', '#84443A', '#5E3028'];
const HAIR = ['#2B1E17', '#4B3022', '#6E4528', '#9A4E28', '#C9A063', '#17161A'];
const HAIR_HI = ['#5A4233', '#7A5539', '#9C6A40', '#C97A45', '#EBCB8C', '#3E3B44'];
const EYES = ['#7A4A24', '#3E2A1E', '#5E8A4A', '#4A7FB0'];
const CLOTHES = ['#3E4C63', '#5D4A38', '#4C4842', '#2F3B52', '#6A584A', '#3D4A44'];

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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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
  const id = (name: string) => `${name}${uid}`;
  const url = (name: string) => `url(#${id(name)})`;
  const wear: Outfit = outfit ?? (miner ? 'miner' : 'plain');
  const herald = wear === 'herald';
  const warden = wear === 'warden';
  const child = age < 13;
  const grey = age > 55;
  const F = sex === 'F';
  const tone = genes.skin % SKIN.length;
  const skin = SKIN[tone]!;
  const shade = SKIN_SHADE[tone]!;
  const light = SKIN_LIGHT[tone]!;
  const blush = BLUSH[tone]!;
  const lip = herald ? '#D81B60' : LIPS[tone]!;
  const hairBase = grey ? (age > 70 ? '#D8D4CC' : '#9C978F') : HAIR[genes.hair % HAIR.length]!;
  const hairHi = grey ? '#F2EFE8' : HAIR_HI[genes.hair % HAIR_HI.length]!;
  const eye = EYES[genes.eyes % EYES.length]!;
  const cloth = herald
    ? '#F6EAD0'
    : warden
      ? '#39424F'
      : CLOTHES[(genes.hair + genes.face) % CLOTHES.length]!;

  // Head geometry.
  const s = child ? 0.9 : 1;
  const rx = (F ? 22.5 : 24) * s + genes.face * 0.9;
  const ry = (F ? 28.5 : 30) * s + (genes.face % 2) * 1.2;
  const cy = child ? 55 : 52;
  const top = cy - ry;
  const jaw = child ? 0.9 : F ? 0.8 + genes.face * 0.02 : 0.88 + genes.face * 0.025;
  const chin = child ? 0.42 : F ? 0.3 : 0.38 + (genes.face % 2) * 0.04;
  const head = `M50 ${top} C${50 + rx * 0.62} ${top} ${50 + rx} ${cy - ry * 0.55} ${50 + rx} ${cy - ry * 0.1} C${50 + rx} ${cy + ry * 0.3} ${50 + rx * jaw + 1.5} ${cy + ry * 0.6} ${50 + rx * chin} ${cy + ry * 0.87} Q50 ${cy + ry * 1.04} ${50 - rx * chin} ${cy + ry * 0.87} C${50 - rx * jaw - 1.5} ${cy + ry * 0.6} ${50 - rx} ${cy + ry * 0.3} ${50 - rx} ${cy - ry * 0.1} C${50 - rx} ${cy - ry * 0.55} ${50 - rx * 0.62} ${top} 50 ${top}Z`;

  // Expression.
  const smile = clamp((mood - 50) / 30, -1, 1);
  const worry = clamp((32 - mood) / 30, 0, 1);

  // Features.
  const eyeY = cy - ry * 0.08;
  const eyeDX = rx * 0.42;
  const ew = (child ? 5.2 : 4.6) + (genes.eyes % 2) * 0.3;
  const eh = (child ? 3.0 : 2.5) + (F ? 0.2 : 0) - Math.max(0, smile) * 0.4;
  const browY = eyeY - ew * 1.25 - genes.brow * 0.25;
  const noseY = cy + ry * (child ? 0.3 : 0.36);
  const noseW = (child ? 3.2 : 3.8) + (genes.nose % 3) * 0.45 + (F ? -0.3 : 0.3);
  const mouthY = cy + ry * (child ? 0.56 : 0.6);
  const mw = (child ? 5.5 : 6.6) + (F ? 0.2 : 0.5);

  const style = genes.hairStyle % 6;
  const ownHair = !herald && !warden;
  const long = ownHair && F && (style === 0 || style === 1 || style === 3);
  const bun = ownHair && F && style === 2;
  const pony = ownHair && F && (style === 4 || style === 5);
  const bald = ownHair && !F && age > 50 && genes.hairStyle === 5;
  const curly = ownHair && !F && style === 3;
  const beard = ownHair && !F && age >= 19 && (genes.brow === 2 || genes.hairStyle === 4);
  const stubble = ownHair && !F && age >= 19 && !beard && genes.brow === 1;
  const freckles = geneHash(genes, 1) > 0.62 && age < 50;
  const scar = geneHash(genes, 2) > 0.86 && age >= 14;
  const mole = geneHash(genes, 3) > 0.8;

  // Hair cap over the skull: volume above the head and a hairline that tells the cut.
  const cut: 'fringe' | 'side' | 'crop' | 'swept' = F
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
  const lift = cut === 'crop' ? 3.5 : 8;
  const L = 50 - rx;
  const R = 50 + rx;
  const hl = cy - ry * (cut === 'fringe' ? 0.45 : cut === 'crop' ? 0.66 : 0.58);
  const outer = `M${L - 1.2} ${cy - 2} C${L - 3} ${top - lift * 0.4} ${50 - rx * 0.5} ${top - lift} 50 ${top - lift} C${50 + rx * 0.5} ${top - lift} ${R + 3} ${top - lift * 0.4} ${R + 1.2} ${cy - 2}`;
  const inner =
    cut === 'fringe'
      ? `L${R - 2.5} ${cy - 4} C${R - 2} ${hl} ${50 + rx * 0.6} ${hl + 3} ${50 + rx * 0.3} ${hl + 2} C${50 + 6} ${hl - 2} ${50 - 2} ${hl + 3} ${50 - rx * 0.25} ${hl + 1} C${50 - rx * 0.55} ${hl - 1} ${L + 2} ${hl + 2} ${L + 2.5} ${cy - 4}Z`
      : cut === 'side'
        ? `L${R - 2.5} ${cy - 5} C${R - 3} ${hl} ${50 + 9} ${hl - 8} ${50 + 5} ${hl - 8} C${50 - 6} ${hl - 3} ${L + 8} ${hl + 2} ${L + 3} ${hl + 9} L${L + 2.5} ${cy - 4}Z`
        : cut === 'crop'
          ? `L${R - 2.5} ${cy - 6} C${R - 2} ${hl} ${50 + rx * 0.5} ${hl - 1.5} 50 ${hl - 1.5} C${50 - rx * 0.5} ${hl - 1.5} ${L + 2} ${hl} ${L + 2.5} ${cy - 6}Z`
          : `L${R - 2.5} ${cy - 7} C${R - 4} ${top + 8} ${50 + rx * 0.4} ${top + 4} 50 ${top + 4} C${50 - rx * 0.4} ${top + 4} ${L + 4} ${top + 8} ${L + 2.5} ${cy - 7}Z`;
  const hairCap = outer + inner;

  /** An almond eye; `side` 1 = the right eye on screen (outer corner to the right). */
  const eyeShape = (ex: number, side: 1 | -1) => {
    const o = (dx: number) => ex + side * dx;
    return `M${o(-ew)} ${eyeY + 0.2} C${o(-ew * 0.55)} ${eyeY - eh * 1.25} ${o(ew * 0.45)} ${eyeY - eh * 1.3} ${o(ew)} ${eyeY - eh * 0.15} C${o(ew * 0.6)} ${eyeY + eh * 0.95} ${o(-ew * 0.4)} ${eyeY + eh * 1.05} ${o(-ew)} ${eyeY + 0.2}Z`;
  };
  const upperLid = (ex: number, side: 1 | -1) => {
    const o = (dx: number) => ex + side * dx;
    return `M${o(-ew - 0.3)} ${eyeY + 0.1} C${o(-ew * 0.55)} ${eyeY - eh * 1.3} ${o(ew * 0.45)} ${eyeY - eh * 1.35} ${o(ew + (F ? 1.4 : 0.3))} ${eyeY - eh * (F ? 0.55 : 0.2)}`;
  };

  const shoulders = `M4 120 C8 ${cy + 44} 26 ${cy + 36} 41 ${cy + 33} L59 ${cy + 33} C74 ${cy + 36} 92 ${cy + 44} 96 120Z`;
  const neckW = rx * (F ? 0.5 : 0.6);

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
        <radialGradient id={id('bg')} cx="0.45" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#56505E" />
          <stop offset="0.6" stopColor="#2A2830" />
          <stop offset="1" stopColor="#141317" />
        </radialGradient>
        <radialGradient id={id('skin')} cx="0.36" cy="0.32" r="0.8">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={skin} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
        <linearGradient id={id('neck')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade} />
          <stop offset="0.6" stopColor={skin} />
        </linearGradient>
        <linearGradient id={id('hair')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hairHi} />
          <stop offset="0.35" stopColor={hairBase} />
          <stop offset="1" stopColor="#000000" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={id('iris')} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.35" stopColor={eye} />
          <stop offset="1" stopColor="#120C08" />
        </radialGradient>
        <linearGradient id={id('cloth')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={cloth} />
          <stop offset="1" stopColor="#0E0E12" />
        </linearGradient>
        <linearGradient id={id('lip')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lip} />
          <stop offset="1" stopColor={herald ? '#A3104A' : SKIN_SHADE[Math.min(4, tone + 1)]} />
        </linearGradient>
        <linearGradient id={id('wig')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8CC6" />
          <stop offset="0.5" stopColor="#D6338A" />
          <stop offset="1" stopColor="#6B2BB0" />
        </linearGradient>
        <linearGradient id={id('visor')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6A86A2" />
          <stop offset="0.5" stopColor="#1B2632" />
          <stop offset="1" stopColor="#0B1016" />
        </linearGradient>
        <radialGradient id={id('soft')}>
          <stop offset="0" stopColor={shade} stopOpacity="1" />
          <stop offset="1" stopColor={shade} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('glow')}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('blush')}>
          <stop offset="0" stopColor={blush} stopOpacity="1" />
          <stop offset="1" stopColor={blush} stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('head')}>
          <path d={head} />
        </clipPath>
        {[-1, 1].map((side) => (
          <clipPath key={side} id={id(`eye${side}`)}>
            <path d={eyeShape(50 + side * eyeDX, side as 1 | -1)} />
          </clipPath>
        ))}
      </defs>
      {!bare && <rect width="100" height="120" fill={url('bg')} />}

      {/* Behind the head: long hair, ponytail, bun, the herald's wig. */}
      {herald && (
        <g fill={url('wig')}>
          <ellipse cx="50" cy={top - 6} rx={rx + 13} ry="27" />
          <circle cx={50 - rx - 6} cy={cy - 4} r="11" />
          <circle cx={50 + rx + 6} cy={cy - 4} r="11" />
        </g>
      )}
      {long && !bald && (
        <path
          d={`M${L - 4} ${cy - 6} C${L - 8} ${top - 10} ${R + 8} ${top - 10} ${R + 4} ${cy - 6} C${R + 7} ${cy + 18} ${R + 9} ${cy + 34} ${R + 6} ${cy + 44} C${50 + 8} ${cy + 50} ${50 - 8} ${cy + 50} ${L - 6} ${cy + 44} C${L - 9} ${cy + 34} ${L - 7} ${cy + 18} ${L - 4} ${cy - 6}Z`}
          fill={url('hair')}
        />
      )}
      {pony && !bald && (
        <path
          d={`M${R - 3} ${cy - 12} c9 -2 16 8 14 22 c-1 10 -4 18 -9 24 c3 -10 2 -20 -3 -27 c-2 -3 -3 -6 -2 -19z`}
          fill={url('hair')}
        />
      )}
      {bun && <circle cx="50" cy={top - 5} r={8.5 * s} fill={url('hair')} />}

      {/* Shoulders and clothes. */}
      <path d={shoulders} fill={url('cloth')} />
      <path
        d={`M18 ${cy + 52} Q30 ${cy + 44} 40 ${cy + 46}`}
        stroke="#FFFFFF"
        strokeOpacity="0.08"
        strokeWidth="3"
        fill="none"
      />
      {/* Neck with the shadow of the jaw. */}
      <path
        d={`M${50 - neckW} ${cy + ry * 0.62} L${50 - neckW - 1} ${cy + 36} Q50 ${cy + 40} ${50 + neckW + 1} ${cy + 36} L${50 + neckW} ${cy + ry * 0.62}Z`}
        fill={url('neck')}
      />
      {!F && !child && (
        <path
          d={`M${50 - 2} ${cy + ry + 3} q2 2 4 0`}
          stroke={shade}
          strokeWidth="1.2"
          fill="none"
          opacity="0.7"
        />
      )}
      <Collar wear={wear} cy={cy} cloth={cloth} sex={sex} />

      {/* Ears. */}
      {[-1, 1].map((side) => {
        const ex = 50 + side * (rx - 0.6);
        return (
          <g key={side}>
            <path
              d={`M${ex} ${eyeY - 1} c${side * 4.5} -2 ${side * 6} 3 ${side * 5.2} 7 c${side * -0.6} 3.5 ${side * -2.8} 5 ${side * -5} 4.5`}
              fill={side < 0 ? skin : shade}
            />
            <path
              d={`M${ex + side * 1.2} ${eyeY + 1} c${side * 2.6} -0.6 ${side * 3.2} 2.5 ${side * 2.4} 4.8`}
              stroke={SKIN_SHADE[Math.min(4, tone + 1)]}
              strokeWidth="0.9"
              fill="none"
            />
          </g>
        );
      })}

      {/* The face, modelled: base gradient then soft shadows and highlights inside the head. */}
      <path d={head} fill={url('skin')} />
      <g clipPath={`url(#${id('head')})`}>
        <ellipse
          cx={50 + rx * 0.85}
          cy={cy + 4}
          rx={rx * 0.45}
          ry={ry * 0.9}
          fill={shade}
          opacity="0.45"
        />
        <ellipse
          cx={50 + rx * 0.55}
          cy={cy + ry * 0.35}
          rx={rx * 0.3}
          ry={ry * 0.18}
          fill={shade}
          opacity="0.3"
        />
        <ellipse
          cx="50"
          cy={cy + ry * 1.0}
          rx={rx * 0.9}
          ry={ry * 0.22}
          fill={shade}
          opacity="0.35"
        />
        <ellipse
          cx={50 - rx * 0.2}
          cy={top + ry * 0.35}
          rx={rx * 0.5}
          ry={ry * 0.2}
          fill="#FFFFFF"
          opacity="0.12"
        />
        <ellipse
          cx={50 - rx * 0.45}
          cy={cy + ry * 0.28}
          rx={rx * 0.26}
          ry={ry * 0.13}
          fill={blush}
          opacity={child ? 0.32 : 0.18}
        />
        <ellipse
          cx={50 + rx * 0.45}
          cy={cy + ry * 0.28}
          rx={rx * 0.24}
          ry={ry * 0.12}
          fill={blush}
          opacity={child ? 0.28 : 0.14}
        />
        {/* Eye sockets. */}
        {[-1, 1].map((side) => (
          <ellipse
            key={side}
            cx={50 + side * eyeDX}
            cy={eyeY - 1}
            rx={ew + 3}
            ry={eh + 3.5}
            fill={url('soft')}
            opacity={age > 45 ? 0.5 : 0.3}
          />
        ))}
        {stubble && (
          <path
            d={`M${50 - rx * 0.85} ${cy + ry * 0.35} C${50 - rx * 0.7} ${cy + ry * 1.05} ${50 + rx * 0.7} ${cy + ry * 1.05} ${50 + rx * 0.85} ${cy + ry * 0.35} C${50 + rx * 0.4} ${cy + ry * 0.62} ${50 - rx * 0.4} ${cy + ry * 0.62} ${50 - rx * 0.85} ${cy + ry * 0.35}Z`}
            fill={hairBase}
            opacity="0.22"
          />
        )}
        {wear === 'miner' && (
          <g fill="#1B1B1E" opacity="0.18">
            <ellipse cx={50 - rx * 0.5} cy={cy + ry * 0.3} rx="5" ry="2.6" />
            <ellipse cx={50 + rx * 0.35} cy={cy + ry * 0.48} rx="4" ry="2" />
            <ellipse cx={50 + rx * 0.2} cy={top + ry * 0.4} rx="6" ry="1.6" />
          </g>
        )}
      </g>
      {/* Cool rim light on the shadow side. */}
      <path
        d={`M${50 + rx * 0.7} ${cy - ry * 0.62} C${50 + rx + 0.4} ${cy - ry * 0.2} ${50 + rx + 0.4} ${cy + ry * 0.25} ${50 + rx * 0.75} ${cy + ry * 0.62}`}
        stroke="#CFE6FF"
        strokeOpacity="0.22"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      />

      {/* Age. */}
      {age > 40 && (
        <g stroke={SKIN_SHADE[Math.min(4, tone + 1)]} strokeWidth="0.8" fill="none" opacity="0.8">
          <path d={`M${50 - noseW - 1.5} ${noseY + 2} q-2.6 4 -1.6 8`} />
          <path d={`M${50 + noseW + 1.5} ${noseY + 2} q2.6 4 1.6 8`} />
          {age > 50 && (
            <>
              <path d={`M${50 - rx * 0.5} ${top + ry * 0.3} q${rx * 0.5} -2 ${rx} 0`} />
              <path d={`M${50 - rx * 0.4} ${top + ry * 0.4} q${rx * 0.4} -1.5 ${rx * 0.8} 0`} />
              {[-1, 1].map((side) => (
                <path
                  key={side}
                  d={`M${50 + side * (eyeDX + ew + 1)} ${eyeY - 1} l${side * 2.5} -1.2 M${50 + side * (eyeDX + ew + 1)} ${eyeY + 0.5} l${side * 2.6} 0.8`}
                />
              ))}
              {[-1, 1].map((side) => (
                <path
                  key={`b${side}`}
                  d={`M${50 + side * (eyeDX - ew * 0.7)} ${eyeY + eh + 2} q${side * ew * 0.7} 1.6 ${side * ew * 1.4} 0`}
                />
              ))}
            </>
          )}
        </g>
      )}

      {/* Eyes: white, gradient iris, pupil, two catch-lights, lid shadow, lash line, crease. */}
      {[-1, 1].map((side) => {
        const ex = 50 + side * eyeDX;
        const sd = side as 1 | -1;
        const look = smile > 0.4 ? -0.4 : 0;
        return (
          <g key={side}>
            <path d={eyeShape(ex, sd)} fill="#F5F0EA" />
            <g clipPath={`url(#${id(`eye${side}`)})`}>
              <circle cx={ex + look} cy={eyeY + 0.1} r={eh * 1.02} fill={url('iris')} />
              <circle cx={ex + look} cy={eyeY + 0.1} r={eh * 0.45} fill="#0A0706" />
              <circle
                cx={ex + look - eh * 0.38}
                cy={eyeY - eh * 0.4}
                r={eh * 0.24}
                fill="#FFFFFF"
              />
              <circle
                cx={ex + look + eh * 0.35}
                cy={eyeY + eh * 0.35}
                r={eh * 0.12}
                fill="#FFFFFF"
                opacity="0.7"
              />
              <path
                d={`M${ex - ew - 1} ${eyeY - eh * 1.6} L${ex + ew + 1} ${eyeY - eh * 1.6} L${ex + ew + 1} ${eyeY - eh * (0.45 - worry * 0.25)} Q${ex} ${eyeY - eh * (0.95 - worry * 0.3)} ${ex - ew - 1} ${eyeY - eh * (0.45 - worry * 0.25)}Z`}
                fill={shade}
                opacity="0.35"
              />
            </g>
            <path
              d={upperLid(ex, sd)}
              stroke="#24170F"
              strokeWidth={F || herald ? 1.4 : 1.1}
              fill="none"
              strokeLinecap="round"
            />
            {(F || herald) &&
              [0.35, 0.7, 1].map((k) => (
                <path
                  key={k}
                  d={`M${ex + sd * ew * (k - 0.2)} ${eyeY - eh * (1.2 - k * 0.6)} l${sd * 1.1} -1.3`}
                  stroke="#24170F"
                  strokeWidth="0.6"
                  strokeLinecap="round"
                />
              ))}
            <path
              d={`M${ex - sd * ew * 0.6} ${eyeY - eh * 1.75} C${ex - sd * ew * 0.1} ${eyeY - eh * 2.15} ${ex + sd * ew * 0.6} ${eyeY - eh * 2} ${ex + sd * ew * 0.95} ${eyeY - eh * 1.35}`}
              stroke={SKIN_SHADE[Math.min(4, tone + 1)]}
              strokeWidth="0.7"
              fill="none"
              opacity="0.8"
            />
            <path
              d={`M${ex - sd * ew * 0.75} ${eyeY + eh * 0.85} Q${ex} ${eyeY + eh * (1.25 + Math.max(0, smile) * 0.3)} ${ex + sd * ew * 0.85} ${eyeY + eh * 0.5}`}
              stroke={shade}
              strokeWidth="0.6"
              fill="none"
              opacity="0.8"
            />
            {herald && (
              <path
                d={`M${ex - ew - 0.5} ${eyeY - 0.5} C${ex - ew * 0.4} ${eyeY - eh * 2.6} ${ex + ew * 0.5} ${eyeY - eh * 2.6} ${ex + sd * (ew + 1)} ${eyeY - eh * 0.6}`}
                stroke="#22C3C9"
                strokeWidth="2.2"
                fill="none"
                opacity="0.7"
              />
            )}
          </g>
        );
      })}

      {/* Brows: tapered, the inner ends rise with worry. */}
      {!warden &&
        [-1, 1].map((side) => {
          const ex = 50 + side * eyeDX;
          const th = (F ? 1.1 : 1.6) + genes.brow * 0.45;
          const inner = {
            x: ex - side * ew * 0.95,
            y: browY + 1.2 - worry * 2.4 + Math.max(0, -smile) * 0.6,
          };
          const peak = { x: ex + side * ew * 0.25, y: browY - 1.2 - worry * 0.6 };
          const outerP = { x: ex + side * (ew * 1.2), y: browY + 1.4 };
          const browColor = grey ? '#9C978F' : HAIR[genes.hair % HAIR.length]!;
          return (
            <path
              key={side}
              d={`M${inner.x} ${inner.y} Q${peak.x} ${peak.y - th} ${outerP.x} ${outerP.y} Q${peak.x} ${peak.y + th * 0.2} ${inner.x} ${inner.y + th}Z`}
              fill={herald ? '#5A2A4A' : browColor}
            />
          );
        })}

      {/* Nose: bridge shadow, soft tip, wings and nostrils. */}
      <path
        d={`M${50 + 1.4} ${eyeY + 1.5} C${50 + 2.2} ${noseY - 6} ${50 + noseW * 0.55} ${noseY - 3} ${50 + noseW * 0.5} ${noseY - 0.6}`}
        stroke={shade}
        strokeWidth="1.2"
        fill="none"
        opacity="0.8"
      />
      <ellipse
        cx={50 - 0.4}
        cy={noseY - 1.6}
        rx={noseW * 0.42}
        ry="1.8"
        fill={light}
        opacity="0.7"
      />
      <path
        d={`M${50 - noseW} ${noseY} q-0.8 -2.6 1.6 -2.8 M${50 + noseW} ${noseY} q0.8 -2.6 -1.6 -2.8`}
        stroke={shade}
        strokeWidth="1"
        fill="none"
      />
      <path
        d={`M${50 - noseW * 0.6} ${noseY + 0.6} q${noseW * 0.25} 0.9 ${noseW * 0.45} 0 M${50 + noseW * 0.15} ${noseY + 0.6} q${noseW * 0.25} 0.9 ${noseW * 0.45} 0`}
        stroke={SKIN_SHADE[Math.min(4, tone + 1)]}
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${50 - noseW + 0.5} ${noseY + 1.5} Q50 ${noseY + 3.2} ${50 + noseW - 0.5} ${noseY + 1.5}`}
        stroke={shade}
        strokeWidth="0.8"
        fill="none"
        opacity="0.6"
      />

      {/* Mouth: upper lip with a cupid's bow, fuller lower lip, a line that follows the mood. */}
      {(() => {
        const c = smile * 2.2;
        const lw = mw * (1 + Math.max(0, smile) * 0.12);
        const upper = `M${50 - lw} ${mouthY - c * 0.4} C${50 - lw * 0.6} ${mouthY - 2.2} ${50 - 1.6} ${mouthY - 2.6} 50 ${mouthY - 1.6} C${50 + 1.6} ${mouthY - 2.6} ${50 + lw * 0.6} ${mouthY - 2.2} ${50 + lw} ${mouthY - c * 0.4} Q50 ${mouthY + c * 0.6} ${50 - lw} ${mouthY - c * 0.4}Z`;
        const lower = `M${50 - lw * 0.92} ${mouthY - c * 0.35} Q50 ${mouthY + c * 0.7 + 0.2} ${50 + lw * 0.92} ${mouthY - c * 0.35} C${50 + lw * 0.6} ${mouthY + 3.6 + c * 0.3} ${50 - lw * 0.6} ${mouthY + 3.6 + c * 0.3} ${50 - lw * 0.92} ${mouthY - c * 0.35}Z`;
        return (
          <g>
            <path d={upper} fill={url('lip')} opacity={F || herald ? 0.95 : 0.75} />
            <path d={lower} fill={url('lip')} opacity={F || herald ? 0.9 : 0.7} />
            <path
              d={`M${50 - lw} ${mouthY - c * 0.4} Q50 ${mouthY + c * 0.6} ${50 + lw} ${mouthY - c * 0.4}`}
              stroke="#4A221C"
              strokeWidth="0.9"
              fill="none"
              strokeLinecap="round"
            />
            <ellipse
              cx={50 - 1}
              cy={mouthY + 1.8 + c * 0.2}
              rx={lw * 0.3}
              ry="0.7"
              fill="#FFFFFF"
              opacity="0.35"
            />
            <ellipse cx="50" cy={mouthY + 5.6} rx={lw * 0.45} ry="1.2" fill={shade} opacity="0.4" />
          </g>
        );
      })()}

      {freckles && (
        <g fill={SKIN_SHADE[Math.min(4, tone + 1)]} opacity="0.7">
          {[-13, -10.5, -8, -11.5, 8, 10.5, 13, 11.5, -1.5, 1.5].map((dx, i) => (
            <circle key={i} cx={50 + dx * s} cy={noseY - 4 + (i % 3) * 1.4} r="0.6" />
          ))}
        </g>
      )}
      {mole && !herald && <circle cx={50 + rx * 0.4} cy={mouthY - 1} r="0.6" fill="#3A2218" />}
      {herald && <circle cx={50 + rx * 0.5} cy={noseY} r="0.9" fill="#3A1A20" />}
      {scar && (
        <path
          d={`M${50 + rx * 0.55} ${eyeY - 7} l2.6 9`}
          stroke="#A0605A"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.85"
        />
      )}

      {beard && (
        <g>
          <path
            d={`M${50 - rx * 0.92} ${cy + ry * 0.15} C${50 - rx * 0.9} ${cy + ry * 1.15} ${50 + rx * 0.9} ${cy + ry * 1.15} ${50 + rx * 0.92} ${cy + ry * 0.15} C${50 + rx * 0.55} ${cy + ry * 0.4} ${50 + mw + 2} ${mouthY - 4} 50 ${mouthY - 3} C${50 - mw - 2} ${mouthY - 4} ${50 - rx * 0.55} ${cy + ry * 0.4} ${50 - rx * 0.92} ${cy + ry * 0.15}Z M${50 - mw * 0.9} ${mouthY - 0.5} Q50 ${mouthY + 3.5} ${50 + mw * 0.9} ${mouthY - 0.5} Q50 ${mouthY + 1.5} ${50 - mw * 0.9} ${mouthY - 0.5}Z`}
            fill={url('hair')}
            fillRule="evenodd"
            opacity="0.95"
          />
          {[-6, -3, 0, 3, 6].map((dx) => (
            <path
              key={dx}
              d={`M${50 + dx} ${mouthY + 4} l${dx * 0.1} 5`}
              stroke={hairHi}
              strokeWidth="0.5"
              opacity="0.5"
            />
          ))}
        </g>
      )}

      {/* Hair on top: cap with strands and sheen, curls, sideburns. */}
      {ownHair && !bald && !curly && (
        <g>
          <path d={hairCap} fill={url('hair')} />
          {[0.18, 0.38, 0.6, 0.8].map((k) => (
            <path
              key={k}
              d={`M${L + rx * 2 * k} ${top - lift + 2} C${L + rx * 2 * k + 3} ${top + 3} ${L + rx * 2 * k + (k < 0.5 ? -2 : 4)} ${hl - 2} ${L + rx * 2 * k + (k < 0.5 ? -4 : 6)} ${hl + 1}`}
              stroke="#000000"
              strokeOpacity="0.18"
              strokeWidth="0.7"
              fill="none"
            />
          ))}
          <path
            d={`M${50 - rx * 0.55} ${top - lift + 5} Q50 ${top - lift - 0.5} ${50 + rx * 0.35} ${top - lift + 3.5}`}
            stroke={hairHi}
            strokeOpacity="0.7"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          {!F && (
            <g fill={url('hair')}>
              <path d={`M${L + 0.5} ${cy - 5} l2.2 0 l-0.3 ${ry * 0.3} l-1.6 0z`} />
              <path d={`M${R - 0.5} ${cy - 5} l-2.2 0 l0.3 ${ry * 0.3} l1.6 0z`} />
            </g>
          )}
        </g>
      )}
      {curly && !bald && (
        <g>
          {Array.from({ length: 13 }, (_, i) => {
            const a = Math.PI * (0.02 + (i / 12) * 0.96);
            const x = 50 - Math.cos(a) * rx * 0.98;
            const y = cy - 6 - Math.sin(a) * ry * 0.9;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={6.2 * s} fill={url('hair')} />
                <circle cx={x - 1.6} cy={y - 1.8} r="1.6" fill={hairHi} opacity="0.55" />
              </g>
            );
          })}
        </g>
      )}
      {bald && (
        <ellipse
          cx={50 - rx * 0.2}
          cy={top + 5}
          rx={rx * 0.35}
          ry="3"
          fill="#FFFFFF"
          opacity="0.2"
        />
      )}

      {/* The herald: sculpted wig front, gold pins, earrings. */}
      {herald && (
        <g>
          <path
            d={`M${L - 2} ${cy - 4} C${L - 4} ${top - 14} ${R + 4} ${top - 14} ${R + 2} ${cy - 4} C${R - 2} ${top + 3} ${50 + 4} ${top + 4} ${50 + 3} ${top + 6} C${50 - 8} ${top + 10} ${L + 2} ${top + 12} ${L + 2} ${cy - 2}Z`}
            fill={url('wig')}
          />
          <path
            d={`M${50 - rx} ${top - 22} q${rx} -20 ${rx * 2} 0`}
            stroke="#FFFFFF"
            strokeOpacity="0.4"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          {[-16, -4, 9, 20].map((dx, i) => (
            <circle key={i} cx={50 + dx} cy={top - 24 + (i % 2) * 6} r="2.2" fill="#F5C84C" />
          ))}
          {[-1, 1].map((side) => (
            <g key={side}>
              <circle cx={50 + side * (rx + 0.5)} cy={eyeY + 9} r="1.8" fill="#F5C84C" />
              <path
                d={`M${50 + side * (rx + 0.5)} ${eyeY + 11} l0 5`}
                stroke="#F5C84C"
                strokeWidth="1.1"
              />
              <circle cx={50 + side * (rx + 0.5)} cy={eyeY + 17.5} r="2.3" fill="#3FD4D9" />
            </g>
          ))}
        </g>
      )}

      {/* Headgear of the trade. */}
      <Headgear
        wear={wear}
        age={age}
        sex={sex}
        rx={rx}
        ry={ry}
        cy={cy}
        top={top}
        eyeY={eyeY}
        id={id}
      />

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

/** Collars and chest details: the outfit tells the trade. */
function Collar({ wear, cy, cloth, sex }: { wear: Outfit; cy: number; cloth: string; sex: Sex }) {
  const y = cy + 33;
  switch (wear) {
    case 'miner':
      return (
        <g>
          <path
            d={`M30 ${y + 6} L50 ${y + 22} L70 ${y + 6} L64 ${y + 3} L50 ${y + 14} L36 ${y + 3}Z`}
            fill="#26262A"
          />
          <rect x="14" y={y + 20} width="24" height="3.2" rx="1" fill="#E3C44A" opacity="0.9" />
          <rect x="62" y={y + 20} width="24" height="3.2" rx="1" fill="#E3C44A" opacity="0.9" />
        </g>
      );
    case 'farmer':
      return (
        <path
          d={`M34 ${y + 3} Q50 ${y + 16} 66 ${y + 3} L62 ${y + 11} Q50 ${y + 21} 38 ${y + 11}Z`}
          fill="#B23A2A"
        />
      );
    case 'fisher':
      return (
        <g stroke="#D8C9A2" strokeWidth="2.2" fill="none" opacity="0.6">
          {[8, 15, 22].map((d) => (
            <path key={d} d={`M14 ${y + d} Q50 ${y + d - 7} 86 ${y + d}`} />
          ))}
        </g>
      );
    case 'tribute':
      return (
        <g>
          <path
            d={`M41 ${y} L50 ${y + 9} L59 ${y}`}
            fill="none"
            stroke="#E9A23B"
            strokeWidth="1.6"
          />
          <rect x="49.2" y={y + 9} width="1.6" height="30" fill="#C9C9C9" opacity="0.7" />
          <path d={`M10 ${y + 22} L30 ${y + 12}`} stroke="#E9A23B" strokeWidth="2.4" />
          <path d={`M90 ${y + 22} L70 ${y + 12}`} stroke="#E9A23B" strokeWidth="2.4" />
        </g>
      );
    case 'herald':
      return (
        <g>
          <path
            d={`M20 ${y + 10} Q28 ${y - 18} 41 ${y - 3} L59 ${y - 3} Q72 ${y - 18} 80 ${y + 10} Q50 ${y - 2} 20 ${y + 10}Z`}
            fill="#FDF6E3"
            stroke="#D9A93C"
            strokeWidth="1.4"
          />
          {[-6, 0, 6].map((dx) => (
            <circle key={dx} cx={50 + dx} cy={y + 3} r="2.3" fill="#F5C84C" />
          ))}
        </g>
      );
    case 'warden':
      return (
        <g>
          <rect x="28" y={y + 6} width="44" height="4.5" rx="2" fill="#C9A44C" opacity="0.85" />
          <path d={`M8 ${y + 18} Q22 ${y + 4} 36 ${y + 6} L34 ${y + 16}Z`} fill="#4A5466" />
          <path d={`M92 ${y + 18} Q78 ${y + 4} 64 ${y + 6} L66 ${y + 16}Z`} fill="#4A5466" />
        </g>
      );
    default:
      return (
        <g>
          <path
            d={`M40 ${y - 1} L45 ${y + 12} L50 ${y + 4} L55 ${y + 12} L60 ${y - 1}`}
            fill={cloth}
            stroke="#FFFFFF"
            strokeOpacity="0.18"
            strokeWidth="1"
          />
          {sex === 'M' && <circle cx="50" cy={y + 16} r="0.9" fill="#00000055" />}
          <circle cx="50" cy={y + 24} r="0.9" fill="#00000055" />
        </g>
      );
  }
}

/** Hats, helmets and scarves of the trades, the warden's helmet and visor. */
function Headgear(p: {
  wear: Outfit;
  age: number;
  sex: Sex;
  rx: number;
  ry: number;
  cy: number;
  top: number;
  eyeY: number;
  id: (n: string) => string;
}) {
  const { wear, age, sex, rx, cy, top, eyeY } = p;
  if (wear === 'warden')
    return (
      <g>
        <path
          d={`M${50 - rx - 5} ${eyeY + 2} C${50 - rx - 6} ${top - 16} ${50 + rx + 6} ${top - 16} ${50 + rx + 5} ${eyeY + 2}Z`}
          fill="#4C5668"
        />
        <path
          d={`M${50 - rx + 2} ${top - 4} Q50 ${top - 12} ${50 + rx - 6} ${top - 6}`}
          stroke="#FFFFFF"
          strokeOpacity="0.28"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          x={50 - rx - 3}
          y={eyeY - 8}
          width={(rx + 3) * 2}
          height="14"
          rx="6"
          fill={`url(#${p.id('visor')})`}
        />
        <path
          d={`M${50 - rx + 4} ${eyeY - 5} l${rx * 0.9} 0`}
          stroke="#BFE3FF"
          strokeOpacity="0.45"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {[-1, 1].map((side) => (
          <path
            key={side}
            d={`M${50 + side * (rx + 3)} ${eyeY + 5} Q${50 + side * (rx - 2)} ${cy + 18} ${50 + side * 6} ${cy + p.ry - 2}`}
            fill="none"
            stroke="#22262E"
            strokeWidth="1.6"
          />
        ))}
      </g>
    );
  if (wear === 'miner' && age >= 14)
    return (
      <g>
        <path
          d={`M${50 - rx - 3} ${cy - 10} C${50 - rx - 3} ${top - 18} ${50 + rx + 3} ${top - 18} ${50 + rx + 3} ${cy - 10}Z`}
          fill="#8A7B4E"
        />
        <rect x={50 - rx - 5} y={cy - 12} width={rx * 2 + 10} height="4" rx="2" fill="#6E6240" />
        <circle cx="50" cy={top - 6} r="4.2" fill="#F2D27A" stroke="#4A4030" strokeWidth="1.2" />
        <circle cx="49" cy={top - 7} r="1.4" fill="#FFFFFF" opacity="0.8" />
      </g>
    );
  if (wear === 'farmer' && age >= 14 && sex === 'F')
    return (
      <path
        d={`M${50 - rx - 3} ${cy - 4} C${50 - rx - 3} ${top - 16} ${50 + rx + 3} ${top - 16} ${50 + rx + 3} ${cy - 4} C${50 + rx - 2} ${top + 4} ${50 - rx + 2} ${top + 4} ${50 - rx - 3} ${cy - 4}Z`}
        fill="#B85A3A"
        opacity="0.95"
      />
    );
  if (wear === 'farmer' && age >= 14)
    return (
      <g>
        <ellipse cx="50" cy={top + 2} rx={rx + 12} ry="5" fill="#D9BC6A" />
        <path
          d={`M${50 - rx + 2} ${top + 2} C${50 - rx + 2} ${top - 12} ${50 + rx - 2} ${top - 12} ${50 + rx - 2} ${top + 2}Z`}
          fill="#E3C878"
        />
        <rect x={50 - rx + 2} y={top - 2} width={rx * 2 - 4} height="3" fill="#8A3A2A" />
      </g>
    );
  if (wear === 'fisher' && age >= 14 && sex === 'M')
    return (
      <path
        d={`M${50 - rx} ${cy - 12} C${50 - rx} ${top - 16} ${50 + rx} ${top - 16} ${50 + rx} ${cy - 12} L${50 + rx + 2} ${cy - 8} L${50 - rx - 2} ${cy - 8}Z`}
        fill="#3E5A6E"
      />
    );
  return null;
}
