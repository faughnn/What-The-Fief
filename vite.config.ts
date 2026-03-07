import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  root: '.',
  resolve: {
    alias: {
      '$sim': path.resolve(__dirname, 'src/simulation'),
      '$world': path.resolve(__dirname, 'src/world.ts'),
    },
  },
  build: {
    outDir: 'dist-app',
    emptyOutDir: true,
  },
});
