/** Maps a page path to its OG image slug/path (spec Phase 6 C3). */
export function ogSlugFor(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? 'home' : trimmed.replace(/\//g, '-');
}

export function ogImagePathFor(path: string): string {
  return `/og/${ogSlugFor(path)}.png`;
}
