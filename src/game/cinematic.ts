/**
 * Reusable in-engine cinematics (docs/TECHNICAL_ARCHITECTURE.md §7): a sequence of timed steps
 * built from real game data. The renderer follows camera/focus steps; the UI shows titles,
 * lines and name reveals. Always skippable.
 */
/**
 * A composed close shot drawn by the UI over the (blurred) live district: faces, the herald,
 * the urn, the farewell room, the train window. Built from real citizens.
 */
export type Shot =
  | { type: 'herald'; mood?: number }
  | { type: 'guard' }
  | { type: 'faces'; citizenIds: string[] }
  | { type: 'face'; citizenId: string; mood?: number; caption?: string }
  | { type: 'urn'; citizenId: string }
  | { type: 'pair'; citizenIds: string[] }
  | { type: 'farewell'; citizenId: string; visitorId: string | null }
  | { type: 'train'; citizenIds: string[] };

export type CineStep =
  | { kind: 'fade'; to: 'black' | 'clear'; ms: number }
  /** `glide` is how fast the camera eases towards the mark (per frame, default 0.045). */
  | { kind: 'camera'; cell: { x: number; y: number }; zoom: number; glide?: number; ms: number }
  | { kind: 'shot'; shot: Shot; line?: string; speaker?: string; ms: number }
  /** In-engine: the citizen walks from the crowd up to the stage, flanked by guards. */
  | { kind: 'walk'; citizenId: string; ms: number }
  | { kind: 'title'; title: string; subtitle?: string; ms: number }
  | { kind: 'line'; text: string; speaker?: string; ms: number }
  | { kind: 'reveal'; citizenId: string; caption: string; ms: number }
  | { kind: 'focus'; citizenId: string | null; ms: number };

export interface CineView {
  /** Steps active right now (a camera move and a line can overlap the step clock). */
  step: CineStep | null;
  index: number;
  black: boolean;
  camera: { cell: { x: number; y: number }; zoom: number; glide: number } | null;
  focus: string | null;
  /** Citizens sent up to the stage so far (they stay there). */
  walked: string[];
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
      walked: [],
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
    if (step?.kind === 'camera')
      v.camera = { cell: step.cell, zoom: step.zoom, glide: step.glide ?? 0.045 };
    if (step?.kind === 'focus') v.focus = step.citizenId;
    if (step?.kind === 'walk') v.walked = [...v.walked, step.citizenId];
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
