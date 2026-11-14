import { describe, expect, it } from 'vitest';
import { isNavActive } from '../../src/lib/nav';

describe('isNavActive', () => {
  it('is active on the exact route', () => {
    expect(isNavActive('/learn/', '/learn/')).toBe(true);
  });

  it('stays active on nested routes', () => {
    expect(isNavActive('/learn/guides/how-to-read-a-nutrition-label/', '/learn/')).toBe(true);
    expect(isNavActive('/reels/topic/pcos/', '/reels/')).toBe(true);
  });

  it('is not active on an unrelated route', () => {
    expect(isNavActive('/articles/', '/learn/')).toBe(false);
  });

  it('does not false-positive on a route that merely shares a prefix string', () => {
    // "/learn/" should not match "/learnings/" — startsWith is on the full
    // href (with trailing slash), so this is already safe, but worth pinning.
    expect(isNavActive('/learnings/', '/learn/')).toBe(false);
  });
});
