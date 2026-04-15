import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node20',
  noExternal: [/.*/],
  sourcemap: true,
  splitting: false,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
