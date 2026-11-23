import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Standalone viewer for the art pipeline spike: `npx vite --config tools/art/viewer/vite.config.ts`
const here = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: here,
  publicDir: resolve(here, '../../../assets/build/spike'),
  server: { port: 5199, strictPort: true },
});
