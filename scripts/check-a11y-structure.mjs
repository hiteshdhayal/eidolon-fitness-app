/**
 * Static accessibility structure guard (spec Phase 6 Part F.1). Checks what
 * a DOM/axe pass can't cheaply check at build time, over every HTML page:
 * lang, a single h1, no heading-level skips, a working skip link as the
 * first focusable element, accessible names on every link/button, no
 * positive tabindex, a label on every form control, and alt on every img.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { distDir } from './dist-dir.mjs';

const DIST = distDir();

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

function bodyOf(html) {
  const match = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

function textOf(tag, html, matchIndex) {
  // Grab up to the next matching closing tag's worth of content for a name
  // check — good enough for the simple, non-nested markup these pages use.
  const tagName = tag.match(/^<(\w+)/)?.[1]?.toLowerCase();
  if (!tagName) return '';
  const rest = html.slice(matchIndex + tag.length);
  const closeIdx = rest.search(new RegExp(`</${tagName}>`, 'i'));
  const inner = closeIdx === -1 ? '' : rest.slice(0, closeIdx);
  return inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const failures = [];
const files = (await walk(DIST)).filter((file) => file.endsWith('.html'));

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const rel = relative('.', file);

  // ---- lang ---------------------------------------------------------------
  if (!/<html[^>]*\slang="en-IN"/i.test(html)) {
    failures.push(`${rel}: <html> is missing lang="en-IN"`);
  }

  // ---- single h1 ------------------------------------------------------
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count !== 1) failures.push(`${rel}: expected exactly one <h1>, found ${h1Count}`);

  // ---- heading order (no downward skips) -------------------------------
  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  let lastLevel = 0;
  for (const level of headings) {
    if (level > lastLevel + 1 && lastLevel !== 0) {
      failures.push(`${rel}: heading jumps from h${lastLevel} to h${level}`);
      break;
    }
    lastLevel = level;
  }

  const body = bodyOf(html);

  // ---- skip link as first focusable element ----------------------------
  // /links/ deliberately has no header/nav to skip over (spec §15) and
  // doesn't use BaseLayout at all, so it's exempt from this one.
  const isLinksPage = rel.endsWith(`${DIST}/links/index.html`) || rel === `${DIST}/links.html`;
  if (!isLinksPage) {
    const focusablePattern = /<(a|button|input|select|textarea)\b[^>]*>/gi;
    const firstFocusable = focusablePattern.exec(body);
    if (!firstFocusable) {
      failures.push(`${rel}: no focusable elements found at all`);
    } else {
      const tag = firstFocusable[0];
      const isSkipLink = /^<a\b/i.test(tag) && attr(tag, 'href') === '#main';
      if (!isSkipLink) {
        failures.push(`${rel}: first focusable element isn't the "Skip to content" link (${tag.slice(0, 60)})`);
      }
    }
    if (!/id="main"/.test(html)) {
      failures.push(`${rel}: no element with id="main" for the skip link to target`);
    }
  }

  // ---- no positive tabindex ---------------------------------------------
  for (const match of html.matchAll(/\stabindex="(-?\d+)"/gi)) {
    if (Number(match[1]) > 0) {
      failures.push(`${rel}: positive tabindex="${match[1]}" found`);
    }
  }

  // ---- accessible names on every <a>/<button> ---------------------------
  for (const match of body.matchAll(/<(a|button)\b[^>]*>/gi)) {
    const tag = match[0];
    if (/\baria-hidden="true"/.test(tag)) continue;
    const hasAriaLabel = attr(tag, 'aria-label');
    const hasAriaLabelledBy = attr(tag, 'aria-labelledby');
    const text = textOf(tag, body, match.index ?? 0);
    if (!hasAriaLabel && !hasAriaLabelledBy && !text) {
      failures.push(`${rel}: <${match[1]}> has no accessible name (${tag.slice(0, 80)})`);
    }
  }

  // ---- form controls have a label ---------------------------------------
  const labelFors = new Set(
    [...body.matchAll(/<label\b[^>]*\sfor="([^"]+)"/gi)].map((m) => m[1]),
  );
  for (const match of body.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = match[0];
    const type = attr(tag, 'type');
    if (type === 'hidden' || type === 'submit' || type === 'button') continue;
    const id = attr(tag, 'id');
    const hasAriaLabel = attr(tag, 'aria-label') || attr(tag, 'aria-labelledby');
    const wrappedInLabel = body
      .slice(Math.max(0, (match.index ?? 0) - 200), match.index ?? 0)
      .match(/<label\b[^>]*>(?:(?!<\/label>)[\s\S])*$/);
    if (!hasAriaLabel && !(id && labelFors.has(id)) && !wrappedInLabel) {
      failures.push(`${rel}: <${match[1]}> has no associated label (${tag.slice(0, 80)})`);
    }
  }

  // ---- every img has alt -------------------------------------------------
  for (const match of body.matchAll(/<img\b[^>]*>/gi)) {
    if (attr(match[0], 'alt') === undefined) {
      failures.push(`${rel}: <img> missing alt (${match[0].slice(0, 80)})`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\nAccessibility structure guard failed: ${failures.length} issue(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`Accessibility structure guard passed (${files.length} pages checked).`);
