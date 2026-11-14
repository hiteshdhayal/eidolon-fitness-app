/**
 * Phase 3 design-review screenshots. Run with:
 *   pnpm exec tsx scripts/screenshots-phase3.ts
 * Expects a preview server at http://127.0.0.1:4331.
 */
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { AnswersSchema } from '../src/lib/engine/schema';
import { buildPlan, groceryListFor } from '../src/lib/engine/index';
import { FOODS } from '../src/data/foods/index';
import { PERSONAS } from '../tests/unit/personas';
import type { AnswersInput, Plan } from '../src/lib/engine/types';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4331';
const OUT = 'docs/screenshots/phase-3';

const quiet = `*,*::before,*::after{animation:none!important;transition:none!important}.qc-next-wrap{position:static!important;margin-inline:0!important}`;

async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: quiet });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.locator('main').screenshot({ path: `${OUT}/${name}.png` });
}

async function seedPlan(page: Page, persona: AnswersInput) {
  const answers = AnswersSchema.parse(persona);
  const plan: Plan = buildPlan(answers, FOODS, { now: new Date('2026-11-13T10:00:00Z') });
  const groceries = groceryListFor(plan, answers, FOODS);
  const saved = { v: 1, answers, plan, groceries, savedAt: '2026-11-13T10:00:00Z' };
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: 'eidolon:plan:v1', value: JSON.stringify(saved) },
  );
}

async function seedDraft(page: Page, answers: Record<string, unknown>, stepId: string) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    {
      key: 'eidolon:draft:v1',
      value: JSON.stringify({ v: 1, answers, stepId, updatedAt: '2026-11-13T10:00:00Z' }),
    },
  );
}

async function planPage(browser: Browser, width: number, height: number, persona: AnswersInput) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await seedPlan(page, persona);
  await page.goto(`${BASE}/my-plan/`);
  await page.waitForSelector('.pv-stat, .pv-guidance-headline');
  return { context, page };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  // --- /plan at 375 -------------------------------------------------------
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/plan/`);
    await page.waitForSelector('h1');
    await shot(page, 'plan-375-intro');

    await page.getByRole('button', { name: /^Start/ }).click();
    await page.getByRole('radio', { name: /^Lose fat/ }).focus();
    await page.keyboard.press('Space');
    await shot(page, 'plan-375-single');
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const answers = { ...PERSONAS.keralaPcosNonveg, sex: 'female', age: 31 };
    await seedDraft(page, answers as Record<string, unknown>, 'conditions');
    await page.goto(`${BASE}/plan/?step=conditions`);
    await page.getByRole('button', { name: /Continue where you left off/ }).click();
    await page.getByText('Low iron / anaemia', { exact: true }).click();
    await shot(page, 'plan-375-conditions');
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await seedDraft(page, PERSONAS.vegHaryanaMale as Record<string, unknown>, 'state');
    await page.goto(`${BASE}/plan/?step=state`);
    await page.getByRole('button', { name: /Continue where you left off/ }).click();
    await page.locator('.qc-combobox input').click();
    await page.waitForSelector('.qc-listbox');
    await shot(page, 'plan-375-combobox');
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await seedDraft(page, PERSONAS.vegHaryanaMale as Record<string, unknown>, 'review');
    await page.goto(`${BASE}/plan/?step=review`);
    await page.getByRole('button', { name: /Continue where you left off/ }).click();
    await page.waitForSelector('.qc-review');
    await shot(page, 'plan-375-review');
    await context.close();
  }

  // --- /plan at 1440 ------------------------------------------------------
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/plan/`);
    await page.getByRole('button', { name: /^Start/ }).click();
    await page.getByRole('radio', { name: /^Lose fat/ }).focus();
    await page.keyboard.press('Space');
    await shot(page, 'plan-1440-question');
    await context.close();
  }

  // --- /my-plan recipes at 375 and 1440 ----------------------------------
  for (const [width, height] of [
    [375, 812],
    [1440, 900],
  ] as const) {
    const { context, page } = await planPage(browser, width, height, PERSONAS.vegHaryanaMale);
    await shot(page, `my-plan-${width}-recipes`);

    await page.getByRole('button', { name: 'Swap' }).first().click();
    await page.waitForSelector('dialog[open]');
    await page.addStyleTag({ content: quiet });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/my-plan-${width}-swap.png` });
    await page.keyboard.press('Escape');

    await page.getByRole('tab', { name: 'Groceries' }).click();
    await shot(page, `my-plan-${width}-groceries`);
    await context.close();
  }

  // --- plateRules and guidance at 375 and 1440 ---------------------------
  for (const [width, height] of [
    [375, 812],
    [1440, 900],
  ] as const) {
    {
      const { context, page } = await planPage(browser, width, height, PERSONAS.hostel);
      await page.waitForSelector('.pv-plate-rule');
      await shot(page, `my-plan-${width}-plate-rules`);
      await context.close();
    }
    {
      const { context, page } = await planPage(browser, width, height, PERSONAS.teen);
      await page.waitForSelector('.pv-guidance-headline');
      await shot(page, `my-plan-${width}-guidance`);
      await context.close();
    }
  }

  // --- print preview: first day and last page ----------------------------
  {
    const { context, page } = await planPage(browser, 375, 812, PERSONAS.vegHaryanaMale);
    await page.emulateMedia({ media: 'print' });
    await page.addStyleTag({ content: quiet });
    await page.waitForTimeout(200);
    await page
      .locator('.pv-print-day')
      .first()
      .screenshot({ path: `${OUT}/print-page-1.png` });
    await page.locator('.pv-print-tail').screenshot({ path: `${OUT}/print-last-page.png` });
    await context.close();
  }

  await browser.close();
  console.log('Phase 3 screenshots written to', OUT);
}

await main();
