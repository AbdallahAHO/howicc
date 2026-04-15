import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

import alpinejs from '@astrojs/alpinejs';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: 'https://howi.cc',
  integrations: [react(), sitemap(), alpinejs()],
  vite: {
    plugins: [tailwindcss()],
  },
});