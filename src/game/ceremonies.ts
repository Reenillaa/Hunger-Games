import { TEMPLATES } from '../content/maps/index.ts';
import type { Citizen, GameState } from '../core/index.ts';
import { ageOf, fullName } from '../core/index.ts';
import type { CineStep } from './cinematic.ts';
import type { LocaleKey } from '../content/i18n.ts';
import { t } from '../content/i18n.ts';

/** Camera marks of the district's own plaza (each map has its own plan). */
function marks(state: Readonly<GameState>) {
  const p = TEMPLATES[state.district.templateId]?.plaza ?? { x0: 24, y0: 20, x1: 29, y1: 26 };
  return {
    PLAZA: { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 + 1 },
    STAGE: { x: p.x0 + 2, y: p.y0 },
  };
}

function relative(state: Readonly<GameState>, id: string | null): Citizen | null {
  const c = id ? state.population.citizens[id] : null;
  return c?.alive ? c : null;
}

interface Reaction {
  text: string;
  /** Who reacts (for a close-up), or null for the crowd. */
  by: string | null;
}

/** Family and friends react according to who they are (real names, real ties). */
export function reactionLines(state: Readonly<GameState>, c: Citizen): string[] {
  return reactions(state, c).map((r) => r.text);
}

function reactions(state: Readonly<GameState>, c: Citizen): Reaction[] {
  const day = Math.floor(state.clock.tick / 24);
  const lines: Reaction[] = [];
  const mother = relative(state, c.motherId);
  const father = relative(state, c.fatherId);
  const partner = relative(state, c.partnerId);
  const siblings = [...new Set([...(mother?.childrenIds ?? []), ...(father?.childrenIds ?? [])])]
    .filter((id) => id !== c.id)
    .map((id) => relative(state, id))
    .filter((x): x is Citizen => !!x)
    .sort(
      (a, b) => Math.abs(ageOf(a, day) - ageOf(c, day)) - Math.abs(ageOf(b, day) - ageOf(c, day)),
    );
  if (mother)
    lines.push({
      by: mother.id,
      text: t(mother.traits.includes('resilient') ? 'cri.mother.strong' : 'cri.mother', {
        name: mother.firstName,
      }),
    });
  if (father)
    lines.push({
      by: father.id,
      text: t(
        father.traits.includes('rebel') || father.traits.includes('aggressive')
          ? 'cri.father.angry'
          : 'cri.father',
        { name: father.firstName },
      ),
    });
  const sib = siblings[0];
  if (sib)
    lines.push({
      by: sib.id,
      text: t(ageOf(sib, day) < 12 ? 'cri.sibling.small' : 'cri.sibling', { name: sib.firstName }),
    });
  if (partner) lines.push({ by: partner.id, text: t('cri.partner', { name: partner.firstName }) });
  const friend = Object.entries(c.relations)
    .filter(([, r]) => r.opinion > 50)
    .map(([id]) => relative(state, id))
    .find((f) => f && f.id !== mother?.id && f.id !== father?.id);
  if (friend)
    lines.push({
      by: friend.id,
      text: t(friend.traits.includes('brave') ? 'cri.friend.brave' : 'cri.friend', {
        name: friend.firstName,
      }),
    });
  if (lines.length === 0) lines.push({ by: null, text: t('cri.alone') });
  return lines.slice(0, 3);
}

/** Who comes to say goodbye in the town hall, closest first (at most two). */
function visitors(state: Readonly<GameState>, c: Citizen): string[] {
  return reactions(state, c)
    .map((r) => r.by)
    .filter((id): id is string => !!id)
    .slice(0, 2);
}

function farewellLine(state: Readonly<GameState>, c: Citizen, visitorId: string): string {
  const v = state.population.citizens[visitorId]!;
  const day = Math.floor(state.clock.tick / 24);
  const vars = { name: v.firstName, tribute: c.firstName };
  if (visitorId === c.motherId) return t('fw.mother', vars);
  if (visitorId === c.fatherId) return t('fw.father', vars);
  if (visitorId === c.partnerId) return t('fw.partner', vars);
  if (v.motherId && v.motherId === c.motherId)
    return t(ageOf(v, day) < 12 ? 'fw.sibling.small' : 'fw.sibling', vars);
  return t('fw.friend', vars);
}

