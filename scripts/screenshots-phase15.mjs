import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const heroState = process.env.HERO_STATE ?? 'none';
const outDir = 'docs/screenshots/phase-1.5';

const widths = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const viewport of widths) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const prepare = async (path) => {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content:
          'aside.sticky-cta { display: none !important; } .section-reveal, .reveal-line > span, .hero-fade { opacity: 1 !important; transform: none !important; animation: none !important; }',
      });
    };

    await prepare('/');
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.7;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/home-${viewport.name}.png`, fullPage: true });

    if (viewport.width === 375 || viewport.width === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${outDir}/hero-${viewport.name}-${heroState}.png` });
    }

    if (viewport.width === 1440) {
      await prepare('/styleguide/');
      await page.screenshot({ path: `${outDir}/styleguide-1440.png`, fullPage: true });
    }

    if (viewport.width === 375) {
      await prepare('/plan/');
      await page.screenshot({ path: `${outDir}/plan-stub-375.png`, fullPage: true });
    }

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`Screenshots written to ${outDir} (hero state: ${heroState})`);
