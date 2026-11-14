/**
 * Phase 6 screenshots (Part H.1): home, kitchen section (Kerala), FAQ open,
 * /about/, each legal page, at 375 and 1440, against the production build.
 */
import { chromium } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const outDir = 'docs/screenshots/phase-6';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  for (const viewport of [
    { name: '375', width: 375, height: 812 },
    { name: '1440', width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    // Blanket `animation: none !important` would leave any element whose
    // *base* (unconditional) rule is opacity: 0 — like .section-reveal —
    // stuck invisible, since that's exactly what the animation was there to
    // override. prefers-reduced-motion is what the CSS itself is written
    // against (global.css sets .section-reveal{opacity:1} for it), so it
    // renders every section correctly without fighting the stylesheet.

    // Home, full page.
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/home-${viewport.name}.png`, fullPage: true });

    // Kitchen section with Kerala selected.
    await page.locator('[data-state="KL"]').scrollIntoViewIfNeeded();
    await page.locator('[data-state="KL"]').click();
    await page.waitForTimeout(150);
    await page.locator('#kitchen').screenshot({ path: `${outDir}/kitchen-kerala-${viewport.name}.png` });

    // FAQ open.
    await page.locator('#faq .accordion-item summary').first().scrollIntoViewIfNeeded();
    await page.locator('#faq .accordion-item summary').first().click();
    await page.waitForTimeout(150);
    await page.locator('#faq').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await page.locator('#faq').screenshot({ path: `${outDir}/faq-open-${viewport.name}.png` });

    // /about/ top of page.
    await page.goto(`${baseUrl}/about/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${outDir}/about-${viewport.name}.png` });

    // Each legal page, top of page.
    for (const slug of ['disclaimer', 'privacy', 'affiliate-disclosure', 'terms']) {
      await page.goto(`${baseUrl}/${slug}/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${outDir}/${slug}-${viewport.name}.png` });
    }

    await context.close();
  }
} finally {
  await browser.close();
}

// Sample OG images, one per type. The reel/exercise types are draft-only
// content (no page in the production build), so those two come from
// dist-drafts/ (SHOW_DRAFTS=1 pnpm build) instead.
const ogSamples = {
  'og-home.png': 'dist/og/home.png',
  'og-tool.png': 'dist/og/tools-bmi.png',
  'og-article.png': 'dist-drafts/og/articles-top-5-supplement-brands-india.png',
  'og-reel.png': 'dist-drafts/og/reels-pcod-diet-basics.png',
  'og-exercise.png': 'dist-drafts/og/learn-push-up.png',
};
for (const [dest, src] of Object.entries(ogSamples)) {
  try {
    await copyFile(src, `${outDir}/${dest}`);
  } catch {
    console.warn(`Skipped ${dest}: ${src} not found (draft-only page — build with SHOW_DRAFTS=1 first).`);
  }
}

console.log(`Screenshots written to ${outDir}/`);