/**
 * The Reaping as a film, built from the real draw: guards close the plaza, nervous faces, the
 * herald, the urn, the chosen face, family reactions, the walk to the stage, the farewell room
 * in the town hall and the train pulling away from the district.
 */
export function buildSelectionCeremony(state: Readonly<GameState>): CineStep[] {
  const { PLAZA, STAGE } = marks(state);
  const current = state.competition.current;
  if (!current) return [];
  const profile = homeProfile(state.meta.homeDistrictId);
  const n = String(profile.number);
  const day = Math.floor(state.clock.tick / 24);
  const herald = t('cri.herald');
  const totals = { F: 0, M: 0 };
  for (const [id, k] of Object.entries(current.entries)) {
    const c = state.population.citizens[id];
    if (c) totals[c.sex] += k;
  }
  // The three youths with most slips (the ones who have most to fear), never the chosen ones.
  const nervous = Object.entries(current.entries)
    .filter(([id]) => !current.participants.includes(id) && state.population.citizens[id]?.alive)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id]) => id);
  const steps: CineStep[] = [
    { kind: 'camera', cell: { x: PLAZA.x + 3, y: PLAZA.y + 3 }, zoom: 0.55, ms: 0 },
    {
      kind: 'title',
      title: t('cri.title'),
      subtitle: t('cri.subtitle', { year: Math.floor(day / 40) + 1, edition: current.edition }),
      ms: 3800,
    },
    { kind: 'fade', to: 'clear', ms: 600 },
    { kind: 'camera', cell: PLAZA, zoom: 0.8, glide: 0.02, ms: 0 },
    { kind: 'line', text: t('cri.gather'), ms: 4200 },
    { kind: 'shot', shot: { type: 'guard' }, line: t('cri.guards'), ms: 3400 },
  ];
  if (nervous.length > 0)
    steps.push({
      kind: 'shot',
      shot: { type: 'faces', citizenIds: nervous },
      line: t('cri.nerves'),
      ms: 3600,
    });
  steps.push(
    { kind: 'camera', cell: STAGE, zoom: 1.15, ms: 0 },
    {
      kind: 'shot',
      shot: { type: 'herald', mood: 95 },
      speaker: herald,
      line: t('cri.hello', { n }),
      ms: 4200,
    },
    {
      kind: 'shot',
      shot: { type: 'herald', mood: 70 },
      speaker: herald,
      line: t('cri.motto'),
      ms: 3600,
    },
  );
  for (const id of current.participants) {
    const c = state.population.citizens[id];
    if (!c) continue;
    const slips = current.entries[id] ?? 1;
    steps.push(
      {
        kind: 'shot',
        shot: { type: 'herald', mood: 85 },
        speaker: herald,
        line: t(c.sex === 'F' ? 'cri.girls' : 'cri.boys'),
        ms: 2800,
      },
      { kind: 'shot', shot: { type: 'urn', citizenId: c.id }, line: t('cri.urn'), ms: 4200 },
      {
        kind: 'shot',
        shot: {
          type: 'face',
          citizenId: c.id,
          mood: 6,
          caption: t('cri.slips', { age: ageOf(c, day), slips, total: totals[c.sex] }),
        },
        speaker: herald,
        line: fullName(c),
        ms: 4400,
      },
    );
    for (const r of reactions(state, c)) {
      if (r.by)
        steps.push({
          kind: 'shot',
          shot: { type: 'face', citizenId: r.by, mood: 4 },
          line: r.text,
          ms: 3400,
        });
      else steps.push({ kind: 'line', text: r.text, ms: 3400 });
    }
    steps.push(
      { kind: 'focus', citizenId: c.id, ms: 0 },
      { kind: 'camera', cell: PLAZA, zoom: 1.35, ms: 0 },
      { kind: 'walk', citizenId: c.id, ms: 5200 },
      { kind: 'line', text: t('cri.walk', { name: c.firstName }), ms: 1800 },
      { kind: 'focus', citizenId: null, ms: 0 },
    );
  }
  const chosen = current.participants.filter((id) => state.population.citizens[id]);
  const morale = state.economy.morale;
  steps.push(
    { kind: 'camera', cell: STAGE, zoom: 1.25, ms: 0 },
    {
      kind: 'shot',
      shot: { type: 'pair', citizenIds: chosen },
      speaker: herald,
      line: t('cri.hands', { n }),
      ms: 4200,
    },
    { kind: 'camera', cell: PLAZA, zoom: 0.85, glide: 0.02, ms: 0 },
    { kind: 'line', text: t(morale < 40 ? 'cri.silence' : 'cri.helmets'), ms: 4000 },
    {
      kind: 'title',
      title: t('cri.offerings', { n }),
      subtitle: chosen.map((id) => fullName(state.population.citizens[id]!)).join(' · '),
      ms: 4000,
    },
    { kind: 'fade', to: 'black', ms: 700 },
    { kind: 'title', title: t('fw.title'), subtitle: t('fw.subtitle'), ms: 2800 },
    { kind: 'fade', to: 'clear', ms: 400 },
  );
  for (const id of chosen) {
    const c = state.population.citizens[id]!;
    const who = visitors(state, c);
    if (who.length === 0)
      steps.push({
        kind: 'shot',
        shot: { type: 'farewell', citizenId: id, visitorId: null },
        line: t('fw.none', { tribute: c.firstName }),
        ms: 3800,
      });
    for (const v of who)
      steps.push({
        kind: 'shot',
        shot: { type: 'farewell', citizenId: id, visitorId: v },
        line: farewellLine(state, c, v),
        ms: 4000,
      });
  }
  // The station: the Capitol train glides in, the tributes are taken aboard, it pulls away;
  // inside, the real district recedes through the window.
  const S = profile.station;
  steps.push(
    { kind: 'fade', to: 'black', ms: 500 },
    { kind: 'camera', cell: { x: S.x + 2, y: S.y + 2 }, zoom: 0.9, glide: 1, ms: 0 },
    { kind: 'fade', to: 'clear', ms: 500 },
    { kind: 'train', action: 'arrive', line: t('cri.station'), ms: 5200 },
    { kind: 'camera', cell: { x: S.x + 1, y: S.y + 1 }, zoom: 1.25, glide: 0.03, ms: 0 },
    { kind: 'board', citizenIds: chosen, line: t('cri.board'), ms: 4200 },
    { kind: 'camera', cell: { x: S.x + 4, y: S.y + 10 }, zoom: 0.75, glide: 0.012, ms: 0 },
    { kind: 'train', action: 'depart', line: t('cri.depart', { n }), ms: 5200 },
    { kind: 'camera', cell: S, zoom: 1.1, glide: 1, ms: 0 },
    {
      kind: 'shot',
      shot: { type: 'train', citizenIds: chosen },
      line: t('cri.train'),
      ms: 4200,
    },
    { kind: 'camera', cell: PLAZA, zoom: 0.3, glide: 0.025, ms: 0 },
    {
      kind: 'shot',
      shot: { type: 'train', citizenIds: chosen },
      line: t('cri.train.away', { n }),
      ms: 5600,
    },
    { kind: 'fade', to: 'black', ms: 900 },
  );
  return steps;
}

