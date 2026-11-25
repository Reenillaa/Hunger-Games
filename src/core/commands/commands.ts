import { MAX_ACTIVE_LAWS, lawById } from '../../content/laws.ts';
import type { DomainEvent, SimContext } from '../events.ts';
import { collectingContext } from '../events.ts';
import type { GameState, PhaseKind } from '../state/gameState.ts';
import { enterPhase } from '../state/phases.ts';
import { runAutopilotDays } from '../systems/simulation.ts';
import { CAPITAL_DAYS } from '../time/calendar.ts';
import { PRICES } from '../../content/buildings.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import type { ResourceId, StructureKind } from '../district/template.ts';
import { allocateLabor, checkPlacement, def, storageCapacity } from '../economy/economy.ts';
import { nextId } from '../state/gameState.ts';
import { createGames, resolveCapitalDay } from '../games/capital.ts';
import { applyHomecoming, recordResults } from '../games/aftermath.ts';
import { resolveEvent } from '../regime/regime.ts';
import { DISTRICT_EVENTS } from '../../content/districtEvents.ts';
import type { Interview, OpeningPlan, Outfit, Posture, TrainingFocus } from '../games/types.ts';
import type { Order, Stance } from '../arena/arena.ts';
import { arenaDay, capsuleCost, createArena, playUntilInterrupt } from '../arena/arena.ts';
import { ARENA_SIZE } from '../arena/map.ts';
import { ITEMS } from '../../content/arenaItems.ts';

/**
 * Every player decision is a serializable command. UI and renderer never mutate state:
 * they dispatch commands (also the future network protocol for an authoritative server).
 */
export type Command =
  | { type: 'capital/depart' }
  | { type: 'capital/advance-day' }
  | { type: 'arena/advance'; maxRounds?: number }
  | { type: 'arena/order'; actorId: string; order: Order | null }
  | { type: 'arena/stance'; stance: Stance }
  | { type: 'arena/gift'; actorId: string; item: string }
  | { type: 'arena/conclude' }
  | { type: 'home/return' }
  | { type: 'event/choose'; option: number }
  | { type: 'law/toggle'; id: string }
  | {
      type: 'capital/choose';
      contestantId: string;
      choice: 'posture' | 'outfit' | 'training' | 'hidden' | 'interview' | 'plan';
      value: string;
      budget?: number;
    }
  | { type: 'build/place'; kind: StructureKind; x: number; y: number }
  | { type: 'build/demolish'; id: string }
  | { type: 'build/upgrade'; id: string }
  | {
      type: 'trade';
      action: 'sell' | 'buy';
      resource: Exclude<ResourceId, 'credits'>;
      amount: number;
    };

export type CommandType = Command['type'];

