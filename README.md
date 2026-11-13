# Eidolon

Personal site for Hitesh Dhayal (@hiteshdhayal): a free 7-day Indian diet plan, exercise knowledge, and companion articles for Instagram reels.

Built with Astro (static), Preact islands, Tailwind CSS v4, and self-hosted fonts. No backend, no accounts. Plan data stays in the visitor's browser.

Live design identity: Obsidian, ice and racing red. See `SPEC.md` §3.

## Commands

```bash
pnpm install
pnpm dev            # processes the hero photo, then starts the dev server
pnpm typecheck      # Astro + TypeScript
pnpm lint           # ESLint
pnpm test           # Vitest (engine and utilities)
pnpm build          # processes hero, builds, runs placeholder + link guards
pnpm preview        # serve dist/ locally
pnpm test:e2e       # build, then Playwright + axe at 375 / 768 / 1440
pnpm screenshots    # phase screenshots to docs/screenshots
pnpm verify         # typecheck, lint, tests, build
```

## Hero photo

Drop your photo in `src/assets/hero/`:

- `src/assets/hero/hero.png` — cut-out with transparent background (preferred). Anchored to the bottom with a soft bottom fade.
- `src/assets/hero/hero.jpg` — photo with a background. The build darkens the background toward obsidian and fades the left, bottom, top and right edges.

Either filename works; PNG wins if both exist. `pnpm dev` and `pnpm build` process it automatically into `src/assets/hero/processed/` (gitignored). With no photo, the hero renders the outlined wordmark alone and the mobile hero stays compact.

## Site config

Everything personal lives in `src/config/site.ts`: brand, creator, Instagram, domain, and empty placeholders for credentials and contact email. Empty values hide their UI — the footer contact link falls back to an Instagram DM.

Stub routes live in the same file. They are `noindex` and excluded from the sitemap until their real pages ship.

## Structure

```
src/
  assets/hero/    your photo + processed output
  components/     header, footer, FollowLink, hero portrait, kinetic band, UI
  config/         site placeholders, navigation, stubs
  layouts/        BaseLayout, ComingSoon
  lib/            pure TypeScript (engine lands in Phase 3)
  pages/          routes (stubs until their phase)
  styles/         tokens, fonts and base styles
public/fonts/     self-hosted Archivo and IBM Plex subsets
scripts/          hero processing, placeholder guard, link checker, screenshots
docs/             decisions, screenshots, food review (later)
```

## Content workflow

Coming in Phase 6: `pnpm new:reel` and `pnpm new:article` scaffold Markdown/MDX entries with frontmatter. Anything marked `draft: true` is excluded from production builds.

## Health content

All nutrition and training content is general education, not medical advice. Conservative numbers, no cure claims, and a clear path to a doctor or registered dietitian.
