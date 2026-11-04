import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: { rollupOptions: { input: { index: resolve(import.meta.dirname, 'index.html'), privacy: resolve(import.meta.dirname, 'privacy.html') } } },
});
