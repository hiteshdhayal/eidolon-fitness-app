/**
 * Fail the build if an island's eagerly loaded JavaScript passes 80 KB
 * gzipped (spec §17). The engine and food database are lazy chunks and are
 * reported separately; if either is imported statically, the guard fails.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT_KB = 80;
const DIR = process.env.SHOW_DRAFTS === '1' ? 'dist-drafts' : 'dist';
const pages = [
  { name: 'Questionnaire (/plan)', html: `${DIR}/plan/index.html` },
  { name: 'PlanView (/my-plan)', html: `${DIR}/my-plan/index.html` },
];

const astroDir = resolve(DIR, '_astro');
const allChunks = new Set(readdirSync(astroDir).filter((file) => file.endsWith('.js')));

function importsOf(file) {
  const source = readFileSync(resolve(astroDir, file), 'utf8');
  const specs = [];
  const pattern = /(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g;
  for (const match of source.matchAll(pattern)) {
    const spec = match[1];
    if (spec) specs.push(spec.replace(/^\.\//, ''));
  }
  return specs;
}

let failed = false;

for (const page of pages) {
  const html = readFileSync(page.html, 'utf8');
  const roots = new Set(
    [...html.matchAll(/\/_astro\/([A-Za-z0-9._-]+\.js)/g)].map((match) => match[1]),
  );

  const eager = new Set();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop();
    if (!file || eager.has(file) || !allChunks.has(file)) continue;
    eager.add(file);
    for (const next of importsOf(file)) {
      if (!eager.has(next)) queue.push(next);
    }
  }

  const eagerLazy = [...eager].filter((file) => /^(engine|foods)\./.test(file));
  if (eagerLazy.length > 0) {
    console.error(`✗ ${page.name}: engine/foods imported eagerly: ${eagerLazy.join(', ')}`);
    failed = true;
  }

  const chunks = [...eager].filter((file) => !/^(engine|foods)\./.test(file)).sort();
  const gzipKb =
    chunks.reduce((sum, file) => sum + gzipSync(readFileSync(resolve(astroDir, file))).length, 0) /
    1024;

  const verdict = gzipKb > LIMIT_KB ? '✗' : '✓';
  console.log(
    `${verdict} ${page.name}: ${gzipKb.toFixed(1)} KB gzip (limit ${LIMIT_KB}) — ${chunks.join(', ')}`,
  );
  if (gzipKb > LIMIT_KB) failed = true;
}

for (const chunk of [...allChunks].filter((file) => /^(engine|foods)\./.test(file)).sort()) {
  const kb = gzipSync(readFileSync(resolve(astroDir, chunk))).length / 1024;
  console.log(`  lazy ${chunk}: ${kb.toFixed(1)} KB gzip`);
}

if (failed) process.exit(1);
