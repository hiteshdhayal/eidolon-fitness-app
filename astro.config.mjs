import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { sitemapExcludedRoutes } from './src/config/site.ts';

const drafts = process.env.SHOW_DRAFTS === '1';

// https://astro.build/config
export default defineConfig({
  site: 'https://eidolon.cloud',
  // Draft builds go to a separate directory so they never overwrite production.
  outDir: drafts ? './dist-drafts' : './dist',
  integrations: [
    preact(),
    mdx(),
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
