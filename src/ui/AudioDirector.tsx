import { useEffect, useRef } from 'react';
import { arenaHour, dateFromTick } from '../core/index.ts';
import type { GameSession } from '../game/session.ts';
import type { Ambience } from '../platform/audio.ts';
import { cue, setAmbience } from '../platform/audio.ts';
import { useSession } from './useSession.ts';

const night = (h: number) => h < 6 || h >= 20;

/** Chooses the ambience for where the game is, and plays cues for what just happened. */
export function AudioDirector({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const deaths = useRef(-1);
  const phase = state.phase.kind;

  let bed: Ambience = 'none';
  if (phase === 'district' || phase === 'selection' || phase === 'aftermath')
    bed = night(dateFromTick(state.clock.tick).hour) ? 'district-night' : 'district-day';
  else if (phase === 'capital') bed = 'capital';
  else if (phase === 'arena' && state.arena)
    bed = night(arenaHour(state.arena.round)) ? 'arena-night' : 'arena-day';

  useEffect(() => setAmbience(bed), [bed]);
  useEffect(() => () => setAmbience('none'), []);
  useEffect(
    () => session.events.on('phase/changed', (e) => e.to === 'selection' && cue('bell')),
    [session],
  );

  // A distant boom for every contestant who falls (heard by the whole nation).
  const fallen = state.arena ? Object.values(state.arena.actors).filter((a) => !a.alive).length : 0;
  useEffect(() => {
    if (deaths.current >= 0 && fallen > deaths.current) cue('boom');
    deaths.current = state.arena ? fallen : -1;
  }, [fallen, state.arena]);
  return null;
}
