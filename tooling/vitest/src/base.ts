import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
  },
})
