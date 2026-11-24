/** Arena items (docs/GAME_SYSTEMS.md §10.7). Weapons: damage, accuracy bonus, range in cells. */
export interface ItemDef {
  id: string;
  kind: 'weapon' | 'food' | 'water' | 'medkit' | 'gear';
  damage?: number;
  accuracy?: number;
  range?: number;
  /** Patronage cost of sending it in a capsule (rises every arena day). */
  capsule: number;
}

export const ITEMS: Record<string, ItemDef> = {
  knife: { id: 'knife', kind: 'weapon', damage: 18, accuracy: 10, range: 1, capsule: 40 },
  spear: { id: 'spear', kind: 'weapon', damage: 24, accuracy: 0, range: 2, capsule: 60 },
  axe: { id: 'axe', kind: 'weapon', damage: 30, accuracy: -10, range: 1, capsule: 70 },
  bow: { id: 'bow', kind: 'weapon', damage: 20, accuracy: 5, range: 5, capsule: 90 },
  club: { id: 'club', kind: 'weapon', damage: 14, accuracy: 5, range: 1, capsule: 20 },
  ration: { id: 'ration', kind: 'food', capsule: 15 },
  water: { id: 'water', kind: 'water', capsule: 15 },
  medkit: { id: 'medkit', kind: 'medkit', capsule: 50 },
  cloak: { id: 'cloak', kind: 'gear', capsule: 35 },
};

/** What lies in the Relicario at the start (the cornucopia of supplies). */
export const CACHE_LOOT = [
  'knife',
  'spear',
  'axe',
  'bow',
  'club',
  'ration',
  'ration',
  'water',
  'water',
  'medkit',
  'cloak',
  'knife',
  'spear',
  'ration',
];
/** Bare-handed fighting. */
export const FISTS = { damage: 6, accuracy: 0, range: 1 };