export interface CommandError {
  code: 'wrong-phase' | 'invalid' | 'placement' | 'cost' | 'not-found';
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

const UPGRADE_COST_FACTOR = [0, 1.5, 2.5];

function upgradeCost(kind: StructureKind, toLevel: number): Partial<Record<ResourceId, number>> {
  const base = def(kind).cost;
  const f = UPGRADE_COST_FACTOR[toLevel - 1] ?? 3;
  return Object.fromEntries(Object.entries(base).map(([r, n]) => [r, Math.ceil((n ?? 0) * f)]));
}

function payable(state: GameState, cost: Partial<Record<ResourceId, number>>): boolean {
  return Object.entries(cost).every(
    ([r, n]) => state.economy.resources[r as ResourceId] >= (n ?? 0),
  );
}

function pay(state: GameState, cost: Partial<Record<ResourceId, number>>, sign = -1): void {
  for (const [r, n] of Object.entries(cost))
    state.economy.resources[r as ResourceId] += sign * (n ?? 0);
}

const inDistrict = (state: GameState) => requirePhase(state, 'district');

const invalid = (message: string): CommandError => ({ code: 'invalid', message });

function requireArena(state: GameState): CommandError | null {
  return requirePhase(state, 'arena') ?? (state.arena ? null : invalid('No arena'));
}

/** Plays arena rounds and counts the days the delegation spends away. */
function advanceArena(state: GameState, maxRounds: number): void {
  const arena = state.arena!;
  const before = arenaDay(arena.round);
  playUntilInterrupt(state, maxRounds);
  state.away.days += arenaDay(arena.round) - before;
}

const DAY_OF_CHOICE: Record<string, number[]> = {
  posture: [1],
  outfit: [2],
  training: [3, 4, 5],
  hidden: [5],
  interview: [6],
  plan: [7],
};

const OPTIONS: Record<string, readonly string[]> = {
  posture: ['reserved', 'friendly', 'intimidating'],
  outfit: ['identity', 'bold', 'traditional'],
  training: ['combat', 'survival', 'stealth', 'endurance', 'allies', 'scout'],
  hidden: ['yes', 'no'],
  interview: ['humble', 'charming', 'defiant', 'mysterious', 'tragic'],
  plan: ['flee', 'fight'],
};

const HANDLERS: HandlerMap = {
  'capital/choose': {
    validate(state, cmd) {
      if (state.phase.kind !== 'capital') return requirePhase(state, 'capital');
      const c = state.games?.contestants[cmd.contestantId];
      if (!c?.player) return { code: 'not-found', message: cmd.contestantId };
      if (!DAY_OF_CHOICE[cmd.choice]?.includes(state.phase.day))
        return { code: 'invalid', message: 'Not today' };
      if (!OPTIONS[cmd.choice]?.includes(cmd.value))
        return { code: 'invalid', message: 'Unknown option' };
      const budget = cmd.budget ?? 0;
      const available = state.economy.resources.credits + (state.games?.outfitBudget ?? 0);
      if (cmd.choice === 'outfit' && (budget < 0 || budget > available)) {
        return { code: 'cost', message: 'Not enough credits' };
      }
      return null;
    },
    apply(state, cmd) {
      if (state.phase.kind !== 'capital' || !state.games) return;
      const games = state.games;
      const c = games.contestants[cmd.contestantId]!;
      switch (cmd.choice) {
        case 'posture':
          c.choices.posture = cmd.value as Posture;
          break;
        case 'outfit': {
          // One designer for the whole delegation: the concept and the budget are shared.
          const budget = cmd.budget ?? 0;
          state.economy.resources.credits += games.outfitBudget - budget;
          games.outfitBudget = budget;
          for (const t of Object.values(games.contestants))
            if (t.player) t.choices.outfit = cmd.value as Outfit;
          break;
        }
        case 'training':
          c.choices.training[state.phase.day - 3] = cmd.value as TrainingFocus;
          break;
        case 'hidden':
          c.choices.hidden = cmd.value === 'yes';
          break;
        case 'interview':
          c.choices.interview = cmd.value as Interview;
          break;
        case 'plan':
          c.choices.plan = cmd.value as OpeningPlan;
          break;
      }
    },
  },
  'build/place': {
    validate(state, cmd) {
      const phase = inDistrict(state);
      if (phase) return phase;
      const problem = checkPlacement(state, cmd.kind, cmd.x, cmd.y);
      if (problem === 'cost') return { code: 'cost', message: 'Not enough resources' };
      return problem ? { code: 'placement', message: problem } : null;
    },
    apply(state, cmd, ctx) {
      pay(state, def(cmd.kind).cost);
      const id = nextId(state, 'b');
      state.district.structures.push({
        id,
        kind: cmd.kind,
        x: cmd.x,
        y: cmd.y,
        level: 1,
        built: false,
        progress: 0,
        workers: 0,
        efficiency: 1,
      });
      // Clear trees and rocks under the new footprint.
      const { w, d } = STRUCTURE_FOOTPRINTS[cmd.kind];
      state.district.props = state.district.props.filter(
        (p) => p.x < cmd.x || p.y < cmd.y || p.x >= cmd.x + w || p.y >= cmd.y + d,
      );
      allocateLabor(state);
      ctx.emit({ type: 'building/placed', id, kind: cmd.kind });
    },
  },
  'build/demolish': {
    validate(state, cmd) {
      const phase = inDistrict(state);
      if (phase) return phase;
      const s = state.district.structures.find((x) => x.id === cmd.id);
      if (!s) return { code: 'not-found', message: cmd.id };
      return def(s.kind).buildable
        ? null
        : { code: 'invalid', message: 'Landmarks cannot be demolished' };
    },
    apply(state, cmd, ctx) {
      const s = state.district.structures.find((x) => x.id === cmd.id);
      if (!s) return;
      // Refund half (or everything if construction never started).
      const refund = Object.fromEntries(
        Object.entries(def(s.kind).cost).map(([r, n]) => [
          r,
          Math.floor((n ?? 0) * (s.progress === 0 ? 1 : 0.5)),
        ]),
      );
      pay(state, refund, 1);
      state.district.structures = state.district.structures.filter((x) => x.id !== cmd.id);
      allocateLabor(state);
      ctx.emit({ type: 'building/removed', id: cmd.id });
    },
  },
  'build/upgrade': {
    validate(state, cmd) {
      const phase = inDistrict(state);
      if (phase) return phase;
      const s = state.district.structures.find((x) => x.id === cmd.id);
      if (!s) return { code: 'not-found', message: cmd.id };
      if (!s.built || s.level >= 3 || !def(s.kind).buildable)
        return { code: 'invalid', message: 'Cannot upgrade' };
      return payable(state, upgradeCost(s.kind, s.level + 1))
        ? null
        : { code: 'cost', message: 'Not enough resources' };
    },
    apply(state, cmd) {
      const s = state.district.structures.find((x) => x.id === cmd.id);
      if (!s) return;
      pay(state, upgradeCost(s.kind, s.level + 1));
      s.level += 1;
      allocateLabor(state);
    },
  },
  trade: {
    validate(state, cmd) {
      const phase = inDistrict(state);
      if (phase) return phase;
      if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
        return { code: 'invalid', message: 'amount' };
      if (!state.district.structures.some((s) => s.kind === 'economato' && s.built))
        return { code: 'invalid', message: 'No economato' };
      const price = PRICES[cmd.resource];
      if (!price) return { code: 'invalid', message: 'resource' };
      const r = state.economy.resources;
      if (cmd.action === 'sell' && r[cmd.resource] < cmd.amount)
        return { code: 'cost', message: 'Not enough goods' };
      if (cmd.action === 'buy' && r.credits < cmd.amount * price.buy)
        return { code: 'cost', message: 'Not enough credits' };
      if (cmd.action === 'buy' && r[cmd.resource] + cmd.amount > storageCapacity(state))
        return { code: 'invalid', message: 'Storage full' };
      return null;
    },
    apply(state, cmd) {
      const r = state.economy.resources;
      const price = PRICES[cmd.resource];
      if (cmd.action === 'sell') {
        r[cmd.resource] -= cmd.amount;
        r.credits += cmd.amount * price.sell;
      } else {
        r[cmd.resource] += cmd.amount;
        r.credits -= cmd.amount * price.buy;
      }
    },
  },
  'capital/depart': {
    validate: (state) => requirePhase(state, 'selection'),
    apply(state, _cmd, ctx) {
      if (state.phase.kind !== 'selection') return;
      state.away.days = 0;
      state.games = createGames(state);
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
      state.economy.attention = Math.min(
        100,
        state.economy.attention + resolveCapitalDay(state, state.phase.day),
      );
      if (state.phase.day < CAPITAL_DAYS) {
        enterPhase(state, { ...state.phase, day: state.phase.day + 1 }, null, ctx);
      } else {
        state.arena = createArena(state);
        enterPhase(state, { kind: 'arena', edition: state.phase.edition }, 'arenaStarted', ctx);
      }
    },
  },
  'arena/advance': {
    validate: (state) =>
      requireArena(state) ?? (state.arena!.finished ? invalid('Finished') : null),
    apply(state, cmd) {
      advanceArena(state, cmd.maxRounds ?? 24);
    },
  },
  'arena/order': {
    validate(state, cmd) {
      const err = requireArena(state);
      if (err) return err;
      const a = state.arena!.actors[cmd.actorId];
      if (!a?.player || !a.alive) return { code: 'not-found', message: cmd.actorId };
      const o = cmd.order;
      if (o?.kind === 'move' && !(o.x >= 0 && o.y >= 0 && o.x < ARENA_SIZE && o.y < ARENA_SIZE))
        return invalid('Out of the arena');
      if (o?.kind === 'attack' && !state.arena!.actors[o.target]?.alive)
        return invalid('No target');
      return null;
    },
    apply(state, cmd) {
      state.arena!.actors[cmd.actorId]!.order = cmd.order;
    },
  },
  'arena/stance': {
    validate: (state, cmd) =>
      requireArena(state) ??
      (['cautious', 'balanced', 'aggressive'].includes(cmd.stance) ? null : invalid('Stance')),
    apply(state, cmd) {
      state.arena!.stance = cmd.stance;
    },
  },
  'arena/gift': {
    validate(state, cmd) {
      const err = requireArena(state);
      if (err) return err;
      const arena = state.arena!;
      const a = arena.actors[cmd.actorId];
      if (!a?.player || !a.alive) return { code: 'not-found', message: cmd.actorId };
      if (!ITEMS[cmd.item]) return invalid('Unknown item');
      if (capsuleCost(cmd.item, arena.round) > arena.patronage)
        return { code: 'cost', message: 'Not enough patronage' };
      return null;
    },
    apply(state, cmd) {
      const arena = state.arena!;
      arena.patronage -= capsuleCost(cmd.item, arena.round);
      arena.capsules.push({ round: arena.round, actorId: cmd.actorId, item: cmd.item });
    },
  },
  'arena/conclude': {
    validate: (state) => requirePhase(state, 'arena'),
    apply(state, _cmd, ctx) {
      if (state.phase.kind !== 'arena') return;
      // Anything left is fought out without the player (the games always end).
      if (state.arena) while (!state.arena.finished) advanceArena(state, 24 * 30);
      recordResults(state);
      enterPhase(state, { kind: 'aftermath', edition: state.phase.edition }, 'arenaConcluded', ctx);
    },
  },
  'law/toggle': {
    validate(state, cmd) {
      const err = inDistrict(state);
      if (err) return err;
      if (!lawById(cmd.id)) return invalid('Unknown law');
      if (!state.laws.includes(cmd.id) && state.laws.length >= MAX_ACTIVE_LAWS)
        return { code: 'invalid', message: 'Too many laws' };
      return null;
    },
    apply(state, cmd) {
      state.laws = state.laws.includes(cmd.id)
        ? state.laws.filter((l) => l !== cmd.id)
        : [...state.laws, cmd.id];
    },
  },
  'event/choose': {
    validate(state, cmd) {
      const err = inDistrict(state);
      if (err) return err;
      const pending = state.regime.pending;
      const ev = pending ? DISTRICT_EVENTS.find((d) => d.id === pending.eventId) : null;
      if (!ev) return invalid('No pending event');
      const option = ev.options[cmd.option];
      if (!option) return invalid('Unknown option');
      const credits = option.effects.credits ?? 0;
      if (credits < 0 && state.economy.resources.credits < -credits)
        return { code: 'cost', message: 'Not enough credits' };
      return null;
    },
    apply(state, cmd, ctx) {
      resolveEvent(state, cmd.option, ctx);
    },
  },
  'home/return': {
    validate: (state) => requirePhase(state, 'aftermath'),
    apply(state, _cmd, ctx) {
      const days = state.away.days;
      applyHomecoming(state, ctx);
      enterPhase(state, { kind: 'district' }, 'returnedHome', ctx, { daysAway: days });
      runAutopilotDays(state, days, ctx.emit);
      state.away.days = 0;
      state.competition.current = null;
      state.games = null;
      state.arena = null;
      allocateLabor(state);
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
