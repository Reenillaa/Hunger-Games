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

  constructor() {
    super(PHASE_SCENE);
  }

  init(data: { kind?: Exclude<PhaseKind, 'district'> }): void {
    if (data.kind) this.kind = data.kind;
  }

  create(): void {
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
    g.fillGradientStyle(colors.top, colors.top, colors.bottom, colors.bottom, 1);
    g.fillRect(0, 0, width, height);
  }
}
