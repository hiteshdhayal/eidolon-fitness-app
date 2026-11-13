import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  // Placeholder origin until {{DOMAIN}} is set in src/config/site.ts.
  site: 'https://example.com',
  integrations: [preact()],
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
