import * as Phaser from 'phaser';
import type { DistrictState, PlacedProp, PlacedStructure } from '../../core/index.ts';
import { buildWalkGrid, generateDistrict, seedFromString } from '../../core/index.ts';
import { neighbourOf } from '../../content/neighbours.ts';
import type { EdgeDir } from '../../content/neighbours.ts';
import { TEMPLATES } from '../../content/maps/index.ts';
import { Ambience } from '../district/ambience.ts';
import type { CharacterSheet, Role, TownsPerson } from '../district/townsfolk.ts';
import { Townsfolk } from '../district/townsfolk.ts';
import { CeremonyStage } from '../district/ceremony.ts';
import { D12_PALETTE, GroundPainter, paintFog } from '../district/ground.ts';
import { Relief } from '../district/relief.ts';
import { LightingRig } from '../lighting.ts';
import { TrainView } from '../district/train.ts';
import { HOME_DISTRICTS, homeProfile } from '../../content/homeDistricts.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import type { GameSession } from '../../game/session.ts';
import { CameraController } from '../camera/cameraController.ts';
import type { SpriteAsset, SpriteManifest } from '../district/assets.ts';
import { ART_BASE, SMOKE_POINTS, pickTerrainScale } from '../district/assets.ts';
import { daylightAt } from '../district/daylight.ts';
import { BUILDINGS } from '../../content/buildings.ts';
import { ageOf, checkPlacement, livingCitizens } from '../../core/index.ts';
import { TILE_W, cellToWorld, depthOf, mapBounds, pickCell } from '../iso/projection.ts';
import { PALETTE } from '../palette.ts';

export const DISTRICT_SCENE = 'district';

interface Glow {
  image: Phaser.GameObjects.Image;
  strength: number;
}

