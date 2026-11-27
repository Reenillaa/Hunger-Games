import type * as Phaser from 'phaser';
import { pickTerrainScale } from './district/assets.ts';

/**
 * The camera's light (DECISIONS I-70): a post-processing stack on the whole view — a colour grade
 * that follows the hour (golden mornings and evenings, cool blue nights, a little extra
 * saturation and contrast by day), a tilt-shift depth of field that makes the district look like
 * a lit miniature, and a soft vignette. Lighter devices keep only the grade.
 */
interface FilterLike {
  active: boolean;
}
interface GradeFilter extends FilterLike {
  colorMatrix: {
    reset(): unknown;
    saturate(v: number, multiply?: boolean): unknown;
    contrast(v: number, multiply?: boolean): unknown;
    brightness(v: number, multiply?: boolean): unknown;
    hue(deg: number, multiply?: boolean): unknown;
  };
}
interface CameraFilters {
  external: {
    addColorMatrix(): GradeFilter;
    addTiltShift(
      radius?: number,
      amount?: number,
      contrast?: number,
      blurX?: number,
      blurY?: number,
      strength?: number,
    ): FilterLike;
    addVignette(x?: number, y?: number, radius?: number, strength?: number): FilterLike;
  };
}

/** Once a device has shown it cannot afford the blur passes, later scenes skip them too. */
let heavyPassesTooSlow = false;

export class LightingRig {
  private grade?: GradeFilter;
  private heavy: FilterLike[] = [];
  private last = '';
  private elapsed = 0;
  private frames = 0;
  private slow = 0;
  private lastFrame = 0;

  constructor(scene: Phaser.Scene, opts: { tiltShift?: boolean } = {}) {
    const filters = (scene.cameras.main as unknown as { filters?: CameraFilters }).filters;
    if (!filters?.external) return;
    const rich = pickTerrainScale() === '1x';
    try {
      this.grade = filters.external.addColorMatrix();
      if (rich && !heavyPassesTooSlow) {
        if (opts.tiltShift !== false)
          this.heavy.push(filters.external.addTiltShift(0.18, 1, 0.1, 1, 1, 0.3));
        this.heavy.push(filters.external.addVignette(0.5, 0.5, 0.9, 0.3));
      }
    } catch {
      this.grade = undefined; // a renderer without filters: the game still runs, just flatter
    }
  }

  /**
   * `hour` 0–24, `night` 0–1 from the daylight cycle, `delta` the frame time in ms. The blur
   * passes watch the frame rate for a few seconds (after the loading spike) and switch off on
   * devices that cannot hold ~30 fps with them: a nicer picture is not worth a choppy game.
   */
  update(hour: number, night: number, delta = 16): void {
    this.watchFrameRate(delta);
    const g = this.grade;
    if (!g) return;
    // Golden around 7 h and 19 h, warm noon, cool night.
    const golden = Math.max(0, 1 - Math.min(Math.abs(hour - 7.5), Math.abs(hour - 19)) / 2.2);
    const key = `${golden.toFixed(2)}:${night.toFixed(2)}`;
    if (key === this.last) return;
    this.last = key;
    const m = g.colorMatrix;
    m.reset();
    m.saturate(0.1 - night * 0.35, true);
    m.contrast(0.1 + golden * 0.06, true);
    if (golden > 0) m.hue(-6 * golden, true);
    if (night > 0) {
      m.hue(12 * night, true);
      m.brightness(1 - night * 0.18, true);
    }
  }

  private watchFrameRate(_delta: number): void {
    if (this.heavy.length === 0) return;
    // Wall-clock frame time: the engine's own delta is smoothed and clamped.
    const now = performance.now();
    const delta = this.lastFrame ? now - this.lastFrame : 16;
    this.lastFrame = now;
    this.elapsed += delta;
    if (this.elapsed < 1500) return; // loading and first paint
    this.frames++;
    if (delta > 34) this.slow++;
    if (this.elapsed < 4500 && this.frames < 120) return;
    if (this.slow / Math.max(1, this.frames) > 0.5) {
      for (const f of this.heavy) f.active = false;
      heavyPassesTooSlow = true;
      console.info('[lighting] blur passes off: frame rate too low');
    }
    this.heavy = []; // decided: stop watching
  }
}
