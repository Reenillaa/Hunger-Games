import { CACHE_LOOT, FISTS, ITEMS } from '../../content/arenaItems.ts';
import type { Contestant } from '../games/types.ts';
import { findPath } from '../path/astar.ts';
import type { PathGrid } from '../path/astar.ts';
import type { RngState } from '../rng/rng.ts';
import { nextFloat, nextInt, pick } from '../rng/rng.ts';
import type { GameState } from '../state/gameState.ts';
import {
  ARENA,
  ARENA_SIZE,
  COVER,
  arenaForEdition,
  arenaGrid,
  codeAt,
  distance,
  isWater,
  lineOfSight,
  setArenaMap,
} from './map.ts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const ROUNDS_PER_DAY = 24;
const START_HOUR = 10;

export type Stance = 'cautious' | 'balanced' | 'aggressive';
export type Order =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attack'; target: string }
  | { kind: 'forage' }
  | { kind: 'hide' }
  | { kind: 'rest' };

export interface Belief {
  x: number;
  y: number;
  round: number;
}

export interface ArenaActor {
  id: string;
  x: number;
  y: number;
  hp: number;
  hunger: number;
  thirst: number;
  energy: number;
  stress: number;
  bleeding: number;
  fracture: boolean;
  items: string[];
  weapon: string | null;
  alive: boolean;
  hidden: boolean;
  allianceId: string | null;
  /** Where this actor believes the others are (never omniscient). */
  beliefs: Record<string, Belief>;
  /** Grudges and debts: who helped, attacked or betrayed me. */
  memory: Record<string, { helped: number; attacked: number; betrayed: number }>;
  order: Order | null;
  kills: number;
  deathRound?: number;
  deathCause?: string;
  killedBy?: string;
  player: boolean;
}

export interface ArenaLog {
  round: number;
  key: string;
  vars?: Record<string, string>;
  actorId?: string;
  x?: number;
  y?: number;
}

export interface ArenaState {
  /** Which arena the games are fought in (v10). */
  mapId: string;
  round: number;
  actors: Record<string, ArenaActor>;
  /** Loot on the ground by cell index. */
  ground: Record<string, string[]>;
  /** Burning cells (index → rounds left). */
  fire: Record<string, number>;
  /** Safe radius around the centre (cells); shrinks from day 3. */
  zone: number;
  spectacle: number;
  /** Cells the player's team has seen (exploration of the fog of war). */
  explored: number[];
  log: ArenaLog[];
  /** Why the autoplay stopped for the player (null = keep going). */
  interrupt: ArenaLog | null;
  stance: Stance;
  capsules: { round: number; actorId: string; item: string }[];
  patronage: number;
  feastAnnounced: boolean;
  finished: { winner: string | null; round: number } | null;
}

const idx = (x: number, y: number) => y * ARENA_SIZE + x;
const GRIDS = new Map<string, PathGrid>();
function grid(): PathGrid {
  let g = GRIDS.get(ARENA.id);
  if (!g) {
    g = arenaGrid();
    GRIDS.set(ARENA.id, g);
  }
  return g;
}

export function arenaHour(round: number): number {
  return (START_HOUR + round) % 24;
}

export function arenaDay(round: number): number {
  return Math.floor((START_HOUR + round) / 24) + 1;
}

export const isNight = (round: number) => {
  const h = arenaHour(round);
  return h < 6 || h >= 20;
};

// ------------------------------------------------------------------------------- setup

/** Contestants start on a ring of pedestals around the Relicario. */
export function createArena(state: GameState): ArenaState {
  const games = state.games!;
  const mapId = arenaForEdition(games.edition);
  setArenaMap(mapId);
  const rng = state.rng.arena;
  const actors: Record<string, ArenaActor> = {};
  const n = games.order.length;
  const c = ARENA_SIZE / 2 - 0.5;
  games.order.forEach((id, i) => {
    const t = games.contestants[id]!;
    const a = (i / n) * Math.PI * 2;
    let x = Math.round(c + Math.cos(a) * 6);
    let y = Math.round(c + Math.sin(a) * 6);
    while (!Number.isFinite(grid().cost[idx(x, y)]!)) {
      x += x < c ? 1 : -1;
      y += y < c ? 1 : -1;
    }
    actors[id] = {
      id,
      x,
      y,
      hp: 100,
      hunger: 85,
      thirst: 85,
      energy: clamp(60 + t.morale * 0.4, 40, 100),
      stress: clamp(70 - t.morale * 0.5, 10, 80),
      bleeding: 0,
      fracture: false,
      items: [],
      weapon: null,
      alive: true,
      hidden: false,
      allianceId: null,
      beliefs: {},
      memory: {},
      order: null,
      kills: 0,
      player: t.player,
    };
  });
  // The home delegation is one team (the player directs it as a whole).
  for (const a of Object.values(actors)) if (a.player) a.allianceId = 'al_home';
  // Pre-arena friendships become alliances (district partners, strong opinions).
  for (const a of Object.values(actors)) {
    const ta = games.contestants[a.id]!;
    for (const b of Object.values(actors)) {
      if (a.id >= b.id || a.allianceId || b.allianceId) continue;
      const tb = games.contestants[b.id]!;
      if ((ta.opinions[b.id] ?? 0) > 40 && (tb.opinions[a.id] ?? 0) > 40 && nextFloat(rng) < 0.6) {
        a.allianceId = b.allianceId = `al_${a.id}`;
      }
    }
  }
  const ground: Record<string, string[]> = {};
  for (const item of CACHE_LOOT) {
    const x = Math.round(c + nextInt(rng, -1, 1));
    const y = Math.round(c + nextInt(rng, -1, 1));
    (ground[idx(x, y)] ??= []).push(item);
  }
  return {
    mapId,
    round: 0,
    actors,
    ground,
    fire: {},
    zone: 30,
    spectacle: 60,
    explored: [],
    log: [],
    interrupt: null,
    stance: 'balanced',
    capsules: [],
    patronage: games.patronage,
    feastAnnounced: false,
    finished: null,
  };
}

