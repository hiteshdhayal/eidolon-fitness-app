import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:4321';
const targets = [
  { name: 'home', path: '/' },
  { name: 'styleguide', path: '/styleguide/' },
];
const viewports = [
  { name: '375', width: 375, height: 812 },
  { name: '1440', width: 1440, height: 900 },
];

await mkdir('docs/screenshots', { recursive: true });

const browser = await chromium.launch();
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    for (const target of targets) {
      await page.goto(`${baseUrl}${target.path}`, { waitUntil: 'networkidle' });
      // Fixed bars sit at the viewport edge; hide them so full-page shots read cleanly.
      await page.addStyleTag({ content: 'aside.fixed { display: none !important; }' });
      const file = `docs/screenshots/${target.name}-${viewport.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(`saved ${file}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
