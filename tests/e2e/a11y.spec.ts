import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { draftsBaseURL } from '../../playwright.config';
import { seedPlan, seedDraft, answersFor, VEG_HARYANA, HOSTEL, TEEN } from './helpers';

/**
 * Accessibility pass (spec Phase 6 Part F.2): axe across every page type and
 * named interactive state, a keyboard walk on home, touch targets at 375,
 * reduced motion, and a muted-text contrast spot check. Runs across all
 * three Playwright projects (375/768/1440) by default; the drafts-only page
 * types (reel/article/exercise/workout/guide/topic detail) use
 * draftsBaseURL, since the production build never generates those pages.
 */

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations;
}

const PROD_PAGES = [
  '/',
  '/plan/',
  '/my-plan/',
  '/reels/',
  '/articles/',
  '/articles/picks/',
  '/learn/',
  '/workouts/',
  '/tools/',
  '/tools/bmi/',
  '/tools/calories/',
  '/tools/protein/',
  '/links/',
  '/about/',
  '/privacy/',
  '/disclaimer/',
  '/affiliate-disclosure/',
  '/terms/',
];

test.describe('axe: production page types', () => {
  for (const path of PROD_PAGES) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  test('404 has no axe violations', async ({ page }) => {
    await page.goto('/this-page-does-not-exist/');
    expect(await axeViolations(page)).toEqual([]);
  });
});

const DRAFT_PAGES = [
  '/reels/pcod-diet-basics/',
  '/articles/top-5-supplement-brands-india/',
  '/learn/push-up/',
  '/workouts/beginner-home-full-body/',
  '/learn/guides/how-to-find-your-step-count/',
  '/reels/topic/pcos/',
];

