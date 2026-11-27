import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'app',
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true },
  test: { root: '.', include: ['tests/unit/**/*.test.ts'] },
});
