/**
 * Image build guard (spec Phase 6 Part E.4). For every HTML page: every
 * <img> has width, height and an alt attribute (alt="" only for decorative
 * images); anything that isn't the LCP image (fetchpriority="high") must be
 * loading="lazy"; and every raster image is served from /_astro/ (produced
 * by astro:assets), never a raw public/ path.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { distDir } from './dist-dir.mjs';

const DIST = distDir();
const RASTER_EXT = /\.(jpe?g|png|webp|avif)(\?.*)?$/i;

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

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return match ? match[1] : undefined;
}

const failures = [];
const files = (await walk(DIST)).filter((file) => file.endsWith('.html'));
let checked = 0;

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);

  for (const tag of imgTags) {
    checked += 1;
    const src = attr(tag, 'src') ?? attr(tag, 'data-src');
    const width = attr(tag, 'width');
    const height = attr(tag, 'height');
    const alt = attr(tag, 'alt');
    const loading = attr(tag, 'loading');
    const fetchPriority = attr(tag, 'fetchpriority');

    const label = src ?? tag.slice(0, 80);
    if (!width) failures.push(`${relative('.', file)}: <img> missing width (${label})`);
    if (!height) failures.push(`${relative('.', file)}: <img> missing height (${label})`);
    if (alt === undefined) failures.push(`${relative('.', file)}: <img> missing alt (${label})`);

    if (fetchPriority !== 'high' && loading !== 'lazy') {
      failures.push(
        `${relative('.', file)}: <img> is not loading="lazy" and isn't the LCP image (${label})`,
      );
    }

    if (src && RASTER_EXT.test(src) && !src.includes('/_astro/')) {
      failures.push(`${relative('.', file)}: raster image not served from /_astro/ (${src})`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\nImage guard failed: ${failures.length} issue(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`Image guard passed (${checked} <img> tags checked).`);
