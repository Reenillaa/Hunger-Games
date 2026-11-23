/** Shapes of the art manifests written by tools/art (render_terrain.py, render_district_assets.py). */
export interface TerrainManifest {
  scale: number;
  tile: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  /** Pixel (at `scale`) where the ground point of cell (0, 0) lands. */
  originAnchor: [number, number];
  background: string;
}

export interface SpriteAsset {
  name: string;
  kind: 'building' | 'tree' | 'rock' | 'prop';
  footprint: [number, number];
  size: [number, number];
  anchor: [number, number];
  scale: number;
  layers: ('color' | 'shadow' | 'normal' | 'emission')[];
}

export interface SpriteManifest {
  scale: number;
  assets: Record<string, SpriteAsset>;
}

export interface HeightMap {
  width: number;
  height: number;
  heights: number[][];
}

export const ART_BASE = 'assets/district';

/** Terrain resolution: half-size chunks on small touch devices (memory), full otherwise. */
export function pickTerrainScale(): '1x' | '0.5x' {
  const q = new URLSearchParams(window.location.search).get('quality');
  if (q === 'low') return '0.5x';
  if (q === 'high') return '1x';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && Math.min(window.screen.width, window.screen.height) < 900 ? '0.5x' : '1x';
}

/**
 * Smoke emitters per structure, in 1x screen pixels relative to the sprite anchor.
 * Derived from the Blender model coordinates (X, Y, Z): dx = (X+Y)·64, dy = (X−Y)·32 − Z·78.38.
 */
export const SMOKE_POINTS: Record<string, [number, number][]> = {
  house_shack: [[48, -150]],
  house_terrace: [
    [-22, -180],
    [61, -138],
  ],
};
