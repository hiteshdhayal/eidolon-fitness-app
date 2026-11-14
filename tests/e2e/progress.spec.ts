import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPlan, groceryListFor } from '../../src/lib/engine/index';
import { FOODS } from '../../src/data/foods/index';
import { AnswersSchema } from '../../src/lib/engine/schema';
import { PLAN_KEY, PROGRESS_KEY } from '../../src/lib/storage';
import { addDays } from '../../src/lib/progress/dates';
import { answersFor, VEG_HARYANA, TEEN, type UiPersona } from './helpers';

const TODAY = '2026-11-14';
const FIXED_TIME = new Date('2026-11-14T09:00:00+05:30');
const PERSONA: UiPersona = { ...VEG_HARYANA, targetWeight: 75 };

test.skip(({ viewport }) => viewport?.width === 768, 'progress suite runs at 375 and 1440');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(() => {
    localStorage.setItem('unrelated-key', 'keep me');
  });
});

const dateAgo = (days: number) => addDays(TODAY, -days);

async function seedSavedPlan(page: Page, persona: UiPersona, savedAtIso: string) {
  const answers = AnswersSchema.parse(answersFor(persona));
  const plan = buildPlan(answers, FOODS, { now: new Date(savedAtIso) });
  const groceries = groceryListFor(plan, answers, FOODS);
  const saved = { v: 1, answers, plan, groceries, savedAt: savedAtIso };
  await page.addInitScript(
    ({ key, flag, value }) => {
      // Seed once per context; the flag is not an `eidolon:` key, so
      // "Delete everything" does not cause a re-seed on the next navigation.
      if (!localStorage.getItem(flag)) {
        localStorage.setItem(key, value);
        localStorage.setItem(flag, '1');
      }
    },
    { key: PLAN_KEY, flag: 'seeded:plan', value: JSON.stringify(saved) },
  );
}

async function seedEntries(
  page: Page,
  list: { daysAgo: number; weightKg: number; waistCm?: number }[],
) {
  const entries = list
    .map((item, index) => ({
      id: `seed-${index}`,
      date: dateAgo(item.daysAgo),
      weightKg: item.weightKg,
      ...(item.waistCm !== undefined ? { waistCm: item.waistCm } : {}),
      createdAt: `${dateAgo(item.daysAgo)}T00:00:00.000Z`,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const value = JSON.stringify({ v: 1, entries, dismissedRules: {} });
  await page.addInitScript(
    ({ key, flag, data }) => {
      if (!localStorage.getItem(flag)) {
        localStorage.setItem(key, data);
        localStorage.setItem(flag, '1');
      }
    },
    { key: PROGRESS_KEY, flag: 'seeded:entries', data: value },
  );
}

async function openProgress(page: Page) {
  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.locator('#pv-weight')).toBeVisible();
}

async function saveCheckIn(page: Page, weight: string, date?: string) {
  await page.locator('#pv-weight').fill(weight);
  if (date) await page.locator('#pv-date').fill(date);
  await page.getByRole('button', { name: 'Save check-in' }).click();
}

// ---------------------------------------------------------------------------

test('empty tracker shows the form and the empty line, with no chart', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await page.goto('/my-plan/');
  await openProgress(page);
  await expect(page.locator('#pv-weight')).toBeVisible();
  await expect(page.getByText(/Log your weight once a week/)).toBeVisible();
  await expect(page.locator('svg.pv-chart')).toHaveCount(0);
  await expect(page.locator('.pv-summary')).toHaveCount(0);
});

test('logs the first check-in', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await page.goto('/my-plan/');
  await openProgress(page);
  await saveCheckIn(page, '82');
  await expect(page.locator('[aria-live="polite"]')).toContainText('Check-in saved.');
  await expect(page.locator('.pv-table tbody tr')).toHaveCount(1);
  await expect(page.locator('svg.pv-chart')).toHaveCount(0);
});

test('shows the chart with a red current point after a second check-in', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [{ daysAgo: 0, weightKg: 82 }]);
  await page.goto('/my-plan/');
  await openProgress(page);
  await saveCheckIn(page, '81', dateAgo(1));
  await expect(page.locator('svg.pv-chart')).toBeVisible();
  await expect(page.locator('.pv-table tbody tr')).toHaveCount(2);

  const fill = await page
    .locator('circle.pv-chart-current')
    .evaluate((el) => getComputedStyle(el).fill);
  const accent = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
  expect(fill).toBe(accent);
});

