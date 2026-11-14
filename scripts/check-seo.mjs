/**
 * SEO build guard (spec Phase 6 Part C6). For every HTML page in dist/ that
 * isn't noindex: one unique <= 60 char title, a unique <= 155 char
 * description, an absolute trailing-slash canonical matching the file's own
 * path, the og/twitter tags, an og:image that exists on disk, and JSON-LD
 * that parses and never claims Review/AggregateRating/Offer. Also checks
 * that no noindex page is listed in the sitemap.
 */
import { readdir, readFile, access } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const DIST = resolve(process.env.SHOW_DRAFTS === '1' ? 'dist-drafts' : 'dist');
const SITE_URL = 'https://eidolon.cloud';
const BANNED_JSONLD_TYPES = new Set(['Review', 'AggregateRating', 'Offer']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function urlPathFor(file) {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === '404.html') return null; // not a normal route
  return `/${rel.replace(/index\.html$/, '')}`;
}

function matchAll(html, re) {
  return [...html.matchAll(re)];
}

const failures = [];
function fail(file, message) {
  failures.push(`${relative('.', file)}: ${message}`);
}

const files = (await walk(DIST)).filter((file) => file.endsWith('.html'));
const titles = new Map();
const descriptions = new Map();

let checked = 0;

for (const file of files) {
  const html = await readFile(file, 'utf8');
  if (/<meta\s+name="robots"\s+content="noindex/i.test(html)) continue;
  checked += 1;

  const path = urlPathFor(file);

  // ---- title ------------------------------------------------------------
  const titleMatches = matchAll(html, /<title>([^<]*)<\/title>/gi);
  if (titleMatches.length !== 1) {
    fail(file, `expected exactly one <title>, found ${titleMatches.length}`);
  } else {
    const title = titleMatches[0][1].trim();
    if (title.length > 60) fail(file, `title is ${title.length} chars (max 60): "${title}"`);
    if (titles.has(title) && titles.get(title) !== file) {
      fail(file, `title duplicates ${relative('.', titles.get(title))}: "${title}"`);
    }
    titles.set(title, file);
  }

  // ---- description --------------------------------------------------------
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!descMatch) {
    fail(file, 'missing meta description');
  } else {
    const desc = descMatch[1];
    if (desc.length > 155) fail(file, `description is ${desc.length} chars (max 155)`);
    if (descriptions.has(desc) && descriptions.get(desc) !== file) {
      fail(file, `description duplicates ${relative('.', descriptions.get(desc))}`);
    }
    descriptions.set(desc, file);
  }

  // ---- canonical ----------------------------------------------------------
  const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  if (!canonicalMatch) {
    fail(file, 'missing canonical link');
  } else {
    const canonical = canonicalMatch[1];
    if (!canonical.startsWith(SITE_URL)) fail(file, `canonical is not absolute: ${canonical}`);
    if (!canonical.endsWith('/')) fail(file, `canonical missing trailing slash: ${canonical}`);
    if (path && canonical !== `${SITE_URL}${path}`) {
      fail(file, `canonical ${canonical} does not match page path ${path}`);
    }
  }

  // ---- og / twitter ---------------------------------------------------
  for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name', 'og:locale']) {
    if (!new RegExp(`<meta\\s+property="${tag}"`, 'i').test(html)) {
      fail(file, `missing <meta property="${tag}">`);
    }
  }
  for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!new RegExp(`<meta\\s+name="${tag}"`, 'i').test(html)) {
      fail(file, `missing <meta name="${tag}">`);
    }
  }

  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
  if (ogImageMatch) {
    const ogImageUrl = ogImageMatch[1];
    if (ogImageUrl.startsWith(SITE_URL)) {
      const ogPath = ogImageUrl.slice(SITE_URL.length);
      if (!(await exists(join(DIST, ogPath)))) {
        fail(file, `og:image ${ogImageUrl} does not exist in dist/`);
      }
    }
  }

  // ---- JSON-LD ----------------------------------------------------------
  const jsonLdBlocks = matchAll(html, /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, raw] of jsonLdBlocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      fail(file, `JSON-LD block does not parse: ${error.message}`);
      continue;
    }
    const nodes = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
    for (const node of nodes) {
      if (node && BANNED_JSONLD_TYPES.has(node['@type'])) {
        fail(file, `JSON-LD declares banned @type "${node['@type']}"`);
      }
    }
  }
}

// ---- sitemap vs noindex -------------------------------------------------
// Only checked for the real production build: a SHOW_DRAFTS preview build
// renders draft content pages (correctly noindex) that the sitemap filter
// can't see per-page, since it's never deployed anyway.
if (process.env.SHOW_DRAFTS !== '1') {
  const sitemapFiles = (await walk(DIST)).filter((file) => /sitemap.*\.xml$/i.test(file));
  const sitemapUrls = new Set();
  for (const file of sitemapFiles) {
    const xml = await readFile(file, 'utf8');
    for (const [, loc] of matchAll(xml, /<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(loc);
  }
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (!/<meta\s+name="robots"\s+content="noindex/i.test(html)) continue;
    const path = urlPathFor(file);
    if (path && sitemapUrls.has(`${SITE_URL}${path}`)) {
      fail(file, `noindex page appears in the sitemap`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\nSEO guard failed: ${failures.length} issue(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`SEO guard passed (${checked} indexable pages checked).`);
