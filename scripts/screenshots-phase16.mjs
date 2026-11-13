import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const outDir = 'docs/screenshots/phase-1.6';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const viewport of [
    { name: '375', width: 375, height: 812 },
    { name: '768', width: 768, height: 1024 },
    { name: '1440', width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content:
        'aside.sticky-cta{display:none!important}.reveal-line>span,.hero-fade,.hero-stage-col{opacity:1!important;transform:none!important;animation:none!important}',
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/hero-${viewport.name}-slide1.png` });

    await page.locator('[data-go="2"]').click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/hero-${viewport.name}-slide3.png` });

    if (viewport.width === 1440) {
      await page.locator('.controls').screenshot({ path: `${outDir}/controls-1440.png` });
    }

    const cta = page.getByRole('link', { name: /build my plan/i }).first();
    const box = await cta.boundingBox();
    console.log(viewport.name, 'cta', box);
    await context.close();
  }
} finally {
  await browser.close();
}

// Contact sheet: all slides side by side so consistency can be judged.
const slugs = ['01', '02', '03', '04', '05'];
const tileWidth = 320;
const tileHeight = 400;
const gap = 16;
const sheetWidth = slugs.length * tileWidth + (slugs.length - 1) * gap;
const sheetHeight = tileHeight + 44;

const composites = await Promise.all(
  slugs.map(async (slug, index) => {
    const input = `src/assets/hero/processed/slide-${slug}-1080.webp`;
    const buffer = await sharp(input)
      .resize({ width: tileWidth, height: tileHeight, fit: 'cover' })
      .toBuffer();
    return { input: buffer, left: index * (tileWidth + gap), top: 0 };
  }),
);

const labels = slugs
  .map(
    (slug, index) =>
      `<text x="${index * (tileWidth + gap) + 4}" y="${tileHeight + 28}" fill="#8B939D" font-family="monospace" font-size="18" letter-spacing="2">${slug}</text>`,
  )
  .join('');

const labelLayer = Buffer.from(
  `<svg width="${sheetWidth}" height="${sheetHeight}" xmlns="http://www.w3.org/2000/svg">${labels}</svg>`,
);

await sharp({
  create: {
    width: sheetWidth,
    height: sheetHeight,
    channels: 3,
    background: { r: 11, g: 12, b: 14 },
  },
})
  .composite([...composites, { input: labelLayer, left: 0, top: 0 }])
  .png()
  .toFile(`${outDir}/contact-sheet.png`);

console.log('done');