test('replacing the same date keeps the count', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [{ daysAgo: 5, weightKg: 82 }]);
  await page.goto('/my-plan/');
  await openProgress(page);
  await saveCheckIn(page, '80', dateAgo(5));
  await expect(page.getByText(/This replaces your/)).toBeVisible();
  await saveCheckIn(page, '80', dateAgo(5));
  await expect(page.locator('.pv-table tbody tr')).toHaveCount(1);
});

test('validates weight and blocks a future date', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await page.goto('/my-plan/');
  await openProgress(page);

  await expect(page.locator('#pv-date')).toHaveAttribute('max', TODAY);
  await saveCheckIn(page, '25');
  await expect(page.getByText('Enter a weight between 30 and 250 kg.')).toBeVisible();
  await expect(page.locator('.pv-table')).toHaveCount(0);

  // Force a future value past the native max constraint.
  await page.locator('#pv-date').evaluate((el, value) => {
    const input = el as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, dateAgo(-1));
  await saveCheckIn(page, '82');
  await expect(page.getByText('Pick a date in the last 2 years, not in the future.')).toBeVisible();
  await expect(page.locator('.pv-table')).toHaveCount(0);
});

test('range toggle changes how many points are drawn', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(
    page,
    Array.from({ length: 20 }, (_, index) => ({ daysAgo: index * 7, weightKg: 84 - index * 0.1 })),
  );
  await page.goto('/my-plan/');
  await openProgress(page);

  const points = page.locator('circle.pv-chart-point');
  const points12w = await points.count();

  const toggle = page.locator('.pv-chart-range');
  await toggle.getByRole('button', { name: 'ALL' }).click();
  await expect(toggle.getByRole('button', { name: 'ALL' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const pointsAll = await points.count();

  await toggle.getByRole('button', { name: '4W' }).click();
  const points4w = await points.count();

  expect(points4w).toBeLessThan(pointsAll);
  expect(points12w).toBeLessThan(pointsAll);
  expect(pointsAll).toBe(20);
});

test('summary shows signed change and weekly rate', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [
    { daysAgo: 28, weightKg: 84 },
    { daysAgo: 21, weightKg: 83.4 },
    { daysAgo: 14, weightKg: 82.8 },
    { daysAgo: 7, weightKg: 82.2 },
    { daysAgo: 0, weightKg: 81.6 },
  ]);
  await page.goto('/my-plan/');
  await openProgress(page);

  await expect(page.locator('.pv-summary-value').nth(0)).toHaveText('\u22122.4 kg');
  await expect(page.locator('.pv-summary-value').nth(1)).toHaveText('\u22120.6 kg');
  await expect(page.locator('.pv-summary-value').nth(2)).toHaveText('5');
});

test('fastLoss card shows four suggestions and can be hidden', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [
    { daysAgo: 14, weightKg: 90 },
    { daysAgo: 7, weightKg: 88.92 },
    { daysAgo: 0, weightKg: 87.85 },
  ]);
  await page.goto('/my-plan/');
  await openProgress(page);

  await expect(page.getByText("You're losing faster than you need to")).toBeVisible();
  await expect(page.locator('.pv-suggestion-list li')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'Update my plan' })).toBeVisible();

  await page.getByRole('button', { name: 'Hide this for now' }).click();
  await expect(page.getByText("You're losing faster than you need to")).toBeHidden();
  await page.reload();
  await openProgress(page);
  await expect(page.getByText("You're losing faster than you need to")).toHaveCount(0);
});

test('bigChange card reads the loss and Update my plan rebuilds', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [
    { daysAgo: 7, weightKg: 79 },
    { daysAgo: 0, weightKg: 78.5 },
  ]);
  await page.goto('/my-plan/');
  await openProgress(page);

  await expect(page.getByText(/You've lost 3\.5 kg since your plan was made\./)).toBeVisible();
  await page.getByRole('link', { name: 'Update my plan' }).click();
  await expect(page).toHaveURL(/\/plan\/\?edit=1&weight=78\.5/);
  await expect(
    page.locator('.qc-review-row').filter({ hasText: 'What do you weigh?' }),
  ).toContainText('78.5 kg');

  await page.getByRole('button', { name: /Build my plan/ }).click();
  await page.waitForURL('**/my-plan/');
  await openProgress(page);
  await expect(page.locator('.pv-table tbody tr')).toHaveCount(2);
});

