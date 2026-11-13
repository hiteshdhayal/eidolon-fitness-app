# Decisions

One line per decision. Simplest option consistent with the spec wins.

- 2026-11-13: Astro pinned to 6.x because this machine runs Node 22.16.0 and Astro 7 requires Node ≥22.23.4.
- 2026-11-13: Tailwind v4 through `@tailwindcss/postcss` (not `@tailwindcss/vite`) because the Vite plugin breaks against Astro 6's Vite 8 resolve bindings.
- 2026-11-13: The raw Obsidian/steel/ice/red palette is declared in `:root`, then mapped into `@theme` as `--color-*`. Tailwind tree-shakes unused theme variables, so components read the raw tokens directly.
- 2026-11-13: Fonts copied from Fontsource packages into `public/fonts/` (latin subsets only) so exactly two files are preloaded and no font CSS ships from a CDN. The Archivo italic subset is loaded but not preloaded.
- 2026-11-13: Mobile menu uses the native Popover API, so it stays zero-JS and closes on Escape.
- 2026-11-13: Tabs are radio inputs styled with CSS; accordion is native `<details>`; searchable state select is `<input list>` + `<datalist>`. No JS needed for these patterns.
- 2026-11-13: Lucide icons are inlined as SVG paths via a small `Icon.astro` instead of adding an icon runtime dependency.
- 2026-11-13: TypeScript pinned to 6.x because `@astrojs/check` does not support TypeScript 7 yet.
- 2026-11-13: `eslint-plugin-jsx-a11y-x` added because `eslint-plugin-astro` requires it as a peer.
- 2026-11-13: Screenshots for design review are committed under `docs/screenshots/`.
- 2026-11-13: Styleguide type specimens use `.type-h1/.type-h2/.type-h3` classes rather than extra heading tags, so the page keeps one h1.
- 2026-11-13: SPEC.md is now the source of truth; §3 was rewritten for the Obsidian/ice/racing-red identity per Phase 1.5.
- 2026-11-13: Real config set: Eidolon, Hitesh Dhayal, @hiteshdhayal, eidolon.cloud. Credentials and contact email stay empty and their UI hides.
- 2026-11-13: Footer "Contact" falls back to the Instagram profile with the label "Contact (Instagram DM)" when `contactEmail` is empty.
- 2026-11-13: `scripts/check-placeholders.mjs` and `scripts/check-links.mjs` run inside `pnpm build`, after Astro builds. Any `{{` or broken internal link fails the build.
- 2026-11-13: Stub routes are `noindex` and filtered out of `@astrojs/sitemap`; the sitemap currently lists only `/`.
- 2026-11-13: FollowLink uses one accessible name that includes the visible label, e.g. "Follow @hiteshdhayal — Follow Hitesh Dhayal on Instagram (opens in a new tab)". WCAG 2.5.3 requires the visible label in the name; axe fails otherwise.
- 2026-11-13: Hero copy spans columns 1–9 (not 1–7) so the specified display size keeps the headline to four lines.
- 2026-11-13: The no-photo mobile hero is compact instead of reserving 64svh for an image that does not exist; with a photo it uses the full 64svh layer.
- 2026-11-13: sharp keeps only the last `linear()` call, so hero processing combines brightness/gamma maths into one call. Scene backgrounds map to obsidian (~#0B0C0E) before tinting.
- 2026-11-13: Hero screenshots were captured with generated PNG/JPG fixtures for both mask variants, then the fixtures were deleted. Drop the real file at `src/assets/hero/hero.png` or `hero.jpg`.
- 2026-11-13: The mobile sticky bar overlays the page and the footer reserves extra bottom padding, instead of reserving space on `main` (which showed a light strip between sections).
- 2026-11-13: Stub pages keep the mobile sticky plan CTA; their own primary CTA is the Instagram follow link.
- 2026-11-13: Section reveals are CSS scroll-driven and default to invisible until they enter the viewport; screenshots force them visible to avoid blank captures.
