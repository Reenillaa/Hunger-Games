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
  | 'birch'
  | 'hanging_tree'
  | 'k_oak'
  | 'k_tree'
  | 'k_tree_fat'
  | 'k_tree_detailed'
  | 'k_tree_fall'
  | 'k_pine_round'
  | 'k_pine_tall'
  | 'k_pine_small'
  | 'k_palm'
  | 'k_bush'
  | 'k_bush_large'
  | 'k_bush_detailed'
  | 'k_flowers_red'
  | 'k_flowers_yellow'
  | 'k_flowers_purple'
  | 'k_grass'
  | 'k_mushrooms'
  | 'k_stump'
  | 'k_log_stack'
  | 'k_rock_large'
  | 'k_rock_small'
  | 'k_rock_tall'
  | 'k_corn'
  | 'k_wheat'
  | 'k_pumpkin'
  | 'k_lily'
  | 'k_campfire'
  | 'k_tent'
  | 'k_canoe'
  | 'k_cart'
  | 'k_stall_red'
  | 'k_stall_green'
  | 'k_lantern'
  | 'k_fountain'
  | 'k_hedge'
  | 'k_banner'
  | 'k_tree_crooked'
  | 'k_barrel'
  | 'k_crates'
  | 'k_bucket'
  | 'k_workbench'
  | 'k_wood_pile'
  | 'k_signpost'
  | 'k_bench'
  | 'k_hay'
  | 'k_fire_basket'
  | 'k_lightpost'
  | 'k_market_fruit'
  | 'k_market_bread'
  | 'k_market_flowers'
  | 'k_gravestone'
  | 'k_grave'
  | 'k_candles';

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
