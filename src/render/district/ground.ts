import type * as Phaser from 'phaser';
import type { DistrictTemplate, TerrainCode } from '../../core/district/template.ts';
import { terrainAt } from '../../core/district/template.ts';
import { TILE_H, TILE_W, cellToWorld, mapBounds } from '../iso/projection.ts';

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

const PALETTE = {
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
  field: '#C8B14E',
  fieldRow: '#9F8A34',
  fieldLight: '#E3CF6A',
  path: '#F3E2B8',
  pathEdge: '#C9A46A',
  plaza: '#CFC6B3',
  plazaEdge: '#958B78',
  cobble: '#DED6C6',
  cobbleDark: '#C7BDAA',
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

    // 4. Bare earth around the houses.
    const dirt = cells((c) => c === 'd' || c === 'v');
    for (const [x, y] of dirt) stamp(PALETTE.dirtEdge, x, y, 1.75, 0.55, 0.9);
    for (const [x, y] of dirt) stamp(PALETTE.dirt, x, y, 1.45, 0.6);

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
    const rock = cells((c) => c === 'R');
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
    for (const [x, y] of cells((c) => c === 'v')) {
      stamp(PALETTE.coal, x, y, 1.2, 0.7);
      if (rand() < 0.6) stamp(PALETTE.coalShine, x - 0.15, y - 0.15, 0.35, 0.8, 0.8);
    }

    // 7. Paths (template roads + roads laid in play) and the cobbled plaza.
    const path = cells((c) => c === 'r');
    const isPath = (x: number, y: number) => {
      const c = code(x, y);
      return c === 'r' || c === 'p' || c === 'b';
    };
    // Continuous ribbons between neighbouring path cells, then soft blobs at every cell.
    const ribbon = (color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [x, y] of path) {
        const a = cellToWorld(x, y);
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ] as const) {
          if (!isPath(x + dx, y + dy)) continue;
          const b = cellToWorld(x + dx, y + dy);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }
      ctx.stroke();
    };
    ribbon(PALETTE.pathEdge, 58);
    for (const [x, y] of path) stamp(PALETTE.pathEdge, x, y, 1.0, 0.7);
    ribbon(PALETTE.path, 42);
    for (const [x, y] of path) stamp(PALETTE.path, x, y, 0.8, 0.75);
    for (const [x, y] of path)
      if (rand() < 0.5)
        stamp(PALETTE.pathEdge, x + (rand() - 0.5) * 0.5, y + (rand() - 0.5) * 0.5, 0.12, 0.9, 0.7);
    const plaza = cells((c) => c === 'p');
    for (const [x, y] of plaza) {
      ctx.fillStyle = PALETTE.plazaEdge;
      diamond(x, y, 1.12);
      ctx.fill();
    }
    for (const [x, y] of plaza) {
      ctx.fillStyle = PALETTE.plaza;
      diamond(x, y, 1);
      ctx.fill();
      // Irregular rounded cobbles, each a slightly different stone.
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const p = cellToWorld(
            x - 0.375 + i * 0.25 + (rand() - 0.5) * 0.06,
            y - 0.375 + j * 0.25 + (rand() - 0.5) * 0.06,
          );
          const shade = rand();
          ctx.fillStyle = shade < 0.3 ? PALETTE.cobbleDark : PALETTE.cobble;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 13 + rand() * 3, 6.5 + rand() * 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
          if (shade > 0.6) {
            ctx.fillStyle = '#FFFFFF55';
            ctx.beginPath();
            ctx.ellipse(p.x - 3, p.y - 2, 6, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
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

    // 10. Grass details last, only on open grass: tufts and a few flowers.
    for (const [x, y] of cells((c) => c === 'g' || c === 'f')) {
      for (let i = 0; i < 2; i++) {
        if (rand() > 0.55) continue;
        const p = cellToWorld(x + (rand() - 0.5) * 0.8, y + (rand() - 0.5) * 0.8);
        ctx.strokeStyle = rand() < 0.5 ? PALETTE.tuft : PALETTE.tuftLight;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y - 7);
        ctx.lineTo(p.x - 2, p.y + 2);
        ctx.lineTo(p.x + 1, p.y - 9);
        ctx.lineTo(p.x + 4, p.y + 2);
        ctx.lineTo(p.x + 8, p.y - 6);
        ctx.stroke();
      }
      if (code(x, y) === 'g' && rand() < 0.05) {
        const p = cellToWorld(x + (rand() - 0.5) * 0.7, y + (rand() - 0.5) * 0.7);
        ctx.fillStyle = ['#FFFFFF', '#FFE45C', '#FF8FB1', '#B48CFF'][Math.floor(rand() * 4)]!;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(i * 1.6) * 5, p.y + Math.sin(i * 1.6) * 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Slice into GPU-friendly tiles and place them in the world.
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

  destroy(): void {
    for (const img of this.images) img.destroy();
    for (const key of this.keys) this.scene.textures.remove(key);
    this.images = [];
    this.keys = [];
  }
}

/**
 * Mist beyond the playable diamond (DECISIONS I-61): a soft white veil that thickens outwards,
 * drawn once at low resolution above everything on the map, breathing slowly.
 */
export function paintFog(scene: Phaser.Scene, template: DistrictTemplate): void {
  const k = 0.2;
  const bounds = mapBounds(template.width, template.height);
  const m = 1400;
  const ox = bounds.x - m;
  const oy = bounds.y - m;
  const w = bounds.width + m * 2;
  const h = bounds.height + m * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * k);
  canvas.height = Math.ceil(h * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(226, 233, 238, 0.96)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-out';
  const inset = 2.5;
  const pts = [
    cellToWorld(inset, inset),
    cellToWorld(template.width - 1 - inset, inset),
    cellToWorld(template.width - 1 - inset, template.height - 1 - inset),
    cellToWorld(inset, template.height - 1 - inset),
  ].map((p) => [(p.x - ox) * k, (p.y - oy) * k] as const);
  // Several passes, each a little larger and fainter: a soft gradient into the mist.
  for (let i = 0; i < 14; i++) {
    const grow = 1 + i * 0.018;
    const cx = (pts[0]![0] + pts[2]![0]) / 2;
    const cy = (pts[0]![1] + pts[2]![1]) / 2;
    ctx.globalAlpha = i === 0 ? 1 : 0.13;
    ctx.beginPath();
    pts.forEach(([x, y], j) => {
      const px = cx + (x - cx) * grow;
      const py = cy + (y - cy) * grow;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
  }
  const key = `fog_${template.id}_${Date.now().toString(36)}`;
  const tex = scene.textures.createCanvas(key, canvas.width, canvas.height)!;
  tex.getContext().drawImage(canvas, 0, 0);
  tex.refresh();
  const img = scene.add
    .image(ox, oy, key)
    .setOrigin(0, 0)
    .setScale(1 / k)
    .setDepth(60000);
  scene.tweens.add({
    targets: img,
    alpha: { from: 0.88, to: 1 },
    duration: 4200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
