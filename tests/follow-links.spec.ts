import { expect, test } from '@playwright/test';

const EXACT_URL = 'https://www.instagram.com/hiteshdhayal/';

for (const path of ['/', '/styleguide/', '/about/']) {
  test(`every follow link on ${path} points to Instagram correctly`, async ({ page }) => {
    await page.goto(path);

    const links = page.locator('a[data-umami-event="follow_click"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute('href', EXACT_URL);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('data-umami-event-location', /.+/);
      await expect(link).toHaveAttribute(
        'aria-label',
        /Follow Hitesh Dhayal on Instagram \(opens in a new tab\)/,
      );
    }
  });
}

test('home has at least four follow links', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('a[data-umami-event="follow_click"]').count()).toBeGreaterThanOrEqual(
    4,
  );
});
