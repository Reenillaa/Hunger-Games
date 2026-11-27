import * as Phaser from 'phaser';
import type { ArenaActor, ArenaLog, ArenaState, GameState } from '../../core/index.ts';
import {
  ARENAS,
  ARENA_SIZE,
  setArenaMap,
  arenaCodeAt,
  arenaHour,
  visibleActors,
  visibleCells,
} from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { MS_PER_ROUND_AT_X1 } from '../../game/session.ts';
import { CameraController } from '../camera/cameraController.ts';
import type { SpriteAsset, SpriteManifest } from '../district/assets.ts';
import { ART_BASE, pickTerrainScale } from '../district/assets.ts';
import { daylightAt } from '../district/daylight.ts';
import { LightingRig } from '../lighting.ts';
import { ARENA_FOREST_PALETTE, GroundPainter, SNOW_PALETTE } from '../district/ground.ts';
import type { CharacterSheet } from '../district/townsfolk.ts';
import { directionIndex } from '../district/townsfolk.ts';
import { TILE_H, TILE_W, cellToWorld, depthOf, mapBounds, pickCell } from '../iso/projection.ts';
import { PALETTE } from '../palette.ts';
import { getSettings } from '../../platform/settings.ts';

export const ARENA_SCENE = 'arena';
const DIRS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];
const SHEETS = ['contestant', 'contestant_f'];
const PROPS = [
  'oak_a',
  'oak_b',
  'birch',
  'pine_a',
  'pine_b',
  'pine_c',
  'dead_tree',
  'bush_big',
  'rock_a',
  'rock_b',
  'rock_c',
  'ruin_wall',
  'ruin_pillar',
  'cave_mouth',
  'pedestal',
  'relicario',
];
const MOVE_MS = 650;
/** Fog canvas pixels per world pixel: soft clouds need little resolution. */
const FOG_K = 0.16;
const FOG_MARGIN = 900;

/** Stable per-cell pseudo-random value in [0, 1) (visual only, never simulation). */
function hash(x: number, y: number, salt: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

interface ActorView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Container;
  /** Current opacity and the one it eases towards (sighted or not): no popping in and out. */
  fade: number;
  shown: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
  t: number;
  dir: number;
  sheet: string;
}

interface Tree {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

/**
 * The arena: a pre-rendered forest with depth-sorted trees, ruins and the Relicario, the
 * contestants as animated figures, and a fog of war built only from what the home team knows.
 * Rivals out of sight are drawn as their last known position (faded), never their true one.
 */
export class ArenaScene extends Phaser.Scene {
  private readonly session: GameSession;
  private controller?: CameraController;
  private terrainScale: '1x' | '0.5x' = '1x';
  private mapId = 'arena_forest';
  private readonly tinted: Phaser.GameObjects.Image[] = [];
  private readonly shadows: Phaser.GameObjects.Image[] = [];
  private readonly trees: Tree[] = [];
  private readonly views = new Map<string, ActorView>();
  private readonly graves = new Map<string, Phaser.GameObjects.Graphics>();
  /** Two cloud layers: the new fog fades in over the old one after every round. */
  private fogLayers: Phaser.GameObjects.Image[] = [];
  private fogKeys: string[] = [];
  private fogSerial = 0;
  private overlay?: Phaser.GameObjects.Graphics;
  private hover?: Phaser.GameObjects.Graphics;
  private fire?: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastRound = -1;
  private lastLog = 0;
  private lastSelected: string | null = null;
  private lastAmbient = -1;
  private lighting?: LightingRig;
  private built = false;
  private unsubscribe?: () => void;

  constructor(session: GameSession) {
    super(ARENA_SCENE);
    this.session = session;
  }

