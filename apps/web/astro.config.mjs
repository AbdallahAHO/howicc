import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],
  site: 'https://howi.cc',
  vite: {
    plugins: [tailwindcss()],
    build: {
      minify: false,
    },
    ssr: {
      noExternal: ['@howicc/ui-web', '@howicc/ui'],
    },
  },
})