// ------------------------------------------------------------------------------- helpers

function contestant(state: GameState, id: string): Contestant {
  return state.games!.contestants[id]!;
}

function weaponOf(a: ArenaActor) {
  const w = a.weapon ? ITEMS[a.weapon] : null;
  return w ? { damage: w.damage!, accuracy: w.accuracy!, range: w.range! } : FISTS;
}

function power(state: GameState, a: ArenaActor): number {
  const t = contestant(state, a.id);
  return (
    (t.skills.combat + t.attributes.strength * 2 + weaponOf(a).damage) *
    (a.hp / 100) *
    (a.fracture ? 0.7 : 1)
  );
}

export function movePoints(state: GameState, a: ArenaActor): number {
  const t = contestant(state, a.id);
  let mp = 6 + Math.floor((t.attributes.agility + t.attributes.endurance) / 4);
  if (a.fracture) mp -= 3;
  if (a.energy < 25) mp -= 2;
  if (a.thirst < 30) mp -= 2;
  else if (a.hunger < 30) mp -= 1;
  return Math.max(2, mp);
}

function visionRadius(state: GameState, a: ArenaActor, round: number): number {
  const base = 4 + Math.floor(contestant(state, a.id).attributes.perception / 2);
  return isNight(round) ? Math.max(2, Math.floor(base / 2)) : base;
}

function allies(a: ArenaActor, b: ArenaActor): boolean {
  return !!a.allianceId && a.allianceId === b.allianceId;
}

function log(arena: ArenaState, entry: ArenaLog, interrupt = false): void {
  arena.log.push(entry);
  if (arena.log.length > 300) arena.log.splice(0, arena.log.length - 300);
  if (interrupt && !arena.interrupt) arena.interrupt = entry;
}

function teamOf(arena: ArenaState): ArenaActor[] {
  return Object.values(arena.actors).filter((a) => a.player && a.alive);
}

// ------------------------------------------------------------------------------- perception

/** Can `obs` see `target` right now (range, line of sight, hiding, darkness)? */
function canSee(state: GameState, arena: ArenaState, obs: ArenaActor, target: ArenaActor): boolean {
  const d = distance(obs.x, obs.y, target.x, target.y);
  if (d > visionRadius(state, obs, arena.round)) return false;
  if (!lineOfSight(obs.x, obs.y, target.x, target.y)) return false;
  if (target.hidden && d > 1) {
    const spot = contestant(state, obs.id).attributes.perception * 2;
    const hide =
      contestant(state, target.id).skills.stealth +
      COVER[codeAt(target.x, target.y) ?? 'c'] / 5 +
      (isNight(arena.round) ? 4 : 0);
    if (spot < hide) return false;
  }
  return true;
}

function perceive(state: GameState, arena: ArenaState, a: ArenaActor): string[] {
  const newly: string[] = [];
  for (const b of Object.values(arena.actors)) {
    if (!b.alive || b.id === a.id) continue;
    if (canSee(state, arena, a, b)) {
      const old = a.beliefs[b.id];
      if (!old || arena.round - old.round > 3) newly.push(b.id);
      a.beliefs[b.id] = { x: b.x, y: b.y, round: arena.round };
    }
  }
  // Allies share what they know.
  for (const b of Object.values(arena.actors)) {
    if (b.alive && b.id !== a.id && allies(a, b)) {
      for (const [k, v] of Object.entries(b.beliefs))
        if (!a.beliefs[k] || a.beliefs[k]!.round < v.round) a.beliefs[k] = { ...v };
    }
  }
  if (a.player) {
    const r = visionRadius(state, a, arena.round);
    const seen = new Set(arena.explored);
    for (let y = a.y - r; y <= a.y + r; y++) {
      for (let x = a.x - r; x <= a.x + r; x++) {
        if (x >= 0 && y >= 0 && x < ARENA_SIZE && y < ARENA_SIZE && lineOfSight(a.x, a.y, x, y))
          seen.add(idx(x, y));
      }
    }
    arena.explored = [...seen].sort((p, q) => p - q);
  }
  return newly;
}

