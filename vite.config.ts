import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env['VITE_BASE'] ?? '/5-to-5/',
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  server: {
    open: true,
  },
});