  preload(): void {
    this.terrainScale = pickTerrainScale();
    this.mapId = this.session.getState().arena?.mapId ?? 'arena_forest';
    setArenaMap(this.mapId);
    this.load.json('spriteManifest', `${ART_BASE}/sprites/manifest.json`);
    this.load.json('characterManifest', `${ART_BASE}/characters/manifest.json`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.forestDeep);
    const sprites = this.cache.json.get('spriteManifest') as SpriteManifest;
    const characters = (
      this.cache.json.get('characterManifest') as { characters: Record<string, CharacterSheet> }
    ).characters;
    for (const kind of PROPS) {
      const asset = sprites.assets[kind];
      if (!asset || this.textures.exists(kind)) continue;
      this.load.image(kind, `${ART_BASE}/sprites/${kind}.webp`);
      if (asset.layers.includes('shadow'))
        this.load.image(`${kind}_s`, `${ART_BASE}/sprites/${kind}_s.webp`);
    }
    for (const name of SHEETS) {
      const sheet = characters[name];
      if (!sheet || this.textures.exists(`char_${name}`)) continue;
      this.load.spritesheet(`char_${name}`, `${ART_BASE}/characters/${name}.webp`, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    this.load.once('complete', () => this.build(sprites, characters));
    this.load.start();
  }

  private build(sprites: SpriteManifest, characters: Record<string, CharacterSheet>): void {
    // The arena painted in the same cartoon style as the districts (DECISIONS I-62).
    const arena = ARENAS[this.mapId] ?? ARENAS.arena_forest!;
    const toGround: Record<string, string> = {
      c: 'g',
      F: 'f',
      D: 'f',
      b: 'g',
      r: 's',
      R: 'R',
      w: 'w',
      W: 'w',
      v: 'R',
      u: 'p',
      X: 'd',
    };
    const template = {
      id: arena.id,
      width: arena.width,
      height: arena.height,
      legend: {},
      plaza: { x0: 0, y0: 0, x1: 0, y1: 0 },
      terrain: arena.terrain.map((row) => [...row].map((ch) => toGround[ch] ?? 'g').join('')),
      elevation: arena.elevation,
    };
    const painter = new GroundPainter(this, this.terrainScale === '1x' ? 0.75 : 0.5);
    for (const img of painter.paint({
      template,
      roads: new Set(),
      palette: this.mapId === 'arena_tundra' ? SNOW_PALETTE : ARENA_FOREST_PALETTE,
    }))
      this.tinted.push(img);
    this.makeTextures();
    this.placeProps(sprites);
    this.makeAnimations(characters);

    this.overlay = this.add.graphics().setDepth(-4000);
    this.hover = this.add.graphics().setDepth(150001);
    this.fire = this.add
      .particles(0, 0, 'ember', {
        lifespan: 900,
        speedY: { min: -60, max: -25 },
        speedX: { min: -12, max: 12 },
        scale: { start: 1.2, end: 0.2 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffb347, 0xff7a2a, 0xffd27a],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(140000);

    const bounds = mapBounds(ARENA_SIZE, ARENA_SIZE);
    this.controller = new CameraController(this, {
      minZoom: 0.35,
      maxZoom: 1.6,
      bounds: { x: bounds.x, y: bounds.y - 200, width: bounds.width, height: bounds.height + 200 },
    });
    const fit = Math.min(this.scale.width, this.scale.height) / 1000;
    const centre = cellToWorld(ARENA_SIZE / 2, ARENA_SIZE / 2);
    this.cameras.main.setZoom(Phaser.Math.Clamp(fit, 0.45, 0.8)).centerOn(centre.x, centre.y);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.drawHover(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.unsubscribe = this.session.ui.subscribe(() => this.refreshSelection());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      for (const k of this.fogKeys) if (this.textures.exists(k)) this.textures.remove(k);
      this.fogLayers = [];
      this.fogKeys = [];
    });
    this.lighting = new LightingRig(this);
    this.built = true;
    this.sync(true);
  }

  /** The painted arena is flat, like the districts. */
  private heightAt(_x: number, _y: number): number {
    return 0;
  }

  private makeTextures(): void {
    const tex = this.textures;
    if (!tex.exists('ember')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
      g.generateTexture('ember', 8, 8);
      g.destroy();
    }
    // Cloud brushes for the fog of war: a puff (blue-grey belly, white sunlit crown), a thin
    // haze for remembered ground, and a feathered eraser for what is in sight.
    if (!tex.exists('fog_puff')) {
      // A cumulus lump: a shaded belly, a body of round lobes and a sunlit crown (light from
      // the upper left, like the buildings).
      const c = tex.createCanvas('fog_puff', 128, 96)!;
      const ctx = c.getContext();
      const lobe = (x: number, y: number, r: number, colour: string, hard = 0.78) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, colour);
        g.addColorStop(hard, colour);
        g.addColorStop(1, colour.replace(/,1\)$/, ',0)'));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };
      lobe(70, 64, 34, 'rgba(150,163,190,1)', 0.6);
      lobe(42, 62, 26, 'rgba(160,172,198,1)', 0.6);
      lobe(64, 54, 32, 'rgba(208,216,230,1)');
      lobe(38, 54, 24, 'rgba(214,222,236,1)');
      lobe(90, 56, 22, 'rgba(204,212,228,1)');
      lobe(56, 42, 26, 'rgba(246,248,252,1)');
      lobe(78, 44, 18, 'rgba(240,244,250,1)');
      lobe(48, 36, 15, 'rgba(255,255,255,1)', 0.7);
      c.refresh();
    }
    if (!tex.exists('fog_haze')) {
      const c = tex.createCanvas('fog_haze', 64, 32)!;
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(32, 16, 0, 32, 16, 30);
      g.addColorStop(0, 'rgba(222,230,240,0.85)');
      g.addColorStop(1, 'rgba(222,230,240,0)');
      ctx.fillStyle = g;
      ctx.setTransform(1, 0, 0, 0.5, 0, 8);
      ctx.fillRect(0, 0, 64, 64);
      c.refresh();
    }
    if (!tex.exists('fog_carve')) {
      const c = tex.createCanvas('fog_carve', 64, 32)!;
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.setTransform(1, 0, 0, 0.5, 0, 0);
      ctx.fillRect(0, 0, 64, 64);
      c.refresh();
    }
    if (!tex.exists('blob_shadow')) {
      const canvas = tex.createCanvas('blob_shadow', 40, 20);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(20, 10, 2, 20, 10, 18);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.scale(1, 0.5);
      ctx.beginPath();
      ctx.arc(20, 20, 20, 0, Math.PI * 2);
      ctx.fill();
      canvas!.refresh();
    }
  }

