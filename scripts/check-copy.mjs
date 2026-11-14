/**
 * Copy and data-honesty guard (spec Phase 6 Part G.1), over the visible
 * text of every HTML page — scripts, styles and JSON-LD stripped first.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { distDir } from './dist-dir.mjs';

const DIST = distDir();
const IS_PROD = process.env.SHOW_DRAFTS !== '1' && process.env.LH_AUDIT !== '1';

const BANNED_PHRASES = [
  'unlock',
  'elevate',
  'transform your journey',
  'revolutionize',
  'revolutionise',
  'game-changer',
  'gamechanger',
  'seamless',
  'empower',
  'supercharge',
  'dive in',
  'holistic',
  'next-level',
  "in today's fast-paced world",
  'look no further',
];

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

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');
}

// Extended_Pictographic also covers ©/®/™ (valid in emoji ZWJ sequences)
// and the whole Arrows block (↗ etc. — used throughout for external-link
// and "see more" indicators), none of which are emoji in intent here.
const LEGACY_SYMBOLS = /[©®™←-⇿]/u;

function hasEmoji(text) {
  for (const ch of text) {
    if (LEGACY_SYMBOLS.test(ch)) continue;
    if (/\p{Extended_Pictographic}/u.test(ch)) return true;
  }
  return false;
}
const DATA_HONESTY_WORDS = ['verified', 'dietitian-approved', 'ifct'];

const failures = [];
const files = (await walk(DIST)).filter((file) => file.endsWith('.html'));

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const text = visibleText(html);
  const lower = text.toLowerCase();
  const rel = relative('.', file);

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) failures.push(`${rel}: contains banned phrase "${phrase}"`);
  }

  if (/\bjourney\b/i.test(text)) failures.push(`${rel}: contains the word "journey"`);

  if (hasEmoji(text)) failures.push(`${rel}: contains an emoji`);

  if (lower.includes('lorem ipsum')) failures.push(`${rel}: contains "lorem ipsum"`);

  if (IS_PROD && /\b(TODO|FIXME)\b/.test(text)) {
    failures.push(`${rel}: contains leftover TODO/FIXME text`);
  }

  const foodIdx = [...lower.matchAll(/food/g)].map((m) => m.index ?? -1);
  for (const word of DATA_HONESTY_WORDS) {
    for (const match of lower.matchAll(new RegExp(word, 'g'))) {
      const idx = match.index ?? -1;
      const near = foodIdx.some((f) => Math.abs(f - idx) <= 60);
      if (near) {
        failures.push(
          `${rel}: "${word}" appears within 60 characters of "food" — never call the food data verified/dietitian-approved/IFCT`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`\nCopy guard failed: ${failures.length} issue(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`Copy guard passed (${files.length} pages checked).`);