test('plateau card only for a lose goal', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [
    { daysAgo: 22, weightKg: 80 },
    { daysAgo: 14, weightKg: 80.1 },
    { daysAgo: 7, weightKg: 80 },
    { daysAgo: 0, weightKg: 79.9 },
  ]);
  await page.goto('/my-plan/');
  await openProgress(page);
  await expect(page.getByText('Your weight has held steady for 3 weeks')).toBeVisible();
});

test('plateau does not show for a healthier goal', async ({ page }) => {
  await seedSavedPlan(page, { ...PERSONA, goal: 'Eat healthier and get fitter' }, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [
    { daysAgo: 22, weightKg: 80 },
    { daysAgo: 14, weightKg: 80.1 },
    { daysAgo: 7, weightKg: 80 },
    { daysAgo: 0, weightKg: 79.9 },
  ]);
  await page.goto('/my-plan/');
  await openProgress(page);
  await expect(page.getByText('Your weight has held steady for 3 weeks')).toHaveCount(0);
});

test('nudge shows and Not now hides it', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(10)}T09:00:00+05:30`);
  await seedEntries(page, [{ daysAgo: 9, weightKg: 82 }]);
  await page.goto('/my-plan/');
  await expect(page.getByText("It's been a week. Want to log a quick check-in?")).toBeVisible();

  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByText("It's been a week. Want to log a quick check-in?")).toBeHidden();
  await page.reload();
  await expect(page.getByText("It's been a week. Want to log a quick check-in?")).toHaveCount(0);
});

test('Log weight in the nudge opens the Progress tab and focuses the input', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(10)}T09:00:00+05:30`);
  await seedEntries(page, [{ daysAgo: 9, weightKg: 82 }]);
  await page.goto('/my-plan/');
  await page.getByRole('button', { name: 'Log weight' }).click();

  await expect(page.getByRole('tab', { name: 'Progress' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pv-weight')).toBeFocused();
});

test('guidance plan has no Progress tab, no nudge, but keeps data controls', async ({ page }) => {
  await seedSavedPlan(page, TEEN, `${dateAgo(10)}T09:00:00+05:30`);
  await page.goto('/my-plan/');
  await expect(page.locator('[data-kind="guidance"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Progress' })).toHaveCount(0);
  await expect(page.getByText("It's been a week. Want to log a quick check-in?")).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export my data' })).toBeVisible();
});

test('exports a JSON file', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [
    { daysAgo: 7, weightKg: 82 },
    { daysAgo: 0, weightKg: 81 },
  ]);
  await page.goto('/my-plan/');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export my data' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('eidolon-data-2026-11-14.json');
  const path = await download.path();
  const json = JSON.parse(readFileSync(path!, 'utf8'));
  expect(json.app).toBe('eidolon');
  expect(json.exportVersion).toBe(1);
  expect(json.progress.entries).toHaveLength(2);
});

test('imports a valid file and rejects a broken one', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [{ daysAgo: 0, weightKg: 82 }]);
  await page.goto('/my-plan/');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export my data' }).click(),
  ]);
  const exported = await download.path();

  // A fresh context with no plan.
  const fresh = await page.context().browser()!.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto('/my-plan/');
  await expect(freshPage.getByRole('heading', { name: /no plan yet/i })).toBeVisible();
  await freshPage.locator('input[type="file"]').setInputFiles(exported!);
  await expect(freshPage.locator('.pv-data-confirm')).toContainText('1 check-ins');
  await freshPage.locator('.pv-data-confirm').getByRole('button', { name: 'Import' }).click();
  await openProgress(freshPage);
  await expect(freshPage.locator('.pv-table tbody tr')).toHaveCount(1);
  await fresh.close();

  // A broken file leaves storage unchanged.
  const dir = mkdtempSync(join(tmpdir(), 'eidolon-'));
  const brokenPath = join(dir, 'broken.json');
  writeFileSync(brokenPath, 'not json at all');
  await page.locator('input[type="file"]').setInputFiles(brokenPath);
  await expect(
    page.getByText("That file isn't an Eidolon export, or it's damaged. Nothing was changed."),
  ).toBeVisible();
  const stored = await page.evaluate((key) => localStorage.getItem(key), PLAN_KEY);
  expect(stored).not.toBeNull();
});

