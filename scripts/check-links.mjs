import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { distDir } from './dist-dir.mjs';

const DIST = resolve(distDir());

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

function isIgnored(url) {
  return (
    url.startsWith('#') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('javascript:') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('//') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  );
}

async function resolves(url, sourceFile) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return true;
  const decoded = decodeURI(clean);

  let target;
  if (decoded.startsWith('/')) {
    target = join(DIST, decoded);
  } else {
    target = resolve(sourceFile, '..', decoded);
  }

  if (!target.startsWith(DIST + sep) && target !== DIST) return true;

  if (await exists(target)) return true;
  if (decoded.endsWith('/') || !decoded.includes('.')) {
    return exists(join(target, 'index.html'));
  }
  return false;
}

const files = (await walk(DIST)).filter((file) => file.endsWith('.html'));
const failures = [];
let checked = 0;

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const matches = [...html.matchAll(/(?:href|src)="([^"]+)"/g)];
  for (const match of matches) {
    const url = match[1];
    if (!url || isIgnored(url)) continue;
    checked += 1;
    if (!(await resolves(url, file))) {
      failures.push(`${relative('.', file)} → ${url}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\nLink check failed: ${failures.length} broken target(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`Link check passed (${checked} internal links across ${files.length} pages).`);
