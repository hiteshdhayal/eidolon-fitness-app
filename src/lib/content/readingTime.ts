/**
 * Reading time (words / 200, rounded up, minimum 1). Counts words from the raw
 * entry body with MDX/JSX tags, imports and code fences stripped.
 */

const WORDS_PER_MINUTE = 200;

export function stripMarkup(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/~~~[\s\S]*?~~~/g, ' ') // fenced code (tilde)
    .replace(/^import\s.+$/gm, ' ') // mdx import lines
    .replace(/^export\s.+$/gm, ' ') // mdx export lines
    .replace(/<[^>]+>/g, ' ') // jsx/html tags
    .replace(/\{[^}]*\}/g, ' ') // jsx expressions like {frontmatter.x}
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their text
    .replace(/[#>*_`~|-]+/g, ' '); // markdown punctuation
}

export function wordCount(body: string): number {
  const text = stripMarkup(body).trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function readingTimeMinutes(body: string): number {
  return Math.max(1, Math.ceil(wordCount(body) / WORDS_PER_MINUTE));
}

export function readingTime(body: string): string {
  return `${readingTimeMinutes(body)} min read`;
}
