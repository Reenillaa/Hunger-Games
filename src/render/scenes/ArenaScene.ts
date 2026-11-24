import * as Phaser from 'phaser';
import type { ArenaActor, ArenaLog, ArenaState, GameState } from '../../core/index.ts';
import {
  ARENA_SIZE,
  arenaCodeAt,
  arenaHour,
  visibleActors,
  visibleCells,
} from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession } from '../../game/session.ts';
import { CameraController } from '../camera/cameraController.ts';
import type {
  HeightMap,
  SpriteAsset,
  SpriteManifest,
  TerrainManifest,
} from '../district/assets.ts';
import { ART_BASE, pickTerrainScale } from '../district/assets.ts';
import { daylightAt } from '../district/daylight.ts';
import type { CharacterSheet } from '../district/townsfolk.ts';
import { directionIndex } from '../district/townsfolk.ts';
import { TILE_H, TILE_W, cellToWorld, depthOf, mapBounds, pickCell } from '../iso/projection.ts';
import { PALETTE } from '../palette.ts';
import { getSettings } from '../../platform/settings.ts';

export const ARENA_SCENE = 'arena';
const ARENA_BASE = 'assets/arena';
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

/** Stable per-cell pseudo-random value in [0, 1) (visual only, never simulation). */
function hash(x: number, y: number, salt: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

interface ActorView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
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
  private heights: number[][] = [];
  private readonly tinted: Phaser.GameObjects.Image[] = [];
  private readonly shadows: Phaser.GameObjects.Image[] = [];
  private readonly trees: Tree[] = [];
  private readonly views = new Map<string, ActorView>();
  private readonly graves = new Map<string, Phaser.GameObjects.Graphics>();
  private fog?: Phaser.GameObjects.Graphics;
  private overlay?: Phaser.GameObjects.Graphics;
  private hover?: Phaser.GameObjects.Graphics;
  private fire?: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastRound = -1;
  private lastLog = 0;
  private lastSelected: string | null = null;
  private lastAmbient = -1;
  private built = false;
  private unsubscribe?: () => void;

  constructor(session: GameSession) {
    super(ARENA_SCENE);
    this.session = session;
  }

  preload(): void {
    this.terrainScale = pickTerrainScale();
    this.load.json('arenaTerrain', `${ARENA_BASE}/terrain/${this.terrainScale}/manifest.json`);
    this.load.json('arenaHeights', `${ARENA_BASE}/terrain/heights.json`);
    this.load.json('spriteManifest', `${ART_BASE}/sprites/manifest.json`);
    this.load.json('characterManifest', `${ART_BASE}/characters/manifest.json`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.forestDeep);
    const terrain = this.cache.json.get('arenaTerrain') as TerrainManifest;
    const sprites = this.cache.json.get('spriteManifest') as SpriteManifest;
    const characters = (
      this.cache.json.get('characterManifest') as { characters: Record<string, CharacterSheet> }
    ).characters;
    this.heights = (this.cache.json.get('arenaHeights') as HeightMap).heights;
    const base = `${ARENA_BASE}/terrain/${this.terrainScale}`;
    for (let r = 0; r < terrain.rows; r++)
      for (let c = 0; c < terrain.cols; c++)
        this.load.image(`arena_${r}_${c}`, `${base}/t_${r}_${c}.jpg`);
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
    this.load.once('complete', () => this.build(terrain, sprites, characters));
    this.load.start();
  }

  private build(
    terrain: TerrainManifest,
    sprites: SpriteManifest,
    characters: Record<string, CharacterSheet>,
  ): void {
    const s = terrain.scale;
    const [ax, ay] = terrain.originAnchor;
    for (let r = 0; r < terrain.rows; r++) {
      for (let c = 0; c < terrain.cols; c++) {
        this.tinted.push(
          this.add
            .image((c * terrain.tile - ax) / s, (r * terrain.tile - ay) / s, `arena_${r}_${c}`)
            .setOrigin(0, 0)
            .setScale(1 / s)
            .setDepth(-10000),
        );
      }
    }
    this.makeTextures();
    this.placeProps(sprites);
    this.makeAnimations(characters);

    this.overlay = this.add.graphics().setDepth(-4000);
    this.fog = this.add.graphics().setDepth(150000);
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.built = true;
    this.sync(true);
  }

  private heightAt(x: number, y: number): number {
    const cx = Math.max(0, Math.min(ARENA_SIZE - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(ARENA_SIZE - 1, Math.round(y)));
    return Math.max(0, this.heights[cy]?.[cx] ?? 0);
  }

  private makeTextures(): void {
    const tex = this.textures;
    if (!tex.exists('ember')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
      g.generateTexture('ember', 8, 8);
      g.destroy();
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
          key = pickOf(['oak_a', 'oak_b', 'birch', 'pine_a', 'oak_a'], hash(x, y, 5));
        else if (code === 'D' && r < 0.7)
          key = pickOf(['pine_a', 'pine_c', 'oak_b', 'pine_b', 'oak_a'], hash(x, y, 5));
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
    const label = this.add
      .text(pos.x, pos.y - 84, c.name.split(' ')[0]!, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: a.player ? '#F2C14E' : '#E9E4D8',
        stroke: '#0B0B0D',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(160000);
    sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
    v = {
      sprite,
      shadow,
      ring,
      label,
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
      v.sprite.setVisible(shown);
      v.shadow.setVisible(shown);
      v.label.setVisible(shown);
      v.ring.setVisible(shown);
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
      v.sprite.setAlpha(a.hidden ? 0.55 : 1);
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

  /** Unknown ground is black, remembered ground is dim, what the team sees now is clear. */
  private drawFog(arena: ArenaState, visible: Set<number>): void {
    const g = this.fog!;
    g.clear();
    const explored = new Set(arena.explored);
    // Exact diamonds on the ground plane tile without overlaps (no darker seams).
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    for (let y = 0; y < ARENA_SIZE; y++) {
      for (let x = 0; x < ARENA_SIZE; x++) {
        const i = y * ARENA_SIZE + x;
        if (visible.has(i)) continue;
        const alpha = explored.has(i) ? 0.42 : 0.86;
        const p = cellToWorld(x, y);
        g.fillStyle(0x070a08, alpha);
        g.fillTriangle(p.x, p.y - hh, p.x + hw, p.y, p.x, p.y + hh);
        g.fillTriangle(p.x, p.y - hh, p.x - hw, p.y, p.x, p.y + hh);
      }
    }
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
    if (light.ambient !== this.lastAmbient) {
      this.lastAmbient = light.ambient;
      for (const img of this.tinted) img.setTint(light.ambient);
      for (const s of this.shadows) s.setAlpha(0.9 * light.shadow);
      for (const v of this.views.values()) v.sprite.setTint(light.ambient);
    }
    // Smooth walking between rounds.
    for (const v of this.views.values()) {
      if (v.t < 1) v.t = Math.min(1, v.t + delta / MOVE_MS);
      const c = this.currentCell(v);
      const p = cellToWorld(c.x, c.y, this.heightAt(c.x, c.y));
      v.sprite.setPosition(p.x, p.y).setDepth(depthOf(c.x, c.y) + 9);
      v.shadow.setPosition(p.x, p.y);
      v.ring.setPosition(p.x, p.y);
      v.label.setPosition(p.x, p.y - 80);
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
