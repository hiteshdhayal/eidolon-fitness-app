# Decisions

One line per decision. Simplest option consistent with the spec wins.

- 2026-11-13: Astro pinned to 6.x because this machine runs Node 22.16.0 and Astro 7 requires Node ≥22.23.4.
- 2026-11-13: Tailwind v4 through `@tailwindcss/postcss` (not `@tailwindcss/vite`) because the Vite plugin breaks against Astro 6's Vite 8 resolve bindings.
- 2026-11-13: Tailwind theme removes the default palette with `--color-*: initial`; only the §3 gray scale and semantic tokens exist.
- 2026-11-13: Fonts copied from Fontsource packages into `public/fonts/` (latin subsets only) so exactly two files are preloaded and no font CSS ships from a CDN.
- 2026-11-13: Mobile menu uses the native Popover API, so it stays zero-JS and closes on Escape.
- 2026-11-13: Tabs are radio inputs styled with CSS; accordion is native `<details>`; searchable state select is `<input list>` + `<datalist>`. No JS needed for these patterns.
- 2026-11-13: Lucide icons are inlined as SVG paths via a small `Icon.astro` instead of adding an icon runtime dependency.
- 2026-11-13: TypeScript pinned to 6.x because `@astrojs/check` does not support TypeScript 7 yet.
- 2026-11-13: `eslint-plugin-jsx-a11y-x` added because `eslint-plugin-astro` requires it as a peer.
- 2026-11-13: Astro `site` stays `https://example.com` until `{{DOMAIN}}` is filled in; canonical and OG URLs derive from it.
- 2026-11-13: Screenshots for design review are committed under `docs/screenshots/`.
- 2026-11-13: Home ships hero, how-it-works and a CTA in Phase 1; the remaining §5 sections arrive in Phase 6.
- 2026-11-13: Styleguide type specimens use `.type-h1/.type-h2/.type-h3` classes rather than extra heading tags, so the page keeps one h1.