// ------------------------------------------------------------------------------- actions

function moveToward(
  _state: GameState,
  arena: ArenaState,
  a: ArenaActor,
  tx: number,
  ty: number,
  budget: number,
  avoid: ArenaActor[] = [],
): boolean {
  const g = grid();
  // Danger-aware costs: cells near feared enemies and fire cost more.
  let pathGrid = g;
  if (avoid.length > 0 || Object.keys(arena.fire).length > 0) {
    const cost = new Float32Array(g.cost);
    for (const e of avoid) {
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const x = e.x + dx;
          const y = e.y + dy;
          if (x >= 0 && y >= 0 && x < ARENA_SIZE && y < ARENA_SIZE)
            cost[idx(x, y)] = cost[idx(x, y)]! + (4 - Math.max(Math.abs(dx), Math.abs(dy))) * 3;
        }
    }
    for (const k of Object.keys(arena.fire)) cost[Number(k)] = cost[Number(k)]! + 40;
    pathGrid = { ...g, cost };
  }
  const path = findPath(pathGrid, { x: a.x, y: a.y }, { x: tx, y: ty }, 4000);
  if (!path || path.length < 2) return false;
  let spent = 0;
  for (let i = 1; i < path.length; i++) {
    const step = path[i]!;
    const occupied = Object.values(arena.actors).some(
      (o) => o.alive && o.id !== a.id && o.x === step.x && o.y === step.y,
    );
    if (occupied) break;
    const c = g.cost[idx(step.x, step.y)]! * (step.x !== a.x && step.y !== a.y ? 1.4 : 1);
    if (spent + c > budget) break;
    spent += c;
    a.x = step.x;
    a.y = step.y;
  }
  a.hidden = false;
  a.energy = clamp(a.energy - spent * 0.35, 0, 100);
  return spent > 0;
}

/** Chance to hit with a transparent breakdown (GAME_SYSTEMS §10.6). */
export function hitChance(
  state: GameState,
  arena: ArenaState,
  att: ArenaActor,
  def: ArenaActor,
): number {
  const ta = contestant(state, att.id);
  const td = contestant(state, def.id);
  const surprise = !def.beliefs[att.id] || arena.round - def.beliefs[att.id]!.round > 1 ? 25 : 0;
  const flank = Object.values(arena.actors).some(
    (o) => o.alive && o.id !== att.id && allies(o, att) && distance(o.x, o.y, def.x, def.y) <= 1,
  )
    ? 15
    : 0;
  const height = codeAt(att.x, att.y) === 'r' && codeAt(def.x, def.y) !== 'r' ? 10 : 0;
  const fatigue =
    (att.energy < 30 ? 15 : 0) + (att.bleeding > 0 ? 10 : 0) + (att.fracture ? 10 : 0);
  const raw =
    55 +
    2 * ta.skills.combat +
    weaponOf(att).accuracy -
    3 * td.attributes.agility -
    COVER[codeAt(def.x, def.y) ?? 'c'] +
    flank +
    height +
    surprise -
    fatigue;
  return clamp(Math.round(raw), 5, 95);
}

function kill(
  state: GameState,
  arena: ArenaState,
  victim: ArenaActor,
  cause: string,
  killer?: ArenaActor,
): void {
  victim.alive = false;
  victim.hp = 0;
  victim.deathRound = arena.round;
  victim.deathCause = cause;
  if (killer) {
    victim.killedBy = killer.id;
    killer.kills += 1;
  }
  const drop = [...victim.items, ...(victim.weapon ? [victim.weapon] : [])];
  if (drop.length > 0) (arena.ground[idx(victim.x, victim.y)] ??= []).push(...drop);
  arena.spectacle = clamp(arena.spectacle + 25, 0, 100);
  log(
    arena,
    {
      round: arena.round,
      key: killer ? 'arena.killed' : `arena.died.${cause}`,
      vars: {
        name: contestant(state, victim.id).name,
        killer: killer ? contestant(state, killer.id).name : '',
      },
      actorId: victim.id,
      x: victim.x,
      y: victim.y,
    },
    victim.player || !!killer?.player,
  );
}

