import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PLAN_KEY } from '../../src/lib/storage';
import { seedPlan, VEG_HARYANA, HOSTEL, TEEN, KERALA_PCOS } from './helpers';

async function noViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('plan page', () => {
  test('shows the empty state without a plan', async ({ page }) => {
    await page.goto('/my-plan/');
    await expect(page.getByRole('heading', { name: /no plan yet/i })).toBeVisible();
    await expect(
      page.locator('.pv-empty').getByRole('link', { name: /Build my plan/ }),
    ).toBeVisible();
  });

  test('treats corrupt storage as empty without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript((key) => localStorage.setItem(key, '{bad'), PLAN_KEY);
    await page.goto('/my-plan/');
    await expect(page.getByRole('heading', { name: /no plan yet/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('renders the recipes plan with numbers and seven days', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await expect(page.getByRole('heading', { name: /your plan/i })).toBeVisible();
    await expect(page.getByText('Lose fat', { exact: true })).toBeVisible();
    await expect(page.getByText('Vegetarian', { exact: true })).toBeVisible();
    await expect(page.locator('.pv-stat')).toHaveCount(7);
    await expect(page.getByRole('tablist', { name: 'Choose a day' }).getByRole('tab')).toHaveCount(
      7,
    );
    await expect(page.getByText('Approximate daily targets.')).toBeVisible();
  });

  test('swaps a meal and persists it', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    const panel = page.locator('#panel-plan');
    const before = await panel.innerText();
    await page.getByRole('button', { name: 'Swap' }).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.pv-swap-option').first()).toBeVisible();
    await sheet.locator('.pv-swap-option').first().click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[aria-live="polite"]')).toContainText('Swapped to');
    await expect.poll(async () => (await panel.innerText()) !== before).toBe(true);

    await page.reload();
    const afterReload = await page.locator('#panel-plan').innerText();
    expect(afterReload).not.toBe(before);
  });

  test('shuffles only the active day', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    const days = page.getByRole('tablist', { name: 'Choose a day' });
    const panel = page.locator('#panel-plan');

    await days.getByRole('tab', { name: 'Tue' }).click();
    const tueBefore = await panel.innerText();
    await days.getByRole('tab', { name: 'Mon' }).click();
    const monBefore = await panel.innerText();

    await page.getByRole('button', { name: 'Shuffle day' }).first().click();
    await expect(page.locator('[aria-live="polite"]')).toContainText('New meals for');
    await expect.poll(async () => (await panel.innerText()) !== monBefore).toBe(true);

    await days.getByRole('tab', { name: 'Tue' }).click();
    expect(await panel.innerText()).toBe(tueBefore);
  });

  test('persists grocery ticks across a reload', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.getByRole('tab', { name: 'Groceries' }).click();
    const first = page.locator('.pv-grocery-row input').first();
    await first.check();
    await expect(first).toBeChecked();

    await page.reload();
    await page.getByRole('tab', { name: 'Groceries' }).click();
    await expect(page.locator('.pv-grocery-row input').first()).toBeChecked();
  });

  test('prints all seven days without the site chrome', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.pv-screen')).toBeHidden();
    await expect(page.locator('.print-only')).toBeVisible();
    expect(await page.locator('.print-only h2').count()).toBeGreaterThanOrEqual(7);
    await expect(page.getByRole('button', { name: 'Swap' }).first()).toBeHidden();
  });

  test('renders plate rules for hostel users', async ({ page }) => {
    await seedPlan(page, HOSTEL);
    await page.goto('/my-plan/');
    await expect(page.getByText('Build your plate').first()).toBeVisible();
    await expect(page.getByText('2 idli + extra sambar').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Choose a day' })).toHaveCount(0);
    await expect(page.getByText('Download as PDF')).toBeVisible();
  });

  test('renders guidance with no numbers', async ({ page }) => {
    await seedPlan(page, TEEN);
    await page.goto('/my-plan/');
    await expect(page.locator('[data-kind="guidance"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /simple meals/i })).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/kcal|\d+\s?g protein|\d+\s?kg/i);
    await expect(page.getByText(/parent or doctor/i).first()).toBeVisible();
    await expect(page.getByText('Download as PDF')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Groceries' })).toHaveCount(0);
    await expect(page.locator('.pv-stat')).toHaveCount(0);
  });

  test('adds one follow link on the plan page', async ({ page }) => {
    await seedPlan(page, KERALA_PCOS);
    await page.goto('/my-plan/');
    const follow = page.locator('a[data-umami-event="follow_click"]');
    await expect(follow.first()).toHaveAttribute('href', 'https://www.instagram.com/hiteshdhayal/');
    await expect(follow.first()).toHaveAttribute('target', '_blank');
  });

  test('the Preact follow mirror matches the Astro FollowLink', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.getByRole('tab', { name: 'Progress' }).click();

    const attributes = [
      'href',
      'target',
      'rel',
      'aria-label',
      'data-umami-event',
      'data-umami-event-location',
    ];
    const read = (selector: string) =>
      page
        .locator(selector)
        .evaluate((el, list) => list.map((name) => el.getAttribute(name)), attributes);

    const astro = await read('.pv-follow-actions a[data-umami-event="follow_click"]');
    const preact = await read('#panel-progress a[data-umami-event="follow_click"]');
    expect(preact).toEqual(astro);
  });

  test('edit answers rebuilds the plan', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.getByRole('link', { name: 'Edit answers' }).click();
    await expect(page).toHaveURL(/\/plan\/\?edit=1/);
    await expect(page.locator('.qc-legend')).toHaveText('Check your answers');

    await page
      .locator('.qc-review-row')
      .filter({ hasText: 'How do you eat?' })
      .getByRole('button', { name: 'Edit' })
      .click();
    await page.getByText('Eggetarian (veg + eggs)', { exact: true }).click();
    await expect(page.locator('.qc-legend')).toHaveText('Check your answers');
    await page.getByRole('button', { name: /Build my plan/ }).click();
    await page.waitForURL('**/my-plan/');
    await expect(page.getByText('Eggetarian', { exact: true })).toBeVisible();
  });

  test('has no horizontal scroll', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    const noScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noScroll).toBe(true);
  });
});

test.describe('plan page axe', () => {
  test.skip(({ viewport }) => viewport?.width === 768, 'axe runs at 375 and 1440');

  test('empty state', async ({ page }) => {
    await page.goto('/my-plan/');
    await noViolations(page);
  });

  test('recipes', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await noViolations(page);
  });

  test('plate rules', async ({ page }) => {
    await seedPlan(page, HOSTEL);
    await page.goto('/my-plan/');
    await noViolations(page);
  });

  test('guidance', async ({ page }) => {
    await seedPlan(page, TEEN);
    await page.goto('/my-plan/');
    await noViolations(page);
  });

  test('swap sheet open', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.getByRole('button', { name: 'Swap' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noViolations(page);
  });
});
