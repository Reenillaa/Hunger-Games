import type * as Phaser from 'phaser';
import type { Cell, DistrictState, PathGrid, PlacedStructure } from '../../core/index.ts';
import { entranceOf, findPath } from '../../core/index.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import { cellToWorld, depthOf } from '../iso/projection.ts';

export interface CharacterSheet {
  name: string;
  frameWidth: number;
  frameHeight: number;
  anchor: [number, number];
  scale: number;
  directions: string[];
  walkFrames: number;
}

type Role = 'miner' | 'worker' | 'woman' | 'woman_b' | 'child' | 'elder' | 'warden';

interface Agent {
  role: Role;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  home: Cell;
  work: Cell;
  path: Cell[];
  step: number;
  progress: number;
  dir: number;
  wait: number;
  /** Deterministic per-agent pseudo-random sequence. */
  seed: number;
  inside: boolean;
}

const DIRS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];

function rand(agent: Agent): number {
  agent.seed = (agent.seed * 1103515245 + 12345) & 0x7fffffff;
  return agent.seed / 0x7fffffff;
}

/** Screen direction index (0 = towards the viewer, clockwise) of a move between cells. */
export function directionIndex(dx: number, dy: number): number {
  const sx = (dx - dy) * 64;
  const sy = (dx + dy) * 32;
  const angle = Math.atan2(sy, sx); // 0 = right, +π/2 = down
  const idx = Math.round((angle - Math.PI / 2) / (Math.PI / 4));
  return ((idx % 8) + 8) % 8;
}

/**
 * Visual townsfolk following a daily routine (Phase 2 ambience). In Phase 4 every agent becomes
 * the visible avatar of a real citizen; the movement code stays the same.
 */
export class Townsfolk {
  private readonly agents: Agent[] = [];
  private readonly scene: Phaser.Scene;
  private grid: PathGrid;
  private readonly places: {
    mine: Cell[];
    plaza: Cell[];
    shops: Cell[];
    homes: Cell[];
    patrol: Cell[];
  };

  constructor(
    scene: Phaser.Scene,
    grid: PathGrid,
    district: DistrictState,
    sheets: Record<string, CharacterSheet>,
    maxAgents: number,
  ) {
    this.scene = scene;
    this.grid = grid;
    const entrance = (s: PlacedStructure) => entranceOf(s, STRUCTURE_FOOTPRINTS, grid);
    const of = (kinds: string[]) =>
      district.structures
        .filter((s) => kinds.includes(s.kind))
        .map(entrance)
        .filter((c): c is Cell => c !== null);
    const homes = district.structures.filter((s) => s.kind.startsWith('house'));
    this.places = {
      mine: of(['mine_headframe']),
      plaza: of(['stage', 'town_hall']),
      shops: of(['economato', 'warehouse']),
      homes: homes.map(entrance).filter((c): c is Cell => c !== null),
      patrol: of(['town_hall', 'stage', 'warehouse', 'economato']),
    };
    this.makeAnimations(sheets);
    this.makeShadowTexture();

    const roles: Role[] = [
      'miner',
      'miner',
      'woman',
      'worker',
      'child',
      'woman_b',
      'elder',
      'miner',
    ];
    let n = 0;
    homes.forEach((house, i) => {
      const home = entrance(house);
      if (!home) return;
      const residents = house.kind === 'house_terrace' ? 3 : 2;
      for (let r = 0; r < residents && n < maxAgents - 3; r++) {
        const role = roles[(i * 3 + r) % roles.length]!;
        this.spawn(
          role,
          home,
          role === 'miner' ? this.pick(this.places.mine, i) : this.pick(this.places.shops, i + r),
          i * 97 + r * 13 + 7,
          sheets,
        );
        n++;
      }
    });
    for (let k = 0; k < 3; k++) {
      const start = this.pick(this.places.patrol, k);
      if (start) this.spawn('warden', start, start, 5000 + k * 31, sheets);
    }
  }

  private pick(list: Cell[], i: number): Cell {
    return list[i % Math.max(1, list.length)] ?? { x: 26, y: 23 };
  }

  private spawn(
    role: Role,
    home: Cell,
    work: Cell,
    seed: number,
    sheets: Record<string, CharacterSheet>,
  ): void {
    const sheet = sheets[role];
    if (!sheet) return;
    const sprite = this.scene.add
      .sprite(0, 0, `char_${role}`, 0)
      .setOrigin(sheet.anchor[0] / sheet.frameWidth, sheet.anchor[1] / sheet.frameHeight)
      .setScale(1 / sheet.scale)
      .setVisible(false);
    const shadow = this.scene.add
      .image(0, 0, 'blob_shadow')
      .setAlpha(0.45)
      .setVisible(false)
      .setDepth(-4500);
    this.agents.push({
      role,
      sprite,
      shadow,
      home,
      work,
      path: [],
      step: 0,
      progress: 0,
      dir: 0,
      wait: (seed % 17) * 0.3,
      seed,
      inside: true,
    });
  }

