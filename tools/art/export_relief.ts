/**
 * Writes a district's visual relief (the exact heights the game uses for sprites) for the
 * terrain renderer: corner heights ((W + 1) × (H + 1)) and the tunnel spot.
 *
 *   node tools/art/export_relief.ts d12 > assets/build/relief_d12.json
 */
import { TEMPLATES } from '../../src/content/maps/index.ts';
import { Relief } from '../../src/render/district/relief.ts';

const id = process.argv[2] ?? 'd12';
const template = TEMPLATES[id];
if (!template) throw new Error(`no template ${id}`);
// Same seed as DistrictScene (template.id.length * 7 + 3).
const relief = new Relief(template, template.id.length * 7 + 3);
const corners: number[][] = [];
for (let j = 0; j <= template.height; j++) {
  const row: number[] = [];
  for (let i = 0; i <= template.width; i++)
    row.push(Math.round(relief.at(i - 0.5, j - 0.5) * 1000) / 1000);
  corners.push(row);
}
process.stdout.write(
  JSON.stringify({
    id,
    width: template.width,
    height: template.height,
    terrain: template.terrain,
    corners,
  }),
);
