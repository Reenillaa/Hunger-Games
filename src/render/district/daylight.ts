/**
 * Day/night look as a pure function of the in-game time (testable without Phaser).
 * `night` drives lamps and lit windows; `ambient` tints everything lit by Phaser's lighting.
 */
export interface Daylight {
  /** Ambient light colour (0xRRGGBB). White means the baked art shows unchanged. */
  ambient: number;
  /** 0 = full day, 1 = deep night. */
  night: number;
  /** Opacity of baked sun shadows (fade at night, they make no sense without the sun). */
  shadow: number;
}

const DAY = [1, 1, 1];
const DUSK = [0.95, 0.72, 0.55];
const NIGHT = [0.2, 0.25, 0.38];

function mix(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + ((b[i] ?? v) - v) * t);
}

function toHex(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))));
  return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** `hour` is fractional (e.g. 18.5). Dawn 5–7, dusk 18–20.5. */
export function daylightAt(hour: number): Daylight {
  const h = ((hour % 24) + 24) % 24;
  let rgb: number[];
  let night: number;
  if (h >= 7 && h < 18) {
    rgb = DAY;
    night = 0;
  } else if (h >= 18 && h < 19.25) {
    const t = smooth((h - 18) / 1.25);
    rgb = mix(DAY, DUSK, t);
    night = t * 0.35;
  } else if (h >= 19.25 && h < 20.5) {
    const t = smooth((h - 19.25) / 1.25);
    rgb = mix(DUSK, NIGHT, t);
    night = 0.35 + t * 0.65;
  } else if (h >= 5 && h < 6) {
    const t = smooth(h - 5);
    rgb = mix(NIGHT, DUSK, t);
    night = 1 - t * 0.65;
  } else if (h >= 6 && h < 7) {
    const t = smooth(h - 6);
    rgb = mix(DUSK, DAY, t);
    night = 0.35 - t * 0.35;
  } else {
    rgb = NIGHT;
    night = 1;
  }
  return { ambient: toHex(rgb), night, shadow: 1 - night };
}
