/**
 * The twelve districts (docs/GDD.md §3), known only by the number the Capitol gave them.
 * wealth: economic level (outfits, sponsors); training: culture of preparing youths for the
 * games (academies) — high in the richest loyal districts.
 */
export interface DistrictProfile {
  id: number;
  numeral: string;
  name: string;
  industry: string;
  wealth: number;
  training: number;
}

export const DISTRICTS: readonly DistrictProfile[] = [
  {
    id: 1,
    numeral: '1',
    name: 'Distrito 1',
    industry: 'lujo y joyería',
    wealth: 0.95,
    training: 0.85,
  },
  {
    id: 2,
    numeral: '2',
    name: 'Distrito 2',
    industry: 'cantería y defensa',
    wealth: 0.8,
    training: 0.95,
  },
  { id: 3, numeral: '3', name: 'Distrito 3', industry: 'tecnología', wealth: 0.65, training: 0.2 },
  { id: 4, numeral: '4', name: 'Distrito 4', industry: 'pesca', wealth: 0.6, training: 0.7 },
  { id: 5, numeral: '5', name: 'Distrito 5', industry: 'energía', wealth: 0.5, training: 0.2 },
  { id: 6, numeral: '6', name: 'Distrito 6', industry: 'transporte', wealth: 0.45, training: 0.15 },
  { id: 7, numeral: '7', name: 'Distrito 7', industry: 'madera', wealth: 0.35, training: 0.25 },
  { id: 8, numeral: '8', name: 'Distrito 8', industry: 'textil', wealth: 0.3, training: 0.1 },
  { id: 9, numeral: '9', name: 'Distrito 9', industry: 'cereal', wealth: 0.3, training: 0.1 },
  {
    id: 10,
    numeral: '10',
    name: 'Distrito 10',
    industry: 'ganadería',
    wealth: 0.25,
    training: 0.2,
  },
  { id: 11, numeral: '11', name: 'Distrito 11', industry: 'huertas', wealth: 0.15, training: 0.15 },
  { id: 12, numeral: '12', name: 'Distrito 12', industry: 'minería', wealth: 0.1, training: 0.05 },
];

export const HOME_DISTRICT_NUMBER = 12;
