import type * as Phaser from 'phaser';
import { cellToWorld, depthOf } from '../iso/projection.ts';
import type { SpriteAsset, SpriteManifest } from './assets.ts';
import type { CharacterSheet, Role } from './townsfolk.ts';

/** How far down the line (in cells) the train waits before arriving and goes after leaving. */
const AWAY = 34;
const CARS = ['train_tail', 'train_car', 'train_head'] as const;
const CAR_LEN = 3;

interface Layer {
  img: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
}

/**
 * The Capitol train on the district's rails (DECISIONS I-59): three pre-rendered carriages that
 * slide along the line, a platform by the station, and what the train brings back — the
 * survivors stepping down and the coffins carried out. Driven by cinematic steps.
 */
export class TrainView {
  private readonly scene: Phaser.Scene;
  private readonly sprites: SpriteManifest;
  private readonly sheets: Record<string, CharacterSheet>;
  private readonly railX: number;
  private readonly stationY: number;
  private readonly cars: Layer[] = [];
  private readonly extras: Phaser.GameObjects.GameObject[] = [];
  private offset = AWAY;
  private tween?: Phaser.Tweens.Tween;
  readonly onCreate: (img: Phaser.GameObjects.Image, shadow?: Phaser.GameObjects.Image) => void;

  constructor(
    scene: Phaser.Scene,
    sprites: SpriteManifest,
    sheets: Record<string, CharacterSheet>,
    rail: { x: number; stationY: number },
    onCreate: (img: Phaser.GameObjects.Image, shadow?: Phaser.GameObjects.Image) => void,
  ) {
    this.scene = scene;
    this.sprites = sprites;
    this.sheets = sheets;
    this.railX = rail.x;
    this.stationY = rail.stationY;
    this.onCreate = onCreate;
    // The platform is part of the district: always there.
    const platform = sprites.assets.platform;
    if (platform && scene.textures.exists('platform'))
      this.layer('platform', platform, this.railX - 1, this.stationY);
    for (const key of CARS) {
      const asset = sprites.assets[key];
      if (asset && scene.textures.exists(key)) this.cars.push(this.layer(key, asset, 0, 0));
    }
    this.place();
    this.setVisible(false);
  }

  private layer(key: string, asset: SpriteAsset, cx: number, cy: number): Layer {
    const origin: [number, number] = [
      asset.anchor[0] / asset.size[0],
      asset.anchor[1] / asset.size[1],
    ];
    const scale = 1 / asset.scale;
    const p = cellToWorld(cx, cy);
    const shadow = asset.layers.includes('shadow')
      ? this.scene.add
          .image(p.x, p.y, `${key}_s`)
          .setOrigin(...origin)
          .setScale(scale)
          .setDepth(-5000)
      : undefined;
    const img = this.scene.add
      .image(p.x, p.y, key)
      .setOrigin(...origin)
      .setScale(scale)
      .setDepth(depthOf(cx, cy + 1) + 8);
    this.onCreate(img, shadow);
    return { img, shadow };
  }

  /** Puts the carriages on the line, `offset` cells down from the platform. */
  private place(): void {
    this.cars.forEach((car, i) => {
      const cy = this.stationY + this.offset + (i - 1) * CAR_LEN;
      const p = cellToWorld(this.railX, cy);
      car.img.setPosition(p.x, p.y).setDepth(depthOf(this.railX, cy + 1.5) + 8);
      car.shadow?.setPosition(p.x, p.y);
    });
  }

  private setVisible(v: boolean): void {
    for (const c of this.cars) {
      c.img.setVisible(v);
      c.shadow?.setVisible(v);
    }
  }

  private slide(from: number, to: number, ms: number, ease: string): void {
    this.tween?.stop();
    this.setVisible(true);
    this.offset = from;
    this.place();
    if (ms <= 0) {
      this.offset = to;
      this.place();
      return;
    }
    const state = { o: from };
    this.tween = this.scene.tweens.add({
      targets: state,
      o: to,
      duration: ms,
      ease,
      onUpdate: () => {
        this.offset = state.o;
        this.place();
      },
    });
  }