/**
 * The return, filmed at the station: the train glides in, the survivors step down, the coffins
 * are carried out onto the platform; a close-up for each one, with who mourns them.
 */
export function buildReturnCeremony(state: Readonly<GameState>, edition: number): CineStep[] {
  const { PLAZA } = marks(state);
  const profile = homeProfile(state.meta.homeDistrictId);
  const S = profile.station;
  const n = String(profile.number);
  const result = state.competition.history.find((h) => h.edition === edition)?.result;
  if (!result || result.home.length === 0) return [];
  const home = [...result.home].sort((a, b) => Number(b.alive) - Number(a.alive));
  const survivors = home.filter((r) => r.alive).map((r) => r.citizenId);
  const dead = home.filter((r) => !r.alive);
  const steps: CineStep[] = [
    { kind: 'camera', cell: { x: S.x + 2, y: S.y + 3 }, zoom: 0.85, glide: 1, ms: 0 },
    { kind: 'title', title: t('ret.title'), ms: 3200 },
    { kind: 'fade', to: 'clear', ms: 600 },
    { kind: 'train', action: 'arrive', line: t('ret.train', { n }), ms: 5200 },
    { kind: 'camera', cell: { x: S.x + 1, y: S.y }, zoom: 1.3, glide: 0.03, ms: 0 },
    {
      kind: 'unload',
      survivors,
      coffins: dead.length,
      line: t(dead.length > 0 ? 'ret.unload.coffins' : 'ret.unload', { n: dead.length }),
      ms: 4400,
    },
  ];
  for (const r of home) {
    const c = state.population.citizens[r.citizenId];
    if (!c) continue;
    if (r.alive) {
      steps.push({
        kind: 'shot',
        shot: { type: 'face', citizenId: c.id, mood: 35, caption: t('ret.hero.caption') },
        line: t('ret.hero', { name: c.firstName }),
        ms: 4400,
      });
      continue;
    }
    const mourner = [c.motherId, c.fatherId, c.partnerId]
      .map((id) => (id ? state.population.citizens[id] : null))
      .find((x) => x?.alive);
    steps.push({
      kind: 'shot',
      shot: { type: 'coffin', citizenId: c.id, mournerId: mourner?.id ?? null },
      line: t('ret.coffin', { name: c.firstName }),
      ms: 4600,
    });
    if (mourner)
      steps.push({
        kind: 'shot',
        shot: { type: 'face', citizenId: mourner.id, mood: 2 },
        line: t('ret.mother', { mother: mourner.firstName }),
        ms: 3600,
      });
  }
  if (survivors.length === 0) steps.push({ kind: 'line', text: t('ret.silence'), ms: 3600 });
  steps.push(
    { kind: 'camera', cell: PLAZA, zoom: 0.8, glide: 0.02, ms: 0 },
    { kind: 'line', text: t('ret.life'), ms: 3200 },
  );
  return steps;
}

