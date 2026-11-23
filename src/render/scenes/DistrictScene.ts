import * as Phaser from 'phaser';
import type { DistrictState, PlacedProp, PlacedStructure } from '../../core/index.ts';
import { buildWalkGrid } from '../../core/index.ts';
import { TEMPLATES } from '../../content/maps/index.ts';
import { Ambience } from '../district/ambience.ts';
import type { CharacterSheet } from '../district/townsfolk.ts';
import { Townsfolk } from '../district/townsfolk.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import type { GameSession } from '../../game/session.ts';
import { CameraController } from '../camera/cameraController.ts';
import type {
  HeightMap,
  SpriteAsset,
  SpriteManifest,
  TerrainManifest,
} from '../district/assets.ts';
import { ART_BASE, SMOKE_POINTS, pickTerrainScale } from '../district/assets.ts';
import { daylightAt } from '../district/daylight.ts';
import { TILE_H, TILE_W, cellToWorld, depthOf, mapBounds, pickCell } from '../iso/projection.ts';
import { PALETTE } from '../palette.ts';

export const DISTRICT_SCENE = 'district';
const MAP_SIZE = 48;

interface Glow {
  image: Phaser.GameObjects.Image;
  strength: number;
}

/**
 * District XII: pre-rendered terrain chunks + layered sprites (colour, ground shadow, additive
 * emission), day/night by tinting (cheap on mobile GPUs) plus additive glows for lamps and windows,
 * chimney smoke. Normal maps are shipped for a future high-end lighting preset.
 * Structures and props come from GameState.district (deterministic per seed).
 */
export class DistrictScene extends Phaser.Scene {
  private readonly session: GameSession;
  private controller?: CameraController;
  private hover?: Phaser.GameObjects.Graphics;
  private terrainScale: '1x' | '0.5x' = '1x';
  private heights: number[][] = [];
  private readonly shadows: Phaser.GameObjects.Image[] = [];
  private readonly emissive: Phaser.GameObjects.Image[] = [];
  private readonly glows: Glow[] = [];
  private readonly tinted: (Phaser.GameObjects.Image | Phaser.GameObjects.Image)[] = [];
  private lastAmbient = -1;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private townsfolk?: Townsfolk;
  private ambience?: Ambience;
  private built = false;

  constructor(session: GameSession) {
    super(DISTRICT_SCENE);
    this.session = session;
  }

