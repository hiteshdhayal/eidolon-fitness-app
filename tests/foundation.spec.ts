import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  { path: '/', heading: /diet plan built on the food/i },
  { path: '/styleguide/', heading: /styleguide/i },
  { path: '/plan/', heading: /build your plan/i },
];

for (const page of pages) {
  test(`${page.path} renders and has no axe violations`, async ({ page: pw }) => {
    await pw.goto(page.path);
    await expect(pw.getByRole('heading', { level: 1, name: page.heading })).toBeVisible();

    const results = await new AxeBuilder({ page: pw }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('404 page renders and has no axe violations', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText("doesn't exist");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('mobile menu opens and closes', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 1440) >= 1024, 'Menu button is hidden on desktop');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeHidden();
});

test('home has a working plan call to action', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /build my plan/i }).first();
  await expect(cta).toHaveAttribute('href', '/plan/');
});

test('header turns solid after scrolling past the hero sentinel', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('[data-site-header]');
  await expect(header).not.toHaveAttribute('data-scrolled', '');

  await page.evaluate(() => window.scrollTo(0, 240));
  await expect(header).toHaveAttribute('data-scrolled', '');
});
