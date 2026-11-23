import type { Citizen, GameState } from '../core/index.ts';
import { ageOf, fullName } from '../core/index.ts';
import type { CineStep } from './cinematic.ts';
import { t } from '../content/i18n.ts';

const PLAZA = { x: 26, y: 24 };
const STAGE = { x: 26, y: 22 };

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