function attack(
  state: GameState,
  arena: ArenaState,
  att: ArenaActor,
  def: ArenaActor,
  rng: RngState,
): void {
  const chance = hitChance(state, arena, att, def);
  const betrayal = allies(att, def);
  if (betrayal) {
    att.allianceId = null;
    def.allianceId = null;
    for (const o of Object.values(arena.actors))
      if (o.alive && canSee(state, arena, o, att))
        (o.memory[att.id] ??= { helped: 0, attacked: 0, betrayed: 0 }).betrayed += 1;
    log(
      arena,
      {
        round: arena.round,
        key: 'arena.betrayal',
        vars: { a: contestant(state, att.id).name, b: contestant(state, def.id).name },
        actorId: att.id,
      },
      att.player || def.player,
    );
    arena.spectacle = clamp(arena.spectacle + 20, 0, 100);
  }
  (def.memory[att.id] ??= { helped: 0, attacked: 0, betrayed: 0 }).attacked += 1;
  def.beliefs[att.id] = { x: att.x, y: att.y, round: arena.round };
  att.hidden = false;
  att.energy = clamp(att.energy - 6, 0, 100);
  arena.spectacle = clamp(arena.spectacle + 8, 0, 100);
  const roll = nextInt(rng, 1, 100);
  const names = {
    a: contestant(state, att.id).name,
    b: contestant(state, def.id).name,
    p: String(chance),
  };
  if (roll > chance) {
    log(
      arena,
      { round: arena.round, key: 'arena.miss', vars: names, actorId: att.id, x: def.x, y: def.y },
      def.player || att.player,
    );
    return;
  }
  const w = weaponOf(att);
  const strength = w.range <= 1 ? contestant(state, att.id).attributes.strength : 0;
  const crit = roll <= 8;
  const dmg = Math.round((w.damage + strength + nextInt(rng, -3, 3)) * (crit ? 1.6 : 1));
  def.hp = clamp(def.hp - dmg, 0, 100);
  def.stress = clamp(def.stress + 12, 0, 100);
  if (dmg >= 20) def.bleeding = Math.min(3, def.bleeding + 1);
  if (crit && nextFloat(rng) < 0.5) def.fracture = true;
  log(
    arena,
    {
      round: arena.round,
      key: crit ? 'arena.crit' : 'arena.hit',
      vars: { ...names, d: String(dmg) },
      actorId: att.id,
      x: def.x,
      y: def.y,
    },
    def.player || att.player,
  );
  if (def.hp <= 0) kill(state, arena, def, 'combat', att);
}

function pickUp(arena: ArenaState, a: ArenaActor): string | null {
  const here = arena.ground[idx(a.x, a.y)];
  if (!here || here.length === 0) return null;
  const item = here.shift()!;
  if (here.length === 0) delete arena.ground[idx(a.x, a.y)];
  const def = ITEMS[item];
  if (def?.kind === 'weapon' && (!a.weapon || (ITEMS[a.weapon]?.damage ?? 0) < def.damage!)) {
    if (a.weapon) a.items.push(a.weapon);
    a.weapon = item;
  } else {
    a.items.push(item);
  }
  return item;
}

function forage(state: GameState, arena: ArenaState, a: ArenaActor, rng: RngState): void {
  const found = pickUp(arena, a);
  if (found) return;
  const t = contestant(state, a.id);
  const code = codeAt(a.x, a.y) ?? 'c';
  const richness =
    code === 'b' ? 0.35 : code === 'F' || code === 'D' ? 0.25 : code === 'u' ? 0.2 : 0.12;
  if (nextFloat(rng) < richness + t.skills.survival / 40) {
    a.hunger = clamp(a.hunger + 25 + t.skills.survival, 0, 100);
    if (a.player)
      log(arena, {
        round: arena.round,
        key: 'arena.forage',
        vars: { name: t.name },
        actorId: a.id,
      });
  }
  a.energy = clamp(a.energy - 3, 0, 100);
}

function drinkIfWater(a: ArenaActor): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (isWater(a.x + dx, a.y + dy)) {
        a.thirst = 100;
        return true;
      }
    }
  return false;
}

function consume(a: ArenaActor): void {
  if (a.thirst < 50 && a.items.includes('water')) {
    a.items.splice(a.items.indexOf('water'), 1);
    a.thirst = clamp(a.thirst + 60, 0, 100);
  }
  if (a.hunger < 50 && a.items.includes('ration')) {
    a.items.splice(a.items.indexOf('ration'), 1);
    a.hunger = clamp(a.hunger + 55, 0, 100);
  }
  if ((a.bleeding > 0 || a.hp < 50) && a.items.includes('medkit')) {
    a.items.splice(a.items.indexOf('medkit'), 1);
    a.bleeding = 0;
    a.hp = clamp(a.hp + 30, 0, 100);
  }
}

// ------------------------------------------------------------------------------- AI

function nearestWater(a: ArenaActor): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (let y = 0; y < ARENA_SIZE; y++)
    for (let x = 0; x < ARENA_SIZE; x++) {
      if (codeAt(x, y) !== 'w') continue;
      const d = distance(a.x, a.y, x, y);
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    }
  return best;
}

