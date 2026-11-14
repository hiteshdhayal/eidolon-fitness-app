/**
 * Header nav active-state (spec Phase 6 Part G.3). A nav item is active on
 * its own page and on every nested route underneath it, e.g. "Learn" stays
 * active on /learn/guides/x/ and "Reels" on /reels/topic/x/.
 */
export function isNavActive(path: string, href: string): boolean {
  return path === href || path.startsWith(href);
}