test('delete everything can be cancelled or confirmed', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await page.goto('/my-plan/');

  await page.getByRole('button', { name: 'Delete everything' }).click();
  const dialog = page.locator('#pv-delete');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: /your plan/i })).toBeVisible();

  await page.getByRole('button', { name: 'Delete everything' }).click();
  await dialog.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('heading', { name: /no plan yet/i })).toBeVisible();

  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('eidolon:')));
  expect(keys).toEqual([]);
  const unrelated = await page.evaluate(() => localStorage.getItem('unrelated-key'));
  expect(unrelated).toBe('keep me');

  await page.goto('/');
  await expect(page.locator('.header-actions a.plan-cta')).toContainText('Build my plan');
});

test.describe('axe', () => {
  test('progress tab with a card, chart and table', async ({ page }) => {
    await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
    await seedEntries(page, [
      { daysAgo: 14, weightKg: 90 },
      { daysAgo: 7, weightKg: 88.92 },
      { daysAgo: 0, weightKg: 87.85 },
    ]);
    await page.goto('/my-plan/');
    await openProgress(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('delete dialog', async ({ page }) => {
    await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
    await page.goto('/my-plan/');
    await page.getByRole('button', { name: 'Delete everything' }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('import confirm panel', async ({ page }) => {
    await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
    await seedEntries(page, [{ daysAgo: 0, weightKg: 82 }]);
    await page.goto('/my-plan/');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export my data' }).click(),
    ]);
    await page.locator('input[type="file"]').setInputFiles((await download.path())!);
    await expect(page.locator('.pv-data-confirm')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test('no horizontal scroll with 100 entries', async ({ page, viewport }) => {
  test.skip(viewport?.width !== 1440, 'the loop sets its own viewports in one project');
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(
    page,
    Array.from({ length: 100 }, (_, index) => ({ daysAgo: index, weightKg: 82 - index * 0.05 })),
  );
  for (const width of [375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await page.goto('/my-plan/');
    await openProgress(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
  }
});

test('progress and data headings line up with the wordmark', async ({ page, viewport }) => {
  test.skip(viewport?.width !== 1440, 'runs once');
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await seedEntries(page, [
    { daysAgo: 14, weightKg: 83 },
    { daysAgo: 0, weightKg: 82 },
  ]);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/my-plan/');
    const wordmark = await page.locator('.site-header .wordmark-text').first().boundingBox();
    await openProgress(page);
    const heading = await page.locator('.pv-progress .pv-subhead').boundingBox();
    expect(Math.abs(heading!.x - wordmark!.x)).toBeLessThanOrEqual(2);

    const dataHeader = await page
      .locator('.pv-screen section[data-surface="obsidian"] .pv-sechead')
      .last()
      .boundingBox();
    expect(Math.abs(dataHeader!.x - wordmark!.x)).toBeLessThanOrEqual(2);
  }
});

test('the nudge does not push the key numbers below the fold at 1440x900', async ({
  page,
  viewport,
}) => {
  test.skip(viewport?.width !== 1440, 'runs once');
  await seedSavedPlan(page, PERSONA, `${dateAgo(10)}T09:00:00+05:30`);
  await seedEntries(page, [{ daysAgo: 9, weightKg: 82 }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/my-plan/');
  await expect(page.getByText("It's been a week. Want to log a quick check-in?")).toBeVisible();
  const grid = await page.locator('.pv-stat-grid').boundingBox();
  expect(grid!.y).toBeLessThan(900);
});

test('print hides the tracker, data controls and nudge', async ({ page }) => {
  await seedSavedPlan(page, PERSONA, `${dateAgo(10)}T09:00:00+05:30`);
  await page.goto('/my-plan/');
  await openProgress(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.pv-progress')).toBeHidden();
  await expect(page.locator('.pv-data')).toBeHidden();
  await expect(page.locator('.pv-screen')).toBeHidden();
});

test('saving a check-in sends progress_log with no data', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __calls: unknown[][] }).__calls = [];
    (window as unknown as { umami: unknown }).umami = {
      track: (event: string, data?: unknown) =>
        (window as unknown as { __calls: unknown[][] }).__calls.push([event, data]),
    };
  });
  await seedSavedPlan(page, PERSONA, `${dateAgo(1)}T09:00:00+05:30`);
  await page.goto('/my-plan/');
  await openProgress(page);
  await saveCheckIn(page, '82');

  const calls = await page.evaluate(
    () => (window as unknown as { __calls: unknown[][] }).__calls,
  );
  expect(calls.map((call) => call[0])).toEqual(['progress_log']);
  expect(calls[0]?.[1] ?? null).toBeNull();

  const serialized = JSON.stringify(calls);
  expect(serialized).not.toMatch(/\b(3[0-9]|[4-9][0-9]|1\d\d|2[0-4]\d|250)\b/);
});
