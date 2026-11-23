import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../content/maps/index.ts';
import { STRUCTURE_FOOTPRINTS } from '../../content/structures.ts';
import { seedFromString } from '../rng/rng.ts';
import { createNewGame } from '../state/newGame.ts';
import { generateDistrict } from './generate.ts';
import { isBuildable, terrainAt } from './template.ts';

const template = TEMPLATES.d12!;
const gen = (seed: string) =>
  generateDistrict(template, STRUCTURE_FOOTPRINTS, seedFromString(seed));

describe('d12 template', () => {
  it('is a 48x48 grid with a valid code in every cell', () => {
    expect(template.terrain).toHaveLength(48);
    for (const row of template.terrain) {
      expect(row).toHaveLength(48);
      for (const ch of row) expect(Object.keys(template.legend)).toContain(ch);
    }
  });

  it('has a plaza, buildable land, water, rail and coal seams', () => {
    const all = template.terrain.join('');
    for (const code of ['p', 'g', 'd', 'w', 't', 'v', 'R', 'f', 'r', 'b'])
      expect(all).toContain(code);
    expect(terrainAt(template, template.plaza.x0, template.plaza.y0)).toBe('p');
  });
});

describe('generateDistrict', () => {
  it('is deterministic per seed and varies across seeds', () => {
    expect(gen('a')).toEqual(gen('a'));
    expect(gen('a')).not.toEqual(gen('b'));
  });

  it('places the landmarks and all the houses', () => {
    const d = gen('layout');
    const kinds = d.structures.map((s) => s.kind);
    for (const k of ['town_hall', 'stage', 'mine_headframe', 'warehouse', 'economato'] as const) {
      expect(kinds).toContain(k);
    }
    expect(kinds.filter((k) => k === 'house_terrace')).toHaveLength(9);
    expect(kinds.filter((k) => k === 'house_shack')).toHaveLength(13);
  });

  it('never overlaps structures and keeps houses on buildable land', () => {
    for (const seed of ['x', 'y', 'z', 'veta']) {
      const d = gen(seed);
      const used = new Set<string>();
      for (const s of d.structures) {
        const { w, d: depth } = STRUCTURE_FOOTPRINTS[s.kind];
        for (let dy = 0; dy < depth; dy++) {
          for (let dx = 0; dx < w; dx++) {
            const k = `${s.x + dx},${s.y + dy}`;
            expect(used.has(k), `${s.kind} overlaps at ${k}`).toBe(false);
            used.add(k);
            if (s.kind.startsWith('house'))
              expect(isBuildable(template, s.x + dx, s.y + dy)).toBe(true);
          }
        }
      }
      for (const p of d.props) expect(used.has(`${p.x},${p.y}`)).toBe(false);
    }
  });

  it('grows a forest and scatters rocks on the scree', () => {
    const d = gen('nature');
    const trees = d.props.filter((p) => p.kind.startsWith('pine'));
    expect(trees.length).toBeGreaterThan(150);
    expect(
      d.props.some((p) => p.kind.startsWith('rock') && terrainAt(template, p.x, p.y) === 's'),
    ).toBe(true);
    expect(d.props.filter((p) => p.kind === 'lamp').length).toBeGreaterThan(4);
  });

  it('is part of every new game', () => {
    const s = createNewGame({ seed: 'district' });
    expect(s.district.templateId).toBe('d12');
    expect(s.district.structures.length).toBe(27);
  });
});