  private makeAnimations(sheets: Record<string, CharacterSheet>): void {
    for (const [name, sheet] of Object.entries(sheets)) {
      const cols = sheet.walkFrames + 1;
      DIRS.forEach((dir, row) => {
        const key = `${name}_walk_${dir}`;
        if (this.scene.anims.exists(key)) return;
        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(`char_${name}`, {
            start: row * cols + 1,
            end: row * cols + sheet.walkFrames,
          }),
          frameRate: 10,
          repeat: -1,
        });
      });
    }
  }

  private makeShadowTexture(): void {
    if (this.scene.textures.exists('blob_shadow')) return;
    const canvas = this.scene.textures.createCanvas('blob_shadow', 40, 20);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return;
    const g = ctx.createRadialGradient(20, 10, 1, 20, 10, 18);
    g.addColorStop(0, 'rgba(0,0,0,0.8)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.scale(1, 0.5);
    ctx.fillRect(0, 0, 40, 40);
    canvas.refresh();
  }

  /** Where an agent wants to be at this hour, or null to stay inside. */
  private destination(a: Agent, hour: number): Cell | null {
    if (a.role === 'warden') return this.pick(this.places.patrol, Math.floor(rand(a) * 8));
    const night = hour < 5 || hour >= 22;
    if (night) return a.home;
    if (a.role === 'miner') return hour >= 5 && hour < 18 ? a.work : a.home;
    const r = rand(a);
    if (hour >= 19) return r < 0.7 ? a.home : this.pick(this.places.plaza, Math.floor(r * 10));
    if (r < 0.35) return this.pick(this.places.plaza, Math.floor(r * 10));
    if (r < 0.6) return a.work;
    if (r < 0.8) return this.pick(this.places.homes, Math.floor(r * 50));
    return a.home;
  }

  update(deltaMs: number, hour: number, speed: number, tint: number): void {
    const dt = (deltaMs / 1000) * speed;
    for (const a of this.agents) {
      a.sprite.setTint(tint);
      if (speed === 0) {
        a.sprite.anims.pause();
        continue;
      }
      if (a.path.length === 0) {
        a.wait -= dt;
        if (a.wait > 0) continue;
        const here = a.inside ? a.home : (a.path.at(-1) ?? a.home);
        const target = this.destination(a, hour);
        a.wait = 4 + rand(a) * 10;
        if (!target || (target.x === here.x && target.y === here.y)) continue;
        const from = a.inside ? a.home : this.currentCell(a);
        const path = findPath(this.grid, from, target, 6000);
        if (!path || path.length < 2) continue;
        a.path = path;
        a.step = 0;
        a.progress = 0;
        a.inside = false;
        a.sprite.setVisible(true);
        a.shadow.setVisible(true);
      }
      this.advance(a, dt * (a.role === 'elder' ? 0.7 : a.role === 'child' ? 1.25 : 1));
    }
  }

  private currentCell(a: Agent): Cell {
    return a.path[a.step] ?? a.home;
  }

  private advance(a: Agent, dt: number): void {
    const cellsPerSecond = 1.15;
    a.progress += dt * cellsPerSecond;
    while (a.progress >= 1 && a.step < a.path.length - 1) {
      a.progress -= 1;
      a.step += 1;
    }
    const cur = a.path[a.step]!;
    const next = a.path[Math.min(a.step + 1, a.path.length - 1)]!;
    if (a.step >= a.path.length - 1) {
      // Arrived: go inside buildings, linger outdoors otherwise.
      const arrived = a.path.at(-1)!;
      a.path = [];
      const indoors =
        a.role !== 'warden' &&
        [a.home, a.work, ...this.places.shops].some((c) => c.x === arrived.x && c.y === arrived.y);
      if (indoors) {
        a.inside = true;
        a.home =
          a.role === 'miner' && arrived.x === a.work.x && arrived.y === a.work.y ? a.home : a.home;
        a.sprite.setVisible(false);
        a.shadow.setVisible(false);
      } else {
        a.sprite.anims.stop();
        a.sprite.setFrame(a.dir * 9);
      }
      return;
    }
    const t = Math.min(1, a.progress);
    const x = cur.x + (next.x - cur.x) * t;
    const y = cur.y + (next.y - cur.y) * t;
    const p = cellToWorld(x, y, 0.02);
    a.sprite.setPosition(p.x, p.y).setDepth(depthOf(x, y) + 8.5);
    a.shadow.setPosition(p.x, p.y + 2);
    const dir = directionIndex(next.x - cur.x, next.y - cur.y);
    const key = `${a.role}_walk_${DIRS[dir]}`;
    if (dir !== a.dir || !a.sprite.anims.isPlaying || a.sprite.anims.currentAnim?.key !== key) {
      a.dir = dir;
      a.sprite.play(key, true);
    } else if (a.sprite.anims.isPaused) {
      a.sprite.anims.resume();
    }
  }

  /** New buildings or demolitions change where people can walk. */
  setGrid(grid: PathGrid): void {
    this.grid = grid;
  }

  get count(): number {
    return this.agents.length;
  }
}
