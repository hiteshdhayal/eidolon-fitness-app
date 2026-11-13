/**
 * All placeholders from the build spec live here.
 * Replace the {{...}} values with the real details before launch.
 */
export const site = {
  brandName: '{{BRAND_NAME}}',
  creatorName: '{{CREATOR_NAME}}',
  instagramHandle: '{{INSTAGRAM_HANDLE}}',
  instagramUrl: 'https://www.instagram.com/{{INSTAGRAM_HANDLE}}/',
  domain: '{{DOMAIN}}',
  /** Placeholder origin until {{DOMAIN}} is filled in. */
  url: 'https://example.com',
  credentials: '{{CREDENTIALS}}',
  contactEmail: '{{CONTACT_EMAIL}}',
  photos: '{{PHOTOS}}',
  affiliateIds: {
    amazon: '{{AMAZON_AFFILIATE_ID}}',
  },
  nav: [
    { label: 'Diet plan', href: '/plan/' },
    { label: 'Learn', href: '/learn/' },
    { label: 'Articles', href: '/articles/' },
    { label: 'Reels', href: '/reels/' },
  ],
  disclaimer:
    'General education, not medical advice. Check with your doctor before changing how you eat, especially if you have a condition or take medicines.',
} as const;
