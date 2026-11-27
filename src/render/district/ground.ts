import type * as Phaser from 'phaser';
import type { DistrictTemplate, TerrainCode } from '../../core/district/template.ts';
import { terrainAt } from '../../core/district/template.ts';
import { TILE_H, TILE_W, cellToWorld, mapBounds } from '../iso/projection.ts';
import type { Relief } from './relief.ts';
import { SUN, fbm } from './relief.ts';

/**
 * Stylised ground painted at runtime (DECISIONS I-55): bright, soft-edged "painted" layers in the
 * spirit of the simple buildings — grass with brush variation, sandy paths, cobbled plaza, cartoon
 * water with a sandy shore, chunky rocks — instead of a photographic pre-render. Roads come from
 * the game state, so new paths appear as soon as they are laid.
 *
 * Soft edges come from overlapping radial "brush stamps" (no canvas filters: older iOS Safari
 * ignores them). Everything is deterministic for a template, so the ground never flickers.
 */

const MARGIN = 700;
const MAX_TILE = 2048;

const DEFAULT_PALETTE = {
  beyond: '#2E5E2A',
  beyondDark: '#244B22',
  grass: '#79C84F',
  grassLight: '#93D862',
  grassDark: '#63B241',
  tuft: '#579E37',
  tuftLight: '#A8E275',
  forest: '#4E9A39',
  dirt: '#C9AA7C',
  dirtEdge: '#AE8E60',
  dirtLight: '#D8BE94',
  /** Specks of coal dust on bare earth (same as the earth where there is no mine). */
  dust: '#C9AA7C',
  pebble: '#B9B3A6',
  field: '#C8B14E',
  fieldRow: '#9F8A34',
  fieldLight: '#E3CF6A',
  path: '#F3E2B8',
  pathEdge: '#C9A46A',
  pathRut: '#B89464',
  plaza: '#CFC6B3',
  plazaEdge: '#958B78',
  grout: '#8F8676',
  curb: '#7D7466',
  cobble: '#DED6C6',
  cobbleDark: '#C7BDAA',
  cobbleLight: '#E8E2D6',
  shore: '#EDDDA3',
  water: '#41B9E8',
  waterDeep: '#2C98D3',
  foam: '#F4FBFF',
  rock: '#9497A0',
  rockLight: '#C3C7CF',
  rockDark: '#686B74',
  scree: '#B4AA98',
  coal: '#3A3735',
  coalShine: '#6E6A66',
  rail: '#8F857C',
  tie: '#6E4A30',
  steel: '#CDD2D8',
  plank: '#A9733F',
  plankDark: '#7C5128',
} as const;

export type GroundPalette = { -readonly [K in keyof typeof DEFAULT_PALETTE]: string };

/**
 * District 12 (DECISIONS I-77): the mining valley. A deeper, less candy green, darker trodden
 * earth with coal dust, worn grey cobbles. The reference look for the other districts.
 */
export const D12_PALETTE: Partial<GroundPalette> = {
  beyond: '#4E8A3A',
  beyondDark: '#21401F',
  grass: '#69AA44',
  grassLight: '#70B049',
  grassDark: '#578F36',
  tuft: '#4C8530',
  tuftLight: '#9BCF68',
  forest: '#5A9C3B',
  dirt: '#A88A66',
  dirtEdge: '#8F7353',
  dirtLight: '#AF916C',
  dust: '#4A4440',
  pebble: '#A9A497',
  path: '#D6C29B',
  pathEdge: '#9C8160',
  pathRut: '#A68C68',
  plaza: '#A9A295',
  plazaEdge: '#5F584D',
  grout: '#6A6358',
  curb: '#57514A',
  cobble: '#B3AC9F',
  cobbleDark: '#9C958A',
  cobbleLight: '#C2BCAF',
  water: '#3EA7D6',
  waterDeep: '#2F8FC2',
  shore: '#D8C48E',
  scree: '#A29C8F',
};

/** The arena's woods: wilder, deeper greens. */
export const ARENA_FOREST_PALETTE: Partial<GroundPalette> = {
  grass: '#6DBB45',
  grassLight: '#86CC57',
  grassDark: '#559C36',
  forest: '#3F8530',
  beyond: '#1F4A22',
  beyondDark: '#173B1A',
};

/** The frozen tundra: snow, ice, slush and blue shadows. */
export const SNOW_PALETTE: Partial<GroundPalette> = {
  beyond: '#B9C9D6',
  beyondDark: '#A3B5C4',
  grass: '#EAF2F8',
  grassLight: '#F8FCFF',
  grassDark: '#D3E1EC',
  tuft: '#B7CCDC',
  tuftLight: '#FFFFFF',
  forest: '#CFDDE8',
  dirt: '#C9D3DB',
  dirtEdge: '#AEBBC6',
  path: '#DDE7EF',
  pathEdge: '#B5C4D0',
  shore: '#F4F8FB',
  water: '#8DCBEA',
  waterDeep: '#4E9CCB',
  foam: '#FFFFFF',
  scree: '#C7CFD6',
};

/** Small deterministic PRNG (render-side decoration only). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A soft round brush of one colour, pre-rendered once and stamped many times. */
function makeBrush(color: string, hardness: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(hardness, color);
  grad.addColorStop(1, `${color}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export interface GroundInput {
  template: DistrictTemplate;
  /** Cells (y * width + x) that are roads laid during the game (on top of the template's). */
  roads: ReadonlySet<number>;
  /** Colours that differ from the districts' (arenas, snow). */
  palette?: Partial<GroundPalette>;
  /** Visual heights: cliffs and hills drawn in relief, light and shadow over the valley. */
  relief?: Relief;
  /**
   * The low-poly diorama look (DECISIONS I-80): ground and cliffs as flat-shaded facets with
   * crisp edges, like the models standing on them.
   */
  lowPoly?: boolean;
}

/** `#rrggbb` → [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as [
    number,
    number,
    number,
  ];
}

export class GroundPainter {
  private images: Phaser.GameObjects.Image[] = [];
  private keys: string[] = [];
  private readonly brushes = new Map<string, HTMLCanvasElement>();

  private readonly scene: Phaser.Scene;
  /** Canvas pixels per world pixel (0.5 on small devices). */
  private readonly k: number;

  constructor(scene: Phaser.Scene, k: number) {
    this.scene = scene;
    this.k = k;
  }

  private brush(color: string, hardness = 0.45): HTMLCanvasElement {
    const id = `${color}:${hardness}`;
    let b = this.brushes.get(id);
    if (!b) {
      b = makeBrush(color, hardness);
      this.brushes.set(id, b);
    }
    return b;
  }

