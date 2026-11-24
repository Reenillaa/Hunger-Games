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

/** Family and friends react according to who they are (real names, real ties). */
export function reactionLines(state: Readonly<GameState>, c: Citizen): string[] {
  const day = Math.floor(state.clock.tick / 24);
  const lines: string[] = [];
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
    lines.push(
      t(mother.traits.includes('resilient') ? 'cri.mother.strong' : 'cri.mother', {
        name: mother.firstName,
      }),
    );
  if (father)
    lines.push(
      t(
        father.traits.includes('rebel') || father.traits.includes('aggressive')
          ? 'cri.father.angry'
          : 'cri.father',
        { name: father.firstName },
      ),
    );
  const sib = siblings[0];
  if (sib)
    lines.push(
      t(ageOf(sib, day) < 12 ? 'cri.sibling.small' : 'cri.sibling', { name: sib.firstName }),
    );
  if (partner) lines.push(t('cri.partner', { name: partner.firstName }));
  const friend = Object.entries(c.relations)
    .filter(([, r]) => r.opinion > 50)
    .map(([id]) => relative(state, id))
    .find((f) => f && f.id !== mother?.id && f.id !== father?.id);
  if (friend)
    lines.push(
      t(friend.traits.includes('brave') ? 'cri.friend.brave' : 'cri.friend', {
        name: friend.firstName,
      }),
    );
  if (lines.length === 0) lines.push(t('cri.alone'));
  return lines.slice(0, 3);
}

/** The Criba, built from the real draw: who, how many slips, and who cries for them. */
export function buildSelectionCeremony(state: Readonly<GameState>): CineStep[] {
  const { PLAZA, STAGE } = marks(state);
  const current = state.competition.current;
  if (!current) return [];
  const day = Math.floor(state.clock.tick / 24);
  const steps: CineStep[] = [
    { kind: 'camera', cell: PLAZA, zoom: 0.8, ms: 0 },
    {
      kind: 'title',
      title: t('cri.title'),
      subtitle: t('cri.subtitle', { year: Math.floor(day / 40) + 1, edition: current.edition }),
      ms: 3800,
    },
    { kind: 'fade', to: 'clear', ms: 600 },
    { kind: 'line', text: t('cri.gather'), ms: 4200 },
    { kind: 'camera', cell: STAGE, zoom: 1.15, ms: 0 },
    { kind: 'line', speaker: t('cri.herald'), text: t('cri.motto'), ms: 3800 },
  ];
  const totals = { F: 0, M: 0 };
  for (const [id, n] of Object.entries(current.entries)) {
    const c = state.population.citizens[id];
    if (c) totals[c.sex] += n;
  }
  for (const id of current.participants) {
    const c = state.population.citizens[id];
    if (!c) continue;
    const slips = current.entries[id] ?? 1;
    steps.push(
      {
        kind: 'line',
        speaker: t('cri.herald'),
        text: t(c.sex === 'F' ? 'cri.girls' : 'cri.boys'),
        ms: 3000,
      },
      { kind: 'line', text: t('cri.urn'), ms: 2200 },
      { kind: 'focus', citizenId: c.id, ms: 0 },
      { kind: 'camera', cell: PLAZA, zoom: 1.35, ms: 0 },
      {
        kind: 'reveal',
        citizenId: c.id,
        caption: t('cri.slips', { age: ageOf(c, day), slips, total: totals[c.sex] }),
        ms: 4600,
      },
    );
    for (const line of reactionLines(state, c)) steps.push({ kind: 'line', text: line, ms: 3400 });
    steps.push(
      { kind: 'focus', citizenId: null, ms: 0 },
      { kind: 'camera', cell: STAGE, zoom: 1.15, ms: 0 },
    );
  }
  const morale = state.economy.morale;
  steps.push(
    { kind: 'line', text: t(morale < 40 ? 'cri.silence' : 'cri.helmets'), ms: 4000 },
    {
      kind: 'title',
      title: t('cri.offerings'),
      subtitle: current.participants
        .map((id) =>
          state.population.citizens[id] ? fullName(state.population.citizens[id]!) : '',
        )
        .join(' · '),
      ms: 4200,
    },
  );
  return steps;
}

/** The return of the delegation: built from the recorded results of the edition. */
export function buildReturnCeremony(state: Readonly<GameState>, edition: number): CineStep[] {
  const { PLAZA } = marks(state);
  const STATION = homeProfile(state.meta.homeDistrictId).station;
  const result = state.competition.history.find((h) => h.edition === edition)?.result;
  if (!result || result.home.length === 0) return [];
  const steps: CineStep[] = [
    { kind: 'camera', cell: STATION, zoom: 0.85, ms: 0 },
    { kind: 'title', title: t('ret.title'), ms: 3200 },
    { kind: 'fade', to: 'clear', ms: 600 },
    {
      kind: 'line',
      text: t('ret.train', { n: String(homeProfile(state.meta.homeDistrictId).number) }),
      ms: 3800,
    },
  ];
  for (const r of [...result.home].sort((a, b) => Number(b.alive) - Number(a.alive))) {
    const c = state.population.citizens[r.citizenId];
    if (!c) continue;
    steps.push(
      { kind: 'camera', cell: STATION, zoom: 1.2, ms: 0 },
      {
        kind: 'reveal',
        citizenId: c.id,
        caption: t(r.alive ? 'ret.hero' : 'ret.coffin', { name: c.firstName }),
        ms: 4400,
      },
    );
    const mother = c.motherId ? state.population.citizens[c.motherId] : null;
    if (!r.alive && mother?.alive)
      steps.push({ kind: 'line', text: t('ret.mother', { mother: mother.firstName }), ms: 3400 });
  }
  if (!result.home.some((r) => r.alive))
    steps.push({ kind: 'line', text: t('ret.silence'), ms: 3600 });
  steps.push(
    { kind: 'camera', cell: PLAZA, zoom: 0.8, ms: 0 },
    { kind: 'line', text: t('ret.life'), ms: 3200 },
  );
  return steps;
}

import { homeProfile } from '../content/homeDistricts.ts';

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