  preload(): void {
    this.terrainScale = pickTerrainScale();
    this.load.json('terrainManifest', `${ART_BASE}/terrain/${this.terrainScale}/manifest.json`);
    this.load.json('spriteManifest', `${ART_BASE}/sprites/manifest.json`);
    this.load.json('heights', `${ART_BASE}/terrain/heights.json`);
    this.load.json('characterManifest', `${ART_BASE}/characters/manifest.json`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.coal);
    const terrain = this.cache.json.get('terrainManifest') as TerrainManifest;
    const sprites = this.cache.json.get('spriteManifest') as SpriteManifest;
    this.heights = (this.cache.json.get('heights') as HeightMap).heights;
    const district = this.session.getState().district;

    // Second loading pass: only the art this district actually uses.
    const base = `${ART_BASE}/terrain/${this.terrainScale}`;
    for (let r = 0; r < terrain.rows; r++) {
      for (let c = 0; c < terrain.cols; c++)
        this.load.image(`terrain_${r}_${c}`, `${base}/t_${r}_${c}.jpg`);
    }
    const characters = (
      this.cache.json.get('characterManifest') as { characters: Record<string, CharacterSheet> }
    ).characters;
    for (const sheet of Object.values(characters)) {
      this.load.spritesheet(`char_${sheet.name}`, `${ART_BASE}/characters/${sheet.name}.png`, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    const kinds = new Set<string>([
      ...district.structures.map((s) => this.spriteKey(s, sprites)),
      ...district.props.map((p) => p.kind),
    ]);
    for (const kind of kinds) {
      const asset = sprites.assets[kind];
      if (!asset) continue;
      const path = `${ART_BASE}/sprites/${kind}`;
      this.load.image(kind, `${path}.png`);
      if (asset.layers.includes('shadow')) this.load.image(`${kind}_s`, `${path}_s.png`);
      if (asset.layers.includes('emission')) this.load.image(`${kind}_e`, `${path}_e.png`);
    }
    const bar = this.add.graphics().setScrollFactor(0);
    this.load.on('progress', (p: number) => {
      const { width, height } = this.scale;
      bar
        .clear()
        .fillStyle(PALETTE.lampOchre, 1)
        .fillRect(width * 0.3, height / 2, width * 0.4 * p, 3);
    });
    this.load.once('complete', () => {
      bar.destroy();
      this.build(terrain, sprites, district);
    });
    this.load.start();
  }

  private build(terrain: TerrainManifest, sprites: SpriteManifest, district: DistrictState): void {
    this.makeSmokeTexture();
    this.makeGlowTexture();

    // Terrain chunks, positioned so the manifest anchor lands on cell (0, 0).
    const s = terrain.scale;
    const [ax, ay] = terrain.originAnchor;
    for (let r = 0; r < terrain.rows; r++) {
      for (let c = 0; c < terrain.cols; c++) {
        const chunk = this.add
          .image((c * terrain.tile - ax) / s, (r * terrain.tile - ay) / s, `terrain_${r}_${c}`)
          .setOrigin(0, 0)
          .setScale(1 / s)
          .setDepth(-10000);
        this.tinted.push(chunk);
      }
    }

    for (const structure of district.structures) {
      this.placeStructure(
        structure,
        this.spriteKey(structure, sprites),
        sprites.assets[this.spriteKey(structure, sprites)],
      );
    }
    for (const prop of district.props) this.placeProp(prop, sprites.assets[prop.kind]);

    // Life: townsfolk on their daily routine and small ambient details.
    const template = TEMPLATES[district.templateId];
    if (template) {
      const grid = buildWalkGrid(template, district, STRUCTURE_FOOTPRINTS);
      const characters = (
        this.cache.json.get('characterManifest') as { characters: Record<string, CharacterSheet> }
      ).characters;
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      this.townsfolk = new Townsfolk(this, grid, district, characters, coarse ? 40 : 70);
      const mines = district.structures
        .filter((st) => st.kind === 'mine_headframe')
        .map((st) => ({ x: st.x + 1, y: st.y + 1 }));
      this.ambience = new Ambience(this, template, mines);
    }

    this.hover = this.add.graphics().setDepth(100000);
    const bounds = mapBounds(MAP_SIZE, MAP_SIZE);
    this.controller = new CameraController(this, {
      minZoom: 0.4,
      maxZoom: 1.6,
      // Inset so the dark corners beyond the playable diamond stay off screen.
      bounds: {
        x: bounds.x + bounds.width * 0.12,
        y: bounds.y - 260,
        width: bounds.width * 0.76,
        height: bounds.height * 0.9 + 260,
      },
    });
    const plaza = cellToWorld(26.5, 23.5);
    // Small screens start further out so the whole town core is visible.
    const fit = Math.min(this.scale.width, this.scale.height) / 1100;
    this.cameras.main.setZoom(Phaser.Math.Clamp(fit, 0.45, 0.75)).centerOn(plaza.x, plaza.y);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.drawHover(p));
    this.built = true;
  }

  private heightAt(x: number, y: number): number {
    return (
      this.heights[Math.max(0, Math.min(MAP_SIZE - 1, Math.round(y)))]?.[
        Math.max(0, Math.min(MAP_SIZE - 1, Math.round(x)))
      ] ?? 0
    );
  }

  /** Visual variant (same footprint, other materials) chosen from the position: stable per save. */
  private spriteKey(s: PlacedStructure, sprites: SpriteManifest): string {
    const variants = Object.keys(sprites.assets).filter(
      (k) => k === s.kind || (k.startsWith(`${s.kind}_`) && k.length === s.kind.length + 2),
    );
    variants.sort();
    return variants[(s.x * 31 + s.y * 17) % variants.length] ?? s.kind;
  }

  private placeStructure(s: PlacedStructure, key: string, asset: SpriteAsset | undefined): void {
    if (!asset) return;
    const { w, d } = STRUCTURE_FOOTPRINTS[s.kind];
    let ground = Infinity;
    for (let dy = 0; dy < d; dy++)
      for (let dx = 0; dx < w; dx++) ground = Math.min(ground, this.heightAt(s.x + dx, s.y + dy));
    const cx = s.x + (w - 1) / 2;
    const cy = s.y + (d - 1) / 2;
    const depth = depthOf(s.x + w - 1, s.y + d - 1) + 8;
    const img = this.addLayers(key, asset, cx, cy, Math.max(0, ground), depth);
    // Lived-in houses: some chimneys smoke, lit windows cast warm light at night.
    const hash = (s.x * 73 + s.y * 151) % 7;
    for (const [dx, dy] of SMOKE_POINTS[s.kind] ?? []) {
      if (hash < 4) this.addSmoke(img.x + dx, img.y + dy, depth + 0.6);
    }
    if (asset.layers.includes('emission')) {
      this.addGlow(
        img.x,
        img.y - 20,
        s.kind === 'town_hall' ? 3.2 : 2.2,
        0xffa850,
        0.45,
        depth - 1,
      );
    }
  }

  private placeProp(p: PlacedProp, asset: SpriteAsset | undefined): void {
    if (!asset) return;
    const x = p.x + p.ox;
    const y = p.y + p.oy;
    const img = this.addLayers(p.kind, asset, x, y, this.heightAt(p.x, p.y), depthOf(x, y) + 8);
    if (p.kind === 'lamp') {
      this.addGlow(img.x - 6, img.y - 8, 2.6, 0xffb565, 0.55, -4000);
      this.addGlow(img.x - 6, img.y - 75, 0.7, 0xffd9a0, 0.9, img.depth + 1);
    }
  }

  /** Adds shadow, colour (lit, with normal map) and emission layers at a footprint centre. */
  private addLayers(
    key: string,
    asset: SpriteAsset,
    cx: number,
    cy: number,
    z: number,
    depth: number,
  ) {
    const pos = cellToWorld(cx, cy, z);
    const origin: [number, number] = [
      asset.anchor[0] / asset.size[0],
      asset.anchor[1] / asset.size[1],
    ];
    const scale = 1 / asset.scale;
    if (asset.layers.includes('shadow')) {
      const shadow = this.add
        .image(pos.x, pos.y, `${key}_s`)
        .setOrigin(...origin)
        .setScale(scale)
        .setDepth(-5000);
      this.shadows.push(shadow);
    }
    const img = this.add
      .image(pos.x, pos.y, key)
      .setOrigin(...origin)
      .setScale(scale)
      .setDepth(depth);
    this.tinted.push(img);
    if (asset.layers.includes('emission')) {
      const glow = this.add
        .image(pos.x, pos.y, `${key}_e`)
        .setOrigin(...origin)
        .setScale(scale)
        .setDepth(depth + 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.emissive.push(glow);
    }
    return img;
  }

  /** Additive radial glow; ground glows are squashed 2:1 to sit on the isometric floor. */
  private addGlow(
    x: number,
    y: number,
    size: number,
    color: number,
    strength: number,
    depth: number,
  ): void {
    const image = this.add
      .image(x, y, 'glow')
      .setScale(size, depth < 0 ? size / 2 : size)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth)
      .setAlpha(0);
    this.glows.push({ image, strength });
  }

  private makeGlowTexture(): void {
    if (this.textures.exists('glow')) return;
    const size = 128;
    const canvas = this.textures.createCanvas('glow', size, size);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }

  private makeSmokeTexture(): void {
    if (this.textures.exists('smoke')) return;
    const size = 64;
    const canvas = this.textures.createCanvas('smoke', size, size);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return;
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(200,200,205,0.9)');
    g.addColorStop(0.5, 'rgba(160,160,168,0.35)');
    g.addColorStop(1, 'rgba(140,140,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }

  private addSmoke(x: number, y: number, depth: number): void {
    const emitter = this.add.particles(x, y, 'smoke', {
      lifespan: { min: 3500, max: 5500 },
      speedY: { min: -26, max: -14 },
      speedX: { min: -4, max: 12 },
      scale: { start: 0.18, end: 1.1 },
      alpha: { start: 0.38, end: 0 },
      rotate: { min: 0, max: 360 },
      frequency: 340,
      tint: 0x9a9aa2,
    });
    emitter.setDepth(depth);
    this.smoke.push(emitter);
  }

  override update(time: number, delta: number): void {
    if (!this.built) return;
    this.controller?.update(delta);
    const state = this.session.getState();
    const hour = (state.clock.tick % 24) + this.session.getTickProgress();
    const light = daylightAt(hour);
    if (light.ambient !== this.lastAmbient) {
      this.lastAmbient = light.ambient;
      for (const t of this.tinted) t.setTint(light.ambient);
      for (const s of this.shadows) s.setAlpha(0.9 * light.shadow);
      for (const e of this.emissive) e.setAlpha(light.night);
      for (const g of this.glows) g.image.setAlpha(g.strength * light.night);
    }
    const smokeTint = light.night > 0.5 ? 0x4a4c58 : 0x9a9aa2;
    for (const s of this.smoke) s.particleTint = smokeTint;
    const speed = state.phase.kind === 'district' ? this.session.getSpeed() : 0;
    this.townsfolk?.update(delta, hour, speed, light.ambient);
    this.ambience?.update(delta, speed, light.night, time);
  }

  private drawHover(pointer: Phaser.Input.Pointer): void {
    if (!this.hover) return;
    this.hover.clear();
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const { cx, cy } = pickCell(world.x, world.y);
    if (cx < 0 || cy < 0 || cx >= MAP_SIZE || cy >= MAP_SIZE) return;
    const { x, y } = cellToWorld(cx, cy, this.heightAt(cx, cy));
    this.hover.lineStyle(2, PALETTE.lampOchre, 0.9);
    this.hover.strokePoints(
      [
        new Phaser.Math.Vector2(x, y - TILE_H / 2),
        new Phaser.Math.Vector2(x + TILE_W / 2, y),
        new Phaser.Math.Vector2(x, y + TILE_H / 2),
        new Phaser.Math.Vector2(x - TILE_W / 2, y),
      ],
      true,
    );
  }
}
