import { TEMPLATES } from '../../content/maps/index.ts';
import * as Phaser from 'phaser';
import type { GameState } from '../../core/index.ts';
import { ageOf, livingCitizens } from '../../core/index.ts';
import { cellToWorld, depthOf } from '../iso/projection.ts';
import type { CharacterSheet, Role } from './townsfolk.ts';

const FACING_STAGE = 5; // 'ne': from the plaza towards the stage
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
  private spotlight?: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    state: Readonly<GameState>,
    sheets: Record<string, CharacterSheet>,
  ) {
    this.scene = scene;
    const plaza = TEMPLATES[state.district.templateId]?.plaza ?? { x0: 24, y0: 20 };
    const X = plaza.x0 - 24;
    const Y = plaza.y0 - 20;
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
      this.byCitizen.set(
        c!.id,
        this.person(sheets, roleOf(ageOf(c!, day), c!.sex), x + ox, y + oy),
      );
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

  focusPoint(citizenId: string | null): { x: number; y: number } | null {
    const s = citizenId ? this.byCitizen.get(citizenId) : undefined;
    return s ? { x: s.x, y: s.y - 40 } : null;
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
  }
}
