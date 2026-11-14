import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { buildPlan, groceryListFor } from '../src/lib/engine/index';
import { FOODS } from '../src/data/foods/index';
import { AnswersSchema } from '../src/lib/engine/schema';
import { answersFor, VEG_HARYANA, type UiPersona } from '../tests/e2e/helpers';
import { addDays, todayLocal } from '../src/lib/progress/dates';
import { PLAN_KEY, PROGRESS_KEY } from '../src/lib/storage';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const outDir = 'docs/screenshots/phase-4';
await mkdir(outDir, { recursive: true });

const TODAY = todayLocal();
const PERSONA: UiPersona = { ...VEG_HARYANA, targetWeight: 75 };
const dateAgo = (n: number) => addDays(TODAY, -n);

const REVEAL =
  'aside.sticky-cta{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}' +
  '.section-reveal{opacity:1!important;transform:none!important}';

type EntryInput = { daysAgo: number; weightKg: number; waistCm?: number };

function planBundle(persona: UiPersona, savedAtIso: string) {
  const answers = AnswersSchema.parse(answersFor(persona));
  const plan = buildPlan(answers, FOODS, { now: new Date(savedAtIso) });
  const groceries = groceryListFor(plan, answers, FOODS);
  return { v: 1, answers, plan, groceries, savedAt: savedAtIso };
}

function progressBundle(entries: EntryInput[]) {
  return {
    v: 1,
    entries: entries
      .map((item, index) => ({
        id: `e-${index}`,
        date: dateAgo(item.daysAgo),
        weightKg: item.weightKg,
        ...(item.waistCm !== undefined ? { waistCm: item.waistCm } : {}),
        createdAt: `${dateAgo(item.daysAgo)}T00:00:00.000Z`,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    dismissedRules: {},
  };
}

const browser = await chromium.launch();
const desktop = { width: 1440, height: 900 };
const mobile = { width: 375, height: 812 };

async function open(
  viewport: { width: number; height: number },
  options: { persona?: UiPersona; savedAtIso?: string; entries?: EntryInput[] } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (options.persona && options.savedAtIso) {
    const value = JSON.stringify(planBundle(options.persona, options.savedAtIso));
    await page.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
      key: PLAN_KEY,
      data: value,
    });
  }
  if (options.entries) {
    const value = JSON.stringify(progressBundle(options.entries));
    await page.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
      key: PROGRESS_KEY,
      data: value,
    });
  }
  await page.goto(`${baseUrl}/my-plan/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: REVEAL });
  return { context, page };
}

async function openProgress(page: Page) {
  await page.getByRole('tab', { name: 'Progress' }).click();
  await page.locator('#pv-weight').waitFor();
  await page.waitForTimeout(200);
}

async function shoot(page: Page, name: string, selector?: string, fullPage = false) {
  if (selector) await page.locator(selector).screenshot({ path: `${outDir}/${name}.png` });
  else await page.screenshot({ path: `${outDir}/${name}.png`, fullPage });
  console.log('shot', name);
}

const weekData: EntryInput[] = [84, 70, 56, 42, 28, 21, 14, 7, 0].map((daysAgo) => ({
  daysAgo,
  weightKg:
    daysAgo === 84
      ? 95
      : daysAgo === 70
        ? 94
        : daysAgo === 56
          ? 93
          : daysAgo === 42
            ? 92
            : daysAgo === 28
              ? 91
              : daysAgo === 21
                ? 90.5
                : daysAgo === 14
                  ? 90
                  : daysAgo === 7
                    ? 88.92
                    : 87.85,
}));

const bigChangeData: EntryInput[] = [
  { daysAgo: 28, weightKg: 80 },
  { daysAgo: 21, weightKg: 79.6 },
  { daysAgo: 14, weightKg: 79.3 },
  { daysAgo: 7, weightKg: 79 },
  { daysAgo: 0, weightKg: 78.5 },
];

const plateauData: EntryInput[] = [
  { daysAgo: 84, weightKg: 81 },
  { daysAgo: 70, weightKg: 80.5 },
  { daysAgo: 56, weightKg: 80.3 },
  { daysAgo: 42, weightKg: 80.2 },
  { daysAgo: 28, weightKg: 80.1 },
  { daysAgo: 22, weightKg: 80 },
  { daysAgo: 14, weightKg: 80.1 },
  { daysAgo: 7, weightKg: 80 },
  { daysAgo: 0, weightKg: 79.9 },
];

for (const [label, viewport] of [
  ['1440', desktop],
  ['375', mobile],
] as const) {
  // Empty tracker.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
    });
    await openProgress(page);
    await shoot(page, `progress-empty-${label}`, '#panel-progress');
    await context.close();
  }

  // 12 weeks of data: chart, summary, fastLoss card, history.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
      entries: weekData,
    });
    await openProgress(page);
    await shoot(page, `progress-data-${label}`, '#panel-progress');
    await context.close();
  }

  // bigChange card.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
      entries: bigChangeData,
    });
    await openProgress(page);
    await shoot(page, `progress-bigchange-${label}`, '#panel-progress');
    await context.close();
  }

  // plateau card.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
      entries: plateauData,
    });
    await openProgress(page);
    await shoot(page, `progress-plateau-${label}`, '#panel-progress');
    await context.close();
  }

  // Weekly nudge at the top of /my-plan.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(10)}T09:00:00+05:30`,
      entries: [{ daysAgo: 9, weightKg: 82 }],
    });
    await shoot(page, `nudge-${label}`, '.pv-hero');
    await context.close();
  }

  // Data section.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
    });
    await shoot(page, `data-section-${label}`, '.pv-data-section');
    await context.close();
  }

  // Import confirm panel.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
      entries: [
        { daysAgo: 7, weightKg: 82 },
        { daysAgo: 0, weightKg: 81 },
      ],
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export my data' }).click(),
    ]);
    await page.locator('input[type="file"]').setInputFiles((await download.path())!);
    await page.locator('.pv-data-confirm').waitFor();
    await shoot(page, `import-confirm-${label}`, '.pv-data-confirm');
    await context.close();
  }

  // Delete dialog.
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
    });
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await page.locator('#pv-delete[open]').waitFor();
    await page.waitForTimeout(200);
    await shoot(page, `delete-dialog-${label}`);
    await context.close();
  }

  // Review screen from "Update my plan".
  {
    const { context, page } = await open(viewport, {
      persona: PERSONA,
      savedAtIso: `${dateAgo(1)}T09:00:00+05:30`,
      entries: bigChangeData,
    });
    await openProgress(page);
    await page.getByRole('link', { name: 'Update my plan' }).click();
    await page.waitForURL(/\/plan\/\?edit=1&weight=78\.5/);
    await page.locator('.qc-legend').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await shoot(page, `update-review-${label}`);
    await context.close();
  }
}

await browser.close();
console.log('done');
