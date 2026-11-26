import type { GameState } from '../core/index.ts';
import { PHASE_KINDS, RNG_STREAMS, STATE_SCHEMA_VERSION } from '../core/index.ts';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isInt = (v: unknown): v is number => Number.isInteger(v);

/**
 * Structural check of a decoded save before it reaches the simulation.
 * Returns a list of problems (empty = valid). Grows with the state shape.
 */
export function validateGameState(value: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(value)) return ['state is not an object'];
  if (value.schemaVersion !== STATE_SCHEMA_VERSION) problems.push('schemaVersion mismatch');
  const meta = value.meta;
  if (!isRecord(meta) || typeof meta.seed !== 'string' || !isInt(meta.firstEdition))
    problems.push('meta');
  const clock = value.clock;
  if (!isRecord(clock) || !isInt(clock.tick) || clock.tick < 0) problems.push('clock');
  const phase = value.phase;
  if (!isRecord(phase) || !(PHASE_KINDS as readonly unknown[]).includes(phase.kind))
    problems.push('phase');
  if (!isRecord(value.away) || !isInt(value.away.days)) problems.push('away');
  if (!isRecord(value.competition)) problems.push('competition');
  const rng = value.rng;
  if (
    !isRecord(rng) ||
    !RNG_STREAMS.every(
      (id) =>
        Array.isArray(rng[id]) &&
        (rng[id] as unknown[]).length === 4 &&
        (rng[id] as unknown[]).every(isInt),
    )
  ) {
    problems.push('rng');
  }
  if (!isRecord(value.ids) || !isInt(value.ids.next)) problems.push('ids');
  if (!Array.isArray(value.chronicle)) problems.push('chronicle');
  if (!isRecord(value.economy) || !isRecord(value.economy.resources)) problems.push('economy');
  if (!isRecord(value.population) || !isRecord(value.population.citizens))
    problems.push('population');
  const district = value.district;
  if (
    !isRecord(district) ||
    !Array.isArray(district.structures) ||
    !Array.isArray(district.props) ||
    !Array.isArray(district.roads)
  ) {
    problems.push('district');
  }
  return problems;
}

export function isGameState(value: unknown): value is GameState {
  return validateGameState(value).length === 0;
}