import { homeProfile } from '../content/homeDistricts.ts';

/**
 * The chariot parade on the first night in the Capitol (DECISIONS I-60): an aerial of the avenue
 * under the fireworks, chariots passing the stands, our tributes on the leading chariot in their
 * costume, close-ups, and the Capitol's welcome. Built from the real tributes.
 */
export function buildParade(state: Readonly<GameState>): CineStep[] {
  const games = state.games;
  if (!games) return [];
  const profile = homeProfile(state.meta.homeDistrictId);
  const n = String(profile.number);
  const ours = games.order
    .map((id) => games.contestants[id]!)
    .filter((c) => c.player && c.citizenId)
    .map((c) => c.citizenId!);
  const herald = t('cri.herald');
  const steps: CineStep[] = [
    { kind: 'title', title: t('par.title'), subtitle: t('par.subtitle'), ms: 3400 },
    { kind: 'fade', to: 'clear', ms: 500 },
    {
      kind: 'shot',
      shot: { type: 'plate', plate: 'wide', move: 'crane', fx: ['fireworks', 'beams', 'flashes'] },
      line: t('par.crowd'),
      ms: 5600,
    },
    {
      kind: 'shot',
      shot: { type: 'plate', plate: 'side', move: 'panLeft', fx: ['flashes', 'confetti'] },
      speaker: herald,
      line: t('par.d1'),
      ms: 4400,
    },
    {
      kind: 'shot',
      shot: { type: 'plate', plate: 'side', move: 'panRight', fx: ['flashes', 'beams'] },
      line: t('par.passing'),
      ms: 4200,
    },
    {
      kind: 'shot',
      shot: {
        type: 'plate',
        plate: 'hero',
        move: 'push',
        fx: ['confetti', 'flashes', 'beams'],
        riders: ours,
      },
      speaker: herald,
      line: t('par.ours', { n }),
      ms: 5600,
    },
  ];
  for (const id of ours) {
    const c = state.population.citizens[id];
    if (!c) continue;
    steps.push({
      kind: 'shot',
      shot: {
        type: 'face',
        citizenId: id,
        mood: 70,
        caption: t(`cap.opt.identity.${profile.id}` as LocaleKey),
      },
      line: t('par.wave', { name: c.firstName }),
      ms: 3600,
    });
  }
  steps.push(
    {
      kind: 'shot',
      shot: { type: 'plate', plate: 'wide', move: 'push', fx: ['fireworks', 'flashes'] },
      line: t('par.welcome'),
      ms: 5200,
    },
    { kind: 'fade', to: 'black', ms: 800 },
  );
  return steps;
}