  arrive(ms: number): void {
    this.slide(AWAY, 0, ms, 'Cubic.easeOut');
  }

  depart(ms: number): void {
    this.slide(0, AWAY + 6, ms, 'Cubic.easeIn');
  }

  park(): void {
    this.slide(0, 0, 0, 'Linear');
  }

  hide(): void {
    this.tween?.stop();
    this.offset = AWAY;
    this.place();
    this.setVisible(false);
    this.clearExtras();
  }

  /** World point of the middle carriage (for the camera). */
  focus(): { x: number; y: number } {
    const p = cellToWorld(this.railX, this.stationY + this.offset);
    return { x: p.x, y: p.y - 40 };
  }

  private person(role: Role, x: number, y: number, dir: number): Phaser.GameObjects.Sprite | null {
    const sheet = this.sheets[role];
    if (!sheet || !this.scene.textures.exists(`char_${role}`)) return null;
    const p = cellToWorld(x, y, 0.18);
    const sprite = this.scene.add
      .sprite(p.x, p.y, `char_${role}`, dir * (sheet.walkFrames + 1))
      .setOrigin(sheet.anchor[0] / sheet.frameWidth, sheet.anchor[1] / sheet.frameHeight)
      .setScale(1 / sheet.scale)
      .setDepth(Math.max(depthOf(x, y), depthOf(this.railX - 1, this.stationY + 2)) + 9.2);
    this.extras.push(sprite);
    return sprite;
  }

  /**
   * The return: survivors step down onto the platform; coffins are slid out of the luggage car
   * and laid in a row, two guards at attention.
   */
  unload(survivors: Role[], coffins: number, ms: number): void {
    this.clearExtras();
    const px = this.railX - 1;
    const asset = this.sprites.assets.coffin;
    for (let i = 0; i < coffins && asset && this.scene.textures.exists('coffin'); i++) {
      const y = this.stationY - 0.9 + i * 0.9;
      const from = cellToWorld(this.railX, y);
      const to = cellToWorld(px - 0.05, y, 0.18);
      const img = this.scene.add
        .image(from.x, from.y, 'coffin')
        .setOrigin(asset.anchor[0] / asset.size[0], asset.anchor[1] / asset.size[1])
        .setScale(1 / asset.scale)
        .setDepth(depthOf(px, this.stationY + 2) + 9 + i * 0.01)
        .setAlpha(ms > 0 ? 0 : 1);
      this.extras.push(img);
      if (ms > 0)
        this.scene.tweens.add({
          targets: img,
          x: to.x,
          y: to.y,
          alpha: 1,
          delay: (ms * 0.35 * i) / Math.max(1, coffins),
          duration: ms * 0.5,
          ease: 'Sine.easeOut',
        });
      else img.setPosition(to.x, to.y);
    }
    survivors.forEach((role, i) => {
      const s = this.person(role, this.railX - 0.4, this.stationY + 1 + i * 0.6, 3);
      if (!s) return;
      const to = cellToWorld(px - 0.2, this.stationY + 1.2 + i * 0.6, 0.18);
      if (ms > 0) {
        s.setAlpha(0);
        s.play(`${role}_walk_nw`, true);
        this.scene.tweens.add({
          targets: s,
          x: to.x,
          y: to.y,
          alpha: 1,
          duration: ms * 0.7,
          onComplete: () => s.anims.stop(),
        });
      } else s.setPosition(to.x, to.y);
    });
    if (coffins > 0) {
      this.person('warden', px - 0.6, this.stationY - 1.6, 1);
      this.person('warden', px - 0.6, this.stationY + coffins * 0.9 - 0.4, 1);
    }
  }

  private clearExtras(): void {
    for (const o of this.extras) o.destroy();
    this.extras.length = 0;
  }
}
