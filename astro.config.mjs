import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { sitemapExcludedRoutes } from './src/config/site.ts';

const drafts = process.env.SHOW_DRAFTS === '1';
const lhAudit = process.env.LH_AUDIT === '1';

// The Lighthouse audit build (spec Phase 6 Part E) always goes to its own
// directory and is never deployed — guard against it ever landing in dist/.
const outDir = lhAudit ? './dist-audit' : drafts ? './dist-drafts' : './dist';
if (lhAudit && outDir === './dist') {
  throw new Error('LH_AUDIT must never build into ./dist (it is not deployed).');
}

// https://astro.build/config
export default defineConfig({
  site: 'https://eidolon.cloud',
  // Draft and audit builds go to separate directories so they never
  // overwrite production.
  outDir,
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
