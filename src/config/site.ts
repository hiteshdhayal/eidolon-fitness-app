export const site = {
  brandName: 'Eidolon',
  creatorName: 'Hitesh Dhayal',
  bio: 'Indian food, honest numbers, and training I actually use.',
  instagramHandle: 'hiteshdhayal',
  instagramUrl: 'https://www.instagram.com/hiteshdhayal/',
  domain: 'eidolon.cloud',
  siteUrl: 'https://eidolon.cloud',
  /** Empty until supplied. UI that depends on these hides itself. */
  credentials: '',
  contactEmail: '',
  /** Longer "why I built this" / background copy for /about/. Empty hides the extra paragraphs. */
  aboutLong: '',
  umamiWebsiteId: '',
  umamiSrc: 'https://stats.eidolon.cloud/script.js',
  nav: [
    { label: 'Diet plan', href: '/plan/' },
    { label: 'Learn', href: '/learn/' },
    { label: 'Articles', href: '/articles/' },
    { label: 'Reels', href: '/reels/' },
  ],
  disclaimer:
    'General education, not medical advice. Check with your doctor before changing how you eat, especially if you have a condition or take medicines.',
} as const;

export const defaultTitle = 'Eidolon — Indian diet plans built on your food';

export function pageTitle(page: string): string {
  return `${page} · Eidolon`;
}

/**
 * Routes that are still placeholders. Excluded from the sitemap. Every page
 * that shipped real content in Phase 6 (learn, workouts, reels, articles,
 * tools, links) has been removed from this map — add new stubs here only.
 */
export const stubPages: Record<string, { title: string; copy: string }> = {};

export const stubRoutes = Object.keys(stubPages);

export function stub(path: string): { title: string; copy: string } {
  const page = stubPages[path];
  if (!page) throw new Error(`Unknown stub route: ${path}`);
  return page;
}

/**
 * Routes that must stay out of the sitemap regardless of stub status (spec
 * Phase 6 §C5): the no-JS questionnaire output, the component gallery, 404,
 * and build-time-only OG image routes.
 */
export const sitemapExcludedRoutes = [
  ...stubRoutes,
  '/my-plan/',
  '/styleguide/',
  '/404/',
  '/og/',
];