  private addProp(key: string, asset: SpriteAsset | undefined, x: number, y: number): void {
    if (!asset) return;
    const pos = cellToWorld(x, y, this.heightAt(x, y));
    const origin: [number, number] = [
      asset.anchor[0] / asset.size[0],
      asset.anchor[1] / asset.size[1],
    ];
    const scale = 1 / asset.scale;
    if (asset.layers.includes('shadow') && this.textures.exists(`${key}_s`)) {
      this.shadows.push(
        this.add
          .image(pos.x, pos.y, `${key}_s`)
          .setOrigin(...origin)
          .setScale(scale)
          .setDepth(-5000),
      );
    }
    const img = this.add
      .image(pos.x, pos.y, key)
      .setOrigin(...origin)
      .setScale(scale * (asset.kind === 'tree' ? 0.85 + hash(x, y, 9) * 0.35 : 1))
      .setFlipX(asset.kind !== 'building' && hash(x, y, 4) < 0.5)
      .setDepth(depthOf(x, y) + 8);
    this.tinted.push(img);
    if (asset.kind === 'tree') this.trees.push({ img, x, y });
  }

  /** Vegetation, rocks, ruins and the Relicario: dressed from the template, stable per cell. */
  private placeProps(sprites: SpriteManifest): void {
    const a = sprites.assets;
    const pickOf = (list: string[], v: number) => list[Math.floor(v * list.length)]!;
    for (let y = 0; y < ARENA_SIZE; y++) {
      for (let x = 0; x < ARENA_SIZE; x++) {
        const code = arenaCodeAt(x, y);
        const r = hash(x, y, 1);
        const jx = x + (hash(x, y, 2) - 0.5) * 0.5;
        const jy = y + (hash(x, y, 3) - 0.5) * 0.5;
        let key: string | null = null;
        if (code === 'F' && r < 0.42)
          key = pickOf(
            this.mapId === 'arena_tundra'
              ? ['pine_a', 'pine_b', 'pine_c', 'dead_tree', 'pine_a']
              : ['oak_a', 'oak_b', 'birch', 'pine_a', 'oak_a'],
            hash(x, y, 5),
          );
        else if (code === 'D' && r < 0.7)
          key = pickOf(
            this.mapId === 'arena_tundra'
              ? ['pine_a', 'pine_c', 'pine_b', 'pine_c', 'pine_a']
              : ['pine_a', 'pine_c', 'oak_b', 'pine_b', 'oak_a'],
            hash(x, y, 5),
          );
        else if (code === 'b' && r < 0.3) key = 'bush_big';
        else if (code === 'c' && r < 0.03)
          key = pickOf(['bush_big', 'rock_b', 'dead_tree'], hash(x, y, 5));
        else if (code === 'r' && r < 0.35)
          key = pickOf(['rock_a', 'rock_b', 'rock_c'], hash(x, y, 5));
        else if (code === 'u' && r < 0.55) key = r < 0.2 ? 'ruin_pillar' : 'ruin_wall';
        else if (code === 'v') key = 'cave_mouth';
        if (key)
          this.addProp(
            key,
            a[key],
            code === 'v' || code === 'u' ? x : jx,
            code === 'v' || code === 'u' ? y : jy,
          );
      }
    }
    const c = ARENA_SIZE / 2 - 0.5;
    this.addProp('relicario', a.relicario, c, c);
    // Launch plates where the contestants started.
    const start = this.session.getState().games?.order.length ?? 24;
    for (let i = 0; i < start; i++) {
      const ang = (i / start) * Math.PI * 2;
      this.addProp(
        'pedestal',
        a.pedestal,
        Math.round(c + Math.cos(ang) * 6),
        Math.round(c + Math.sin(ang) * 6),
      );
    }
  }