function safeTowardsCentre(arena: ArenaState, a: ArenaActor): boolean {
  const c = ARENA_SIZE / 2;
  return Math.hypot(a.x - c, a.y - c) <= arena.zone;
}

/**
 * Utility AI (GAME_SYSTEMS §10.9): scores goals from needs, threats, personality and memory,
 * using only what the actor believes. The player's actors use it too, biased by the stance,
 * unless they carry an explicit order.
 */
function decide(state: GameState, arena: ArenaState, a: ArenaActor, rng: RngState): void {
  const t = contestant(state, a.id);
  const stance: Stance = a.player
    ? arena.stance
    : t.traits.includes('aggressive') || t.skills.combat >= 10
      ? 'aggressive'
      : t.traits.includes('coward')
        ? 'cautious'
        : 'balanced';
  const alive = Object.values(arena.actors).filter((o) => o.alive).length;
  const known = Object.entries(a.beliefs)
    .map(([id, b]) => ({ actor: arena.actors[id]!, b }))
    .filter(({ actor, b }) => actor.alive && arena.round - b.round <= 3 && !allies(a, actor));
  const visible = known.filter(({ b }) => b.round === arena.round);
  const myPower = power(state, a);

  consume(a);
  drinkIfWater(a); // free when standing at the water's edge

  // Explicit player order first.
  if (a.order) {
    const o = a.order;
    if (o.kind === 'move') {
      const reached = a.x === o.x && a.y === o.y;
      if (!reached) moveToward(state, arena, a, o.x, o.y, movePoints(state, a) * 2);
      if (a.x === o.x && a.y === o.y) {
        a.order = null;
        log(
          arena,
          { round: arena.round, key: 'arena.order.done', vars: { name: t.name }, actorId: a.id },
          true,
        );
      }
      return;
    }
    if (o.kind === 'attack') {
      const target = arena.actors[o.target];
      if (!target?.alive) {
        a.order = null;
        return;
      }
      if (distance(a.x, a.y, target.x, target.y) > weaponOf(a).range)
        moveToward(state, arena, a, target.x, target.y, movePoints(state, a));
      if (
        distance(a.x, a.y, target.x, target.y) <= weaponOf(a).range &&
        lineOfSight(a.x, a.y, target.x, target.y)
      )
        attack(state, arena, a, target, rng);
      return;
    }
    if (o.kind === 'hide') {
      a.hidden = true;
      a.energy = clamp(a.energy + 4, 0, 100);
      return;
    }
    if (o.kind === 'rest') {
      a.energy = clamp(a.energy + 22, 0, 100);
      a.stress = clamp(a.stress - 6, 0, 100);
      return;
    }
    if (o.kind === 'forage') {
      forage(state, arena, a, rng);
      forage(state, arena, a, rng);
      return;
    }
  }

  // Hazards first: fire and the closing zone.
  const inFire = arena.fire[idx(a.x, a.y)] !== undefined;
  if (inFire || !safeTowardsCentre(arena, a)) {
    const c = Math.round(ARENA_SIZE / 2);
    moveToward(
      state,
      arena,
      a,
      c + nextInt(rng, -3, 3),
      c + nextInt(rng, -3, 3),
      movePoints(state, a) * 2,
    );
    return;
  }

  // Score goals.
  const nearest = visible.sort(
    (p, q) => distance(a.x, a.y, p.b.x, p.b.y) - distance(a.x, a.y, q.b.x, q.b.y),
  )[0];
  const theirPower = nearest ? power(state, nearest.actor) : 0;
  const grudge = nearest
    ? (a.memory[nearest.actor.id]?.attacked ?? 0) + (a.memory[nearest.actor.id]?.betrayed ?? 0) * 2
    : 0;
  const bold = stance === 'aggressive' ? 0.35 : stance === 'cautious' ? -0.3 : 0;
  const scores: [string, number][] = [
    ['drink', (100 - a.thirst) / 70],
    ['eat', (100 - a.hunger) / 90],
    ['rest', a.energy < 30 && !nearest ? (100 - a.energy) / 80 : 0],
    ['heal', a.bleeding > 0 ? 0.6 + a.bleeding * 0.2 : 0],
    ['explore', stance === 'cautious' ? 0.12 : 0.3],
    [
      'cache',
      arena.round < 3 && t.choices.plan === 'fight'
        ? 1.2
        : arena.feastAnnounced && a.hunger < 60
          ? 0.7
          : 0,
    ],
    [
      'hunt',
      nearest && myPower > theirPower * (0.9 - bold)
        ? 0.55 + bold + grudge * 0.2 + (alive <= 4 ? 0.3 : 0)
        : 0,
    ],
    [
      'flee',
      nearest &&
      theirPower > myPower * (1.1 + bold) &&
      distance(a.x, a.y, nearest.b.x, nearest.b.y) < 5
        ? 0.9 - bold + a.stress / 200
        : 0,
    ],
    [
      'hide',
      nearest && (t.skills.stealth >= 6 || stance === 'cautious') && theirPower > myPower * 0.8
        ? 0.7 + (stance === 'cautious' ? 0.25 : 0)
        : stance === 'cautious' && !nearest
          ? 0.22
          : 0,
    ],
  ];
  // Ambush: hidden, the prey in reach and unaware of us. The patient survive this way.
  if (
    nearest &&
    a.hidden &&
    distance(a.x, a.y, nearest.b.x, nearest.b.y) <= weaponOf(a).range &&
    lineOfSight(a.x, a.y, nearest.b.x, nearest.b.y) &&
    (!nearest.actor.beliefs[a.id] || arena.round - nearest.actor.beliefs[a.id]!.round > 2) &&
    myPower > theirPower * 0.55
  )
    scores.push(['hunt', 1.15 + (stance === 'cautious' ? 0.2 : 0)]);
  // Alliances and betrayals.
  const ally = Object.values(arena.actors).find((o) => o.alive && o.id !== a.id && allies(a, o));
  if (
    !a.allianceId &&
    t.traits.includes('sociable') &&
    nearest &&
    (contestant(state, nearest.actor.id).opinions[a.id] ?? 0) > 15
  )
    scores.push(['ally', 0.65]);
  const treacherous =
    t.traits.includes('manipulative') ||
    t.traits.includes('selfish') ||
    t.traits.includes('ambitious');
  if (
    ally &&
    !a.player &&
    treacherous &&
    alive <= 5 &&
    distance(a.x, a.y, ally.x, ally.y) <= weaponOf(a).range &&
    ally.hp < a.hp &&
    !t.traits.includes('loyal')
  )
    scores.push(['betray', 0.95]);
  for (const s of scores) s[1] += nextFloat(rng) * 0.12;
  scores.sort((p, q) => q[1] - p[1]);
  const goal = scores[0]![0];

  switch (goal) {
    case 'drink': {
      if (drinkIfWater(a)) break;
      if (a.items.includes('water')) {
        consume(a);
        break;
      }
      const w = nearestWater(a);
      if (w)
        moveToward(
          state,
          arena,
          a,
          w.x,
          w.y,
          movePoints(state, a) * 2,
          visible.map((v) => v.actor),
        );
      drinkIfWater(a);
      break;
    }
    case 'eat':
      forage(state, arena, a, rng);
      forage(state, arena, a, rng);
      break;
    case 'rest':
      a.energy = clamp(a.energy + 22, 0, 100);
      a.stress = clamp(a.stress - 5, 0, 100);
      a.hidden = t.skills.stealth > 4;
      break;
    case 'heal':
      if (t.skills.survival >= 6 || t.skills.medicine >= 4)
        a.bleeding = Math.max(0, a.bleeding - 1);
      a.hidden = true;
      break;
    case 'cache': {
      const c = Math.round(ARENA_SIZE / 2 - 0.5);
      moveToward(
        state,
        arena,
        a,
        c + nextInt(rng, -1, 1),
        c + nextInt(rng, -1, 1),
        movePoints(state, a),
      );
      pickUp(arena, a);
      break;
    }
    case 'hunt': {
      const target = nearest!.actor;
      if (distance(a.x, a.y, target.x, target.y) > weaponOf(a).range)
        moveToward(state, arena, a, target.x, target.y, movePoints(state, a));
      if (
        distance(a.x, a.y, target.x, target.y) <= weaponOf(a).range &&
        lineOfSight(a.x, a.y, target.x, target.y)
      )
        attack(state, arena, a, target, rng);
      break;
    }
    case 'flee': {
      const threat = nearest!.actor;
      const fx = clamp(a.x + Math.sign(a.x - threat.x) * 6, 1, ARENA_SIZE - 2);
      const fy = clamp(a.y + Math.sign(a.y - threat.y) * 6, 1, ARENA_SIZE - 2);
      moveToward(state, arena, a, fx, fy, movePoints(state, a) * 2, [threat]);
      a.stress = clamp(a.stress + 4, 0, 100);
      break;
    }
    case 'hide':
      a.hidden = true;
      break;
    case 'ally': {
      const other = nearest!.actor;
      const ot = contestant(state, other.id);
      const accept =
        (ot.opinions[a.id] ?? 0) +
          (ot.traits.includes('suspicious') ? -25 : 0) +
          (ot.traits.includes('trusting') ? 15 : 0) +
          (other.hp < 60 ? 10 : 0) >
        20;
      if (accept && !other.allianceId) {
        a.allianceId = other.allianceId = `al_${a.id}_${arena.round}`;
        log(
          arena,
          {
            round: arena.round,
            key: 'arena.alliance',
            vars: { a: t.name, b: ot.name },
            actorId: a.id,
          },
          a.player || other.player,
        );
      }
      break;
    }
    case 'betray':
      attack(state, arena, a, ally!, rng);
      break;
    default: {
      // Explore towards the least-known direction, preferring cover by day.
      const tx = clamp(a.x + nextInt(rng, -8, 8), 1, ARENA_SIZE - 2);
      const ty = clamp(a.y + nextInt(rng, -8, 8), 1, ARENA_SIZE - 2);
      moveToward(
        state,
        arena,
        a,
        tx,
        ty,
        movePoints(state, a),
        visible.map((v) => v.actor),
      );
      pickUp(arena, a);
    }
  }
}

