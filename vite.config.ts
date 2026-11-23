import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// `base: './'` keeps every asset path relative, so the build works under
// https://<user>.github.io/Hunger-Games/ and any other sub-path (DECISIONS I-07).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'DIEZMO',
        short_name: 'DIEZMO',
        description: 'Estrategia, gestión y supervivencia en un distrito minero bajo la Concordia.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#16161a',
        theme_color: '#16161a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/*.png'],
        globIgnores: ['assets/**'],
        // Art is large: cached on first use instead of precached at install.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/assets/district/'),
            handler: 'CacheFirst',
            options: { cacheName: 'district-art', expiration: { maxEntries: 400 } },
          },
        ],
        // The engine chunk is ~1.3 MB minified; precache it so the game works offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
});
