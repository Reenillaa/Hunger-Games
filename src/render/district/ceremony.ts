import { TEMPLATES } from '../../content/maps/index.ts';
import * as Phaser from 'phaser';
import type { GameState } from '../../core/index.ts';
import { ageOf, livingCitizens } from '../../core/index.ts';
import { cellToWorld, depthOf } from '../iso/projection.ts';
import type { CharacterSheet, Role } from './townsfolk.ts';
import { directionIndex } from './townsfolk.ts';

const FACING_STAGE = 5; // 'ne': from the plaza towards the stage
const FACING_CROWD = 1; // 'sw': from the stage towards the plaza
const DIRS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];
const SLOTS = [
  [-0.25, -0.25],
  [0.25, -0.25],
  [-0.25, 0.25],
  [0.25, 0.25],
] as const;

/**
 * The Criba gathering in the plaza: the real eligible youths in front, adults behind,
 * the herald and wardens on the stage. Built from the game state; destroyed afterwards.
 */
export class CeremonyStage {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly byCitizen = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly roleOf = new Map<string, Role>();
  private readonly walked = new Set<string>();
  private readonly escorts: Phaser.GameObjects.Sprite[] = [];
  private readonly origin: { X: number; Y: number };
  private readonly cellOf = new Map<string, { x: number; y: number }>();
  private readonly sheets: Record<string, CharacterSheet>;
  private spotlight?: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    state: Readonly<GameState>,
    sheets: Record<string, CharacterSheet>,
  ) {
    this.scene = scene;
    this.sheets = sheets;
    const plaza = TEMPLATES[state.district.templateId]?.plaza ?? { x0: 24, y0: 20 };
    const X = plaza.x0 - 24;
    const Y = plaza.y0 - 20;
    this.origin = { X, Y };
    const current = state.competition.current;
    const day = Math.floor(state.clock.tick / 24);
    const youths = Object.keys(current?.entries ?? {})
      .map((id) => state.population.citizens[id])
      .filter((c) => c?.alive)
      .sort((a, b) => ageOf(b!, day) - ageOf(a!, day));
    const adults = livingCitizens(state.population)
      .filter((c) => !current?.entries[c.id] && ageOf(c, day) >= 19)
      .slice(0, 48);
    const roleOf = (age: number, sex: 'F' | 'M'): Role =>
      age < 14 ? 'child' : sex === 'F' ? 'woman' : 'worker';
    // Youths: front rows of the plaza (y 23–24), girls on the left, boys on the right.
    let iF = 0;
    let iM = 0;
    for (const c of youths) {
      const k = c!.sex === 'F' ? iF++ : iM++;
      const col = Math.floor(k / 2) % 3;
      const row = Math.floor(k / 6);
      const x = (c!.sex === 'F' ? 24 : 27) + col + X;
      const y = 23 + (row % 2) + Y;
      const [ox, oy] = SLOTS[(k % 2) + (row >= 2 ? 2 : 0)]!;
      const role = roleOf(ageOf(c!, day), c!.sex);
      this.roleOf.set(c!.id, role);
      this.cellOf.set(c!.id, { x: x + ox, y: y + oy });
      this.byCitizen.set(c!.id, this.person(sheets, role, x + ox, y + oy));
    }
    // Adults behind and around.
    adults.forEach((c, i) => {
      const x = 23 + (i % 8) + X;
      const y = 25 + Math.floor(i / 8) * 0.5 + Y;
      const [ox, oy] = SLOTS[i % 4]!;
      this.person(
        sheets,
        ageOf(c, day) > 62 ? 'elder' : c.sex === 'F' ? 'woman_b' : 'miner',
        x + ox * 0.6,
        y + oy * 0.6,
      );
    });
    // Stage against the town hall: the herald from the capital (gold) and the wardens.
    const herald = this.person(sheets, 'woman_b', 26.5 + X, 20.7 + Y, 1, 0.3);
    herald.setTint(0xf2d48a);
    this.person(sheets, 'warden', 25.4 + X, 20.5 + Y, 1, 0.3);
    this.person(sheets, 'warden', 27.4 + X, 20.4 + Y, 1, 0.3);
    // Wardens guarding the town hall's doors behind the stage.
    this.person(sheets, 'warden', 24.3 + X, 20.2 + Y, 1);
    this.person(sheets, 'warden', 28.6 + X, 20.2 + Y, 1);
    // A cordon of wardens closing the plaza on both flanks, and two escorts waiting below the stage.
    for (let i = 0; i < 5; i++) {
      this.person(sheets, 'warden', 22.4 + X, 21.6 + i * 1.1 + Y, 6);
      this.person(sheets, 'warden', 30.6 + X, 21.6 + i * 1.1 + Y, 2);
    }
    this.escorts.push(
      this.person(sheets, 'warden', 25.2 + X, 21.9 + Y, FACING_CROWD),
      this.person(sheets, 'warden', 27.8 + X, 21.9 + Y, FACING_CROWD),
    );
    this.spotlight = scene.add
      .image(0, 0, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff1c8)
      .setAlpha(0)
      .setScale(1.3, 0.65);
    this.objects.push(this.spotlight);
  }

  private person(
    sheets: Record<string, CharacterSheet>,
    role: Role,
    x: number,
    y: number,
    dir = FACING_STAGE,
    z = 0,
  ): Phaser.GameObjects.Sprite {
    const sheet = sheets[role]!;
    const p = cellToWorld(x, y, z);
    const sprite = this.scene.add
      .sprite(p.x, p.y, `char_${role}`, dir * (sheet.walkFrames + 1))
      .setOrigin(sheet.anchor[0] / sheet.frameWidth, sheet.anchor[1] / sheet.frameHeight)
      .setScale(1 / sheet.scale)
      .setDepth(depthOf(x, y) + 8.6);
    this.objects.push(sprite);
    return sprite;
  }

  /** Lights the chosen youth and dims everyone else a little. */
  setFocus(citizenId: string | null): void {
    const target = citizenId ? this.byCitizen.get(citizenId) : undefined;
    for (const s of this.byCitizen.values())
      s.setTint(target && s !== target ? 0x8a8a90 : 0xffffff);
    if (this.spotlight) {
      if (target)
        this.spotlight
          .setPosition(target.x, target.y - 4)
          .setDepth(target.depth - 0.1)
          .setAlpha(0.85);
      else this.spotlight.setAlpha(0);
    }
  }

  /**
   * The chosen youth walks out of the rows, down the aisle and up onto the stage, with the two
   * escorts closing in beside them. `ms` 0 places them there at once (skipped cinematic).
   */
  walkToStage(citizenId: string, ms: number): void {
    const sprite = this.byCitizen.get(citizenId);
    const role = this.roleOf.get(citizenId);
    const from = this.cellOf.get(citizenId);
    if (!sprite || !role || !from || this.walked.has(citizenId)) return;
    const { X, Y } = this.origin;
    const slot = this.walked.size;
    this.walked.add(citizenId);
    const path = [
      { x: 26.5 + X, y: 22.7 + Y, z: 0 },
      { x: 26.5 + X, y: 21.8 + Y, z: 0 },
      { x: (slot === 0 ? 25.9 : 27.1) + X, y: 20.9 + Y, z: 0.3 },
    ];
    const end = path.at(-1)!;
    const finish = () => {
      const p = cellToWorld(end.x, end.y, end.z);
      sprite.anims.stop();
      sprite
        .setPosition(p.x, p.y)
        .setDepth(depthOf(end.x, end.y) + 8.6)
        .setFrame(FACING_CROWD * (this.sheets[role]!.walkFrames + 1));
    };
    const escortsTo = (duration: number) =>
      this.escorts.forEach((e, i) => {
        const p = cellToWorld((i === 0 ? 25.9 : 27.1) + X, 21.7 + Y, 0);
        if (duration <= 0) e.setPosition(p.x, p.y);
        else
          this.scene.tweens.add({ targets: e, x: p.x, y: p.y, duration, ease: 'Sine.easeInOut' });
      });
    if (ms <= 0) {
      escortsTo(0);
      finish();
      return;
    }
    const leg = ms / path.length;
    let prev = from;
    const tweens = path.map((to) => {
      const dir = directionIndex(to.x - prev.x, to.y - prev.y);
      const p = cellToWorld(to.x, to.y, to.z);
      prev = to;
      return {
        x: p.x,
        y: p.y,
        duration: leg,
        onStart: () => {
          sprite.play(`${role}_walk_${DIRS[dir]}`, true);
          sprite.setDepth(depthOf(to.x, to.y) + 8.6);
        },
      };
    });
    this.scene.tweens.chain({ targets: sprite, tweens, onComplete: finish });
    escortsTo(ms * 0.6);
  }

  /**
   * Departure: the tributes (already on the stage) are taken to the platform and step into the
   * train. `ms` 0 jumps to the end (skipped cinematic).
   */
  boardTrain(citizenIds: string[], railX: number, stationY: number, ms: number): void {
    citizenIds.forEach((id, i) => {
      const sprite = this.byCitizen.get(id);
      const role = this.roleOf.get(id);
      if (!sprite || !role) return;
      const start = cellToWorld(railX - 1.2, stationY + 0.8 + i * 0.7, 0.18);
      const door = cellToWorld(railX - 0.3, stationY + 0.2 + i * 0.4, 0.18);
      sprite.setPosition(start.x, start.y).setDepth(depthOf(railX - 1, stationY + 1 + i) + 8.7);
      if (ms <= 0) {
        sprite.setVisible(false);
        return;
      }
      sprite.setVisible(true).setAlpha(1).clearTint();
      sprite.play(`${role}_walk_${DIRS[6]}`, true);
      this.scene.tweens.add({
        targets: sprite,
        x: door.x,
        y: door.y,
        delay: i * ms * 0.15,
        duration: ms * 0.6,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          sprite.anims.stop();
          this.scene.tweens.add({ targets: sprite, alpha: 0, duration: ms * 0.2 });
        },
      });
    });
    this.escorts.forEach((e, i) => {
      const p = cellToWorld(railX - 1.4, stationY - 0.6 + i * 2.6, 0.18);
      e.setPosition(p.x, p.y).setDepth(depthOf(railX - 1.4, stationY + i * 2.6) + 8.7);
    });
  }

  focusPoint(citizenId: string | null): { x: number; y: number } | null {
    const s = citizenId ? this.byCitizen.get(citizenId) : undefined;
    return s ? { x: s.x, y: s.y - 40 } : null;
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
  }
}