/** Templates drawn with real relief (DECISIONS I-76). */
const RELIEF_TEMPLATES: ReadonlySet<string> = new Set(['d12']);
/** Woods and boulders on the heights (scenery only, never part of the game state). */
const RELIEF_DECOR = [
  'k_pine_tall',
  'k_pine_round',
  'k_pine_small',
  'k_rock_large',
  'k_rock_tall',
  'k_tunnel',
];

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
  private ground?: GroundPainter;
  private relief?: Relief;
  /** Where the rails enter the cliff (set with the relief). */
  private tunnelAt?: { x: number; y: number };
  private lighting?: LightingRig;
  /** Visiting a neighbour through the fog: its district, generated the same way every time. */
  private visit: { id: string; district: DistrictState } | null = null;
  private camBounds?: { x: number; y: number; width: number; height: number };
  private train?: TrainView;
  private rail?: { x: number; stationY: number };
  private trainSeen = { train: -1, unload: -1, board: -1 };
  private roadsSig = '';

  constructor(session: GameSession) {
    super(DISTRICT_SCENE);
    this.session = session;
  }

  init(data?: { visit?: string }): void {
    const id = data?.visit;
    const template = id ? TEMPLATES[id] : undefined;
    const profile = id ? HOME_DISTRICTS[id as keyof typeof HOME_DISTRICTS] : undefined;
    this.visit =
      id && template && profile
        ? {
            id,
            district: generateDistrict(
              template,
              STRUCTURE_FOOTPRINTS,
              seedFromString(`visit-${id}`),
              profile,
            ),
          }
        : null;
    this.built = false;
    this.ground = undefined;
    this.relief = undefined;
    this.lighting = undefined;
    this.train = undefined;
    this.ceremony = undefined;
    this.townsfolk = undefined;
    this.ambience = undefined;
    this.structureViews.clear();
    this.propViews.clear();
    this.tinted.length = 0;
    this.shadows.length = 0;
    this.emissive.length = 0;
    this.glows.length = 0;
    this.smoke.length = 0;
    this.lastVersion = -1;
    this.roadsSig = '';
  }

  /** The district on screen: ours, or the neighbour we are visiting. */
  private shown(): DistrictState {
    return this.visit?.district ?? this.session.getState().district;
  }

  private shownHome(): string {
    return this.visit?.id ?? this.session.getState().meta.homeDistrictId;
  }

  preload(): void {
    this.terrainScale = pickTerrainScale();
    this.load.json('spriteManifest', `${ART_BASE}/sprites/manifest.json`);
    this.load.json('characterManifest', `${ART_BASE}/characters/manifest.json`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.coal);
    const sprites = this.cache.json.get('spriteManifest') as SpriteManifest;
    const district = this.shown();

    // Second loading pass: only the art this district actually uses.
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
        .filter(
          ([k]) => !k.includes('__') || new RegExp(`__${district.templateId}(_l[23])?$`).test(k),
        )
        .map(([k]) => k),
      ...district.props.map((p) => p.kind),
      ...(RELIEF_TEMPLATES.has(district.templateId) ? RELIEF_DECOR : []),
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
      this.build(sprites, district);
    });
    this.load.start();
  }

  private build(sprites: SpriteManifest, district: DistrictState): void {
    this.makeSmokeTexture();
    this.makeGlowTexture();
    this.makeAoTexture();

    // Stylised ground painted at runtime from the template and the roads laid in play.
    this.paintGround();

    this.sprites = sprites;
    this.syncWorld();
    this.decorateRelief();

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
        this.visit ? [] : this.townspeople(),
        (id) => this.session.ui.openCitizen(id),
      );
      const mines = district.structures
        .filter((st) => st.kind === 'mine_headframe')
        .map((st) => ({ x: st.x + 1, y: st.y + 1 }));
      this.ambience = new Ambience(this, template, mines);
      // The station: rails by the platform, where the Capitol train comes and goes.
      const station = homeProfile(this.shownHome()).station;
      const row = template.terrain[station.y] ?? '';
      const railX = row.indexOf('t');
      if (railX > 0 && !this.visit) {
        this.rail = { x: railX, stationY: station.y };
        this.train = new TrainView(this, sprites, characters, this.rail, (img, shadow) => {
          this.tinted.push(img);
          if (shadow) this.shadows.push(shadow);
        });
      }
    }

    this.hover = this.add.graphics().setDepth(100000);
    const size = template?.width ?? 64;
    const bounds = mapBounds(size, size);
    // Inset so the dark corners beyond the playable diamond stay off screen.
    this.camBounds = {
      x: bounds.x + bounds.width * 0.08,
      y: bounds.y - 260,
      width: bounds.width * 0.84,
      height: bounds.height * 0.94 + 260,
    };
    this.controller = new CameraController(this, {
      minZoom: 0.3,
      maxZoom: 1.6,
      bounds: this.camBounds,
    });
    this.lighting = new LightingRig(this);
    // Mist beyond the edges: the land goes on, but nobody from here has seen it.
    if (template) paintFog(this, template);
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

  /**
   * Pine woods and boulders on the mountain tops: dense clumps where the ground is level, a few
   * rocks clinging to the slopes. Deterministic per map, scenery only.
   */
  private decorateRelief(): void {
    const relief = this.relief;
    const sprites = this.sprites;
    if (!relief || !sprites) return;
    const hash = (x: number, y: number, k: number) => {
      const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
      return v - Math.floor(v);
    };
    const template = TEMPLATES[this.shown().templateId];
    if (!template) return;
    const clear = new Set<string>();
    // Where the rails run into the cliff, the line goes on through a tunnel.
    for (let y = 1; y < relief.height; y++) {
      const row = template.terrain[y] ?? '';
      const x = row.indexOf('t');
      if (x < 0) continue;
      // The track's northern end, with the cliff a few steps beyond it.
      if (![1, 2, 3].some((k) => template.terrain[y - k]?.[x] === 'R')) break;
      const tunnel = sprites.assets.k_tunnel;
      if (tunnel)
        this.addLayers('k_tunnel', tunnel, x + 0.5, y - 1.5, 0, depthOf(x + 1, y - 1) + 8, 2);
      for (let dy = -4; dy <= 0; dy++)
        for (let dx = -2; dx <= 3; dx++) clear.add(`${x + dx},${y + dy}`);
      break;
    }
    for (let y = 0; y < relief.height; y++)
      for (let x = 0; x < relief.width; x++) {
        if (template.terrain[y]?.[x] !== 'R' || clear.has(`${x},${y}`)) continue;
        const h = relief.cell(x, y);
        if (h < 0.6) continue;
        const level = relief.normal(x, y).z;
        // Clumps: a slow noise decides where the woods are, a fast one picks the trees.
        const wood = Math.sin(x * 0.45 + Math.cos(y * 0.3) * 2) + Math.cos(y * 0.5 - x * 0.2);
        const r = hash(x, y, 1);
        let kind: string | null = null;
        if (level > 0.86 && wood > -0.2 && r < 0.62)
          kind = r < 0.3 ? 'k_pine_tall' : r < 0.5 ? 'k_pine_round' : 'k_pine_small';
        else if (level <= 0.86 && r < 0.07) kind = r < 0.035 ? 'k_rock_large' : 'k_rock_tall';
        if (!kind) continue;
        const ox = (hash(x, y, 2) - 0.5) * 0.6;
        const oy = (hash(x, y, 3) - 0.5) * 0.6;
        const asset = sprites.assets[kind];
        if (!asset) continue;
        this.addLayers(
          kind,
          asset,
          x + ox,
          y + oy,
          relief.at(x + ox, y + oy),
          depthOf(x + ox, y + oy) + 8,
          0.8,
        );
      }
  }

  /** The visual relief: the town floor is flat, cliffs and wooded hills rise around it. */
  private heightAt(x: number, y: number): number {
    return this.relief?.cell(x, y) ?? 0;
  }

  private paintGround(): void {
    const template = TEMPLATES[this.shown().templateId];
    if (!template) return;
    this.ground ??= new GroundPainter(this, this.terrainScale === '1x' ? 0.75 : 0.5);
    const roads = new Set<number>(this.shown().roads);
    this.roadsSig = [...roads].join(',');
    // District 12 leads the way with real relief (the others follow once it is signed off).
    if (RELIEF_TEMPLATES.has(template.id) && this.relief?.width !== template.width) {
      this.relief = new Relief(template, template.id.length * 7 + 3);
      this.tunnelAt = undefined;
      for (let y = 1; y < template.height && !this.tunnelAt; y++) {
        const x = (template.terrain[y] ?? '').indexOf('t');
        if (x >= 0 && [1, 2, 3].some((k) => template.terrain[y - k]?.[x] === 'R'))
          this.tunnelAt = { x: x + 0.5, y: y - 1 };
        if (x >= 0) break;
      }
    }
    const fresh = this.ground.paint({
      template,
      roads,
      relief: this.relief,
      palette: template.id === 'd12' ? D12_PALETTE : undefined,
      lowPoly: RELIEF_TEMPLATES.has(template.id),
    });
    const alive = (o: { active: boolean }) => o.active;
    this.tinted.splice(0, this.tinted.length, ...this.tinted.filter(alive), ...fresh);
    this.lastAmbient = -1; // re-tint the new ground at the current hour
  }

  /** Visual variant (same footprint, other materials) chosen from the position: stable per save. */
  private spriteKey(s: PlacedStructure, sprites: SpriteManifest): string {
    // Regional architecture first (e.g. house_shack__d11): every district builds its own way.
    const regional = `${s.kind}__${this.shownHome()}`;
    // Upgraded homes look better off (annex, flower boxes, a fenced yard at level 3).
    if (s.level >= 2) {
      const base = sprites.assets[regional] ? regional : s.kind;
      const levelled = `${base}_l${s.level}`;
      if (sprites.assets[levelled]) return levelled;
    }
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
    const district = this.shown();
    // New paths were laid: repaint the ground.
    if (district.roads.join(',') !== this.roadsSig) this.paintGround();
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
    const img = this.addLayers(
      key,
      asset,
      cx,
      cy,
      0,
      depthOf(s.x + w - 1, s.y + d - 1) + 8,
      Math.max(w, d),
    );
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
    const img = this.addLayers(key, asset, cx, cy, Math.max(0, ground), depth, Math.max(w, d));
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
    // Keep the tunnel mouth and the track in front of it clear of scenery.
    if (
      this.tunnelAt &&
      Math.abs(p.x - this.tunnelAt.x) <= 3 &&
      Math.abs(p.y - this.tunnelAt.y) <= 3
    )
      return;
    const x = p.x + p.ox;
    const y = p.y + p.oy;
    const big = p.kind.includes('tree') || p.kind.includes('pine') || p.kind.includes('oak');
    const img = this.addLayers(
      p.kind,
      asset,
      x,
      y,
      this.heightAt(p.x, p.y),
      depthOf(x, y) + 8,
      big ? 0.8 : 0.55,
    );
    if (p.kind === 'lamp') {
      this.addGlow(img.x - 6, img.y - 8, 2.6, 0xffb565, 0.55, -4000);
      // The lantern sits on top of the post (Kenney lamp post, 1.4 cells tall).
      this.addGlow(img.x, img.y - 104, 0.7, 0xffd9a0, 0.9, img.depth + 1);
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
    foot = 1,
  ) {
    const pos = cellToWorld(cx, cy, z);
    // Contact shadow: a soft dark pool right under the object, so nothing floats on the ground.
    if (asset.layers.includes('shadow') && this.textures.exists('ao_blob')) {
      const ao = this.track(this.add.image(pos.x, pos.y, 'ao_blob'))
        .setScale(foot * 1.05, foot * 1.05)
        .setDepth(-4990)
        .setAlpha(0.55)
        .setData('ao', true);
      this.shadows.push(ao);
    }
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

  /** The contact shadow: a squashed radial pool, darkest at the centre. */
  private makeAoTexture(): void {
    if (this.textures.exists('ao_blob')) return;
    const canvas = this.textures.createCanvas('ao_blob', 128, 64);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 0.5, 0, 0);
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(12,14,22,0.7)');
    g.addColorStop(0.55, 'rgba(12,14,22,0.35)');
    g.addColorStop(1, 'rgba(12,14,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    canvas.refresh();
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
    // Crossing the fog: the scene is rebuilt for the neighbour (or for home on the way back).
    const visiting = this.session.ui.get().visiting;
    if (visiting !== (this.visit?.id ?? null)) {
      this.scene.restart(visiting ? { visit: visiting } : {});
      return;
    }
    if (!this.built) return;
    this.updateEdge();
    this.controller?.update(delta);
    const version = this.session.getSnapshot().version;
    if (version !== this.lastVersion) {
      this.lastVersion = version;
      this.syncWorld();
    }
    this.updatePlacement();
    this.updateCeremony();
    this.updateTrain();
    const state = this.session.getState();
    const hour = (state.clock.tick % 24) + this.session.getTickProgress();
    const light = daylightAt(hour);
    this.lighting?.update(hour, light.night, delta);
    if (light.ambient !== this.lastAmbient) {
      this.lastAmbient = light.ambient;
      for (const t of this.tinted) t.setTint(light.ambient);
      // Cast shadows fade with the sun; contact shadows stay (a softer pool at night).
      for (const s of this.shadows)
        s.setAlpha(s.getData('ao') ? 0.35 + 0.25 * light.shadow : 0.9 * light.shadow);
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

  /** Pressing the camera against the fog shows which district lies beyond it. */
  private updateEdge(): void {
    const b = this.camBounds;
    if (!b || this.session.getState().phase.kind !== 'district' || this.session.cinematic) {
      this.session.ui.setEdge(null);
      return;
    }
    const v = this.cameras.main.worldView;
    const near = 6;
    let dir: EdgeDir | null = null;
    if (v.y <= b.y + near) dir = 'n';
    else if (v.bottom >= b.y + b.height - near) dir = 's';
    else if (v.x <= b.x + near) dir = 'w';
    else if (v.right >= b.x + b.width - near) dir = 'e';
    const district = dir ? neighbourOf(this.shownHome(), dir) : null;
    this.session.ui.setEdge(dir && district ? { dir, district } : null);
  }

  /** The Capitol train follows the cinematic's orders; once it ends the line is empty again. */
  private updateTrain(): void {
    const train = this.train;
    if (!train || !this.rail) return;
    const view = this.session.cinematic?.get();
    if (!view || view.done) {
      if (this.trainSeen.train >= 0 || this.trainSeen.unload >= 0) {
        train.hide();
        this.trainSeen = { train: -1, unload: -1, board: -1 };
      }
      return;
    }
    const live = (index: number) => view.index === index;
    if (view.train && view.train.index !== this.trainSeen.train) {
      this.trainSeen.train = view.train.index;
      const ms = live(view.train.index) ? view.train.ms : 0;
      if (view.train.action === 'arrive') train.arrive(ms);
      else if (view.train.action === 'depart') train.depart(ms);
      else if (view.train.action === 'park') train.park();
      else train.hide();
    }
    if (view.boarded && view.boarded.index !== this.trainSeen.board) {
      this.trainSeen.board = view.boarded.index;
      const ms = live(view.boarded.index) ? view.boarded.ms : 0;
      this.ceremony?.boardTrain(view.boarded.citizenIds, this.rail.x, this.rail.stationY, ms);
    }
    if (view.unloaded && view.unloaded.index !== this.trainSeen.unload) {
      this.trainSeen.unload = view.unloaded.index;
      const ms = live(view.unloaded.index) ? view.unloaded.ms : 0;
      const state = this.session.getState();
      const day = Math.floor(state.clock.tick / 24);
      const roles = view.unloaded.survivors.map((id): Role => {
        const c = state.population.citizens[id];
        return c && c.sex === 'F' ? 'woman' : ageOf(c!, day) < 14 ? 'child' : 'worker';
      });
      train.unload(roles, view.unloaded.coffins, ms);
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
        const regional = `${kind}__${this.session.getState().meta.homeDistrictId}`;
        const tex = this.textures.exists(regional) ? regional : kind;
        const a = this.sprites?.assets[tex] ?? asset;
        if (!this.ghost) this.ghost = this.add.image(pos.x, pos.y, tex).setDepth(99999);
        // The ghost glides after the finger instead of jumping from cell to cell.
        const gx = this.ghost.visible ? this.ghost.x + (pos.x - this.ghost.x) * 0.35 : pos.x;
        const gy = this.ghost.visible ? this.ghost.y + (pos.y - this.ghost.y) * 0.35 : pos.y;
        this.ghost
          .setTexture(tex)
          .setVisible(true)
          .setPosition(gx, gy)
          .setOrigin(a.anchor[0] / a.size[0], a.anchor[1] / a.size[1])
          .setScale(1 / a.scale)
          .setAlpha(0.75)
          .setTint(problem ? 0xff6a5a : 0x9be08a);
      }
      this.softFootprint(marker, x, y, w, d, problem ? 0xe0533f : 0x9be08a);
    }
    const selected = ui.selectedId
      ? this.session.getState().district.structures.find((s) => s.id === ui.selectedId)
      : null;
    if (selected) {
      const { w, d } = STRUCTURE_FOOTPRINTS[selected.kind];
      this.softFootprint(marker, selected.x, selected.y, w, d, PALETTE.lampOchre);
    }
  }

  /** A soft glow on the ground under a building: no grid lines, just a pool of light. */
  private softFootprint(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    d: number,
    color: number,
  ): void {
    const c = cellToWorld(x + (w - 1) / 2, y + (d - 1) / 2);
    const rx = ((w + d) / 2) * (TILE_W / 2) * 1.05;
    const ry = rx / 2;
    for (let i = 3; i >= 1; i--) {
      g.fillStyle(color, 0.08 * i);
      g.fillEllipse(c.x, c.y, rx * 2 * (0.7 + i * 0.12), ry * 2 * (0.7 + i * 0.12));
    }
    g.lineStyle(3, color, 0.7);
    g.strokeEllipse(c.x, c.y, rx * 2, ry * 2);
  }

  /** A tap (not a drag) places the building in placement mode, or selects one in view mode. */
  private onTap(pointer: Phaser.Input.Pointer): void {
    if (this.visit) return; // a visitor only looks
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

  /** No grid on screen: hovering the ground shows nothing (buildings react on tap). */
  private drawHover(_pointer: Phaser.Input.Pointer): void {
    this.hover?.clear();
  }
}
