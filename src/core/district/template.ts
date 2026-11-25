/** Terrain template shared with the art pipeline (src/content/maps/*.json). */
export type TerrainCode = 'R' | 's' | 'v' | 'w' | 'b' | 'f' | 'g' | 'd' | 'p' | 't' | 'r' | 'c';

export interface DistrictTemplate {
  id: string;
  width: number;
  height: number;
  legend: Record<string, string>;
  plaza: { x0: number; y0: number; x1: number; y1: number };
  /** One string per row (y), one character per cell (x). */
  terrain: string[];
  elevation: number[][];
}

export type StructureKind =
  | 'house_shack'
  | 'house_terrace'
  | 'mine_headframe'
  | 'town_hall'
  | 'warehouse'
  | 'economato'
  | 'stage'
  | 'lumber_camp'
  | 'quarry'
  | 'garden'
  | 'infirmary'
  | 'school'
  | 'farm'
  | 'fishery'
  | 'tavern'
  | 'bakery'
  | 'windmill'
  | 'smokehouse'
  | 'market'
  | 'well';

export type ResourceId = 'food' | 'wood' | 'stone' | 'coal' | 'credits';

export type PropKind =
  | 'pine_a'
  | 'pine_b'
  | 'pine_c'
  | 'dead_tree'
  | 'rock_a'
  | 'rock_b'
  | 'rock_c'
  | 'lamp'
  | 'coal_heap'
  | 'supplies'
  | 'poster_a'
  | 'poster_b'
  | 'fruit_tree'
  | 'boat'
  | 'oak_a'
  | 'oak_b'
  | 'birch';

/** Cells where the player may build (Phase 3 rules start from this). */
export const BUILDABLE: ReadonlySet<TerrainCode> = new Set(['g', 'd', 'c']);

export function terrainAt(t: DistrictTemplate, x: number, y: number): TerrainCode | null {
  if (x < 0 || y < 0 || x >= t.width || y >= t.height) return null;
  return (t.terrain[y]?.[x] as TerrainCode | undefined) ?? null;
}

export function isBuildable(t: DistrictTemplate, x: number, y: number): boolean {
  const code = terrainAt(t, x, y);
  return code !== null && BUILDABLE.has(code);
}