/**
 * The interview night (DECISIONS I-75), staged after day 6 from the chosen angle: the host,
 * each of our tributes answering in their way, the audience's verdict.
 */
export function buildInterview(state: Readonly<GameState>): CineStep[] {
  const games = state.games;
  if (!games) return [];
  const ours = games.order.map((id) => games.contestants[id]!).filter((c) => c.player);
  const steps: CineStep[] = [
    { kind: 'title', title: t('int.title'), subtitle: t('int.subtitle'), ms: 3000 },
    { kind: 'fade', to: 'clear', ms: 400 },
    {
      kind: 'shot',
      shot: { type: 'studio', who: 'host', mood: 95, crowd: true },
      speaker: t('int.host'),
      line: t('int.hello'),
      ms: 4200,
    },
  ];
  for (const c of ours) {
    if (!c.citizenId) continue;
    const angle = c.choices.interview ?? 'humble';
    const mood =
      angle === 'charming' ? 85 : angle === 'defiant' ? 25 : angle === 'tragic' ? 10 : 50;
    steps.push(
      {
        kind: 'shot',
        shot: { type: 'studio', who: 'host', mood: 80 },
        speaker: t('int.host'),
        line: t('int.ask', { name: c.name.split(' ')[0]! }),
        ms: 3400,
      },
      {
        kind: 'shot',
        shot: { type: 'studio', who: c.citizenId, mood },
        speaker: c.name,
        line: t(`int.a.${angle}` as LocaleKey),
        ms: 4600,
      },
      {
        kind: 'shot',
        shot: {
          type: 'studio',
          who: 'host',
          mood: angle === 'defiant' ? 30 : 90,
          crowd: angle !== 'defiant',
        },
        line: t(`int.crowd.${angle}` as LocaleKey),
        ms: 3600,
      },
    );
  }
  steps.push({ kind: 'fade', to: 'black', ms: 700 });
  return steps;
}

/** The opening of a new game: the world in four lines, over the district itself. */
export function buildPrologue(state: Readonly<GameState>): CineStep[] {
  const profile = homeProfile(state.meta.homeDistrictId);
  const n = String(profile.number);
  const { PLAZA, STAGE } = marks(state);
  return [
    { kind: 'camera', cell: { x: PLAZA.x + 4, y: PLAZA.y + 4 }, zoom: 0.55, ms: 0 },
    { kind: 'title', title: t('pro.title'), subtitle: t('pro.subtitle', { n }), ms: 3600 },
    { kind: 'fade', to: 'clear', ms: 800 },
    { kind: 'line', text: t('pro.1'), ms: 4600 },
    { kind: 'camera', cell: STAGE, zoom: 0.9, ms: 0 },
    { kind: 'line', text: t('pro.2'), ms: 4600 },
    { kind: 'camera', cell: profile.showcase, zoom: 0.75, ms: 0 },
    { kind: 'line', text: t(`pro.3.${profile.id}` as LocaleKey), ms: 4400 },
    { kind: 'camera', cell: PLAZA, zoom: 0.7, ms: 0 },
    { kind: 'line', text: t('pro.4'), ms: 5200 },
  ];
}
