import { describe, expect, it } from 'vitest';
import { createNewGame, nextSelectionTick } from '../core/index.ts';
import { buildSelectionCeremony } from './ceremonies.ts';
import { GameSession } from './session.ts';

describe('the Reaping cinematic', () => {
  it('is a film built from the real draw: herald, urn, faces, walk, farewell and train', () => {
    const session = new GameSession(createNewGame({ seed: 'reaping-film' }));
    const s0 = session.getState();
    session.advance(
      nextSelectionTick(s0.clock.tick, s0.competition.lastSelectionYear) - s0.clock.tick,
    );
    const state = session.getState();
    expect(state.phase.kind).toBe('selection');
    const chosen = state.competition.current!.participants;
    expect(chosen.length).toBe(2);
    const steps = buildSelectionCeremony(state);
    const shots = steps.flatMap((s) => (s.kind === 'shot' ? [s.shot] : []));
    const types = new Set(shots.map((s) => s.type));
    for (const t of ['guard', 'herald', 'urn', 'face', 'pair', 'farewell', 'train'])
      expect(types).toContain(t);
    for (const id of chosen) {
      // Their slip comes out of the urn, we see their face, they walk up and say goodbye.
      expect(shots.some((s) => s.type === 'urn' && s.citizenId === id)).toBe(true);
      expect(shots.some((s) => s.type === 'face' && s.citizenId === id)).toBe(true);
      expect(steps.some((s) => s.kind === 'walk' && s.citizenId === id)).toBe(true);
      expect(shots.some((s) => s.type === 'farewell' && s.citizenId === id)).toBe(true);
    }
    // Every close-up shows somebody who exists and is alive in this district.
    for (const s of shots) {
      if (s.type === 'face' || s.type === 'farewell')
        expect(state.population.citizens[s.citizenId]?.alive).toBe(true);
      if (s.type === 'farewell' && s.visitorId)
        expect(state.population.citizens[s.visitorId]?.alive).toBe(true);
    }
    // The session plays it, and skipping leaves both tributes on the stage.
    expect(session.cinematic?.id).toBe('selection');
    session.cinematic!.skip();
    expect(session.cinematic).toBeNull();
  });
});
