import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { buildPlan, groceryListFor } from '../src/lib/engine/index';
import { FOODS } from '../src/data/foods/index';
import { AnswersSchema } from '../src/lib/engine/schema';
import { answersFor, HOSTEL, TEEN, VEG_HARYANA } from '../tests/e2e/helpers';
import { DRAFT_KEY, PLAN_KEY } from '../src/lib/storage';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const variant = process.env.VARIANT ?? 'after';
const outDir = 'docs/screenshots/phase-3.1';
await mkdir(outDir, { recursive: true });

type Persona = Parameters<typeof answersFor>[0];

function savedPlan(persona: Persona) {
  const answers = AnswersSchema.parse(answersFor(persona));
  const plan = buildPlan(answers, FOODS, { now: new Date('2026-11-13T10:00:00Z') });
  const groceries = groceryListFor(plan, answers, FOODS);
  return { v: 1, answers, plan, groceries, savedAt: '2026-11-13T10:00:00Z' };
}

const REVEAL =
  'aside.sticky-cta{display:none!important}.qc-next-wrap{position:static!important}' +
  '*,*::before,*::after{animation:none!important;transition:none!important}' +
  '.section-reveal{opacity:1!important;transform:none!important}';

const browser = await chromium.launch();

interface ShotOptions {
  url: string;
  viewport: { width: number; height: number };
  persona?: Persona;
  draft?: Record<string, unknown>;
  step?: string;
  fullPage?: boolean;
}

async function capture(name: string, options: ShotOptions) {
  const context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();

  if (options.persona) {
    const saved = JSON.stringify(savedPlan(options.persona));
    await page.addInitScript(
      ({ key, value }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      },
      { key: PLAN_KEY, value: saved },
    );
  }
  if (options.draft) {
    const draft = JSON.stringify({
      v: 1,
      answers: options.draft,
      stepId: options.step,
      updatedAt: '2026-11-13T10:00:00Z',
    });
    await page.addInitScript(
      ({ key, value }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      },
      { key: DRAFT_KEY, value: draft },
    );
  }

  await page.goto(`${baseUrl}${options.url}`, { waitUntil: 'networkidle' });
  if (options.step) {
    const resume = page.getByRole('button', { name: /Continue where you left off/ });
    if (await resume.count()) {
      await resume.first().click();
      await page.waitForTimeout(300);
    }
  }
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: REVEAL });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: options.fullPage ?? true });
  console.log('shot', name);
  await context.close();
}

const desktop = { width: 1440, height: 900 };
const mobile = { width: 375, height: 812 };

if (variant === 'before') {
  await capture('my-plan-recipes-before-1440', {
    url: '/my-plan/',
    viewport: desktop,
    persona: VEG_HARYANA,
  });
  await capture('my-plan-recipes-before-375', {
    url: '/my-plan/',
    viewport: mobile,
    persona: VEG_HARYANA,
  });
} else {
  await capture('my-plan-recipes-1440', {
    url: '/my-plan/',
    viewport: desktop,
    persona: VEG_HARYANA,
  });
  await capture('my-plan-recipes-375', {
    url: '/my-plan/',
    viewport: mobile,
    persona: VEG_HARYANA,
  });
  await capture('my-plan-platerules-1440', {
    url: '/my-plan/',
    viewport: desktop,
    persona: HOSTEL,
  });
  await capture('my-plan-platerules-375', { url: '/my-plan/', viewport: mobile, persona: HOSTEL });
  await capture('my-plan-guidance-1440', { url: '/my-plan/', viewport: desktop, persona: TEEN });
  await capture('my-plan-guidance-375', { url: '/my-plan/', viewport: mobile, persona: TEEN });
  await capture('my-plan-empty-1440', { url: '/my-plan/', viewport: desktop });
  await capture('my-plan-empty-375', { url: '/my-plan/', viewport: mobile });

  await capture('plan-intro-1440', { url: '/plan/', viewport: desktop, fullPage: false });
  await capture('plan-intro-375', { url: '/plan/', viewport: mobile, fullPage: false });

  for (const [label, viewport] of [
    ['1440', desktop],
    ['375', mobile],
  ] as const) {
    await capture(`plan-single-${label}`, {
      url: '/plan/',
      viewport,
      draft: answersFor(VEG_HARYANA),
      step: 'goal',
      fullPage: false,
    });
    await capture(`plan-targetweight-${label}`, {
      url: '/plan/',
      viewport,
      draft: answersFor(VEG_HARYANA),
      step: 'targetWeight',
      fullPage: false,
    });
    await capture(`plan-review-${label}`, {
      url: '/plan/',
      viewport,
      draft: answersFor(VEG_HARYANA),
      step: 'review',
      fullPage: false,
    });
  }

  await capture('home-hero-1366x768', {
    url: '/',
    viewport: { width: 1366, height: 768 },
    fullPage: false,
  });
  await capture('home-hero-375x812', { url: '/', viewport: mobile, fullPage: false });
}

await browser.close();
console.log('done', variant);
