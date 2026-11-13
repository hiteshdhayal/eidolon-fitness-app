# {{BRAND_NAME}}

Personal site for {{CREATOR_NAME}} (@{{INSTAGRAM_HANDLE}}): a free 7-day Indian diet plan, exercise knowledge, and companion articles for Instagram reels.

Built with Astro (static), Preact islands, Tailwind CSS v4, and self-hosted fonts. No backend, no accounts. Plan data stays in the visitor's browser.

## Commands

```bash
pnpm install
pnpm dev          # local dev server
pnpm check        # Astro + TypeScript typecheck
pnpm lint         # ESLint
pnpm test         # Vitest (engine and utilities)
pnpm build        # production build to dist/
pnpm preview      # serve dist/ locally
pnpm test:e2e     # Playwright + axe (run pnpm build first)
pnpm screenshots  # 375px and 1440px screenshots to docs/screenshots
pnpm verify       # typecheck, lint, unit tests, build
```

## Placeholders

Everything the site owner fills in lives in `src/config/site.ts`:

- `{{BRAND_NAME}}`, `{{CREATOR_NAME}}`, `{{INSTAGRAM_HANDLE}}`, `{{DOMAIN}}`
- `{{CREDENTIALS}}`, `{{CONTACT_EMAIL}}`, `{{PHOTOS}}`
- Affiliate IDs

Update `site.url` in `astro.config.mjs` too once the domain is live.

## Structure

```
src/
  components/     shared UI (header, footer, styleguide primitives)
  config/         site-wide placeholders and navigation
  layouts/        BaseLayout
  lib/            pure TypeScript (engine lands in Phase 2)
  pages/          routes
  styles/         tokens, fonts and base styles
public/fonts/     self-hosted Archivo and IBM Plex subsets
docs/             decisions and review screenshots
```

## Content workflow

Coming in Phase 5: `pnpm new:reel` and `pnpm new:article` scaffold Markdown/MDX entries with frontmatter. Anything marked `draft: true` is excluded from production builds.

## Health content

All nutrition and training content is general education, not medical advice. Conservative numbers, no cure claims, and a clear path to a doctor or registered dietitian.
