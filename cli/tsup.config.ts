import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  shims: true,
  splitting: false,
  dts: true,
  minify: false,
  sourcemap: true,
});
