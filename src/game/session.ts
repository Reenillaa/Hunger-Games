import { PARADE_READY } from '../content/parade.ts';
import type { Command, CommandResult, DomainEvent, GameState } from '../core/index.ts';
import { advanceTick, applyCommand, collectingContext } from '../core/index.ts';
import { EventBus } from './eventBus.ts';
import { UiStore } from './uiStore.ts';
import {
  buildParade,
  buildPrologue,
  buildReturnCeremony,
  buildSelectionCeremony,
} from './ceremonies.ts';
import type { CineStep } from './cinematic.ts';
import { CinematicPlayer } from './cinematic.ts';

export const GAME_SPEEDS = [0, 1, 2, 4] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

/** Real milliseconds per in-game hour at ×1 (D-04: 1 hour = 2 s → 1 day ≈ 48 s). */
export const MS_PER_TICK_AT_X1 = 2000;
/** Real milliseconds per arena round (one arena hour) at ×1. */
export const MS_PER_ROUND_AT_X1 = 1400;
/** Upper bound of ticks simulated per frame, to avoid a death spiral after a stall. */
const MAX_TICKS_PER_UPDATE = 8;

export interface SessionSnapshot {
  readonly state: Readonly<GameState>;
  readonly version: number;
  readonly speed: GameSpeed;
}

/**
 * Orchestrates one playthrough: real-time → ticks, command dispatch, event fan-out.
 * Engine- and UI-agnostic; Phaser drives `update`, React subscribes to snapshots.
 */
export class GameSession {
  readonly events = new EventBus();
  /** Interaction state (placement, selection): shared by UI and renderer, not saved. */
  readonly ui = new UiStore();
  private state: GameState;
  private version = 0;
  private speed: GameSpeed = 1;
  private accumulatorMs = 0;
  private snapshot: SessionSnapshot;
  private readonly listeners = new Set<() => void>();

  /** The arena plays round by round while true; it stops on every interrupt. */
  private arenaPlaying = false;
  private arenaMs = 0;

  /** Cinematic currently playing (the clock is stopped outside the district anyway). */
  cinematic: CinematicPlayer | null = null;

  constructor(state: GameState) {
    this.state = state;
    this.snapshot = this.makeSnapshot();
    this.events.on('phase/changed', (e) => {
      if (e.to === 'selection') this.playSelectionCeremony();
      if (e.to === 'capital' && PARADE_READY) {
        const parade = buildParade(this.state);
        if (parade.length > 0) this.playCinematic('parade', parade);
      }
      const last = this.state.competition.history.at(-1);
      if (e.from === 'aftermath' && e.to === 'district' && last) {
        const steps = buildReturnCeremony(this.state, last.edition);
        if (steps.length > 0) this.playCinematic('return', steps);
      }
    });
    if (state.phase.kind === 'selection') this.playSelectionCeremony();
  }

  playCinematic(id: string, steps: CineStep[]): void {
    this.cinematic = new CinematicPlayer(id, steps, () => {
      this.cinematic = null;
      this.changed();
    });
    this.changed();
  }

  /** Played once when a new game starts (skippable; the clock waits for it). */
  playPrologue(): void {
    this.playCinematic('prologue', buildPrologue(this.state));
  }

  private playSelectionCeremony(): void {
    const steps = buildSelectionCeremony(this.state);
    if (steps.length > 0) this.playCinematic('selection', steps);
  }

  /** Mutable access is limited to the core; outer layers must treat it as read-only. */
  getState(): Readonly<GameState> {
    return this.state;
  }

  getSnapshot = (): SessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSpeed(): GameSpeed {
    return this.speed;
  }

  setSpeed(speed: GameSpeed): void {
    if (speed === this.speed) return;
    this.speed = speed;
    this.accumulatorMs = 0;
    this.changed();
  }

  isArenaPlaying(): boolean {
    return this.arenaPlaying && this.state.phase.kind === 'arena' && !this.state.arena?.finished;
  }

  setArenaPlaying(playing: boolean): void {
    if (playing === this.arenaPlaying) return;
    this.arenaPlaying = playing;
    this.arenaMs = 0;
    if (playing && this.speed === 0) this.speed = 1;
    this.changed();
  }

  /** True when district time is allowed to flow. */
  isClockRunning(): boolean {
    return this.state.phase.kind === 'district' && this.speed > 0 && !this.cinematic;
  }

  dispatch(command: Command): CommandResult {
    const result = applyCommand(this.state, command);
    if (result.ok) {
      this.publish(result.events);
      this.changed();
    }
    return result;
  }

  /** Called every frame with the elapsed real time. */
  update(deltaMs: number): void {
    if (this.cinematic && deltaMs > 0) this.cinematic.advance(deltaMs);
    if (this.isArenaPlaying() && this.speed > 0 && deltaMs > 0 && !this.cinematic) {
      this.arenaMs += deltaMs;
      if (this.arenaMs >= MS_PER_ROUND_AT_X1 / this.speed) {
        this.arenaMs = 0;
        this.dispatch({ type: 'arena/advance', maxRounds: 1 });
        const arena = this.state.arena;
        if (!arena || arena.interrupt || arena.finished) this.setArenaPlaying(false);
      }
    }
    if (!this.isClockRunning() || !(deltaMs > 0)) return;
    const msPerTick = MS_PER_TICK_AT_X1 / this.speed;
    this.accumulatorMs = Math.min(this.accumulatorMs + deltaMs, msPerTick * MAX_TICKS_PER_UPDATE);
    let ticks = 0;
    while (this.accumulatorMs >= msPerTick && ticks < MAX_TICKS_PER_UPDATE) {
      this.accumulatorMs -= msPerTick;
      ticks += 1;
    }
    if (ticks === 0) return;
    this.advance(ticks);
  }

  /** Fraction of the current hour elapsed (for smooth visual interpolation). */
  getTickProgress(): number {
    if (!this.isClockRunning()) return 0;
    return Math.min(1, this.accumulatorMs / (MS_PER_TICK_AT_X1 / this.speed));
  }

  /** Runs whole ticks immediately (debug tools, tests). Stops if the phase leaves the district. */
  advance(ticks: number): number {
    const ctx = collectingContext();
    let ran = 0;
    while (ran < ticks && this.state.phase.kind === 'district') {
      advanceTick(this.state, ctx);
      ran += 1;
    }
    if (ran > 0) {
      this.publish(ctx.events);
      this.changed();
    }
    return ran;
  }

  private publish(events: DomainEvent[]): void {
    for (const e of events) this.events.emit(e);
  }

  private changed(): void {
    this.version += 1;
    this.snapshot = this.makeSnapshot();
    this.listeners.forEach((l) => l());
  }

  private makeSnapshot(): SessionSnapshot {
    return { state: this.state, version: this.version, speed: this.speed };
  }
}
