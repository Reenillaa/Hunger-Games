import { describe, expect, it, vi } from 'vitest';
import { TICKS_PER_DAY, createNewGame } from '../core/index.ts';
import { attachAutosave } from './autosave.ts';
import { GameSession, MS_PER_TICK_AT_X1 } from './session.ts';

describe('GameSession', () => {
  it('converts real time into ticks according to speed', () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    const start = session.getState().clock.tick;
    session.update(MS_PER_TICK_AT_X1 * 3);
    expect(session.getState().clock.tick - start).toBe(3);
    session.setSpeed(4);
    session.update(MS_PER_TICK_AT_X1);
    expect(session.getState().clock.tick - start).toBe(7);
  });

  it('does not advance while paused', () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    const start = session.getState().clock.tick;
    session.setSpeed(0);
    session.update(10_000);
    expect(session.getState().clock.tick).toBe(start);
  });

  it('caps ticks per frame after a long stall', () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    const start = session.getState().clock.tick;
    session.setSpeed(4);
    session.update(60_000);
    expect(session.getState().clock.tick - start).toBeLessThanOrEqual(8);
  });

  it('notifies subscribers and bumps the snapshot version', () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    const listener = vi.fn();
    session.subscribe(listener);
    const v0 = session.getSnapshot().version;
    session.advance(5);
    expect(listener).toHaveBeenCalled();
    expect(session.getSnapshot().version).toBeGreaterThan(v0);
  });

  it('stops the clock when the selection starts', () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    session.advance(TICKS_PER_DAY * 100);
    expect(session.getSnapshot().state.phase.kind).toBe('selection');
    expect(session.isClockRunning()).toBe(false);
  });

  it('rejects invalid commands without notifying', () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    const listener = vi.fn();
    session.subscribe(listener);
    expect(session.dispatch({ type: 'home/return' }).ok).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('autosave', () => {
  it('saves on each new day and on phase changes', async () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    const autosave = vi.fn(async () => {});
    attachAutosave(session, { autosave });
    session.advance(TICKS_PER_DAY * 2);
    await vi.waitFor(() => expect(autosave).toHaveBeenCalled());
  });

  it('reports errors instead of throwing', async () => {
    const session = new GameSession(createNewGame({ seed: 's' }));
    const onError = vi.fn();
    attachAutosave(
      session,
      { autosave: async () => Promise.reject(new Error('disk full')) },
      onError,
    );
    session.advance(TICKS_PER_DAY);
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
