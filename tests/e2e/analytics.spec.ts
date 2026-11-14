import { test, expect, type Page } from '@playwright/test';
import { draftsBaseURL } from '../../playwright.config';
import { fillQuestionnaire, VEG_HARYANA } from './helpers';

/**
 * Analytics event audit (spec Phase 6 Part D). Stubs window.umami and walks
 * a full persona flow, asserting each event name/payload and that no
 * payload ever carries personal data or an out-of-range number. reel_open
 * is exercised against the SHOW_DRAFTS preview server (draftsBaseURL),
 * since every reel is draft: true and the production build never generates
 * a page for one. affiliate_click has no real link to click yet (every
 * seed product's affiliateUrl is '') — it's covered by
 * tests/unit/productCard.test.ts instead.
 */

const BANNED_KEYS = [
  'age',
  'weight',
  'weightKg',
  'height',
  'heightCm',
  'conditions',
  'medications',
  'firstName',
  'waist',
];

interface TrackedEvent {
  name: string;
  data?: Record<string, unknown>;
}

/**
 * Stubs window.umami.track and, since the real Umami script is never
 * loaded here (site.umamiWebsiteId is empty by default — see the assertion
 * below), also replicates its click delegation on [data-umami-event]
 * elements: a click fires track(name, {...the data-umami-event-* attrs}).
 */
async function stubUmami(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __umamiEvents: TrackedEvent[] }).__umamiEvents = [];
    (window as unknown as { umami: unknown }).umami = {
      track: (name: string, data?: Record<string, unknown>) => {
        (window as unknown as { __umamiEvents: TrackedEvent[] }).__umamiEvents.push({
          name,
          data,
        });
      },
    };

    document.addEventListener(
      'click',
      (event) => {
        const el = (event.target as Element | null)?.closest('[data-umami-event]');
        if (!el) return;
        const name = el.getAttribute('data-umami-event');
        if (!name) return;
        const data: Record<string, string> = {};
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-umami-event-')) {
            data[attr.name.slice('data-umami-event-'.length)] = attr.value;
          }
        }
        const umami = (window as unknown as { umami: { track: (n: string, d?: object) => void } })
          .umami;
        umami.track(name, Object.keys(data).length > 0 ? data : undefined);
      },
      true,
    );
  });
}

async function events(page: Page): Promise<TrackedEvent[]> {
  return page.evaluate(
    () => (window as unknown as { __umamiEvents: TrackedEvent[] }).__umamiEvents,
  );
}

function assertNoPersonalData(all: TrackedEvent[]) {
  for (const event of all) {
    if (!event.data) continue;
    for (const [key, value] of Object.entries(event.data)) {
      expect(BANNED_KEYS, `event "${event.name}" carried a banned key "${key}"`).not.toContain(
        key,
      );
      if (key !== 'step' && typeof value === 'number') {
        const inRange = value >= 30 && value <= 250;
        expect(
          inRange,
          `event "${event.name}" carried a number ${value} in the 30-250 range for key "${key}"`,
        ).toBe(false);
      }
    }
  }
}

test.describe('analytics events', () => {
  test('a full persona flow fires the right events with only allowed data', async ({ page }) => {
    const requestsToStats: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('stats.eidolon.cloud')) requestsToStats.push(request.url());
    });

    await stubUmami(page);

    // home
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // plan -> build (plan_start, plan_step, plan_complete)
    await fillQuestionnaire(page, VEG_HARYANA);
    await expect(page).toHaveURL(/\/my-plan\/?$/);

    // swap a meal (no analytics event is specified for this; just exercises
    // the flow per the spec's instructed walk)
    await page.getByRole('button', { name: 'Swap' }).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.locator('.pv-swap-option').first()).toBeVisible();
    await sheet.locator('.pv-swap-option').first().click();

    // PDF (pdf_download)
    await page.getByText('Download as PDF').click();

    // progress log (progress_log)
    await page.getByRole('tab', { name: 'Progress' }).click();
    await page.locator('#pv-weight').fill('70');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.locator('[aria-live="polite"]')).toContainText('Check-in saved.');

    // follow click (follow_click)
    await page.locator('a[data-umami-event="follow_click"]').first().click();

    const fired = await events(page);
    const names = fired.map((e) => e.name);

    expect(names).toContain('plan_start');
    expect(names).toContain('plan_step');
    expect(names).toContain('plan_complete');
    expect(names).toContain('pdf_download');
    expect(names).toContain('progress_log');
    expect(names).toContain('follow_click');

    const complete = fired.find((e) => e.name === 'plan_complete');
    expect(Object.keys(complete?.data ?? {}).sort()).toEqual(['dietType', 'goal', 'region']);

    const step = fired.find((e) => e.name === 'plan_step');
    expect(typeof step?.data?.step).toBe('number');

    const follow = fired.find((e) => e.name === 'follow_click');
    expect(typeof follow?.data?.location).toBe('string');

    for (const name of ['pdf_download', 'progress_log', 'plan_start']) {
      const event = fired.find((e) => e.name === name);
      expect(event?.data ?? {}).toEqual({});
    }

    assertNoPersonalData(fired);

    // umamiWebsiteId is empty by default: never actually request the script
    expect(requestsToStats).toEqual([]);
  });

  test('reel_open fires with the reel slug (SHOW_DRAFTS preview, no published reel in prod)', async ({
    page,
  }) => {
    await stubUmami(page);
    await page.goto(`${draftsBaseURL}/reels/pcod-diet-basics/`);
    await page.getByRole('link', { name: 'Watch on Instagram' }).click();

    const fired = await events(page);
    const reelOpen = fired.find((e) => e.name === 'reel_open');
    expect(reelOpen).toBeTruthy();
    expect(reelOpen?.data).toEqual({ reel: 'pcod-diet-basics' });
    assertNoPersonalData(fired);
  });
});
