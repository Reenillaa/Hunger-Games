import { useMemo } from 'react';
import css from './worldmap.module.css';

type Pt = [number, number];

/** Clips a convex polygon to the half-plane closer to `a` than to `b`. */
function clipCloser(poly: Pt[], a: Pt, b: Pt): Pt[] {
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n: Pt = [b[0] - a[0], b[1] - a[1]];
  const side = (p: Pt) => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1];
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if (sp * sq < 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** Ink glyphs of each district's trade, drawn small beside its seal. */
const GLYPHS: Record<string, string> = {
  d1: 'M0 -7 L6 -1 L0 7 L-6 -1Z M-6 -1 L6 -1',
  d2: 'M-6 6 L-6 -2 L-3 -6 L3 -6 L6 -2 L6 6Z M-6 1 L6 1',
  d3: 'M0 -7 A7 7 0 1 1 -0.1 -7 M0 -3 A3 3 0 1 1 -0.1 -3',
  d4: 'M-7 0 Q-2 -6 5 0 Q-2 6 -7 0Z M5 0 L8 -3 L8 3Z',
  d5: 'M2 -8 L-4 1 L1 1 L-2 8 L5 -2 L0 -2Z',
  d6: 'M-8 5 L8 5 M-8 1 L8 1 M-5 -1 L-5 7 M0 -1 L0 7 M5 -1 L5 7',
  d7: 'M0 -8 L6 2 L-6 2Z M0 -3 L7 7 L-7 7Z M0 7 L0 9',
  d8: 'M-6 -6 L6 -6 L6 6 L-6 6Z M-6 -2 L6 -2 M-6 2 L6 2',
  d9: 'M0 8 L0 -6 M0 -6 L-3 -3 M0 -6 L3 -3 M0 -2 L-3 1 M0 -2 L3 1 M0 2 L-3 5 M0 2 L3 5',
  d10: 'M-7 2 Q-7 -5 0 -5 Q7 -5 7 2 L7 5 L-7 5Z M-4 5 L-4 8 M4 5 L4 8',
  d11: 'M0 -2 A5 5 0 1 1 -0.1 -2 M0 -2 Q2 -7 6 -7',
  d12: 'M-7 7 L5 -5 M2 -8 Q8 -8 8 -2 M-1 -5 L5 1',
};

/**
 * The borders of the districts on the parchment (DECISIONS I-61): each place owns the land
 * nearest to its seal; borders are inked as dashed lines, the selected district glows, and
 * every district carries the small glyph of its trade.
 */
export function WorldBorders({
  markers,
  aspect,
  selected,
}: {
  markers: Record<string, [number, number]>;
  aspect: number;
  selected: string;
}) {
  const W = 1000;
  const H = W / aspect;
  const cells = useMemo(() => {
    const sites = Object.entries(markers).map(([id, [x, y]]): [string, Pt] => [id, [x * W, y * H]]);
    return sites.map(([id, p]) => {
      let poly: Pt[] = [
        [0, 0],
        [W, 0],
        [W, H],
        [0, H],
      ];
      for (const [other, q] of sites) if (other !== id) poly = clipCloser(poly, p, q);
      return {
        id,
        p,
        d: `M${poly.map((v) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`).join(' L')}Z`,
      };
    });
  }, [markers, H]);
  return (
    <svg
      className={css.borders}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="selGlow">
          <stop offset="0" stopColor="#E9A23B" stopOpacity="0.34" />
          <stop offset="1" stopColor="#E9A23B" stopOpacity="0.08" />
        </radialGradient>
      </defs>
      {cells.map((c) => (
        <path
          key={c.id}
          d={c.d}
          className={c.id === selected ? css.cellOn : css.cell}
          fill={c.id === selected ? 'url(#selGlow)' : 'none'}
        />
      ))}
      {cells.map((c) =>
        GLYPHS[c.id] ? (
          <g
            key={`g${c.id}`}
            transform={`translate(${c.p[0] + 26} ${c.p[1] - 24})`}
            className={css.glyph}
          >
            <circle r="11" />
            <path d={GLYPHS[c.id]} />
          </g>
        ) : null,
      )}
    </svg>
  );
}
