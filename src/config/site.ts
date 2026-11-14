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

/** Routes that are still placeholders. Excluded from the sitemap. */
export const stubPages: Record<string, { title: string; copy: string }> = {
  '/learn/': {
    title: 'Learn',
    copy: 'Exercise library: how to do each movement properly, mistakes to avoid, easier and harder versions.',
  },
  '/workouts/': {
    title: 'Workouts',
    copy: 'Ready-made home and gym workouts with simple progression.',
  },
  '/reels/': {
    title: 'Reels',
    copy: 'Every reel in one place, with written notes.',
  },
  '/articles/': {
    title: 'Articles',
    copy: 'Deep dives that go with my reels.',
  },
  '/tools/bmi/': {
    title: 'BMI calculator',
    copy: 'BMI with Asian cutoffs.',
  },
  '/tools/calories/': {
    title: 'Calorie calculator',
    copy: 'How much you actually need to eat.',
  },
  '/tools/protein/': {
    title: 'Protein calculator',
    copy: 'Your daily protein, from food.',
  },
  '/links/': {
    title: 'Links',
    copy: 'All my links in one place.',
  },
};

export const stubRoutes = Object.keys(stubPages);

export function stub(path: string): { title: string; copy: string } {
  const page = stubPages[path];
  if (!page) throw new Error(`Unknown stub route: ${path}`);
  return page;
}

/** Routes that must stay out of the sitemap (stubs, styleguide, 404). */
export const sitemapExcludedRoutes = [...stubRoutes, '/my-plan/', '/styleguide/', '/404/'];
