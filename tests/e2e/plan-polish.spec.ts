import { expect, test, type Page } from '@playwright/test';
import { answersFor, seedDraft, seedPlan, VEG_HARYANA } from './helpers';

// These tests set their own viewport, so run them once.
test.skip(
  ({ viewport }) => viewport?.width === 375 || viewport?.width === 768,
  'polish suite loops viewports in one project',
);

async function leftOf(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} has a box`).not.toBeNull();
  return box!.x;
}

async function openSkippableStep(page: Page): Promise<void> {
  await seedDraft(page, answersFor(VEG_HARYANA), 'targetWeight');
  await page.goto('/plan/?step=targetWeight');
  await page.getByRole('button', { name: /Continue where you left off/ }).click();
  await expect(page.locator('.qc-legend')).toHaveText('Do you have a target weight?');
}

test.describe('layout alignment (no centred columns)', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`plan headings line up with the wordmark at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedPlan(page, VEG_HARYANA);

      await page.goto('/my-plan/');
      const wordmark = await leftOf(page, '.site-header .wordmark-text');
      const h1 = await leftOf(page, '.pv-title');
      expect(Math.abs(h1 - wordmark), 'my-plan h1 vs wordmark').toBeLessThanOrEqual(2);

      await page.goto('/plan/');
      await page.getByRole('button', { name: /^Start/ }).click();
      const legend = await leftOf(page, '.qc-legend');
      expect(Math.abs(legend - wordmark), 'plan legend vs wordmark').toBeLessThanOrEqual(2);
    });
  }
});

test('key numbers are above the fold at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedPlan(page, VEG_HARYANA);
  await page.goto('/my-plan/');
  const box = await page.locator('.pv-stat-grid').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(900);
});

test.describe('next and skip', () => {
  test('mobile sticky bar shows only Next, never Skip', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openSkippableStep(page);

    const bar = page.locator('.qc-next-wrap');
    await expect(bar.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    await expect(bar.locator('.qc-skip:visible')).toHaveCount(0);

    // Skip sits inline, below the input, instead.
    const inline = page.locator('.qc-skip-inline');
    await expect(inline).toBeVisible();
    const inlineBox = await inline.boundingBox();
    expect(inlineBox!.height).toBeGreaterThanOrEqual(44);
  });

  test('desktop has at least 32px between Next and Skip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSkippableStep(page);

    const nextBox = await page.getByRole('button', { name: 'Next', exact: true }).boundingBox();
    const skipBox = await page.locator('.qc-skip-desktop').boundingBox();
    expect(nextBox).not.toBeNull();
    expect(skipBox).not.toBeNull();
    expect(skipBox!.x - (nextBox!.x + nextBox!.width)).toBeGreaterThanOrEqual(32);
  });

  test('pressing Next while aria-disabled shows a reason and does not advance', async ({
    page,
  }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();

    const next = page.getByRole('button', { name: 'Next', exact: true });
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    // force:true — Playwright treats aria-disabled as a disabled control.
    await next.click({ force: true });

    await expect(page.locator('.qc-legend')).toHaveText("What's your goal?");
    await expect(page.locator('.qc-notice')).toHaveText('Pick one to continue.');
  });
});

test.describe('no horizontal scroll', () => {
  for (const width of [375, 768, 1440, 1920]) {
    test(`my-plan recipes at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      await seedPlan(page, VEG_HARYANA);
      await page.goto('/my-plan/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
