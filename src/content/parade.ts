/**
 * The chariot parade (DECISIONS I-60): plates rendered by tools/art/render_parade.py and where
 * the riders stand in the hero plate (fractions of the 16:9 image, top-left origin), written
 * by the same script to public/assets/capital/parade.json.
 */
export const PARADE_PLATES = {
  wide: 'assets/capital/parade_wide.jpg',
  side: 'assets/capital/parade_side.jpg',
  hero: 'assets/capital/parade_hero.jpg',
} as const;

export const PARADE_HERO = {
  left: [0.5, 0.55] as const,
  right: [0.42, 0.55] as const,
  riderHeight: 0.15,
};

/** Costume light of each district's chariot (d1 … d12). */
export const DISTRICT_CHARIOT_COLOURS = [
  '#E8C547',
  '#8E9AA8',
  '#3FB6E8',
  '#2E86C1',
  '#F2C14E',
  '#B0563B',
  '#3E8E41',
  '#C2185B',
  '#E0A84A',
  '#8D5A3B',
  '#7CB342',
  '#FF7A2E',
];