// ------------------------------------------------------------------------------- director & round

function director(state: GameState, arena: ArenaState, rng: RngState): void {
  const day = arenaDay(arena.round);
  // Every morning the patrons pledge more for the home contestants still alive: the audience's
  // love (popularity from the week in the Capitol) and every kill on screen pay off.
  if (arenaHour(arena.round) === 8) {
    let pledge = 0;
    for (const a of teamOf(arena))
      pledge += Math.round(contestant(state, a.id).popularity * 0.6 + a.kills * 12);
    if (pledge > 0) {
      arena.patronage += pledge;
      log(arena, { round: arena.round, key: 'arena.patrons', vars: { n: String(pledge) } });
    }
  }
  arena.spectacle = clamp(arena.spectacle - 1.5, 0, 100);
  if (day >= 3 && arena.round % 6 === 0) arena.zone = Math.max(4, arena.zone - 1.5);
  if (arena.round > ROUNDS_PER_DAY * 7) arena.zone = Math.max(2, arena.zone - 2);
  // Nobody outlasts the games: after two weeks the safe zone vanishes.
  if (arena.round > ROUNDS_PER_DAY * 14) arena.zone = 0;
  if (day >= 2 && arena.spectacle < 25 && nextFloat(rng) < 0.35) {
    // A wall of fire where the contestants hide: drives them together.
    const hidden = Object.values(arena.actors).filter((a) => a.alive);
    const centre = pick(rng, hidden);
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = centre.x + dx;
        const y = centre.y + dy;
        if (x > 0 && y > 0 && x < ARENA_SIZE - 1 && y < ARENA_SIZE - 1 && !isWater(x, y))
          arena.fire[idx(x, y)] = 6;
      }
    arena.spectacle += 30;
    log(arena, { round: arena.round, key: 'arena.fire', x: centre.x, y: centre.y }, true);
  }
  if (day >= 3 && !arena.feastAnnounced) {
    arena.feastAnnounced = true;
    const c = Math.round(ARENA_SIZE / 2 - 0.5);
    (arena.ground[idx(c, c)] ??= []).push('medkit', 'ration', 'ration', 'water', 'bow');
    log(arena, { round: arena.round, key: 'arena.feast' }, true);
  }
  for (const k of Object.keys(arena.fire)) {
    arena.fire[k]! -= 1;
    if (arena.fire[k]! <= 0) delete arena.fire[k];
  }
}

