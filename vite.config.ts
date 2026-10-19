/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// KiranaIQ build configuration.
// - PWA: precached app shell via vite-plugin-pwa (Workbox generateSW).
// - No remote asset/font requests are configured: everything ships locally.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'offline.html'],
      manifest: {
        name: 'KiranaIQ — Inventory & Restocking Assistant',
        short_name: 'KiranaIQ',
        description:
          'Offline-first multilingual inventory and restocking assistant for small kirana shops. Smart Stock. Less Waste. Better Business.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#6D28D9',
        background_color: '#FFFFFF',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Keep the offline fallback page available even without the app shell.
        additionalManifestEntries: [{ url: 'offline.html', revision: null }],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/offline\.html$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5173 },
  build: {
    outDir : 'docs',
    emptyOutDir : true,
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
