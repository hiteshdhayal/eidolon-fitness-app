/**
 * Lighthouse CI config (spec Phase 6 Part E). Run via `pnpm perf`, which
 * builds a dedicated LH_AUDIT=1 SHOW_DRAFTS=1 build into dist-audit/ first
 * (never deployed — drafts render without the DRAFT tag/noindex so every
 * page type can be scored) and then runs lhci against it.
 */
const URLS = [
  '/',
  '/plan/',
  '/my-plan/',
  '/reels/',
  '/reels/pcod-diet-basics/',
  '/reels/topic/pcos/',
  '/articles/',
  '/articles/top-5-supplement-brands-india/',
  '/articles/picks/',
  '/learn/',
  '/learn/push-up/',
  '/workouts/beginner-home-full-body/',
  '/learn/guides/how-to-find-your-step-count/',
  '/tools/',
  '/tools/bmi/',
  '/tools/calories/',
  '/tools/protein/',
  '/links/',
  '/about/',
  '/privacy/',
  '/404.html',
];

// /my-plan/ (empty state, noindex by design) and /404.html are exempt from
// the SEO category only — every other assertion still applies to them.
const SEO_EXEMPT = new Set(['/my-plan/', '/404.html']);

function assertionsFor(url) {
  const base = {
    'categories:performance': ['error', { minScore: 0.95 }],
    'categories:accessibility': ['error', { minScore: 0.95 }],
    'categories:best-practices': ['error', { minScore: 0.95 }],
    'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
    'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
    'total-blocking-time': ['error', { maxNumericValue: 200 }],
  };
  if (!SEO_EXEMPT.has(url)) {
    base['categories:seo'] = ['error', { minScore: 0.95 }];
  }
  return base;
}

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist-audit',
      url: URLS,
      numberOfRuns: 3,
      settings: {
        preset: 'mobile',
      },
    },
    assert: {
      assertMatrix: URLS.map((url) => ({
        matchingUrlPattern: `.*${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        assertions: assertionsFor(url),
      })),
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
