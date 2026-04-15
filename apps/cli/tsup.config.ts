import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  format: ['cjs'],
  platform: 'node',
  target: 'node24',
  define: {
    __CLI_VERSION__: JSON.stringify(packageJson.version),
  },
  noExternal: [/.*/],
  sourcemap: true,
  splitting: false,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