  private makeAnimations(sheets: Record<string, CharacterSheet>): void {
    for (const name of SHEETS) {
      const sheet = sheets[name];
      if (!sheet) continue;
      const cols = sheet.walkFrames + 1;
      DIRS.forEach((dir, row) => {
        const key = `${name}_walk_${dir}`;
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`char_${name}`, {
            start: row * cols + 1,
            end: row * cols + sheet.walkFrames,
          }),
          frameRate: 10,
          repeat: -1,
        });
      });
      const sheetInfo = sheets[name]!;
      this.registry.set(`sheet_${name}`, sheetInfo);
    }
  }

  private viewFor(state: GameState, a: ArenaActor): ActorView {
    let v = this.views.get(a.id);
    if (v) return v;
    const c = state.games!.contestants[a.id]!;
    const sheet = c.sex === 'F' ? 'contestant_f' : 'contestant';
    const info = this.registry.get(`sheet_${sheet}`) as CharacterSheet | undefined;
    const pos = cellToWorld(a.x, a.y, this.heightAt(a.x, a.y));
    const shadow = this.add.image(pos.x, pos.y, 'blob_shadow').setDepth(-4500).setScale(0.8);
    const sprite = this.add
      .sprite(pos.x, pos.y, `char_${sheet}`, 0)
      .setOrigin(
        info ? info.anchor[0] / info.frameWidth : 0.5,
        info ? info.anchor[1] / info.frameHeight : 0.9,
      )
      .setScale(info ? 1 / info.scale : 0.5);
    const ring = this.add.graphics().setDepth(-4400);
    const label = this.nameTag(c.name.split(' ')[0]!, c.district, a.player);
    label.setPosition(pos.x, pos.y - 80).setAlpha(0);
    sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
    v = {
      sprite,
      shadow,
      ring,
      label,
      fade: 0,
      shown: true,
      from: { x: a.x, y: a.y },
      to: { x: a.x, y: a.y },
      t: 1,
      dir: 0,
      sheet,
    };
    this.views.set(a.id, v);
    return v;
  }

  /** Brings the scene in line with the arena state after a round. */
  private sync(force = false): void {
    const state = this.session.getState();
    const arena = state.arena;
    if (!arena || !this.built) return;
    if (!force && arena.round === this.lastRound) return;
    const visible = visibleCells(state);
    const seenActors = visibleActors(state);
    this.drawFog(arena, visible);
    this.drawOverlay(arena);
    for (const a of Object.values(arena.actors)) {
      const shown = a.alive && seenActors.has(a.id);
      const v = this.views.get(a.id) ?? (shown ? this.viewFor(state, a) : null);
      if (!v) {
        if (!a.alive && a.deathRound !== undefined && visible.has(a.y * ARENA_SIZE + a.x))
          this.addGrave(a);
        continue;
      }
      if (!a.alive) {
        this.destroyView(a.id);
        this.addGrave(a);
        continue;
      }
      v.shown = shown;
      if (v.to.x !== a.x || v.to.y !== a.y) {
        v.from = this.currentCell(v);
        v.to = { x: a.x, y: a.y };
        v.t = force ? 1 : 0;
        const dx = v.to.x - v.from.x;
        const dy = v.to.y - v.from.y;
        if (dx !== 0 || dy !== 0) v.dir = directionIndex(Math.sign(dx), Math.sign(dy));
      }
      const hp = Math.max(0, a.hp);
      v.ring.clear();
      v.ring.lineStyle(3, a.player ? 0xf2c14e : 0xc0392b, a.player ? 0.95 : 0.8);
      v.ring.strokeEllipse(0, 0, 54, 27);
      if (a.player) {
        v.ring.fillStyle(0x0b0b0d, 0.7).fillRect(-24, 14, 48, 6);
        v.ring
          .fillStyle(hp > 50 ? 0x7fb069 : hp > 25 ? 0xf2c14e : 0xc0392b, 1)
          .fillRect(-23, 15, (46 * hp) / 100, 4);
      }
      v.sprite.setData('hidden', a.hidden);
    }
    for (const id of [...this.views.keys()]) if (!arena.actors[id]?.alive) this.destroyView(id);
    // Floating combat text for the new log lines.
    const fresh = arena.log.slice(Math.max(0, this.lastLog > arena.log.length ? 0 : this.lastLog));
    if (this.lastRound >= 0) for (const e of fresh) this.popEvent(e, visible);
    this.lastLog = arena.log.length;
    this.lastRound = arena.round;
    this.refreshSelection();
  }

  private currentCell(v: ActorView): { x: number; y: number } {
    const k = Math.min(1, v.t);
    return { x: v.from.x + (v.to.x - v.from.x) * k, y: v.from.y + (v.to.y - v.from.y) * k };
  }

  private destroyView(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    v.sprite.destroy();
    v.shadow.destroy();
    v.ring.destroy();
    v.label.destroy();
    this.views.delete(id);
  }

  private addGrave(a: ArenaActor): void {
    if (this.graves.has(a.id)) return;
    const p = cellToWorld(a.x, a.y, this.heightAt(a.x, a.y));
    const g = this.add.graphics({ x: p.x, y: p.y }).setDepth(depthOf(a.x, a.y) + 4);
    g.fillStyle(0x0b0b0d, 0.35).fillEllipse(0, 0, 34, 14);
    g.fillStyle(a.player ? 0xf2c14e : 0xd9d6cc, 0.9);
    g.fillRect(-2, -26, 4, 26).fillRect(-9, -20, 18, 4);
    this.graves.set(a.id, g);
  }

  private popEvent(e: ArenaLog, visible: Set<number>): void {
    if (e.x === undefined || e.y === undefined) return;
    if (!visible.has(e.y * ARENA_SIZE + e.x) && e.key !== 'arena.fire') return;
    const p = cellToWorld(e.x, e.y, this.heightAt(e.x, e.y));
    let text: string;
    let color = '#E9E4D8';
    if (e.key === 'arena.hit' || e.key === 'arena.crit') {
      text = `−${e.vars?.d ?? ''}`;
      color = e.key === 'arena.crit' ? '#FF6B4A' : '#F2C14E';
      if (!getSettings().reducedMotion) this.cameras.main.shake(120, 0.002);
    } else if (e.key === 'arena.miss') text = t('arena.fx.miss');
    else if (e.key === 'arena.killed') {
      text = '✝';
      color = '#C0392B';
    } else if (e.key === 'arena.capsule') {
      text = '✦';
      color = '#7EC8E3';
    } else return;
    const label = this.add
      .text(p.x, p.y - 70, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color,
        stroke: '#0B0B0D',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(170000);
    this.tweens.add({
      targets: label,
      y: label.y - 50,
      alpha: 0,
      duration: 1600,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** A name tag: a pill with the district number, gold for the home team. */
  private nameTag(name: string, district: number, player: boolean): Phaser.GameObjects.Container {
    const text = this.add
      .text(0, 0, name, {
        fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: player ? '#1D1408' : '#F4F1EA',
        resolution: 2,
      })
      .setOrigin(0, 0.5);
    const badge = this.add
      .text(0, 0, String(district), {
        fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: '800',
        color: player ? '#F2C14E' : '#14161C',
        resolution: 2,
      })
      .setOrigin(0.5);
    const h = 26;
    const chip = 20;
    const w = chip + 8 + text.width + 12;
    const g = this.add.graphics();
    // Soft drop shadow, the pill, a little pointer towards the figure.
    g.fillStyle(0x000000, 0.28).fillRoundedRect(-w / 2 + 1, -h + 3, w, h, h / 2);
    g.fillStyle(player ? 0xf2c14e : 0x14161c, player ? 1 : 0.82).fillRoundedRect(
      -w / 2,
      -h,
      w,
      h,
      h / 2,
    );
    g.fillTriangle(-6, -1, 6, -1, 0, 6);
    g.lineStyle(1.5, player ? 0xfff1c2 : 0xffffff, player ? 0.9 : 0.18).strokeRoundedRect(
      -w / 2,
      -h,
      w,
      h,
      h / 2,
    );
    g.fillStyle(player ? 0x1d1408 : 0xe9e4d8, 1).fillCircle(
      -w / 2 + 3 + chip / 2,
      -h / 2,
      chip / 2,
    );
    badge.setPosition(-w / 2 + 3 + chip / 2, -h / 2);
    text.setPosition(-w / 2 + chip + 9, -h / 2);
    return this.add.container(0, 0, [g, badge, text]).setDepth(160000);
  }

  /**
   * The fog of war as clouds: what nobody on the team has seen lies under thick, sunlit cloud;
   * remembered ground under a thin haze; what the team sees now is clear, with soft edges. The
   * new fog cross-fades over the old one, so the clouds part instead of blinking.
   */
  private drawFog(arena: ArenaState, visible: Set<number>): void {
    const bounds = mapBounds(ARENA_SIZE, ARENA_SIZE);
    const ox = bounds.x - FOG_MARGIN;
    const oy = bounds.y - FOG_MARGIN;
    const w = Math.ceil((bounds.width + FOG_MARGIN * 2) * FOG_K);
    const h = Math.ceil((bounds.height + FOG_MARGIN * 2) * FOG_K);
    const key = `arena_fog_${this.fogSerial++}`;
    const tex = this.textures.createCanvas(key, w, h)!;
    const ctx = tex.getContext();
    const explored = new Set(arena.explored);
    const puff = this.textures.get('fog_puff').getSourceImage() as HTMLCanvasElement;
    const haze = this.textures.get('fog_haze').getSourceImage() as HTMLCanvasElement;
    const carve = this.textures.get('fog_carve').getSourceImage() as HTMLCanvasElement;
    const at = (x: number, y: number) => {
      const p = cellToWorld(x, y);
      return { x: (p.x - ox) * FOG_K, y: (p.y - oy) * FOG_K };
    };
    const cw = TILE_W * FOG_K;
    // Beyond the arena it is cloud all the way.
    // Back to front along the iso depth (x + y), so every lump's crown covers the belly of the
    // one behind it.
    const cells: [number, number][] = [];
    for (let y = -4; y < ARENA_SIZE + 4; y++)
      for (let x = -4; x < ARENA_SIZE + 4; x++) cells.push([x, y]);
    cells.sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[0] - q[0]);
    for (const [x, y] of cells) {
      const inside = x >= 0 && y >= 0 && x < ARENA_SIZE && y < ARENA_SIZE;
      const i = y * ARENA_SIZE + x;
      if (inside && (visible.has(i) || explored.has(i))) continue;
      const p = at(x, y);
      // A base of mist so no ground shows between the lumps.
      ctx.drawImage(haze, p.x - cw * 1.2, p.y - cw * 0.6, cw * 2.4, cw * 1.2);
      ctx.drawImage(haze, p.x - cw * 1.2, p.y - cw * 0.6, cw * 2.4, cw * 1.2);
      // Every other cell: lumps big enough to overlap, drawn back to front.
      if ((x + y) % 2 !== 0 && hash(x, y, 7) < 0.6) continue;
      const r = cw * (1.7 + hash(x, y, 9) * 1.1);
      const jx = (hash(x, y, 3) - 0.5) * cw * 0.5;
      const jy = (hash(x, y, 4) - 0.5) * cw * 0.25;
      ctx.drawImage(puff, p.x + jx - r / 2, p.y + jy - r * 0.6, r, r * 0.75);
    }
    ctx.globalAlpha = 1;
    for (const i of explored) {
      if (visible.has(i)) continue;
      const p = at(i % ARENA_SIZE, Math.floor(i / ARENA_SIZE));
      ctx.globalAlpha = 0.3;
      ctx.drawImage(haze, p.x - cw, p.y - cw * 0.5, cw * 2, cw);
    }
    // What the team sees now: the clouds part with feathered edges.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    for (const i of visible) {
      const p = at(i % ARENA_SIZE, Math.floor(i / ARENA_SIZE));
      ctx.drawImage(carve, p.x - cw * 0.9, p.y - cw * 0.45, cw * 1.8, cw * 0.9);
    }
    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
    const img = this.add
      .image(ox, oy, key)
      .setOrigin(0, 0)
      .setScale(1 / FOG_K)
      .setDepth(150000 + (this.fogSerial % 2))
      .setAlpha(0);
    const old = this.fogLayers;
    const oldKeys = this.fogKeys;
    this.fogLayers = [img];
    this.fogKeys = [key];
    this.tweens.add({
      targets: img,
      alpha: 1,
      duration: old.length ? 700 : 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        for (const o of old) o.destroy();
        for (const k of oldKeys) this.textures.remove(k);
      },
    });
    // The clouds breathe a little.
    this.tweens.add({
      targets: img,
      x: ox + 18,
      y: oy + 6,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Fire, the closing zone, the selected contestant's order and the rivals' last known spots. */
  private drawOverlay(arena: ArenaState): void {
    const g = this.overlay!;
    g.clear();
    for (const k of Object.keys(arena.fire)) {
      const i = Number(k);
      const p = cellToWorld(i % ARENA_SIZE, Math.floor(i / ARENA_SIZE));
      g.fillStyle(0xff7a2a, 0.35).fillEllipse(p.x, p.y, TILE_W * 0.9, TILE_H * 0.9);
      this.fire?.emitParticleAt(p.x + (Math.random() - 0.5) * 40, p.y, 3);
    }
    if (arena.zone < 28) {
      const c = cellToWorld(ARENA_SIZE / 2 - 0.5, ARENA_SIZE / 2 - 0.5);
      g.lineStyle(6, 0xc0392b, 0.7);
      g.strokeEllipse(c.x, c.y, arena.zone * TILE_W * 1.414, arena.zone * TILE_H * 1.414);
    }
    const team = Object.values(arena.actors).filter((a) => a.player && a.alive);
    const known = new Map<string, { x: number; y: number; round: number }>();
    for (const a of team)
      for (const [id, b] of Object.entries(a.beliefs))
        if (!known.has(id) || known.get(id)!.round < b.round) known.set(id, b);
    for (const [id, b] of known) {
      const other = arena.actors[id];
      if (!other?.alive || other.player || b.round === arena.round) continue;
      const age = arena.round - b.round;
      if (age > 8) continue;
      const p = cellToWorld(b.x, b.y);
      g.lineStyle(2, 0xc0392b, 0.6 - age * 0.06);
      g.strokeCircle(p.x, p.y - 30, 14);
      g.fillStyle(0xc0392b, 0.5 - age * 0.05).fillCircle(p.x, p.y - 30, 4);
    }
  }

  private refreshSelection(): void {
    const state = this.session.getState();
    const arena = state.arena;
    if (!arena || !this.built) return;
    const id = this.session.ui.get().arenaActorId;
    this.lastSelected = id;
    for (const [aid, v] of this.views) v.label.setScale(aid === id ? 1.15 : 1);
    const g = this.hover!;
    g.clear();
    const a = id ? arena.actors[id] : null;
    if (a?.order && a.alive) {
      const o = a.order;
      const target =
        o.kind === 'move'
          ? { x: o.x, y: o.y }
          : o.kind === 'attack'
            ? arena.actors[o.target]
            : null;
      if (target) {
        const p0 = cellToWorld(a.x, a.y);
        const p1 = cellToWorld(target.x, target.y);
        g.lineStyle(3, o.kind === 'attack' ? 0xc0392b : 0xf2c14e, 0.85);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
        g.strokeEllipse(p1.x, p1.y, 50, 25);
      }
    }
  }

  private drawHover(pointer: Phaser.Input.Pointer): void {
    if (!this.session.ui.get().arenaActorId || !this.built) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const { cx, cy } = pickCell(world.x, world.y);
    this.refreshSelection();
    if (cx < 0 || cy < 0 || cx >= ARENA_SIZE || cy >= ARENA_SIZE) return;
    const code = arenaCodeAt(cx, cy);
    const blocked = code === 'W' || code === 'R';
    const p = cellToWorld(cx, cy, this.heightAt(cx, cy));
    this.hover!.lineStyle(2, blocked ? 0xc0392b : 0xf2c14e, 0.9);
    this.hover!.strokePoints(
      [
        new Phaser.Math.Vector2(p.x, p.y - TILE_H / 2),
        new Phaser.Math.Vector2(p.x + TILE_W / 2, p.y),
        new Phaser.Math.Vector2(p.x, p.y + TILE_H / 2),
        new Phaser.Math.Vector2(p.x - TILE_W / 2, p.y),
      ],
      true,
    );
  }

  /** Tap a team member to direct them; then tap ground to move or a visible rival to attack. */
  private onTap(pointer: Phaser.Input.Pointer): void {
    if (this.controller?.gestureConsumed || !this.built) return;
    const state = this.session.getState();
    const arena = state.arena;
    if (!arena || arena.finished) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Figures first (they stand above their cell).
    for (const [id, v] of this.views) {
      if (!v.sprite.visible) continue;
      const b = v.sprite.getBounds();
      if (!b.contains(world.x, world.y)) continue;
      const actor = arena.actors[id]!;
      if (actor.player) {
        this.session.ui.selectArenaActor(id);
        return;
      }
      const sel = this.session.ui.get().arenaActorId;
      if (sel)
        this.session.dispatch({
          type: 'arena/order',
          actorId: sel,
          order: { kind: 'attack', target: id },
        });
      return;
    }
    const sel = this.session.ui.get().arenaActorId;
    if (!sel) return;
    const { cx, cy } = pickCell(world.x, world.y);
    if (cx < 0 || cy < 0 || cx >= ARENA_SIZE || cy >= ARENA_SIZE) return;
    this.session.dispatch({
      type: 'arena/order',
      actorId: sel,
      order: { kind: 'move', x: cx, y: cy },
    });
    this.refreshSelection();
  }

  override update(time: number, delta: number): void {
    if (!this.built) return;
    this.controller?.update(delta);
    const state = this.session.getState();
    const arena = state.arena;
    if (!arena) return;
    this.sync();
    // Day and night of the arena (its own clock).
    const hour = arenaHour(arena.round) + (this.session.isArenaPlaying() ? 0.5 : 0);
    const light = daylightAt(hour);
    this.lighting?.update(hour, light.night, delta);
    if (light.ambient !== this.lastAmbient) {
      this.lastAmbient = light.ambient;
      for (const img of this.tinted) img.setTint(light.ambient);
      for (const s of this.shadows) s.setAlpha(0.9 * light.shadow);
      for (const v of this.views.values()) v.sprite.setTint(light.ambient);
    }
    // Smooth walking between rounds: while the games play, a step lasts the whole round, so the
    // figures keep walking instead of hopping and waiting.
    const playing = this.session.isArenaPlaying() && this.session.getSpeed() > 0;
    const stepMs = playing ? (MS_PER_ROUND_AT_X1 / this.session.getSpeed()) * 0.96 : MOVE_MS;
    const fadeStep = Math.min(1, delta / 260);
    for (const v of this.views.values()) {
      if (v.t < 1) v.t = Math.min(1, v.t + delta / stepMs);
      v.fade += ((v.shown ? 1 : 0) - v.fade) * fadeStep;
      const hidden = v.sprite.getData('hidden') === true;
      v.sprite.setAlpha(v.fade * (hidden ? 0.55 : 1)).setVisible(v.fade > 0.02);
      v.shadow.setAlpha(v.fade).setVisible(v.fade > 0.02);
      v.ring.setAlpha(v.fade).setVisible(v.fade > 0.02);
      v.label.setAlpha(v.fade).setVisible(v.fade > 0.02);
      const c = this.currentCell(v);
      const p = cellToWorld(c.x, c.y, this.heightAt(c.x, c.y));
      v.sprite.setPosition(p.x, p.y).setDepth(depthOf(c.x, c.y) + 9);
      v.shadow.setPosition(p.x, p.y);
      v.ring.setPosition(p.x, p.y);
      v.label.setPosition(p.x, p.y - 78);
      const key = `${v.sheet}_walk_${DIRS[v.dir]}`;
      if (v.t < 1) {
        if (v.sprite.anims.currentAnim?.key !== key || !v.sprite.anims.isPlaying)
          v.sprite.play(key);
      } else if (v.sprite.anims.isPlaying) {
        v.sprite.anims.stop();
        v.sprite.setFrame(v.dir * 9);
      }
    }
    // Trees in front of a figure turn see-through so nobody hides behind the art.
    if (time % 4 < 1 || this.lastSelected !== null) {
      for (const tr of this.trees) {
        let fade = false;
        for (const v of this.views.values()) {
          if (!v.sprite.visible) continue;
          const dx = tr.x - v.to.x;
          const dy = tr.y - v.to.y;
          if (dx >= 0 && dy >= 0 && dx + dy <= 3 && Math.abs(dx - dy) <= 2) {
            fade = true;
            break;
          }
        }
        tr.img.setAlpha(fade ? 0.4 : 1);
      }
    }
  }
}
