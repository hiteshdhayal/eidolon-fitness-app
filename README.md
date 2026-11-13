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
pnpm food:review    # regenerate docs/food-review.csv from the food database
pnpm verify         # typecheck, lint, tests, build
```

## Hero slides

Drop photos in `src/assets/hero/slides/` as `01-name.png`, `02-name.jpg`, `03-name.webp`, ... (up to 8, ordered by filename). Supported: PNG, JPG/JPEG, WebP.

`src/data/hero-slides.json` controls each slide:

- `alt` — written from what is actually in the photo.
- `focalX` / `focalY` — 0–100, keeps the subject in frame when cropped to 4:5.
- `scale` — nudges the subject size.
- `skip` — hides a slide without deleting it.

`pnpm dev` and `pnpm build` process the slides into AVIF/WebP at 480/768/1080/1440 and write `src/assets/hero/processed/` (gitignored). The stage rotates every 5.5s with pause/play, segment bars, arrow keys and swipe; hover, focus, hidden tabs and off-screen pause it; reduced motion starts paused; without JS, slide 1 and the message still render.

If the slides folder is empty, `hero.png` or `hero.jpg` in `src/assets/hero/` is used as one static slide. With no image at all, the outlined wordmark carries the hero and the mobile hero stays compact.

## How to add or edit a food

The food database is plain TypeScript, one file per region in `src/data/foods/` (`north.ts`, `south.ts`, `pan.ts`, …). No app or database changes are needed.

1. Open the region file and copy an existing entry.
2. Change `id` (lowercase-with-dashes), `name`, `gloss`, `serving` and `n`.
3. `n` is `[kcal, protein g, carbs g, fat g, fiber g]` for **one serving**. Round kcal to the nearest 10.
4. List what the dish contains in `has`, for example `['dairy', 'gluten']`. Diet flags (veg, vegan, Jain-safe) are worked out from this automatically.
5. Run `pnpm test`. It tells you if anything doesn't add up (kcal vs macros, unit steps, missing states).
6. Run `pnpm food:review` to refresh `docs/food-review.csv`.

`docs/food-review.csv` is only a review sheet for you and a dietitian. **Editing the CSV changes nothing** — the region `.ts` files are the source of truth, and the CSV is regenerated from them. Leave `verified: false` and `source: "computed from ingredients"` until a value has been checked against IFCT 2017.

## Site config

Everything personal lives in `src/config/site.ts`: brand, creator, Instagram, domain, and empty placeholders for credentials and contact email. Empty values hide their UI — the footer contact link falls back to an Instagram DM.

Stub routes live in the same file. They are `noindex` and excluded from the sitemap until their real pages ship.

## Structure

```
src/
  assets/hero/    hero slides + processed output
  components/     header, footer, FollowLink, HeroStage, kinetic band, UI
  config/         site placeholders, navigation, stubs
  content/        health-notes drafts (Astro content collection)
  data/           hero-slides.json, foods/ (region food database)
  layouts/        BaseLayout, ComingSoon
  lib/            pure TypeScript (plan engine in lib/engine, hero helpers)
  pages/          routes (stubs until their phase)
  styles/         tokens, fonts and base styles
  content.config.ts  content collections (healthNotes)
public/fonts/     self-hosted Archivo and IBM Plex subsets
scripts/          hero processing, food review CSV, guards, screenshots
tests/unit/       Vitest: engine, safety, targets, foods, plan (192 cases)
docs/             decisions, screenshots, food-review.csv, PHASE-2-INTEGRATION.md
```

## Content workflow

Coming in Phase 6: `pnpm new:reel` and `pnpm new:article` scaffold Markdown/MDX entries with frontmatter. Anything marked `draft: true` is excluded from production builds.

## Health content

All nutrition and training content is general education, not medical advice. Conservative numbers, no cure claims, and a clear path to a doctor or registered dietitian.
