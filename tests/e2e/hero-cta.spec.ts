import { expect, test, type Locator, type Page } from '@playwright/test';
import { seedPlan, VEG_HARYANA } from './helpers';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

// One project loops over all five viewports; the other two projects skip it.
test.skip(
  ({ viewport }) => viewport?.width === 375 || viewport?.width === 768,
  'hero CTA suite loops all five viewports in one project',
);

/** elementFromPoint at the centre of the CTA must resolve to the link itself. */
async function centreIsClickable(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, 'CTA has a box').not.toBeNull();
  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const link = el.closest('a');
      return link ? link.getAttribute('href') : null;
    },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  );
  expect(hit, 'elementFromPoint at the CTA centre is the link (or a descendant)').toBeTruthy();
}

async function clickThrough(page: Page, locator: Locator, expected: RegExp): Promise<void> {
  await locator.click({ timeout: 5000 });
  await expect(page).toHaveURL(expected, { timeout: 5000 });
}

test.describe('hero CTA without a saved plan', () => {
  for (const viewport of VIEWPORTS) {
    test(`all CTAs are clickable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);

      await page.goto('/');
      await page.waitForTimeout(300);
      const hero = page.locator('.hero-copy a.btn-primary');
      await centreIsClickable(page, hero);
      await clickThrough(page, hero, /\/plan\/?$/);

      await page.goto('/');
      const finalCta = page.locator('.final-cta a.btn-primary');
      await centreIsClickable(page, finalCta);
      await clickThrough(page, finalCta, /\/plan\/?$/);

      if (viewport.width >= 1024) {
        await page.goto('/');
        const header = page.locator('.header-actions a.plan-cta');
        await centreIsClickable(page, header);
        await clickThrough(page, header, /\/plan\/?$/);
      } else {
        await page.goto('/');
        await page.getByRole('button', { name: 'Open menu' }).click();
        const menuCta = page.locator('#mobile-menu a.plan-cta');
        await expect(menuCta).toBeVisible();
        await centreIsClickable(page, menuCta);
        await clickThrough(page, menuCta, /\/plan\/?$/);
      }

      if (viewport.width < 768) {
        // The sticky bar is hidden on the home page; check it on a content page.
        await page.goto('/learn/');
        const sticky = page.locator('.sticky-cta a');
        await centreIsClickable(page, sticky);
        await clickThrough(page, sticky, /\/plan\/?$/);
      }
    });
  }
});

test.describe('hero CTA with a saved plan', () => {
  test.beforeEach(async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
  });

  for (const viewport of VIEWPORTS) {
    test(`hero, final and header CTAs open the plan at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);

      await page.goto('/');
      await page.waitForTimeout(300);
      const hero = page.locator('.hero-copy a.btn-primary');
      await expect(hero).toContainText('Open my plan');
      await centreIsClickable(page, hero);
      await clickThrough(page, hero, /\/my-plan\/?$/);

      await page.goto('/');
      const finalCta = page.locator('.final-cta a.btn-primary');
      await expect(finalCta).toContainText('Open my plan');
      await centreIsClickable(page, finalCta);
      await clickThrough(page, finalCta, /\/my-plan\/?$/);

      if (viewport.width >= 1024) {
        await page.goto('/');
        const header = page.locator('.header-actions a.plan-cta');
        await expect(header).toContainText('Open my plan');
        await expect(header).toHaveAttribute('href', '/my-plan/');
        await centreIsClickable(page, header);
      }
    });
  }
});

test.describe('header CTA per page', () => {
  test('is hidden on /plan with and without a saved plan', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1440) < 1024, 'header CTA is desktop only');
    await page.goto('/plan/');
    await expect(page.locator('.header-actions a.plan-cta')).toBeHidden();

    await seedPlan(page, VEG_HARYANA);
    await page.goto('/plan/');
    await expect(page.locator('.header-actions a.plan-cta')).toBeHidden();
  });

  test('offers "Edit my plan" on /my-plan only when a plan exists', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1440) < 1024, 'header CTA is desktop only');
    await page.goto('/my-plan/');
    const cta = page.locator('.header-actions a.plan-cta');
    await expect(cta).toContainText('Build my plan');
    await expect(cta).toHaveAttribute('href', '/plan/');

    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await expect(page.locator('.header-actions a.plan-cta')).toContainText('Edit my plan');
    await expect(page.locator('.header-actions a.plan-cta')).toHaveAttribute(
      'href',
      '/plan/?edit=1',
    );
  });
});
