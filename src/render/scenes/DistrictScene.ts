import { homeProfile } from '../../content/homeDistricts.ts';
import * as Phaser from 'phaser';
import type { DistrictState, PlacedProp, PlacedStructure } from '../../core/index.ts';
import { buildWalkGrid } from '../../core/index.ts';
import { TEMPLATES } from '../../content/maps/index.ts';
import { Ambience } from '../district/ambience.ts';
import type { CharacterSheet, Role, TownsPerson } from '../district/townsfolk.ts';
import { Townsfolk } from '../district/townsfolk.ts';
import { CeremonyStage } from '../district/ceremony.ts';
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
import { BUILDINGS } from '../../content/buildings.ts';
import { ageOf, checkPlacement, livingCitizens } from '../../core/index.ts';
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
  private sprites?: SpriteManifest;
  /** Objects created while building one structure/prop view (see track()). */
  private collecting: Phaser.GameObjects.GameObject[] | null = null;
  private readonly structureViews = new Map<
    string,
    { sig: string; objects: Phaser.GameObjects.GameObject[] }
  >();
  private readonly propViews = new Map<string, Phaser.GameObjects.GameObject[]>();
  private lastVersion = -1;
  private ghost?: Phaser.GameObjects.Image;
  private ceremony?: CeremonyStage;
  private characters: Record<string, CharacterSheet> = {};
  private marker?: Phaser.GameObjects.Graphics;
  private ambience?: Ambience;
  private built = false;

  constructor(session: GameSession) {
    super(DISTRICT_SCENE);
    this.session = session;
  }

  preload(): void {
    this.terrainScale = pickTerrainScale();
    const terrainBase = homeProfile(this.session.getState().meta.homeDistrictId).terrainBase;
    this.load.json('terrainManifest', `${terrainBase}/${this.terrainScale}/manifest.json`);
    this.load.json('spriteManifest', `${ART_BASE}/sprites/manifest.json`);
    this.load.json('heights', `${terrainBase}/heights.json`);
    this.load.json('characterManifest', `${ART_BASE}/characters/manifest.json`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.coal);
    const terrain = this.cache.json.get('terrainManifest') as TerrainManifest;
    const sprites = this.cache.json.get('spriteManifest') as SpriteManifest;
    this.heights = (this.cache.json.get('heights') as HeightMap).heights;
    const district = this.session.getState().district;

    // Second loading pass: only the art this district actually uses.
    const base = `${homeProfile(this.session.getState().meta.homeDistrictId).terrainBase}/${this.terrainScale}`;
    for (let r = 0; r < terrain.rows; r++) {
      for (let c = 0; c < terrain.cols; c++)
        this.load.image(`terrain_${r}_${c}`, `${base}/t_${r}_${c}.jpg`);
    }
    const characters = (
      this.cache.json.get('characterManifest') as { characters: Record<string, CharacterSheet> }
    ).characters;
    for (const sheet of Object.values(characters)) {
      this.load.spritesheet(`char_${sheet.name}`, `${ART_BASE}/characters/${sheet.name}.webp`, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    const kinds = new Set<string>([
      ...Object.entries(sprites.assets)
        .filter(([, a]) => a.kind === 'building')
        // Only this district's regional architecture (plus the shared models).
        .filter(([k]) => !k.includes('__') || k.endsWith(`__${district.templateId}`))
        .map(([k]) => k),
      ...district.props.map((p) => p.kind),
    ]);
    for (const kind of kinds) {
      const asset = sprites.assets[kind];
      if (!asset) continue;
      const path = `${ART_BASE}/sprites/${kind}`;
      this.load.image(kind, `${path}.webp`);
      if (asset.layers.includes('shadow')) this.load.image(`${kind}_s`, `${path}_s.webp`);
      if (asset.layers.includes('emission')) this.load.image(`${kind}_e`, `${path}_e.webp`);
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

    this.sprites = sprites;
    this.syncWorld();

    // Life: townsfolk on their daily routine and small ambient details.
    const template = TEMPLATES[district.templateId];
    if (template) {
      const grid = buildWalkGrid(template, district, STRUCTURE_FOOTPRINTS);
      const characters = (
        this.cache.json.get('characterManifest') as { characters: Record<string, CharacterSheet> }
      ).characters;
      this.characters = characters;
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      this.townsfolk = new Townsfolk(
        this,
        grid,
        district,
        characters,
        coarse ? 40 : 70,
        this.townspeople(),
        (id) => this.session.ui.openCitizen(id),
      );
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
    const pz = template?.plaza ?? { x0: 24, y0: 20, x1: 29, y1: 26 };
    const plaza = cellToWorld((pz.x0 + pz.x1) / 2, (pz.y0 + pz.y1) / 2);
    // Small screens start further out so the whole town core is visible.
    const fit = Math.min(this.scale.width, this.scale.height) / 1100;
    this.cameras.main.setZoom(Phaser.Math.Clamp(fit, 0.45, 0.75)).centerOn(plaza.x, plaza.y);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.drawHover(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.marker = this.add.graphics().setDepth(100001);
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
    // Regional architecture first (e.g. house_shack__d11): every district builds its own way.
    const regional = `${s.kind}__${this.session.getState().meta.homeDistrictId}`;
    if (sprites.assets[regional]) return regional;
    const variants = Object.keys(sprites.assets).filter(
      (k) => k === s.kind || (k.startsWith(`${s.kind}_`) && k.length === s.kind.length + 2),
    );
    variants.sort();
    return variants[(s.x * 31 + s.y * 17) % variants.length] ?? s.kind;
  }

  /** Registers objects created for the view currently being built. */
  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.collecting?.push(obj);
    return obj;
  }

  private destroyObjects(objects: Phaser.GameObjects.GameObject[]): void {
    for (const o of objects) o.destroy();
    const alive = (o: { active: boolean }) => o.active;
    this.tinted.splice(0, this.tinted.length, ...this.tinted.filter(alive));
    this.shadows.splice(0, this.shadows.length, ...this.shadows.filter(alive));
    this.emissive.splice(0, this.emissive.length, ...this.emissive.filter(alive));
    this.glows.splice(0, this.glows.length, ...this.glows.filter((g) => g.image.active));
    this.smoke.splice(0, this.smoke.length, ...this.smoke.filter(alive));
  }

  /** Brings structures and props on screen in line with the game state (cheap diff). */
  private syncWorld(): void {
    const sprites = this.sprites;
    if (!sprites) return;
    const district = this.session.getState().district;
    const seen = new Set<string>();
    for (const s of district.structures) {
      seen.add(s.id);
      const def = BUILDINGS[s.kind];
      const pct = s.built ? 1 : Math.floor((s.progress / Math.max(1, def.buildWork)) * 20) / 20;
      const sig = `${s.built}:${s.level}:${s.x},${s.y}:${pct}`;
      const view = this.structureViews.get(s.id);
      if (view?.sig === sig) continue;
      if (view) this.destroyObjects(view.objects);
      this.collecting = [];
      if (s.built) {
        const key = this.spriteKey(s, sprites);
        this.placeStructure(s, key, sprites.assets[key]);
      } else {
        this.placeSite(s, pct);
      }
      this.structureViews.set(s.id, { sig, objects: this.collecting });
      this.collecting = null;
    }
    for (const [id, view] of this.structureViews) {
      if (!seen.has(id)) {
        this.destroyObjects(view.objects);
        this.structureViews.delete(id);
      }
    }
    const propKeys = new Set<string>();
    for (const p of district.props) {
      const k = `${p.kind}@${p.x},${p.y}`;
      propKeys.add(k);
      if (this.propViews.has(k)) continue;
      this.collecting = [];
      this.placeProp(p, sprites.assets[p.kind]);
      this.propViews.set(k, this.collecting);
      this.collecting = null;
    }
    for (const [k, objects] of this.propViews) {
      if (!propKeys.has(k)) {
        this.destroyObjects(objects);
        this.propViews.delete(k);
      }
    }
    const template = TEMPLATES[district.templateId];
    if (template) this.townsfolk?.setGrid(buildWalkGrid(template, district, STRUCTURE_FOOTPRINTS));
  }

  /** Citizens who walk the streets: working adults first, then children and elders. */
  private townspeople(): TownsPerson[] {
    const state = this.session.getState();
    const day = Math.floor(state.clock.tick / 24);
    const structures = new Map(state.district.structures.map((st) => [st.id, st]));
    const people = livingCitizens(state.population)
      .filter((c) => c.homeId)
      .map((c): TownsPerson => {
        const age = ageOf(c, day);
        const job = c.jobId ? structures.get(c.jobId) : undefined;
        const role: Role =
          job?.kind === 'mine_headframe' || job?.kind === 'quarry'
            ? 'miner'
            : age < 13
              ? 'child'
              : age >= 62
                ? 'elder'
                : c.sex === 'F'
                  ? c.genes.hair % 2 === 0
                    ? 'woman'
                    : 'woman_b'
                  : 'worker';
        return { id: c.id, role, homeId: c.homeId!, jobId: c.jobId };
      });
    return people.sort((a, b) => Number(!!b.jobId) - Number(!!a.jobId) || (a.id < b.id ? -1 : 1));
  }

  private placeSite(s: PlacedStructure, pct: number): void {
    const { w, d } = STRUCTURE_FOOTPRINTS[s.kind];
    const key = `site_${w}x${d}`;
    const asset = this.sprites?.assets[key];
    if (!asset) return;
    const cx = s.x + (w - 1) / 2;
    const cy = s.y + (d - 1) / 2;
    const img = this.addLayers(key, asset, cx, cy, 0, depthOf(s.x + w - 1, s.y + d - 1) + 8);
    const bar = this.track(this.add.graphics().setDepth(90000));
    bar.fillStyle(0x16161a, 0.85).fillRect(img.x - 40, img.y - 120, 80, 8);
    bar.fillStyle(PALETTE.lampOchre, 1).fillRect(img.x - 39, img.y - 119, 78 * pct, 6);
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
      const shadow = this.track(this.add.image(pos.x, pos.y, `${key}_s`))
        .setOrigin(...origin)
        .setScale(scale)
        .setDepth(-5000);
      this.shadows.push(shadow);
    }
    const img = this.track(this.add.image(pos.x, pos.y, key))
      .setOrigin(...origin)
      .setScale(scale)
      .setDepth(depth);
    this.tinted.push(img);
    if (asset.layers.includes('emission')) {
      const glow = this.track(this.add.image(pos.x, pos.y, `${key}_e`))
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
    const image = this.track(this.add.image(x, y, 'glow'))
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
    const emitter = this.track(
      this.add.particles(x, y, 'smoke', {
        lifespan: { min: 3500, max: 5500 },
        speedY: { min: -26, max: -14 },
        speedX: { min: -4, max: 12 },
        scale: { start: 0.18, end: 1.1 },
        alpha: { start: 0.38, end: 0 },
        rotate: { min: 0, max: 360 },
        frequency: 340,
        tint: 0x9a9aa2,
      }),
    );
    emitter.setDepth(depth);
    this.smoke.push(emitter);
  }

  override update(time: number, delta: number): void {
    if (!this.built) return;
    this.controller?.update(delta);
    const version = this.session.getSnapshot().version;
    if (version !== this.lastVersion) {
      this.lastVersion = version;
      this.syncWorld();
    }
    this.updatePlacement();
    this.updateCeremony();
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

  private pointerCell(pointer: Phaser.Input.Pointer): { cx: number; cy: number } {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return pickCell(world.x, world.y);
  }

  /** The Criba: crowd in the plaza while the phase lasts; the camera follows the cinematic. */
  private updateCeremony(): void {
    const state = this.session.getState();
    const inCeremony = state.phase.kind === 'selection';
    if (inCeremony && !this.ceremony && state.competition.current) {
      this.ceremony = new CeremonyStage(this, state, this.characters);
      this.townsfolk?.setHidden(true);
    } else if (!inCeremony && this.ceremony) {
      this.ceremony.destroy();
      this.ceremony = undefined;
      this.townsfolk?.setHidden(false);
    }
    const view = this.session.cinematic?.get();
    if (!view || view.done) return;
    this.ceremony?.setFocus(view.focus);
    // Walks: the step being played animates; earlier ones (skipped ahead) land at once.
    for (const id of view.walked) {
      const live = view.step?.kind === 'walk' && view.step.citizenId === id;
      this.ceremony?.walkToStage(id, live ? (view.step?.ms ?? 0) * 0.9 : 0);
    }
    const cam = this.cameras.main;
    const focus = this.ceremony?.focusPoint(view.focus);
    const target =
      focus ?? (view.camera ? cellToWorld(view.camera.cell.x, view.camera.cell.y) : null);
    if (target) {
      const k = view.camera?.glide ?? 0.045;
      cam.centerOn(
        cam.midPoint.x + (target.x - cam.midPoint.x) * k,
        cam.midPoint.y + (target.y - cam.midPoint.y) * k,
      );
      if (view.camera) cam.setZoom(cam.zoom + (view.camera.zoom - cam.zoom) * k);
    }
  }

  /** Ghost of the building being placed, green when valid, red otherwise. */
  private updatePlacement(): void {
    const ui = this.session.ui.get();
    const marker = this.marker;
    if (!marker) return;
    marker.clear();
    if (ui.mode !== 'place' || !ui.placeKind) {
      this.ghost?.setVisible(false);
    } else {
      const kind = ui.placeKind;
      const { w, d } = STRUCTURE_FOOTPRINTS[kind];
      const { cx, cy } = this.pointerCell(this.input.activePointer);
      const x = cx - Math.floor((w - 1) / 2);
      const y = cy - Math.floor((d - 1) / 2);
      const problem = checkPlacement(this.session.getState(), kind, x, y);
      this.session.ui.hint(problem);
      const asset = this.sprites?.assets[kind];
      if (asset) {
        const pos = cellToWorld(x + (w - 1) / 2, y + (d - 1) / 2, 0);
        if (!this.ghost) this.ghost = this.add.image(0, 0, kind).setDepth(99999);
        this.ghost
          .setTexture(kind)
          .setVisible(true)
          .setPosition(pos.x, pos.y)
          .setOrigin(asset.anchor[0] / asset.size[0], asset.anchor[1] / asset.size[1])
          .setScale(1 / asset.scale)
          .setAlpha(0.7)
          .setTint(problem ? 0xff6a5a : 0x9be08a);
      }
      this.outline(marker, x, y, w, d, problem ? 0xe0533f : 0x9be08a);
    }
    const selected = ui.selectedId
      ? this.session.getState().district.structures.find((s) => s.id === ui.selectedId)
      : null;
    if (selected) {
      const { w, d } = STRUCTURE_FOOTPRINTS[selected.kind];
      this.outline(marker, selected.x, selected.y, w, d, PALETTE.lampOchre);
    }
  }

  private outline(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    d: number,
    color: number,
  ): void {
    const a = cellToWorld(x - 0.5, y - 0.5);
    const b = cellToWorld(x + w - 0.5, y - 0.5);
    const c = cellToWorld(x + w - 0.5, y + d - 0.5);
    const e = cellToWorld(x - 0.5, y + d - 0.5);
    g.lineStyle(3, color, 0.95).strokePoints(
      [
        new Phaser.Math.Vector2(a.x, a.y),
        new Phaser.Math.Vector2(b.x, b.y),
        new Phaser.Math.Vector2(c.x, c.y),
        new Phaser.Math.Vector2(e.x, e.y),
      ],
      true,
    );
    g.fillStyle(color, 0.12).fillPoints(
      [
        new Phaser.Math.Vector2(a.x, a.y),
        new Phaser.Math.Vector2(b.x, b.y),
        new Phaser.Math.Vector2(c.x, c.y),
        new Phaser.Math.Vector2(e.x, e.y),
      ],
      true,
    );
  }

  /** A tap (not a drag) places the building in placement mode, or selects one in view mode. */
  private onTap(pointer: Phaser.Input.Pointer): void {
    if (this.controller?.gestureConsumed || pointer.rightButtonReleased()) {
      if (pointer.rightButtonReleased()) this.session.ui.cancel();
      return;
    }
    const ui = this.session.ui.get();
    const { cx, cy } = this.pointerCell(pointer);
    if (ui.mode === 'place' && ui.placeKind) {
      const { w, d } = STRUCTURE_FOOTPRINTS[ui.placeKind];
      const x = cx - Math.floor((w - 1) / 2);
      const y = cy - Math.floor((d - 1) / 2);
      const result = this.session.dispatch({ type: 'build/place', kind: ui.placeKind, x, y });
      if (result.ok) this.session.ui.cancel();
      return;
    }
    const hit = this.session.getState().district.structures.find((s) => {
      const { w, d } = STRUCTURE_FOOTPRINTS[s.kind];
      return cx >= s.x && cy >= s.y && cx < s.x + w && cy < s.y + d;
    });
    this.session.ui.select(hit?.id ?? null);
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
