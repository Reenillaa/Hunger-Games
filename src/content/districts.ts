/**
 * The twelve districts (docs/GDD.md §3). Original names; the numbering is the regime's.
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
  { id: 1, numeral: 'I', name: 'Corona', industry: 'lujo y joyería', wealth: 0.95, training: 0.85 },
  {
    id: 2,
    numeral: 'II',
    name: 'Bastión',
    industry: 'cantería y defensa',
    wealth: 0.8,
    training: 0.95,
  },
  { id: 3, numeral: 'III', name: 'Engranaje', industry: 'tecnología', wealth: 0.65, training: 0.2 },
  { id: 4, numeral: 'IV', name: 'Marea', industry: 'pesca', wealth: 0.6, training: 0.7 },
  { id: 5, numeral: 'V', name: 'Dínamo', industry: 'energía', wealth: 0.5, training: 0.2 },
  { id: 6, numeral: 'VI', name: 'Raíl', industry: 'transporte', wealth: 0.45, training: 0.15 },
  { id: 7, numeral: 'VII', name: 'Pinar', industry: 'madera', wealth: 0.35, training: 0.25 },
  { id: 8, numeral: 'VIII', name: 'Telar', industry: 'textil', wealth: 0.3, training: 0.1 },
  { id: 9, numeral: 'IX', name: 'Mies', industry: 'cereal', wealth: 0.3, training: 0.1 },
  { id: 10, numeral: 'X', name: 'Majada', industry: 'ganadería', wealth: 0.25, training: 0.2 },
  { id: 11, numeral: 'XI', name: 'Vergel', industry: 'huertas', wealth: 0.15, training: 0.15 },
  { id: 12, numeral: 'XII', name: 'Veta Negra', industry: 'minería', wealth: 0.1, training: 0.05 },
];

export const HOME_DISTRICT_NUMBER = 12;
