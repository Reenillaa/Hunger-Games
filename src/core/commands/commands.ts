import type { DomainEvent, SimContext } from '../events.ts';
import { collectingContext } from '../events.ts';
import type { GameState, PhaseKind } from '../state/gameState.ts';
import { enterPhase } from '../state/phases.ts';
import { runAutopilotDays } from '../systems/simulation.ts';
import { CAPITAL_DAYS } from '../time/calendar.ts';

/**
 * Every player decision is a serializable command. UI and renderer never mutate state:
 * they dispatch commands (also the future network protocol for an authoritative server).
 */
export type Command =
  | { type: 'capital/depart' }
  | { type: 'capital/advance-day' }
  | { type: 'arena/conclude' }
  | { type: 'home/return' };

export type CommandType = Command['type'];

export interface CommandError {
  code: 'wrong-phase' | 'invalid';
  message: string;
}

export type CommandResult =
  { ok: true; events: DomainEvent[] } | { ok: false; error: CommandError };

interface Handler<C extends Command> {
  validate(state: GameState, command: C): CommandError | null;
  apply(state: GameState, command: C, ctx: SimContext): void;
}

type HandlerMap = { [K in CommandType]: Handler<Extract<Command, { type: K }>> };

function requirePhase(state: GameState, kind: PhaseKind): CommandError | null {
  return state.phase.kind === kind
    ? null
    : {
        code: 'wrong-phase',
        message: `Expected phase "${kind}", current is "${state.phase.kind}"`,
      };
}

const HANDLERS: HandlerMap = {
  'capital/depart': {
    validate: (state) => requirePhase(state, 'selection'),
    apply(state, _cmd, ctx) {
      if (state.phase.kind !== 'selection') return;
      state.away.days = 0;
      enterPhase(
        state,
        { kind: 'capital', edition: state.phase.edition, day: 1 },
        'departedToCapital',
        ctx,
      );
    },
  },
  'capital/advance-day': {
    validate: (state) => requirePhase(state, 'capital'),
    apply(state, _cmd, ctx) {
      if (state.phase.kind !== 'capital') return;
      state.away.days += 1;
      if (state.phase.day < CAPITAL_DAYS) {
        enterPhase(state, { ...state.phase, day: state.phase.day + 1 }, null, ctx);
      } else {
        enterPhase(state, { kind: 'arena', edition: state.phase.edition }, 'arenaStarted', ctx);
      }
    },
  },
  'arena/conclude': {
    validate: (state) => requirePhase(state, 'arena'),
    apply(state, _cmd, ctx) {
      if (state.phase.kind !== 'arena') return;
      enterPhase(state, { kind: 'aftermath', edition: state.phase.edition }, 'arenaConcluded', ctx);
    },
  },
  'home/return': {
    validate: (state) => requirePhase(state, 'aftermath'),
    apply(state, _cmd, ctx) {
      const days = state.away.days;
      enterPhase(state, { kind: 'district' }, 'returnedHome', ctx, { daysAway: days });
      runAutopilotDays(state, days, ctx.emit);
      state.away.days = 0;
    },
  },
};

export function validateCommand(state: GameState, command: Command): CommandError | null {
  const handler = HANDLERS[command.type] as Handler<Command> | undefined;
  if (!handler)
    return { code: 'invalid', message: `Unknown command "${(command as Command).type}"` };
  return handler.validate(state, command);
}

/** Validates and applies a command. On error, the state is left untouched. */
export function applyCommand(state: GameState, command: Command): CommandResult {
  const error = validateCommand(state, command);
  if (error) return { ok: false, error };
  const ctx = collectingContext();
  (HANDLERS[command.type] as Handler<Command>).apply(state, command, ctx);
  return { ok: true, events: ctx.events };
}
