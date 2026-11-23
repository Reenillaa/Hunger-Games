import type { PortraitGenes, Sex } from '../../core/index.ts';

const SKIN = ['#E8C9AE', '#D9AE8E', '#C49A7A', '#9C7356', '#6E4E38'];
const SKIN_SHADE = ['#CFAE92', '#BF9273', '#A97F61', '#825D44', '#58402E'];
const HAIR = ['#1E1814', '#3A2A20', '#5A3E2A', '#7A3E22', '#9A8458', '#2A2624'];
const EYES = ['#3A2A1E', '#1E1A18', '#4E5A48', '#4A5868'];
const CLOTHES = ['#3E4552', '#5A4A3A', '#4A4540', '#2E3446', '#5C5048', '#3A3E45'];

interface Props {
  genes: PortraitGenes;
  sex: Sex;
  age: number;
  mood?: number;
  miner?: boolean;
  dead?: boolean;
  size?: number;
}

/**
 * Procedural flat-shaded bust (ART_BIBLE §6.1): every feature comes from heritable genes, so
 * siblings look alike. Age adds grey hair and lines; miners carry coal soot; mood bends the mouth.
 */
export function Portrait({
  genes,
  sex,
  age,
  mood = 50,
  miner = false,
  dead = false,
  size = 96,
}: Props) {
  const child = age < 13;
  const grey = age > 55;
  const s = child ? 0.86 : 1;
  const skin = SKIN[genes.skin % SKIN.length]!;
  const shade = SKIN_SHADE[genes.skin % SKIN_SHADE.length]!;
  const hair = grey ? (age > 70 ? '#C8C4BC' : '#8E8A84') : HAIR[genes.hair % HAIR.length]!;
  const eye = EYES[genes.eyes % EYES.length]!;
  const cloth = CLOTHES[(genes.hair + genes.face) % CLOTHES.length]!;
  const faceRx = (26 + genes.face * 1.5) * s;
  const faceRy = (32 + (genes.face % 2) * 3) * s;
  const cy = child ? 56 : 52;
  const eyeY = cy - 4 * s;
  const eyeR = (child ? 3.6 : 3) + genes.eyes * 0.15;
  const browW = 1.6 + genes.brow * 0.9;
  const smile = Math.max(-1, Math.min(1, (mood - 50) / 30));
  const long = sex === 'F' && genes.hairStyle % 3 !== 2;
  const bun = sex === 'F' && genes.hairStyle % 3 === 2;
  const bald = sex === 'M' && age > 50 && genes.hairStyle === 5;
  const beard = sex === 'M' && age >= 18 && (genes.brow === 2 || genes.hairStyle === 4);
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 120"
      role="img"
      aria-hidden="true"
      style={{ filter: dead ? 'grayscale(1) brightness(0.8)' : undefined, borderRadius: 3 }}
    >
      <defs>
        <linearGradient id="pbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34333A" />
          <stop offset="1" stopColor="#1B1B20" />
        </linearGradient>
      </defs>
      <rect width="100" height="120" fill="url(#pbg)" />
      {/* Hair behind the head (long hair). */}
      {long && !bald && (
        <path
          d={`M${50 - faceRx - 4} ${cy} Q50 ${cy - faceRy - 16} ${50 + faceRx + 4} ${cy} L${50 + faceRx + 2} ${cy + 34} L${50 - faceRx - 2} ${cy + 34}Z`}
          fill={hair}
        />
      )}
      {/* Shoulders and clothes. */}
      <path d={`M10 120 Q14 ${cy + 40} 50 ${cy + 36} Q86 ${cy + 40} 90 120Z`} fill={cloth} />
      <path
        d={`M38 ${cy + 36} L50 ${cy + 48} L62 ${cy + 36}`}
        fill="none"
        stroke="#00000040"
        strokeWidth="2"
      />
      <rect x={50 - 8 * s} y={cy + faceRy - 8} width={16 * s} height="14" fill={shade} />
      {/* Ears and face with a two-tone shade. */}
      <ellipse cx={50 - faceRx + 1} cy={cy + 2} rx="4.5" ry="7" fill={shade} />
      <ellipse cx={50 + faceRx - 1} cy={cy + 2} rx="4.5" ry="7" fill={shade} />
      <ellipse cx="50" cy={cy} rx={faceRx} ry={faceRy} fill={skin} />
      <path
        d={`M${50 + faceRx * 0.35} ${cy - faceRy + 6} Q${50 + faceRx + 2} ${cy} ${50 + faceRx * 0.3} ${cy + faceRy - 2} Q${50 + faceRx * 0.75} ${cy} ${50 + faceRx * 0.35} ${cy - faceRy + 6}Z`}
        fill={shade}
        opacity="0.7"
      />
      {/* Eyes and brows. */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <ellipse cx={50 + side * 10 * s} cy={eyeY} rx={eyeR + 1.4} ry={eyeR} fill="#EDE6DA" />
          <circle cx={50 + side * 10 * s} cy={eyeY + 0.3} r={eyeR * 0.65} fill={eye} />
          <rect
            x={50 + side * 10 * s - 5}
            y={eyeY - 8 - genes.brow * 0.4}
            width="10"
            height={browW}
            rx="1"
            fill={grey ? '#8E8A84' : HAIR[genes.hair % HAIR.length]}
            transform={`rotate(${side * (genes.brow - 1) * 6} ${50 + side * 10 * s} ${eyeY - 7})`}
          />
        </g>
      ))}
      {/* Nose variants. */}
      <path
        d={
          [
            `M50 ${eyeY + 2} L47 ${cy + 11} L52 ${cy + 12}`,
            `M51 ${eyeY + 1} Q46 ${cy + 9} 48 ${cy + 12} Q51 ${cy + 13} 53 ${cy + 11}`,
            `M50 ${eyeY + 3} L46 ${cy + 13} L53 ${cy + 13}`,
            `M49 ${eyeY + 2} Q47 ${cy + 8} 49 ${cy + 11} L53 ${cy + 11}`,
          ][genes.nose % 4]
        }
        fill="none"
        stroke={SKIN_SHADE[Math.min(4, genes.skin + 1)]}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Mouth follows the mood. */}
      <path
        d={`M${44} ${cy + 19} Q50 ${cy + 19 + smile * 4} ${56} ${cy + 19}`}
        fill="none"
        stroke="#7A4A3E"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Age lines. */}
      {age > 45 && (
        <g stroke={shade} strokeWidth="1.2" fill="none" opacity="0.9">
          <path d={`M${50 - 18 * s} ${eyeY + 7} q3 2 6 0`} />
          <path d={`M${50 + 12 * s} ${eyeY + 7} q3 2 6 0`} />
          {age > 60 && <path d={`M42 ${cy - faceRy + 12} q8 -2 16 0`} />}
        </g>
      )}
      {beard && (
        <path
          d={`M${50 - faceRx + 4} ${cy + 6} Q50 ${cy + faceRy + 10} ${50 + faceRx - 4} ${cy + 6} Q50 ${cy + 24} ${50 - faceRx + 4} ${cy + 6}Z`}
          fill={hair}
          opacity="0.92"
        />
      )}
      {/* Hair on top. */}
      {!bald && (
        <path
          d={
            bun
              ? `M${50 - faceRx} ${cy - 6} Q50 ${cy - faceRy - 14} ${50 + faceRx} ${cy - 6} Q50 ${cy - faceRy + 2} ${50 - faceRx} ${cy - 6}Z M44 ${cy - faceRy - 10} a7 7 0 1 0 12 0 a7 7 0 1 0 -12 0`
              : genes.hairStyle % 2 === 0
                ? `M${50 - faceRx - 1} ${cy - 2} Q${48} ${cy - faceRy - 16} ${50 + faceRx + 1} ${cy - 4} Q${60} ${cy - faceRy + 2} ${50 - faceRx - 1} ${cy - 2}Z`
                : `M${50 - faceRx - 1} ${cy - 6} Q50 ${cy - faceRy - 12} ${50 + faceRx + 1} ${cy - 6} Q${40} ${cy - faceRy + 4} ${50 - faceRx - 1} ${cy - 6}Z`
          }
          fill={hair}
        />
      )}
      {miner && (
        <g fill="#1B1B1E" opacity="0.45">
          <ellipse cx={50 - 14 * s} cy={cy + 10} rx="5" ry="3" />
          <ellipse cx={50 + 9 * s} cy={cy - faceRy + 14} rx="6" ry="2.5" />
        </g>
      )}
    </svg>
  );
}
