/**
 * Reusable in-engine cinematics (docs/TECHNICAL_ARCHITECTURE.md §7): a sequence of timed steps
 * built from real game data. The renderer follows camera/focus steps; the UI shows titles,
 * lines and name reveals. Always skippable.
 */
export type CineStep =
  | { kind: 'fade'; to: 'black' | 'clear'; ms: number }
  | { kind: 'camera'; cell: { x: number; y: number }; zoom: number; ms: number }
  | { kind: 'title'; title: string; subtitle?: string; ms: number }
  | { kind: 'line'; text: string; speaker?: string; ms: number }
  | { kind: 'reveal'; citizenId: string; caption: string; ms: number }
  | { kind: 'focus'; citizenId: string | null; ms: number };

export interface CineView {
  /** Steps active right now (a camera move and a line can overlap the step clock). */
  step: CineStep | null;
  index: number;
  black: boolean;
  camera: { cell: { x: number; y: number }; zoom: number } | null;
  focus: string | null;
  done: boolean;
}

export class CinematicPlayer {
  readonly id: string;
  private readonly steps: CineStep[];
  private index = 0;
  private elapsed = 0;
  private view: CineView;
  private readonly listeners = new Set<() => void>();
  private readonly onDone: () => void;

  constructor(id: string, steps: CineStep[], onDone: () => void = () => {}) {
    this.id = id;
    this.steps = steps;
    this.onDone = onDone;
    this.view = {
      step: steps[0] ?? null,
      index: 0,
      black: true,
      camera: null,
      focus: null,
      done: steps.length === 0,
    };
    this.enter();
  }

  get = (): CineView => this.view;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  /** Applies the persistent effects of the step being entered. */
  private enter(): void {
    const step = this.steps[this.index];
    const v = { ...this.view, step: step ?? null, index: this.index };
    if (step?.kind === 'fade') v.black = step.to === 'black';
    if (step?.kind === 'camera') v.camera = { cell: step.cell, zoom: step.zoom };
    if (step?.kind === 'focus') v.focus = step.citizenId;
    this.view = v;
  }

  advance(deltaMs: number): void {
    if (this.view.done) return;
    this.elapsed += deltaMs;
    let changed = false;
    while (!this.view.done) {
      const step = this.steps[this.index];
      if (!step || this.elapsed < step.ms) break;
      this.elapsed -= step.ms;
      this.index += 1;
      changed = true;
      if (this.index >= this.steps.length) {
        this.view = { ...this.view, step: null, done: true, black: false };
        this.onDone();
      } else {
        this.enter();
      }
    }
    if (changed) this.emit();
  }

  /** Progress (0–1) inside the current step, for fades and typewriter effects. */
  progress(): number {
    const step = this.steps[this.index];
    return step && step.ms > 0 ? Math.min(1, this.elapsed / step.ms) : 1;
  }

  skip(): void {
    if (this.view.done) return;
    // Apply every remaining persistent effect so the end state is consistent.
    while (this.index < this.steps.length - 1) {
      this.index += 1;
      this.enter();
    }
    this.view = { ...this.view, step: null, done: true, black: false };
    this.onDone();
    this.emit();
  }
}