  /** Paints (or repaints) the whole ground and returns the images placed in the world. */
  paint(input: GroundInput): Phaser.GameObjects.Image[] {
    const { template } = input;
    const PALETTE: GroundPalette = { ...DEFAULT_PALETTE, ...input.palette };
    const W = template.width;
    const H = template.height;
    const bounds = mapBounds(W, H);
    const ox = bounds.x - MARGIN;
    const oy = bounds.y - MARGIN;
    const worldW = bounds.width + MARGIN * 2;
    const worldH = bounds.height + MARGIN * 2;
    const k = this.k;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(worldW * k);
    canvas.height = Math.ceil(worldH * k);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    const rand = mulberry32(hashString(template.id));
    const code = (x: number, y: number): TerrainCode | null => {
      if (input.roads.has(y * W + x)) return 'r';
      return terrainAt(template, x, y);
    };
    const cells = (pred: (c: TerrainCode, x: number, y: number) => boolean) => {
      const out: [number, number][] = [];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const c = code(x, y);
          if (c && pred(c, x, y)) out.push([x, y]);
        }
      return out;
    };
    /** Stamps a soft ellipse (iso-flattened) of `r` cells around a cell centre. */
    const stamp = (
      color: string,
      cx: number,
      cy: number,
      r: number,
      hardness = 0.45,
      alpha = 1,
    ) => {
      const p = cellToWorld(cx, cy);
      const w = TILE_W * r;
      const h = TILE_H * r;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.brush(color, hardness), p.x - w / 2, p.y - h / 2, w, h);
      ctx.globalAlpha = 1;
    };
    const diamond = (cx: number, cy: number, grow = 1) => {
      const p = cellToWorld(cx, cy);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - (TILE_H / 2) * grow);
      ctx.lineTo(p.x + (TILE_W / 2) * grow, p.y);
      ctx.lineTo(p.x, p.y + (TILE_H / 2) * grow);
      ctx.lineTo(p.x - (TILE_W / 2) * grow, p.y);
      ctx.closePath();
    };

    if (input.lowPoly) {
      this.paintLowPoly(ctx, template, input.relief, code, PALETTE);
      return this.upload(canvas, ox, oy);
    }

    // 1. Beyond the district: a dark woodland rim.
    ctx.fillStyle = PALETTE.beyond;
    ctx.fillRect(ox, oy, worldW, worldH);
    for (let i = 0; i < 260; i++) {
      const x = ox + rand() * worldW;
      const y = oy + rand() * worldH;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.brush(PALETTE.beyondDark, 0.2), x - 120, y - 60, 240, 120);
    }
    ctx.globalAlpha = 1;

    // 2. Grass over the whole diamond, with broad brush variation and tufts.
    ctx.fillStyle = PALETTE.grass;
    ctx.beginPath();
    const c0 = cellToWorld(-0.5, -0.5);
    const c1 = cellToWorld(W - 0.5, -0.5);
    const c2 = cellToWorld(W - 0.5, H - 0.5);
    const c3 = cellToWorld(-0.5, H - 0.5);
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < W * H * 0.35; i++) {
      const x = rand() * W;
      const y = rand() * H;
      stamp(rand() < 0.5 ? PALETTE.grassLight : PALETTE.grassDark, x, y, 2 + rand() * 3, 0.1, 0.35);
    }
    ctx.restore();
    for (const [x, y] of cells((c) => c === 'f')) stamp(PALETTE.forest, x, y, 2.2, 0.35, 0.9);

    // 3. Fields: soft soil with crop rows.
    for (const [x, y] of cells((c) => c === 'c')) stamp(PALETTE.field, x, y, 1.6, 0.6);
    for (const [x, y] of cells((c) => c === 'c')) {
      for (let i = -1; i <= 1; i++) {
        const a = cellToWorld(x - 0.45, y + i * 0.3);
        const b = cellToWorld(x + 0.45, y + i * 0.3);
        ctx.strokeStyle = i === 0 ? PALETTE.fieldLight : PALETTE.fieldRow;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // 4. Bare earth around the houses: packed, trodden soil with pebbles, cracks and (in the
    //    mining district) coal dust; grass creeps in at the edges.
    const dirt = cells((c) => c === 'd' || c === 'v');
    for (const [x, y] of dirt) stamp(PALETTE.dirtEdge, x, y, 1.75, 0.55, 0.9);
    for (const [x, y] of dirt) stamp(PALETTE.dirt, x, y, 1.45, 0.6);
    for (const [x, y] of dirt) {
      // Mottling: lighter dry patches and darker damp ones.
      stamp(
        rand() < 0.5 ? PALETTE.dirtLight : PALETTE.dirtEdge,
        x + (rand() - 0.5) * 0.6,
        y + (rand() - 0.5) * 0.6,
        0.6 + rand() * 0.6,
        0.2,
        0.35,
      );
      this.pebbles(ctx, x, y, 3, PALETTE, rand);
      if (rand() < 0.18) this.crack(ctx, x, y, PALETTE.dirtEdge, rand);
      if (PALETTE.dust !== PALETTE.dirt)
        for (let i = 0; i < 4; i++) {
          const p = cellToWorld(x + (rand() - 0.5) * 0.9, y + (rand() - 0.5) * 0.9);
          ctx.fillStyle = PALETTE.dust;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 1.5 + rand() * 2, 1 + rand(), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
    }

    // 4b. Grass reclaims the earth away from the paths and the plaza: the town is a patchwork of
    //     trodden soil and weedy grass, not one bare blob.
    const nearWay = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const c = code(x + dx, y + dy);
          if (c === 'r' || c === 'p') return true;
        }
      return false;
    };
    const wild = dirt.filter(
      ([x, y]) => code(x, y) === 'd' && !nearWay(x, y) && fbm(x * 0.21, y * 0.21, 41) > 0.5,
    );
    for (const [x, y] of wild) stamp(PALETTE.grassDark, x, y, 1.5, 0.35, 0.85);
    for (const [x, y] of wild) stamp(PALETTE.grass, x, y, 1.2, 0.45, 0.9);
    for (const [x, y] of wild)
      stamp(PALETTE.grassLight, x + (rand() - 0.5) * 0.5, y + (rand() - 0.5) * 0.5, 0.7, 0.2, 0.4);

    // 5. Water: sandy shore, cartoon water, deeper middle, foam.
    const water = cells((c) => c === 'w' || c === 'b');
    for (const [x, y] of water) stamp(PALETTE.shore, x, y, 2.1, 0.6);
    for (const [x, y] of water) stamp(PALETTE.water, x, y, 1.55, 0.7);
    for (const [x, y] of water) {
      const deep = [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every((dx) => {
          const c = code(x + dx, y + dy);
          return c === 'w' || c === 'b';
        }),
      );
      if (deep) stamp(PALETTE.waterDeep, x, y, 1.3, 0.3, 0.8);
    }
    for (const [x, y] of water)
      if (rand() < 0.35) {
        const p = cellToWorld(x + (rand() - 0.5) * 0.6, y + (rand() - 0.5) * 0.6);
        ctx.strokeStyle = PALETTE.foam;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - 14, p.y);
        ctx.quadraticCurveTo(p.x, p.y - 6, p.x + 14, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

    // 6. Rock, scree and coal seams: chunky cartoon boulders with a lit top.
    for (const [x, y] of cells((c) => c === 's')) stamp(PALETTE.scree, x, y, 1.6, 0.55);
    // With relief the mountain is drawn as real cliffs further down.
    const rock = input.relief ? [] : cells((c) => c === 'R');
    for (const [x, y] of rock) stamp(PALETTE.rockDark, x, y, 1.7, 0.6);
    for (const [x, y] of rock) {
      if (rand() < 0.75) {
        const jx = x + (rand() - 0.5) * 0.5;
        const jy = y + (rand() - 0.5) * 0.5;
        const r = 0.8 + rand() * 0.6;
        stamp(PALETTE.rock, jx, jy, r, 0.8);
        stamp(PALETTE.rockLight, jx - 0.12, jy - 0.12, r * 0.55, 0.75, 0.9);
      }
    }
    // Coal seams: black, dusty ground heaped with angular lumps that catch the light.
    const seam = cells((c) => c === 'v');
    for (const [x, y] of seam) stamp(PALETTE.coal, x, y, 1.35, 0.35, 0.85);
    for (const [x, y] of seam) {
      for (let i = 0; i < 7; i++) {
        const p = cellToWorld(x + (rand() - 0.5) * 0.9, y + (rand() - 0.5) * 0.9);
        const r = 4 + rand() * 6;
        const pts = Array.from({ length: 5 }, (_, k) => {
          const a = (k / 5) * Math.PI * 2 + rand() * 0.6;
          return [p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.6] as const;
        });
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        pts.forEach(([px, py], k) =>
          k ? ctx.lineTo(px + 1.5, py + 2) : ctx.moveTo(px + 1.5, py + 2),
        );
        ctx.fill();
        ctx.fillStyle = rand() < 0.5 ? '#2C2A29' : '#3B3836';
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.fill();
        // A glint on the lit facet.
        ctx.strokeStyle = 'rgba(190,205,225,0.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(pts[2]![0], pts[2]![1]);
        ctx.lineTo(pts[3]![0], pts[3]![1]);
        ctx.stroke();
      }
    }

    // 7. Paths (template roads + roads laid in play): trodden earth with a darker rim, two worn
    //    wheel ruts, loose pebbles and grass leaning over the edges.
    const path = cells((c) => c === 'r');
    const isPath = (x: number, y: number) => {
      const c = code(x, y);
      return c === 'r' || c === 'p' || c === 'b';
    };
    const links: [number, number, number, number][] = [];
    for (const [x, y] of path)
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const)
        if (isPath(x + dx, y + dy)) links.push([x, y, x + dx, y + dy]);
    const ribbon = (color: string, width: number, along = 0, alpha = 1) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const [x0, y0, x1, y1] of links) {
        // `along`: a parallel line shifted across the path (wheel ruts).
        const ox = y1 !== y0 ? along : 0;
        const oy = x1 !== x0 ? along : 0;
        const a = cellToWorld(x0 + ox, y0 + oy);
        const b = cellToWorld(x1 + ox, y1 + oy);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    ribbon(PALETTE.pathEdge, 62);
    for (const [x, y] of path) stamp(PALETTE.pathEdge, x, y, 1.0, 0.7);
    ribbon(PALETTE.path, 46);
    for (const [x, y] of path) stamp(PALETTE.path, x, y, 0.82, 0.75);
    ribbon(PALETTE.pathRut, 5, -0.17, 0.45);
    ribbon(PALETTE.pathRut, 5, 0.17, 0.45);
    for (const [x, y] of path) {
      this.pebbles(ctx, x, y, 2, PALETTE, rand);
      if (rand() < 0.5)
        stamp(PALETTE.pathEdge, x + (rand() - 0.5) * 0.5, y + (rand() - 0.5) * 0.5, 0.14, 0.9, 0.6);
    }
    // The plaza: grout, then cobbles with a lit top edge and a shaded foot, a curb all round.
    const plaza = cells((c) => c === 'p');
    for (const [x, y] of plaza) {
      ctx.fillStyle = PALETTE.plazaEdge;
      diamond(x, y, 1.14);
      ctx.fill();
    }
    for (const [x, y] of plaza) {
      ctx.fillStyle = PALETTE.grout;
      diamond(x, y, 1.02);
      ctx.fill();
    }
    // Mostly the same worn stone, a darker or paler one here and there.
    const stones = [
      PALETTE.cobble,
      PALETTE.cobble,
      PALETTE.cobble,
      PALETTE.plaza,
      PALETTE.cobbleLight,
      PALETTE.cobbleDark,
    ];
    for (const [x, y] of plaza) {
      const curb = (dx: number, dy: number) => code(x + dx, y + dy) !== 'p';
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          // Running bond: every other row shifted by half a stone.
          const u = x - 1 / 3 + i / 3 + (j % 2 ? 1 / 6 : 0) + (rand() - 0.5) * 0.03;
          const v = y - 1 / 3 + j / 3 + (rand() - 0.5) * 0.03;
          if (u > x + 0.5) continue;
          const p = cellToWorld(u, v);
          const rx = 17 + rand() * 2;
          const ry = 8.6 + rand() * 1;
          ctx.fillStyle = 'rgba(40,34,28,0.3)';
          ctx.beginPath();
          ctx.ellipse(p.x + 1.5, p.y + 2, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = stones[Math.floor(rand() * stones.length)]!;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.beginPath();
          ctx.ellipse(p.x - 3, p.y - 2.5, rx * 0.6, ry * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      // Curb stones on the plaza's outer edges.
      for (const [dx, dy, ax, ay, bx, by] of [
        [1, 0, 0.5, -0.5, 0.5, 0.5],
        [-1, 0, -0.5, -0.5, -0.5, 0.5],
        [0, 1, -0.5, 0.5, 0.5, 0.5],
        [0, -1, -0.5, -0.5, 0.5, -0.5],
      ] as const) {
        if (!curb(dx, dy)) continue;
        const a = cellToWorld(x + ax, y + ay);
        const b = cellToWorld(x + bx, y + by);
        ctx.strokeStyle = PALETTE.curb;
        ctx.lineWidth = 9;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 3);
        ctx.lineTo(b.x, b.y - 3);
        ctx.stroke();
      }
    }

    // 8. Railway: gravel bed, sleepers and rails along the line.
    const rail = cells((c) => c === 't');
    for (const [x, y] of rail) stamp(PALETTE.rail, x, y, 1.3, 0.7);
    for (const [x, y] of rail) {
      const alongY = code(x, y - 1) === 't' || code(x, y + 1) === 't';
      for (let i = -1; i <= 1; i++) {
        const a = alongY
          ? cellToWorld(x - 0.35, y + i * 0.33)
          : cellToWorld(x + i * 0.33, y - 0.35);
        const b = alongY
          ? cellToWorld(x + 0.35, y + i * 0.33)
          : cellToWorld(x + i * 0.33, y + 0.35);
        ctx.strokeStyle = PALETTE.tie;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const off of [-0.2, 0.2]) {
        const a = alongY ? cellToWorld(x + off, y - 0.5) : cellToWorld(x - 0.5, y + off);
        const b = alongY ? cellToWorld(x + off, y + 0.5) : cellToWorld(x + 0.5, y + off);
        ctx.strokeStyle = PALETTE.steel;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // 9. Bridges: planks over the water.
    for (const [x, y] of cells((c) => c === 'b')) {
      ctx.fillStyle = PALETTE.plankDark;
      diamond(x, y, 1.08);
      ctx.fill();
      ctx.fillStyle = PALETTE.plank;
      diamond(x, y, 0.92);
      ctx.fill();
    }

    // 10. Grass details last, only on open grass: clumps of blades in two greens (dark roots,
    //     sunlit tips), clover, a few flowers and stones; grass leans over path and earth edges.
    const blade = (px: number, py: number, h: number, lean: number) => {
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + lean * 0.5, py - h * 0.6, px + lean, py - h);
    };
    for (const [x, y] of cells((c) => c === 'g' || c === 'f')) {
      const clumps = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < clumps; k++) {
        const p = cellToWorld(x + (rand() - 0.5) * 0.9, y + (rand() - 0.5) * 0.9);
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = PALETTE.tuft;
        ctx.beginPath();
        for (let i = 0; i < 4; i++)
          blade(p.x - 5 + i * 3.4, p.y + 2, 7 + rand() * 6, (rand() - 0.5) * 7);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = PALETTE.tuftLight;
        ctx.beginPath();
        for (let i = 0; i < 3; i++)
          blade(p.x - 3 + i * 3.4, p.y - 1, 6 + rand() * 4, (rand() - 0.5) * 6);
        ctx.stroke();
      }
      if (rand() < 0.08) {
        // A patch of clover.
        const p = cellToWorld(x + (rand() - 0.5) * 0.6, y + (rand() - 0.5) * 0.6);
        ctx.fillStyle = PALETTE.grassDark;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.ellipse(
            p.x + (rand() - 0.5) * 22,
            p.y + (rand() - 0.5) * 10,
            4,
            2.4,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      if (rand() < 0.05) this.pebbles(ctx, x, y, 1, PALETTE, rand);
      if (code(x, y) === 'g' && rand() < 0.05) {
        const p = cellToWorld(x + (rand() - 0.5) * 0.7, y + (rand() - 0.5) * 0.7);
        ctx.fillStyle = ['#FFFFFF', '#FFE45C', '#FF8FB1', '#B48CFF'][Math.floor(rand() * 4)]!;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(i * 1.6) * 5, p.y + Math.sin(i * 1.6) * 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Edges: blades lean out over neighbouring earth and paths.
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const n = code(x + dx, y + dy);
        if (n !== 'r' && n !== 'd') continue;
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = rand() < 0.5 ? PALETTE.tuft : PALETTE.grassDark;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const t = (i + rand() * 0.5) / 6 - 0.5;
          const e = cellToWorld(
            x + dx * 0.48 + (dy !== 0 ? t : 0),
            y + dy * 0.48 + (dx !== 0 ? t : 0),
          );
          const out = cellToWorld(x + dx * 0.62, y + dy * 0.62);
          const centre = cellToWorld(x, y);
          blade(e.x, e.y + 2, 6 + rand() * 5, (out.x - centre.x) * 0.12);
        }
        ctx.stroke();
      }
    }

    if (input.relief) {
      this.paintValleyLight(ctx, template, input.relief, code);
      this.paintRelief(ctx, input.relief, code, PALETTE, rand);
    }

    return this.upload(canvas, ox, oy);
  }

  /** Slices the painted canvas into GPU-friendly tiles and places them in the world. */
  private upload(canvas: HTMLCanvasElement, ox: number, oy: number): Phaser.GameObjects.Image[] {
    const k = this.k;
    this.destroy();
    const cols = Math.ceil(canvas.width / MAX_TILE);
    const rows = Math.ceil(canvas.height / MAX_TILE);
    const stampKey = `ground_${Date.now().toString(36)}`;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        // Each tile overlaps its neighbours by a couple of pixels: no seams when filtered.
        const sx = Math.max(0, c * MAX_TILE - 2);
        const sy = Math.max(0, r * MAX_TILE - 2);
        const w = Math.min(MAX_TILE + 4, canvas.width - sx);
        const h = Math.min(MAX_TILE + 4, canvas.height - sy);
        const key = `${stampKey}_${r}_${c}`;
        const tex = this.scene.textures.createCanvas(key, w, h)!;
        tex.getContext().drawImage(canvas, sx, sy, w, h, 0, 0, w, h);
        tex.refresh();
        this.keys.push(key);
        this.images.push(
          this.scene.add
            .image(ox + sx / k, oy + sy / k, key)
            .setOrigin(0, 0)
            .setScale(1 / k)
            .setDepth(-10000),
        );
      }
    return this.images;
  }

  /**
   * The ground as a low-poly diorama (DECISIONS I-80): every cell is four flat triangles, each
   * with one colour lit by the sun from its own slant (the same light as the models), so the
   * floor, the hills and the cliffs read like one more Kenney piece. Borders between grass,
   * earth and scree follow the triangles (crisp, a little irregular); paths, plaza, rails and
   * bridges are drawn on top with hard edges and flat colours. No blur anywhere.
   */
  private paintLowPoly(
    ctx: CanvasRenderingContext2D,
    template: DistrictTemplate,
    relief: Relief | undefined,
    code: (x: number, y: number) => TerrainCode | null,
    P: GroundPalette,
  ): void {
    const W = template.width;
    const H = template.height;
    const B = 10; // facets beyond the edge, under the mist
    const seed = 23;
    const hash = (x: number, y: number, k: number) => {
      const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const height = (u: number, v: number) =>
      relief && inside(Math.round(u), Math.round(v)) ? relief.at(u, v) : 0;
    // Shading-only swell: the floor stays flat for the rules, the light makes it roll.
    const swell = (u: number, v: number) => fbm(u * 0.11 + 50, v * 0.11 + 50, seed) * 2.2;
    const col = (hex: string) => rgb(hex);
    const C = {
      grass: col(P.grass),
      grass2: col(P.grassLight),
      forest: col(P.forest),
      beyond: col(P.beyond),
      dirt: col(P.dirt),
      dirt2: col(P.dirtLight),
      coal: col(P.coal),
      scree: col(P.scree),
      sand: col(P.shore),
      water: col(P.water),
      deep: col(P.waterDeep),
      rock: col('#8C857A'),
      rock2: col('#7A7368'),
      moss: col('#5E9A3F'),
      field: col('#8B6A43'),
    };
    const isWater = (c: TerrainCode | null) => c === 'w' || c === 'b';
    const nearWay = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const c = code(x + dx, y + dy);
          if (c === 'r' || c === 'p' || c === 't') return true;
        }
      return false;
    };
    // What a triangle shows: its cell, or (on soft borders) now and then its neighbour.
    const surface = (
      x: number,
      y: number,
      nx: number,
      ny: number,
      t: number,
    ): TerrainCode | 'x' => {
      const own = inside(x, y) ? code(x, y) : null;
      if (!own) return 'x';
      const other = inside(nx, ny) ? code(nx, ny) : null;
      const soft = 'gfds';
      if (
        other &&
        other !== own &&
        soft.includes(own) &&
        soft.includes(other) &&
        hash(x, y, t) < 0.3
      )
        return other;
      // Away from paths and the plaza, grass takes the bare earth back in patches.
      if (own === 'd' && !nearWay(x, y) && fbm(x * 0.21, y * 0.21, 41) > 0.5) return 'g';
      return own;
    };
    type V = [number, number];
    const tri = (
      a: V,
      b: V,
      c: V,
      fill: [number, number, number],
      lit: boolean,
      flatH: boolean,
    ) => {
      const z = (p: V) => height(p[0], p[1]);
      const sz = (p: V) => z(p) + (flatH ? swell(p[0], p[1]) : swell(p[0], p[1]) * 0.25);
      // Normal of the shading surface.
      const ax = b[0] - a[0],
        ay = b[1] - a[1],
        az = sz(b) - sz(a);
      const bx = c[0] - a[0],
        by = c[1] - a[1],
        bz = sz(c) - sz(a);
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      if (nz < 0) [nx, ny, nz] = [-nx, -ny, -nz];
      const nl = Math.hypot(nx, ny, nz) || 1;
      const lambert = (nx * SUN.x + ny * SUN.y + nz * SUN.z) / nl;
      let f = lit ? 0.5 + 0.56 * lambert : 1;
      const mx = (a[0] + b[0] + c[0]) / 3;
      const my = (a[1] + b[1] + c[1]) / 3;
      if (relief && lit) f *= 1 - relief.occlusion(mx, my) * 0.28;
      f *= 0.985 + hash(mx * 3.1, my * 2.7, 5) * 0.03;
      const r = Math.min(255, Math.round(fill[0] * f));
      const g = Math.min(255, Math.round(fill[1] * f));
      const bl = Math.min(255, Math.round(fill[2] * f));
      const style = `rgb(${r},${g},${bl})`;
      ctx.fillStyle = style;
      ctx.strokeStyle = style;
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const pa = cellToWorld(a[0], a[1], z(a));
      const pb = cellToWorld(b[0], b[1], z(b));
      const pc = cellToWorld(c[0], c[1], z(c));
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.lineTo(pc.x, pc.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    // Back to front, so raised facets cover what lies behind them.
    for (let s = -2 * B; s <= W + H + 2 * B; s++)
      for (let x = -B; x < W + B; x++) {
        const y = s - x;
        if (y < -B || y >= H + B) continue;
        const ctr: V = [x, y];
        const nw: V = [x - 0.5, y - 0.5];
        const ne: V = [x + 0.5, y - 0.5];
        const se: V = [x + 0.5, y + 0.5];
        const sw: V = [x - 0.5, y + 0.5];
        const parts: [V, V, number, number, number][] = [
          [nw, ne, 0, -1, 1],
          [sw, nw, -1, 0, 2],
          [ne, se, 1, 0, 3],
          [se, sw, 0, 1, 4],
        ];
        for (const [p, q, dx, dy, t] of parts) {
          const kind = surface(x, y, x + dx, y + dy, t);
          // Broad patches of a second shade (not a per-triangle checkerboard).
          const tone = fbm(x * 0.22 + 7, y * 0.22, seed + 3) < 0.52;
          const raised = !!relief && inside(x, y) && !relief.flat(x, y);
          let fill: [number, number, number];
          let lit = true;
          if (kind === 'x') fill = tone ? C.beyond : mix(C.beyond, C.forest, 0.35);
          else if (isWater(kind)) {
            const open = [-1, 0, 1].every((oy) =>
              [-1, 0, 1].every((ox) => isWater(code(x + ox, y + oy))),
            );
            fill = open ? C.deep : C.water;
            lit = false;
          } else if (kind === 'R' && raised) {
            const z0 = height(x, y);
            const n = relief!.normal(x + dx * 0.25, y + dy * 0.25);
            if (1 - n.z > 0.3)
              fill = Math.floor(z0 * 1.6 + hash(x, y, 1) * 0.6) % 2 ? C.rock : C.rock2;
            else fill = tone ? C.moss : mix(C.moss, C.forest, 0.5);
          } else if (kind === 'f') fill = tone ? C.forest : mix(C.forest, C.grass, 0.3);
          else if (kind === 'g') {
            // Beaches: a crisp band of sand along the water.
            if (isWater(code(x + dx, y + dy))) fill = C.sand;
            else fill = tone ? C.grass : C.grass2;
          } else if (kind === 's') fill = tone ? C.scree : mix(C.scree, C.dirt, 0.25);
          else if (kind === 'v')
            // Coal-dusted ground with darker seams, not a black hole.
            fill = hash(x, y, t + 3) < 0.35 ? C.coal : mix(C.coal, C.scree, 0.45);
          else if (kind === 'c') fill = C.field;
          else fill = tone ? C.dirt : C.dirt2; // earth under paths, plaza, rails and around houses
          tri(ctr, p, q, fill, lit, !raised);
        }
      }

    // Water: a few crisp white wave marks.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (code(x, y) !== 'w' || hash(x, y, 31) > 0.22) continue;
        const p = cellToWorld(x + (hash(x, y, 32) - 0.5) * 0.5, y + (hash(x, y, 33) - 0.5) * 0.5);
        ctx.beginPath();
        ctx.moveTo(p.x - 14, p.y);
        ctx.lineTo(p.x - 4, p.y - 4);
        ctx.lineTo(p.x + 6, p.y);
        ctx.lineTo(p.x + 14, p.y - 3);
        ctx.stroke();
      }

    // Fields: furrows.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (code(x, y) !== 'c') continue;
        for (let i = -1; i <= 1; i++) {
          const a = cellToWorld(x - 0.45, y + i * 0.3);
          const b = cellToWorld(x + 0.45, y + i * 0.3);
          ctx.strokeStyle = '#6E5233';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

    // Paths: hard-edged ribbons (diagonal steps joined too), a darker rim, flat colours.
    const isWay = (x: number, y: number) => {
      const c = code(x, y);
      return c === 'r' || c === 'p' || c === 'b';
    };
    const links: [number, number, number, number][] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (code(x, y) !== 'r') continue;
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, -1],
        ] as const) {
          if (!isWay(x + dx, y + dy)) continue;
          // A diagonal only where no straight step already joins the two cells.
          if (dx !== 0 && dy !== 0 && (isWay(x + dx, y) || isWay(x, y + dy))) continue;
          links.push([x, y, x + dx, y + dy]);
        }
      }
    const ribbon = (colour: string, width: number) => {
      ctx.strokeStyle = colour;
      ctx.fillStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const [x0, y0, x1, y1] of links) {
        const a = cellToWorld(x0, y0);
        const b = cellToWorld(x1, y1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (code(x, y) !== 'r') continue;
          const p = cellToWorld(x, y);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, width / 2, width / 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
    };
    ribbon(P.pathEdge, 60);
    ribbon(P.path, 46);

    // The plaza: square stones in two tones with thin grout, and a curb.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (code(x, y) !== 'p') continue;
        const corner = (u: number, v: number) => cellToWorld(u, v);
        const quad = (u0: number, v0: number, u1: number, v1: number, fill: string) => {
          const a = corner(u0, v0);
          const b = corner(u1, v0);
          const c = corner(u1, v1);
          const d = corner(u0, v1);
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.lineTo(d.x, d.y);
          ctx.closePath();
          ctx.fill();
        };
        quad(x - 0.5, y - 0.5, x + 0.5, y + 0.5, P.grout);
        const n = 3;
        const g = 0.025;
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            const u0 = x - 0.5 + i / n + g;
            const v0 = y - 0.5 + j / n + g;
            const tone = hash(x * n + i, y * n + j, 7);
            quad(
              u0,
              v0,
              u0 + 1 / n - 2 * g,
              v0 + 1 / n - 2 * g,
              tone < 0.55 ? P.cobble : tone < 0.85 ? P.cobbleLight : P.cobbleDark,
            );
          }
        for (const [dx, dy, ax, ay, bx, by] of [
          [1, 0, 0.5, -0.5, 0.5, 0.5],
          [-1, 0, -0.5, -0.5, -0.5, 0.5],
          [0, 1, -0.5, 0.5, 0.5, 0.5],
          [0, -1, -0.5, -0.5, 0.5, -0.5],
        ] as const) {
          if (code(x + dx, y + dy) === 'p') continue;
          const a = cellToWorld(x + ax, y + ay);
          const b = cellToWorld(x + bx, y + by);
          ctx.strokeStyle = P.curb;
          ctx.lineWidth = 8;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

    // Railway: ballast, sleepers, rails.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (code(x, y) !== 't') continue;
        const alongY = code(x, y - 1) === 't' || code(x, y + 1) === 't';
        const a = alongY ? cellToWorld(x - 0.42, y - 0.5) : cellToWorld(x - 0.5, y - 0.42);
        const b = alongY ? cellToWorld(x + 0.42, y - 0.5) : cellToWorld(x - 0.5, y + 0.42);
        const c = alongY ? cellToWorld(x + 0.42, y + 0.5) : cellToWorld(x + 0.5, y + 0.42);
        const d = alongY ? cellToWorld(x - 0.42, y + 0.5) : cellToWorld(x + 0.5, y - 0.42);
        ctx.fillStyle = P.rail;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
        for (let i = -1; i <= 1; i++) {
          const s0 = alongY
            ? cellToWorld(x - 0.35, y + i * 0.33)
            : cellToWorld(x + i * 0.33, y - 0.35);
          const s1 = alongY
            ? cellToWorld(x + 0.35, y + i * 0.33)
            : cellToWorld(x + i * 0.33, y + 0.35);
          ctx.strokeStyle = P.tie;
          ctx.lineWidth = 9;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.moveTo(s0.x, s0.y);
          ctx.lineTo(s1.x, s1.y);
          ctx.stroke();
        }
        for (const off of [-0.2, 0.2]) {
          const r0 = alongY ? cellToWorld(x + off, y - 0.5) : cellToWorld(x - 0.5, y + off);
          const r1 = alongY ? cellToWorld(x + off, y + 0.5) : cellToWorld(x + 0.5, y + off);
          ctx.strokeStyle = P.steel;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(r0.x, r0.y);
          ctx.lineTo(r1.x, r1.y);
          ctx.stroke();
        }
      }

    // Bridges: planks over the water.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (code(x, y) !== 'b') continue;
        const p = cellToWorld(x, y);
        for (const [grow, fill] of [
          [1.08, P.plankDark],
          [0.92, P.plank],
        ] as const) {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - (TILE_H / 2) * grow);
          ctx.lineTo(p.x + (TILE_W / 2) * grow, p.y);
          ctx.lineTo(p.x, p.y + (TILE_H / 2) * grow);
          ctx.lineTo(p.x - (TILE_W / 2) * grow, p.y);
          ctx.closePath();
          ctx.fill();
        }
      }
  }

  /** A few loose stones around a cell, each with its little shadow. */
  private pebbles(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    n: number,
    P: GroundPalette,
    rand: () => number,
  ): void {
    for (let i = 0; i < n; i++) {
      if (rand() < 0.4) continue;
      const p = cellToWorld(x + (rand() - 0.5) * 0.9, y + (rand() - 0.5) * 0.9);
      const r = 2.5 + rand() * 3.5;
      ctx.fillStyle = 'rgba(30,24,18,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x + 1.2, p.y + 1.4, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.pebble;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.3, p.y - r * 0.2, r * 0.45, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A thin dry crack in the earth. */
  private crack(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colour: string,
    rand: () => number,
  ): void {
    let p = cellToWorld(x + (rand() - 0.5) * 0.6, y + (rand() - 0.5) * 0.6);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    for (let i = 0; i < 4; i++) {
      p = { x: p.x + (rand() - 0.3) * 16, y: p.y + (rand() - 0.5) * 7 };
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  /**
   * Light on the town floor (flat cells): gentle undulations catch the sun or fall into soft
   * shade so the valley reads as land, not a table top; the cliffs cast their shadows and darken
   * the ground at their feet. Computed on a grid image (4 px per cell) and laid down with the
   * isometric transform, so it is smooth at any zoom.
   */
  private paintValleyLight(
    ctx: CanvasRenderingContext2D,
    template: DistrictTemplate,
    relief: Relief,
    code: (x: number, y: number) => TerrainCode | null,
  ): void {
    const K = 4;
    const W = template.width;
    const H = template.height;
    const dark = document.createElement('canvas');
    const light = document.createElement('canvas');
    dark.width = light.width = W * K;
    dark.height = light.height = H * K;
    const dctx = dark.getContext('2d')!;
    const lctx = light.getContext('2d')!;
    const dimg = dctx.createImageData(W * K, H * K);
    const limg = lctx.createImageData(W * K, H * K);
    const seed = template.id.length * 31 + 9;
    const flatLambert = SUN.z;
    for (let py = 0; py < H * K; py++)
      for (let px = 0; px < W * K; px++) {
        const u = (px + 0.5) / K - 0.5;
        const v = (py + 0.5) / K - 0.5;
        const cx = Math.round(u);
        const cy = Math.round(v);
        if (!relief.flat(Math.min(W - 1, Math.max(0, cx)), Math.min(H - 1, Math.max(0, cy))))
          continue;
        const c = code(cx, cy);
        // Soft land waves: strong on grass and fields, faint on earth and stone.
        const amp = c === 'g' || c === 'f' || c === 'c' ? 2.4 : c === 'd' || c === 's' ? 1.1 : 0.4;
        const e = 0.5;
        const hx =
          (fbm((u + e) * 0.11, v * 0.11, seed) - fbm((u - e) * 0.11, v * 0.11, seed)) / (2 * e);
        const hy =
          (fbm(u * 0.11, (v + e) * 0.11, seed) - fbm(u * 0.11, (v - e) * 0.11, seed)) / (2 * e);
        const nx = -hx * amp;
        const ny = -hy * amp;
        const nn = Math.hypot(nx, ny, 1);
        const lambert = (nx * SUN.x + ny * SUN.y + SUN.z) / nn;
        const delta = (lambert - flatLambert) * 6;
        let shade = Math.max(0, -delta) * 0.5;
        const glow = Math.max(0, delta) * 0.42;
        if (relief.peak > 0) {
          if (!relief.sunlit(u, v, 0)) shade += 0.34;
          shade += relief.occlusion(u, v) * 0.35;
        }
        const i = (py * W * K + px) * 4;
        dimg.data[i] = 22;
        dimg.data[i + 1] = 30;
        dimg.data[i + 2] = 52;
        dimg.data[i + 3] = Math.min(165, shade * 255);
        limg.data[i] = 255;
        limg.data[i + 1] = 241;
        limg.data[i + 2] = 205;
        limg.data[i + 3] = Math.min(105, glow * 255);
      }
    dctx.putImageData(dimg, 0, 0);
    lctx.putImageData(limg, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    // Grid pixel (px, py) → world: x = (u − v)·TILE_W/2, y = (u + v)·TILE_H/2.
    ctx.transform(TILE_W / 2 / K, TILE_H / 2 / K, -TILE_W / 2 / K, TILE_H / 2 / K, 0, -TILE_H / 2);
    ctx.drawImage(dark, 0, 0);
    ctx.drawImage(light, 0, 0);
    ctx.restore();
  }

  /**
   * Cliffs and hills in relief, back to front: each cell split in 3×3 facets on the smooth
   * surface, coloured by what grows there and how steep it is (rock bands on the cliff faces,
   * moss and grass on the tops), lit by the same sun as the buildings, with cast shadows and
   * darker hollows.
   */
  private paintRelief(
    ctx: CanvasRenderingContext2D,
    relief: Relief,
    code: (x: number, y: number) => TerrainCode | null,
    P: GroundPalette,
    rand: () => number,
  ): void {
    const N = 4;
    const W = relief.width;
    const H = relief.height;
    const facets: { u: number; v: number; s: number }[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (relief.flat(x, y)) continue;
        for (let j = 0; j < N; j++)
          for (let i = 0; i < N; i++) {
            const u = x - 0.5 + i / N;
            const v = y - 0.5 + j / N;
            facets.push({ u, v, s: u + v });
          }
      }
    facets.sort((a, b) => a.s - b.s || a.u - b.u);
    const rockA = rgb('#8F877B');
    const rockB = rgb('#766F65');
    const rockC = rgb('#A39B8D');
    const moss = rgb('#5C9440');
    const mossDark = rgb('#4A7D34');
    const forest = rgb(P.forest);
    const grass = rgb(P.grass);
    const scree = rgb(P.scree);
    const shadowTint = rgb('#3B4766');
    const seed = 17;
    const d = 1 / N;
    const tufts: { x: number; y: number; dark: boolean }[] = [];
    for (const f of facets) {
      const corners = [
        [f.u, f.v],
        [f.u + d, f.v],
        [f.u + d, f.v + d],
        [f.u, f.v + d],
      ] as const;
      const mu = f.u + d / 2;
      const mv = f.v + d / 2;
      const h = relief.at(mu, mv);
      const n = relief.normal(mu, mv);
      const steep = 1 - n.z;
      const c = code(Math.round(mu), Math.round(mv));
      const grain = fbm(mu * 0.7, mv * 0.7, seed);
      const patch = fbm(mu * 0.25, mv * 0.25, seed + 3);
      const smooth = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      // Tops: moss and grass with bare stone patches; faces: banded rock. Blended, never cut.
      let top: [number, number, number];
      if (c === 'R')
        top = mix(
          mix(mossDark, moss, smooth(0.25, 0.75, grain)),
          rockC,
          smooth(0.6, 0.78, patch) * 0.7,
        );
      else if (c === 'f') top = mix(forest, grass, grain * 0.5);
      else if (c === 's') top = scree;
      else top = grass;
      const band = 0.5 + 0.5 * Math.sin(h * 4.4 + grain * 3.5);
      const face = mix(mix(rockB, rockC, band), rockA, smooth(0.4, 0.8, patch) * 0.5);
      const base = mix(top, face, c === 'R' ? smooth(0.18, 0.4, steep) : 0);
      const lambert = Math.max(0, n.x * SUN.x + n.y * SUN.y + n.z * SUN.z);
      let lightness = 0.52 + 0.62 * lambert;
      // Soft shadow edges: the sun is tested from three nearby points.
      const sun =
        (relief.sunlit(mu, mv, h) +
          relief.sunlit(mu + 0.12, mv - 0.08, h) +
          relief.sunlit(mu - 0.1, mv + 0.1, h)) /
        3;
      lightness = lightness * (0.62 + 0.38 * sun) + 0.04 * (1 - sun);
      lightness *= 1 - relief.occlusion(mu, mv) * 0.3;
      const cool = (1 - Math.min(1, lightness)) * 0.35;
      const col = mix(base, shadowTint, cool).map((ch) =>
        Math.max(0, Math.min(255, Math.round(ch * lightness))),
      );
      const fill = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.fillStyle = fill;
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      corners.forEach(([cu, cv], k) => {
        const p = cellToWorld(cu, cv, relief.at(cu, cv));
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (steep < 0.25 && (c === 'R' || c === 'f') && rand() < 0.16)
        tufts.push({ x: mu + (rand() - 0.5) * d, y: mv + (rand() - 0.5) * d, dark: sun < 0.5 });
      // Strata: short lines along the cliff (following its contour), dark seams with a lit lip.
      if (c === 'R' && steep > 0.3 && rand() < 0.3) {
        const tx = -n.y;
        const ty = n.x;
        const len = Math.hypot(tx, ty) || 1;
        const k = (0.18 + rand() * 0.2) / len;
        const a = cellToWorld(mu - tx * k, mv - ty * k, h);
        const b = cellToWorld(mu + tx * k, mv + ty * k, h);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(40,36,32,0.38)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,250,240,${0.1 + sun * 0.18})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 2.5);
        ctx.lineTo(b.x, b.y - 2.5);
        ctx.stroke();
      }
      // Loose stones on the cliffs.
      if (c === 'R' && steep > 0.32 && rand() < 0.08) {
        const p = cellToWorld(mu, mv, h);
        ctx.fillStyle = `rgba(255,255,255,${0.12 + sun * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5 + rand() * 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Grass on the tops, after the facets so nothing covers it.
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const t of tufts) {
      const p = cellToWorld(t.x, t.y, relief.at(t.x, t.y));
      ctx.strokeStyle = t.dark ? '#3E6B2C' : P.tuft;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y - 6);
      ctx.lineTo(p.x - 2, p.y + 2);
      ctx.lineTo(p.x + 1, p.y - 8);
      ctx.lineTo(p.x + 4, p.y + 2);
      ctx.lineTo(p.x + 8, p.y - 5);
      ctx.stroke();
    }
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    for (const key of this.keys) this.scene.textures.remove(key);
    this.images = [];
    this.keys = [];
  }
}

/**
 * Volumetric mist beyond the playable diamond (DECISIONS I-61, I-67): hundreds of soft cloud
 * puffs — a cool shadow underneath, a bright crown on top — thicker the further from the land,
 * in two layers that drift slowly against each other. Painted once at low resolution.
 */
export function paintFog(scene: Phaser.Scene, template: DistrictTemplate): void {
  const k = 0.22;
  const bounds = mapBounds(template.width, template.height);
  const m = 1600;
  const ox = bounds.x - m;
  const oy = bounds.y - m;
  const w = bounds.width + m * 2;
  const h = bounds.height + m * 2;
  // Distance (in cells) outside the playable area of a world point; ≤ 0 inside.
  const outside = (wx: number, wy: number) => {
    const a = wx / (TILE_W / 2);
    const b = wy / (TILE_H / 2);
    const cx = (a + b) / 2;
    const cy = (b - a) / 2;
    const inset = 2.5;
    const lo = inset;
    const hi = template.width - 1 - inset;
    return Math.max(lo - cx, cx - hi, lo - cy, cy - hi);
  };
  const layer = (seed: number, density: number): string => {
    const rand = mulberry32(hashString(template.id) + seed);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * k);
    canvas.height = Math.ceil(h * k);
    const ctx = canvas.getContext('2d')!;
    const puff = (x: number, y: number, r: number, colour: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, colour);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const n = Math.round(1400 * density);
    for (let i = 0; i < n; i++) {
      const wx = ox + rand() * w;
      const wy = oy + rand() * h;
      const d = outside(wx, wy);
      if (d < -1.5) continue;
      const thick = Math.min(1, (d + 1.5) / 7);
      if (rand() > 0.25 + thick) continue;
      const x = (wx - ox) * k;
      const y = (wy - oy) * k;
      const r = (90 + rand() * 170) * k * (0.7 + thick);
      puff(x + r * 0.18, y + r * 0.16, r, 'rgba(150,170,190,1)', 0.22 + thick * 0.25);
      puff(x, y, r, 'rgba(236,241,246,1)', 0.35 + thick * 0.45);
      puff(x - r * 0.22, y - r * 0.2, r * 0.6, 'rgba(255,255,255,1)', 0.3 + thick * 0.3);
    }
    // Far away it is all mist.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(214,224,233,1)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    const pts = [
      cellToWorld(-6, -6),
      cellToWorld(template.width + 5, -6),
      cellToWorld(template.width + 5, template.height + 5),
      cellToWorld(-6, template.height + 5),
    ].map((p) => [(p.x - ox) * k, (p.y - oy) * k] as const);
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (const [px, py] of pts.slice(1).reverse()) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill('evenodd');
    const key = `fog_${template.id}_${seed}_${Date.now().toString(36)}`;
    const tex = scene.textures.createCanvas(key, canvas.width, canvas.height)!;
    tex.getContext().drawImage(canvas, 0, 0);
    tex.refresh();
    return key;
  };
  const back = scene.add
    .image(ox, oy, layer(1, 1))
    .setOrigin(0, 0)
    .setScale(1 / k)
    .setDepth(60000);
  const front = scene.add
    .image(ox, oy, layer(2, 0.55))
    .setOrigin(0, 0)
    .setScale(1 / k)
    .setDepth(60001)
    .setAlpha(0.85);
  scene.tweens.add({
    targets: back,
    x: ox + 60,
    y: oy + 20,
    duration: 16000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: front,
    x: ox - 90,
    y: oy - 25,
    alpha: { from: 0.7, to: 0.95 },
    duration: 11000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
