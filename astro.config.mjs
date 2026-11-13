import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import { sitemapExcludedRoutes } from './src/config/site.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://eidolon.cloud',
  integrations: [
    preact(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return !sitemapExcludedRoutes.includes(pathname);
      },
    }),
  ],
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
