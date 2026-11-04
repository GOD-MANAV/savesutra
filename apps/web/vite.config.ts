import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the same build works on GitHub Pages (/savesutra/app/), any server and inside the Android app.
export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: mode === 'native',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'SaveSutra',
        short_name: 'SaveSutra',
        description: 'Save any link, reel, video or article. SaveSutra understands it and files it so you can find it later.',
        theme_color: '#0B1220',
        background_color: '#F5F6F8',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android Chrome shows the installed PWA in the share sheet.
        share_target: { action: './', method: 'GET', params: { title: 'share_title', text: 'share_text', url: 'share_url' } },
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html' },
    }),
  ],
  test: { environment: 'node' },
}));