function upkeep(state: GameState, arena: ArenaState, a: ArenaActor): void {
  a.hunger = clamp(a.hunger - 1.6, 0, 100);
  a.thirst = clamp(a.thirst - 2.4, 0, 100);
  // The tundra's cold: nights drain far more energy; snow means water is never far.
  const cold = ARENA.id === 'arena_tundra';
  a.energy = clamp(
    a.energy - (isNight(arena.round) ? (cold ? 2.6 : 1.5) : cold ? 1.1 : 0.8),
    0,
    100,
  );
  if (cold) a.thirst = clamp(a.thirst + 0.8, 0, 100);
  if (a.bleeding > 0) a.hp -= a.bleeding * 3;
  if (a.thirst <= 0) a.hp -= 4;
  if (a.hunger <= 0) a.hp -= 2;
  if (arena.fire[idx(a.x, a.y)] !== undefined) a.hp -= 18;
  if (!safeTowardsCentre(arena, a)) a.hp -= 7;
  if (a.hp <= 0 && a.alive) {
    const cause =
      arena.fire[idx(a.x, a.y)] !== undefined
        ? 'fire'
        : a.bleeding > 0
          ? 'bleeding'
          : a.thirst <= 0
            ? 'thirst'
            : !safeTowardsCentre(arena, a)
              ? 'zone'
              : 'hunger';
    kill(state, arena, a, cause);
  }
}