test.describe('axe: draft-only page types (SHOW_DRAFTS preview)', () => {
  for (const path of DRAFT_PAGES) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(`${draftsBaseURL}${path}`);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test.describe('axe: /plan/ interactive states', () => {
  test('intro screen', async ({ page }) => {
    await page.goto('/plan/');
    expect(await axeViolations(page)).toEqual([]);
  });

  test('a question screen', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('review screen', async ({ page }) => {
    await seedDraft(page, answersFor(VEG_HARYANA), 'review');
    await page.goto('/plan/');
    await expect(page.locator('.qc-legend')).toHaveText('Check your answers');
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('axe: /my-plan/ states', () => {
  test('recipes plan', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await expect(page.locator('[data-kind="recipes"]')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('plate-rules plan (hostel)', async ({ page }) => {
    await seedPlan(page, HOSTEL);
    await page.goto('/my-plan/');
    await expect(page.locator('[data-kind="plateRules"]')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('guidance plan (under 18)', async ({ page }) => {
    await seedPlan(page, TEEN);
    await page.goto('/my-plan/');
    await expect(page.locator('[data-kind="guidance"]')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('Progress tab', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.getByRole('tab', { name: 'Progress' }).click();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('Swap sheet open', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.getByRole('button', { name: 'Swap' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('delete dialog open', async ({ page }) => {
    await seedPlan(page, VEG_HARYANA);
    await page.goto('/my-plan/');
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.locator('#pv-delete')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('axe: home interactive states', () => {
  test('state-kitchen section with a non-default state selected', async ({ page }) => {
    // Scrolled into view like a real visitor browsing down the page, not a
    // direct #hash jump: a hard anchor-jump can land before the scroll-driven
    // .section-reveal animation's view-timeline has settled, which briefly
    // (and only there) renders the section at a partial opacity.
    await page.goto('/');
    await page.locator('[data-state="KL"]').scrollIntoViewIfNeeded();
    await page.locator('[data-state="KL"]').click();
    await expect(page.locator('[data-state="KL"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await axeViolations(page)).toEqual([]);
  });

  test('FAQ with a row open', async ({ page }) => {
    await page.goto('/');
    await page.locator('#faq .accordion-item summary').first().scrollIntoViewIfNeeded();
    await page.locator('#faq .accordion-item summary').first().click();
    await expect(page.locator('#faq .accordion-item').first()).toHaveAttribute('open', '');
    expect(await axeViolations(page)).toEqual([]);
  });

  test('mobile menu open', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1440) >= 1024, 'Menu button is hidden on desktop');
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('keyboard and focus', () => {
  test('tabbing through home shows a visible focus indicator on every stop', async ({ page }) => {
    await page.goto('/');
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const active = page.locator(':focus');
      if ((await active.count()) === 0) break;
      const outline = await active.evaluate((el) => {
        const style = getComputedStyle(el);
        return { outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
      });
      const hasOutline = parseFloat(outline.outlineWidth) >= 2;
      const hasRing = outline.boxShadow !== 'none' && outline.boxShadow !== '';
      const id = await active.evaluate(
        (el) => el.outerHTML.slice(0, 60) + (el.getAttribute('href') ?? ''),
      );
      if (!seen.has(id)) {
        seen.add(id);
        expect(hasOutline || hasRing, `no visible focus on: ${id}`).toBe(true);
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  test('kitchen chips and FAQ rows work with Enter and Space', async ({ page }) => {
    await page.goto('/');
    const chip = page.locator('[data-state="PB"]');
    await chip.scrollIntoViewIfNeeded();
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    const chip2 = page.locator('[data-state="TN"]');
    await chip2.focus();
    await page.keyboard.press(' ');
    await expect(chip2).toHaveAttribute('aria-pressed', 'true');

    const summary = page.locator('#faq .accordion-item summary').first();
    await summary.scrollIntoViewIfNeeded();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#faq .accordion-item').first()).toHaveAttribute('open', '');
  });

  test('mobile menu traps focus and closes with Escape', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1440) >= 1024, 'Menu button is hidden on desktop');
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const closeButton = page.getByRole('button', { name: 'Close menu' });
    await expect(closeButton).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(closeButton).toBeHidden();
  });
});

test.describe('touch targets at 375', () => {
  test('every visible link/button/control in main is at least 44x44', async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 1440) !== 375, 'Only meaningful at the 375 project');
    await page.goto('/');
    const tooSmall = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll('main a, main button, main input, main select, main textarea'),
      );
      const failures: string[] = [];
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue; // not rendered
        // Inline text links inside a paragraph are exempt (spec Part F.2).
        if (el.tagName === 'A' && el.closest('p')) continue;
        if (rect.width < 44 || rect.height < 44) {
          failures.push(`${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${rect.width}x${rect.height}`);
        }
      }
      return failures;
    });
    expect(tooSmall).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const path of ['/', '/plan/', '/my-plan/']) {
    test(`no running animation/transition on ${path}`, async ({ page }) => {
      if (path === '/my-plan/') await seedPlan(page, VEG_HARYANA);
      await page.goto(path);
      // A non-zero computed animation/transition-duration doesn't mean
      // anything is actually playing (Chromium reports a near-zero
      // baseline, e.g. "1e-05s", on essentially every element regardless).
      // getAnimations() reports real, currently-running Web Animations.
      const running = await page.evaluate(() => {
        const getAnimations = document.getAnimations as (opts?: {
          subtree: boolean;
        }) => Animation[];
        return getAnimations
          .call(document, { subtree: true })
          .filter((a) => a.playState === 'running')
          .map((a) => a.id || (a as unknown as { animationName?: string }).animationName || 'unnamed');
      });
      expect(running).toEqual([]);
    });
  }

  test('kinetic band is static', async ({ page }) => {
    await page.goto('/');
    const band = page.locator('.kinetic-band, [data-kinetic-band]').first();
    if ((await band.count()) === 0) return;
    const animation = await band.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation === 'none' || animation === '').toBe(true);
  });
});

test.describe('contrast', () => {
  test('muted text on ice uses steel-500 or darker, never steel-400', async ({ page }) => {
    await page.goto('/');
    const steel400 = await page.evaluate(() => {
      const target = 'rgb(139, 147, 157)'; // --steel-400
      const offenders: string[] = [];
      for (const el of document.querySelectorAll('.text-muted, .small')) {
        // The nearest [data-surface] ancestor is what actually governs this
        // element's colors — a plain descendant selector like
        // `[data-surface="ice"] .text-muted` would also match elements
        // under a *closer* obsidian override nested inside an outer ice
        // one (or vice versa), which isn't what "on ice" means here.
        const surface = el.closest('[data-surface]')?.getAttribute('data-surface');
        if (surface !== 'ice') continue;
        const color = getComputedStyle(el).color;
        if (color === target) offenders.push(el.outerHTML.slice(0, 60));
      }
      return offenders;
    });
    expect(steel400).toEqual([]);
  });
});
