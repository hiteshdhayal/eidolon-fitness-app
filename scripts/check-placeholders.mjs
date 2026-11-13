import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = 'dist';

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

const files = (await walk(DIST)).filter((file) => file.endsWith('.html'));
const failures = [];

for (const file of files) {
  const html = await readFile(file, 'utf8');
  if (!html.includes('{{')) continue;
  const lines = html.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('{{')) {
      failures.push(`${relative('.', file)}:${index + 1}: ${line.trim().slice(0, 160)}`);
    }
  });
}

if (failures.length > 0) {
  console.error(`\nPlaceholder guard failed: found {{ in ${failures.length} place(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`Placeholder guard passed (${files.length} HTML files).`);
