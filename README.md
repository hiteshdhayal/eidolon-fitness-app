# Eidolon Fitness App

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
pnpm test:e2e       # build dist + dist-drafts, then Playwright + axe at 375 / 768 / 1440
pnpm screenshots    # phase screenshots to docs/screenshots
pnpm food:review    # regenerate docs/food-review.csv from the food database
pnpm verify         # typecheck, lint, tests, build
pnpm perf           # Lighthouse CI — see "Checking speed" below
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

## How the plan builder works

`/plan` asks about 18 questions (goal, body, health, activity and food). The plan is computed **in your browser** by the engine in `src/lib/engine/` using the food database in `src/data/foods/`. Nothing is sent to a server.

Your answers and plan are kept on your device in four localStorage keys:

- `eidolon:draft:v1` — the half-finished questionnaire
- `eidolon:plan:v1` — the saved plan, answers and grocery list
- `eidolon:groceries:v1` — which grocery items you've ticked
- `eidolon:progress:v1` — your weight check-ins and which gentle suggestion you closed

`/my-plan` reads the saved plan and offers swap, shuffle, groceries and a printable copy. To clear everything, open your browser's site settings for `eidolon.cloud` and delete site data (Chrome: Settings → Privacy and security → Third-party cookies → See all site data and permissions; Safari: Settings → Privacy → Manage Website Data). Deleting site data removes the plan; there is no server copy.

## Progress and your data

The Progress tab on `/my-plan` logs a weekly check-in: weight, an optional waist measurement, and a date. It shows a hand-drawn SVG trend line, a plain summary (change since start, average per week, number of check-ins) and, at most one at a time, a gentle suggestion — slow down a fast loss, update the plan after a 3 kg change, or try something different after three flat weeks. Nothing is judged and there are no streaks. Check-ins live only in `eidolon:progress:v1` on this device; guidance plans (under 18, pregnant, kidney disease) have no tracker.

The "Your data" section at the bottom of `/my-plan` exports everything to a JSON file (`eidolon-data-YYYY-MM-DD.json`) and imports it back. Export includes your plan, check-ins and grocery ticks but never the half-finished questionnaire draft. Import always replaces what is on the phone — it never merges. "Delete everything" removes every `eidolon:` key, which is the same as clearing the browser's site data.

## Site config

Everything personal lives in `src/config/site.ts`: brand, creator, Instagram, domain, and empty placeholders for credentials, contact email and a longer "why I built this" bio (`aboutLong`). Empty values hide their UI — the footer contact link falls back to an Instagram DM, and `/about/`'s extra paragraph stays hidden until `aboutLong` is filled in.

Stub routes live in the same file. They are `noindex` and excluded from the sitemap until their real pages ship. As of Phase 6 there are none — every route in the site map has a real page.

Analytics is self-hosted Umami, cookieless, and off by default. Also in `src/config/site.ts`: set `umamiWebsiteId` to the website id from your Umami instance (`umamiSrc` already points at `https://stats.eidolon.cloud/script.js`) and the tracking script starts loading site-wide — with it left empty, no analytics script loads and no request leaves the browser at all.

## Checking speed (`pnpm perf`)

```bash
pnpm perf
```

This builds a dedicated audit copy of the site (`LH_AUDIT=1 SHOW_DRAFTS=1`, output to `dist-audit/` — never deployed) in which draft content renders without the DRAFT tag or `noindex`, so every page type can be scored, then runs Lighthouse CI (`lighthouserc.cjs`) against it: mobile, simulated throttling, 3 runs per URL, asserting performance/accessibility/best-practices/SEO ≥ 0.95, LCP ≤ 2000ms, CLS ≤ 0.05 and TBT ≤ 200ms on one URL per page type. `/my-plan/` and `/404.html` are exempt from the SEO assertion only (both `noindex` by design).

It's slow (real Chrome, 3 runs × ~20 URLs) and isn't part of `pnpm build` — run it before launch and whenever you touch layout, fonts or images. Reports land in `.lighthouseci/` (gitignored).

If Chrome won't launch in your environment (a sandboxed container running as root, for instance), set `LHCI_CHROME_PATH` to the Chromium binary and `LHCI_CHROME_FLAGS=--no-sandbox`; neither is needed on a normal machine or CI runner.

## Deploying

See `docs/DEPLOY.md` for the full runbook — server setup, Nginx + TLS, self-hosted Umami, and `scripts/deploy.sh`/`scripts/rollback.sh` for shipping and reverting releases.

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
