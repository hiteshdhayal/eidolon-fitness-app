/**
 * Pure text-wrapping helper for the OG image template (spec Phase 6 C3).
 * Satori renders whatever lines we hand it; this decides those lines and
 * the font size, so it's unit-testable without touching Satori or fonts.
 */

export interface WrappedTitle {
  lines: string[];
  fontSize: number;
}

const MAX_LINES = 3;
const MAX_FONT_SIZE = 72;
const MIN_FONT_SIZE = 56;
const FONT_STEP = 4;
/** Usable width inside the 1200px canvas after padding, in px. */
const CONTENT_WIDTH = 1040;
/** Average glyph advance width for Archivo 900 uppercase, relative to font size. */
const AVG_CHAR_WIDTH_EM = 0.62;

function charsPerLine(fontSize: number): number {
  return Math.max(1, Math.floor(CONTENT_WIDTH / (fontSize * AVG_CHAR_WIDTH_EM)));
}

function wrapAt(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export function wrapOgTitle(title: string): WrappedTitle {
  const clean = title.trim().toUpperCase();

  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= FONT_STEP) {
    const lines = wrapAt(clean, charsPerLine(fontSize));
    if (lines.length <= MAX_LINES) return { lines, fontSize };
  }

  // Still too long at the floor size: wrap there and truncate to 3 lines
  // with an ellipsis on the last one.
  const maxChars = charsPerLine(MIN_FONT_SIZE);
  const allLines = wrapAt(clean, maxChars);
  const lines = allLines.slice(0, MAX_LINES);
  if (allLines.length > MAX_LINES) {
    const last = lines[MAX_LINES - 1] ?? '';
    const trimmed = last.replace(/\s+\S*$/, '').trimEnd();
    lines[MAX_LINES - 1] = `${trimmed || last}…`;
  }
  return { lines, fontSize: MIN_FONT_SIZE };
}
