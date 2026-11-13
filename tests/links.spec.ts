import { expect, test } from '@playwright/test';

const INTERNAL_PAGES = ['/', '/styleguide/', '/plan/'];

test('no rendered page contains an unresolved placeholder', async ({ page }) => {
  for (const path of INTERNAL_PAGES) {
    await page.goto(path);
    const html = await page.content();
    expect(html.includes('{{'), `${path} has a {{ placeholder`).toBe(false);
  }
});

test('every internal link on the home page resolves', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute('href') ?? '')
        .filter(
          (href) =>
            href.startsWith('/') &&
            !href.startsWith('//') &&
            !href.startsWith('#') &&
            !href.startsWith('mailto:'),
        ),
    );

  const unique = [...new Set(hrefs)];
  expect(unique.length).toBeGreaterThan(10);

  for (const href of unique) {
    const response = await request.get(href);
    expect(response.status(), `${href} should return 200`).toBe(200);
  }
});

test('no horizontal scroll on any page', async ({ page }) => {
  for (const path of INTERNAL_PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the band and hero are static', async ({ page }) => {
    await page.goto('/');

    const bandAnimation = await page
      .locator('.band-track')
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(bandAnimation).toBe('none');

    const lineAnimation = await page
      .locator('.reveal-line > span')
      .first()
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(lineAnimation).toBe('none');
  });
});
