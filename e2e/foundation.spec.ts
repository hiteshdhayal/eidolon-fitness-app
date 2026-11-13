import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { path: '/', heading: /diet plan built on the food/i },
  { path: '/styleguide/', heading: /styleguide/i },
];

for (const page of pages) {
  test(`${page.path} renders and has no axe violations`, async ({ page: pw }) => {
    await pw.goto(page.path);
    await expect(pw.getByRole('heading', { level: 1, name: page.heading })).toBeVisible();

    const results = await new AxeBuilder({ page: pw }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('mobile menu opens and closes without JavaScript routing', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 1440) >= 768, 'Mobile menu only exists below 768px');
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
