import type { SimContext } from '../events.ts';
import type { ChronicleKind, GameState, PhaseState } from './gameState.ts';
import { nextId } from './gameState.ts';

function editionOf(phase: PhaseState): number | null {
  return phase.kind === 'district' ? null : phase.edition;
}

/** Single entry point for phase transitions: records history and notifies listeners. */
export function enterPhase(
  state: GameState,
  next: PhaseState,
  chronicle: ChronicleKind | null,
  ctx: SimContext,
  extra: { daysAway?: number } = {},
): void {
  const previous = state.phase;
  state.phase = next;
  const edition = editionOf(next) ?? editionOf(previous);
  if (chronicle) {
    state.chronicle.push({
      id: nextId(state, 'h'),
      tick: state.clock.tick,
      kind: chronicle,
      ...(edition !== null ? { edition } : {}),
      ...(extra.daysAway !== undefined ? { daysAway: extra.daysAway } : {}),
    });
  }
  ctx.emit({ type: 'phase/changed', from: previous.kind, to: next.kind, edition: editionOf(next) });
}
