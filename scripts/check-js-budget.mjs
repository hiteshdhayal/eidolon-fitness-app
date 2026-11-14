/**
 * JS budget guard + report (spec Phase 6 Part E.3). Reel, article,
 * exercise, workout, guide, about and legal pages ship zero *external* JS
 * (no hydrated islands) — the header sentinel and plan-CTA swap scripts are
 * small, inline and site-wide, so they're the baseline every page carries,
 * same as Umami once enabled (also not from /_astro/). The home page's
 * state-kitchen script and /learn's filter script each have their own 2 KB
 * inline budget, found by a content marker rather than position so the
 * check survives reordering. /links/ ships no <script> at all.
 */
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { distDir } from './dist-dir.mjs';

const DIST = distDir();
const KB = (bytes) => bytes / 1024;

function externalJsRefs(html) {
  return [...new Set([...html.matchAll(/\/_astro\/[A-Za-z0-9._-]*\.js/g)].map((m) => m[0]))];
}

function inlineModuleScripts(html) {
  return [...html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

async function readPage(path) {
  try {
    return await readFile(`${DIST}${path}index.html`, 'utf8');
  } catch {
    return null;
  }
}

const ZERO_JS_PAGES = [
  '/reels/pcod-diet-basics/',
  '/articles/top-5-supplement-brands-india/',
  '/learn/push-up/',
  '/workouts/beginner-home-full-body/',
  '/learn/guides/how-to-find-your-step-count/',
  '/about/',
  '/disclaimer/',
  '/privacy/',
  '/affiliate-disclosure/',
  '/terms/',
];

const failures = [];
const report = [];

for (const path of ZERO_JS_PAGES) {
  const html = await readPage(path);
  if (!html) continue; // draft-only page, not present in this build
  const refs = externalJsRefs(html);
  if (refs.length > 0) {
    failures.push(`${path}: ships external JS (${refs.join(', ')})`);
  }
  report.push(`${path}: 0 KB external JS`);
}

const linksHtml = await readPage('/links/');
if (linksHtml) {
  if (/<script/i.test(linksHtml)) failures.push('/links/: ships a <script> tag (budget is 0)');
  report.push('/links/: 0 KB JS');
}

const homeHtml = await readPage('/');
if (homeHtml) {
  const kitchenScript = inlineModuleScripts(homeHtml).find((s) => s.includes('kitchen-data'));
  if (!kitchenScript) {
    failures.push('/: could not find the state-kitchen inline script');
  } else {
    const kb = KB(gzipSync(kitchenScript).length);
    report.push(`/ (kitchen filter script): ${kb.toFixed(2)} KB gzip (limit 2)`);
    if (kb > 2) failures.push(`/: kitchen script is ${kb.toFixed(2)} KB gzip (limit 2)`);
  }
}

const learnHtml = await readPage('/learn/');
if (learnHtml) {
  const filterScript = inlineModuleScripts(learnHtml).find((s) => s.includes('learn-filters'));
  if (filterScript) {
    const kb = KB(gzipSync(filterScript).length);
    report.push(`/learn/ (filter script): ${kb.toFixed(2)} KB gzip (limit 2)`);
    if (kb > 2) failures.push(`/learn/: filter script is ${kb.toFixed(2)} KB gzip (limit 2)`);
  } else {
    // No filters rendered (e.g. too few exercises/facets to need one) — fine.
    report.push('/learn/: no filter script on this build (nothing to filter)');
  }
}

console.log('\nJS budget report:');
for (const line of report) console.log(`  ${line}`);

if (failures.length > 0) {
  console.error(`\nJS budget guard failed: ${failures.length} issue(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('\nJS budget guard passed.');
