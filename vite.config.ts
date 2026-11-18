/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // Ask before activating a new version, so a running brew timer is never reloaded under the user.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Barista Lab',
        short_name: 'Barista Lab',
        description: 'Otthoni barista labor – kávészimulátor és receptasszisztens',
        lang: 'hu',
        theme_color: '#3b2418',
        background_color: '#faf6f1',
        display: 'standalone',
        // The installed app opens straight into the simulator; the browser root shows the landing page.
        start_url: '/#/simulator',
        scope: '/',
        categories: ['food', 'lifestyle', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Főzés', url: '/#/brew', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Napló', url: '/#/journal', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
