import * as Phaser from 'phaser';
import type { PhaseKind } from '../../core/index.ts';
import { PALETTE } from '../palette.ts';

export const PHASE_SCENE = 'phase';

const BACKDROP: Record<Exclude<PhaseKind, 'district'>, { top: number; bottom: number }> = {
  selection: { top: PALETTE.soot, bottom: PALETTE.coal },
  capital: { top: PALETTE.powerBlue, bottom: PALETTE.coal },
  arena: { top: PALETTE.forestDeep, bottom: PALETTE.coal },
  aftermath: { top: PALETTE.wetStone, bottom: PALETTE.coal },
};

/** Phase 1 placeholder backdrop for the phases whose scenes arrive in Phases 5–8. */
export class PhaseScene extends Phaser.Scene {
  private kind: Exclude<PhaseKind, 'district'> = 'selection';
  private backdrop?: Phaser.GameObjects.Graphics;
  private picture?: Phaser.GameObjects.Image;

  constructor() {
    super(PHASE_SCENE);
  }

  init(data: { kind?: Exclude<PhaseKind, 'district'> }): void {
    if (data.kind) this.kind = data.kind;
  }

  preload(): void {
    if (this.kind === 'capital') this.load.image('capital_bg', 'assets/capital/backdrop.jpg');
  }

  create(): void {
    if (this.kind === 'capital' && this.textures.exists('capital_bg')) {
      this.picture = this.add.image(0, 0, 'capital_bg').setOrigin(0.5);
      // Slow push-in: the capital looms over the visitors.
      this.tweens.add({
        targets: this.picture,
        scale: { from: 1, to: 1.08 },
        duration: 40000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    this.backdrop = this.add.graphics();
    this.draw();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.draw, this),
    );
  }

  private draw(): void {
    const g = this.backdrop;
    if (!g) return;
    const { width, height } = this.scale;
    const colors = BACKDROP[this.kind];
    g.clear();
    if (this.picture) {
      const cover = Math.max(width / this.picture.width, height / this.picture.height);
      this.picture.setPosition(width / 2, height / 2).setScale(cover);
      // Darken towards the bottom so the panels stay readable.
      g.fillGradientStyle(0x0b0b0d, 0x0b0b0d, 0x0b0b0d, 0x0b0b0d, 0.25, 0.25, 0.8, 0.8);
      g.fillRect(0, 0, width, height);
      return;
    }
    g.fillGradientStyle(colors.top, colors.top, colors.bottom, colors.bottom, 1);
    g.fillRect(0, 0, width, height);
  }
}