/** One arena hour: perception, decisions, upkeep, the director, capsules, victory. */
export function resolveRound(state: GameState): void {
  const arena = state.arena!;
  setArenaMap(arena.mapId);
  if (arena.finished) return;
  const rng = state.rng.arena;
  arena.round += 1;
  const living = Object.values(arena.actors).filter((a) => a.alive);
  const initiative = living
    .map((a) => ({
      a,
      v:
        contestant(state, a.id).attributes.agility +
        contestant(state, a.id).attributes.perception +
        nextFloat(rng) * 4,
    }))
    .sort((p, q) => q.v - p.v || (p.a.id < q.a.id ? -1 : 1));
  for (const { a } of initiative) {
    if (!a.alive) continue;
    const newly = perceive(state, arena, a);
    if (a.player) {
      // The opening scramble at the Relicario is not an interruption: everyone sees everyone.
      const enemies = newly.filter((id) => {
        const o = arena.actors[id]!;
        return !allies(a, o) && arena.round > 2 && distance(a.x, a.y, o.x, o.y) <= 5;
      });
      if (enemies.length > 0) {
        const other = arena.actors[enemies[0]!]!;
        log(
          arena,
          {
            round: arena.round,
            key: 'arena.sighted',
            vars: { name: contestant(state, a.id).name, other: contestant(state, other.id).name },
            actorId: a.id,
            x: other.x,
            y: other.y,
          },
          true,
        );
      }
    }
    decide(state, arena, a, rng);
  }
  for (const a of living) if (a.alive) upkeep(state, arena, a);
  for (const a of teamOf(arena)) {
    if (a.thirst < 20 || a.hunger < 15 || a.hp < 30) {
      log(
        arena,
        {
          round: arena.round,
          key: 'arena.critical',
          vars: { name: contestant(state, a.id).name },
          actorId: a.id,
        },
        arena.round % 6 === 0,
      );
    }
  }
  // Capsules arrive one round after being sent.
  for (const cap of arena.capsules.filter((c) => c.round < arena.round)) {
    const target = arena.actors[cap.actorId];
    if (target?.alive) {
      (arena.ground[idx(target.x, target.y)] ??= []).push(cap.item);
      pickUp(arena, target);
      log(
        arena,
        {
          round: arena.round,
          key: 'arena.capsule',
          vars: { name: contestant(state, target.id).name, item: cap.item },
          actorId: target.id,
          x: target.x,
          y: target.y,
        },
        true,
      );
    }
  }
  arena.capsules = arena.capsules.filter((c) => c.round >= arena.round);
  director(state, arena, rng);
  const left = Object.values(arena.actors).filter((a) => a.alive);
  // Only one alliance left: there can be only one Laureate, so the pact breaks.
  if (
    left.length > 1 &&
    left[0]!.allianceId &&
    left.every((a) => a.allianceId === left[0]!.allianceId)
  ) {
    for (const a of left) a.allianceId = null;
    log(
      arena,
      { round: arena.round, key: 'arena.lastPact' },
      left.some((a) => a.player),
    );
  }
  if (left.length <= 1) {
    arena.finished = { winner: left[0]?.id ?? null, round: arena.round };
    log(
      arena,
      {
        round: arena.round,
        key: left[0] ? 'arena.victory' : 'arena.nobody',
        vars: { name: left[0] ? contestant(state, left[0].id).name : '' },
      },
      true,
    );
  }
}

/** Plays rounds until something needs the player (or the games end). */
export function playUntilInterrupt(state: GameState, maxRounds = 24): number {
  const arena = state.arena!;
  arena.interrupt = null;
  let played = 0;
  while (played < maxRounds && !arena.finished) {
    resolveRound(state);
    played += 1;
    if (arena.interrupt) break;
  }
  return played;
}

export function capsuleCost(item: string, round: number): number {
  const base = ITEMS[item]?.capsule ?? 999;
  return Math.round(base * (1 + (arenaDay(round) - 1) * 0.25));
}

export const ARENA_IDX = idx;

/** Cells the player's team sees right now (for the fog of war). */
export function visibleCells(state: GameState): Set<number> {
  const arena = state.arena!;
  setArenaMap(arena.mapId);
  const seen = new Set<number>();
  for (const a of teamOf(arena)) {
    const r = visionRadius(state, a, arena.round);
    for (let y = a.y - r; y <= a.y + r; y++) {
      for (let x = a.x - r; x <= a.x + r; x++) {
        if (x < 0 || y < 0 || x >= ARENA_SIZE || y >= ARENA_SIZE) continue;
        if (distance(a.x, a.y, x, y) <= r && lineOfSight(a.x, a.y, x, y)) seen.add(idx(x, y));
      }
    }
  }
  return seen;
}

/** Enemies the team can see now (hidden ones included only if spotted). */
export function visibleActors(state: GameState): Set<string> {
  const arena = state.arena!;
  setArenaMap(arena.mapId);
  const out = new Set<string>();
  const team = teamOf(arena);
  for (const b of Object.values(arena.actors)) {
    if (!b.alive) continue;
    if (b.player || team.some((a) => canSee(state, arena, a, b))) out.add(b.id);
  }
  return out;
}
