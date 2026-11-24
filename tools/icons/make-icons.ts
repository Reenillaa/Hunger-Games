/**
 * Renders the PWA icons from the in-house emblem using the pre-installed Chromium.
 * Run: node tools/icons/make-icons.ts  (outputs to public/icons/)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const svg = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
const outDir = resolve(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

// Maskable icons need the emblem inside the central 80% safe zone and a full-bleed background.
const maskable = svg
  .replace('rx="10"', 'rx="0"')
  .replace(/(<path d="M32 32m)/, '<g transform="translate(6.4 6.4) scale(0.8)">$1')
  .replace('</svg>', '</g></svg>');

const targets = [
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  { file: 'icon-maskable-512.png', size: 512, source: maskable },
  { file: 'apple-touch-icon.png', size: 180, source: maskable },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, source } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:#16161a">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  writeFileSync(resolve(outDir, file), await page.screenshot({ omitBackground: false }));
  console.log('wrote', file);
}
await browser.close();
