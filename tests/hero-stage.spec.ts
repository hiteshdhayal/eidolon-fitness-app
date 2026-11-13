import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const HERO_BG = { r: 11, g: 12, b: 14 };
const TOLERANCE = 18;

async function pixelsAt(buffer: Buffer, points: { x: number; y: number }[]) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  return points.map(({ x, y }) => {
    const px = Math.round(x);
    const py = Math.round(y);
    const index = (py * info.width + px) * info.channels;
    return {
      x: px,
      y: py,
      r: data[index] ?? 0,
      g: data[index + 1] ?? 0,
      b: data[index + 2] ?? 0,
    };
  });
}

test.describe('hero stage rotation', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-hero-stage]')).toBeVisible();
    await page.clock.runFor(100);
  });

  test('advances after 5.5s and wraps after the last slide', async ({ page }) => {
    const root = page.locator('[data-hero-stage]');
    await expect(root).toHaveAttribute('data-index', '0');

    await page.clock.runFor(5600);
    await expect(root).toHaveAttribute('data-index', '1');

    await page.clock.runFor(5500 * 3);
    await expect(root).toHaveAttribute('data-index', '4');

    await page.clock.runFor(5500);
    await expect(root).toHaveAttribute('data-index', '0');
  });

  test('pause button stops and resumes rotation', async ({ page }) => {
    const root = page.locator('[data-hero-stage]');
    const pause = page.locator('[data-pause]');

    await expect(pause).toHaveAttribute('aria-label', 'Pause photo rotation');
    await pause.click();
    await expect(pause).toHaveAttribute('aria-label', 'Play photo rotation');

    await page.clock.runFor(12000);
    await expect(root).toHaveAttribute('data-index', '0');

    await pause.click();
    await expect(pause).toHaveAttribute('aria-label', 'Pause photo rotation');
    await page.clock.runFor(5600);
    await expect(root).toHaveAttribute('data-index', '1');
  });

  test('hover and keyboard focus pause rotation', async ({ page }) => {
    const root = page.locator('[data-hero-stage]');
    const stage = page.locator('.stage');
    const hoverCapable = await page.evaluate(() => matchMedia('(hover: hover)').matches);
    let base = 0;

    if (hoverCapable) {
      await stage.hover();
      await page.clock.runFor(12000);
      await expect(root).toHaveAttribute('data-index', '0');

      await page.mouse.move(0, 0);
      await page.clock.runFor(5600);
      await expect(root).toHaveAttribute('data-index', '1');
      base = 1;
    }

    await stage.focus();
    await page.clock.runFor(12000);
    await expect(root).toHaveAttribute('data-index', String(base));

    await stage.blur();
    await page.clock.runFor(5600);
    await expect(root).toHaveAttribute('data-index', String(base + 1));
  });

  test('segments, arrow keys and swipe change slides', async ({ page }) => {
    const root = page.locator('[data-hero-stage]');

    await page.locator('[data-go="2"]').click();
    await expect(root).toHaveAttribute('data-index', '2');

    await page.keyboard.press('ArrowRight');
    await expect(root).toHaveAttribute('data-index', '3');

    await page.keyboard.press('ArrowLeft');
    await expect(root).toHaveAttribute('data-index', '2');

    const stage = page.locator('.stage');
    const box = await stage.boundingBox();
    if (!box) throw new Error('No stage box');

    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5, { steps: 6 });
    await page.mouse.up();

    await expect(root).toHaveAttribute('data-index', '3');
  });

  test('inactive slides are hidden from assistive technology', async ({ page }) => {
    const slides = page.locator('[data-slide]');
    await expect(slides.nth(0)).toHaveAttribute('aria-hidden', 'false');
    await expect(slides.nth(1)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.stage')).toHaveAttribute('aria-live', 'off');

    await page.locator('[data-pause]').click();
    await expect(page.locator('.stage')).toHaveAttribute('aria-live', 'polite');
  });

  test('the primary hero CTA is fully visible in the first 812px at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const cta = page.locator('.hero-copy a.btn-primary');
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(812);
  });

  test('the stage and message are not clipped at 1366x768 or 1920x1080', async ({ page }) => {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      const hero = await page.locator('.hero').boundingBox();
      const strip = await page.locator('.message-strip').boundingBox();
      expect(hero).not.toBeNull();
      expect(strip).not.toBeNull();
      expect(strip!.y + strip!.height).toBeLessThanOrEqual(hero!.y + hero!.height);
    }
  });

  test('the stage has no visible box edge', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);

    const stage = await page.locator('.stage').boundingBox();
    const viewport = page.viewportSize();
    if (!stage || !viewport) throw new Error('No stage box');

    const fractions = [0.05, 0.25, 0.5, 0.75, 0.95];
    const inset = 2;
    const points = [];
    // Edges that coincide with the viewport have no visible boundary to test.
    const checkLeft = stage.x > 0.5;
    const checkRight = stage.x + stage.width < viewport.width - 0.5;
    const checkTop = stage.y > 0.5;

    for (const fraction of fractions) {
      if (checkLeft) points.push({ x: stage.x + inset, y: stage.y + stage.height * fraction });
      if (checkRight) {
        points.push({ x: stage.x + stage.width - inset, y: stage.y + stage.height * fraction });
      }
      if (checkTop) points.push({ x: stage.x + stage.width * fraction, y: stage.y + inset });
      points.push({
        x: stage.x + stage.width * fraction,
        y: stage.y + stage.height - inset,
      });
    }

    const shot = await page.screenshot();
    const samples = await pixelsAt(shot, points);

    for (const sample of samples) {
      expect(
        Math.abs(sample.r - HERO_BG.r) <= TOLERANCE &&
          Math.abs(sample.g - HERO_BG.g) <= TOLERANCE &&
          Math.abs(sample.b - HERO_BG.b) <= TOLERANCE,
        `stage edge pixel at ${sample.x},${sample.y} is ${sample.r},${sample.g},${sample.b}`,
      ).toBe(true);
    }
  });
});

test.describe('hero stage with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('does not auto-rotate and shows no progress animation', async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-hero-stage]')).toBeVisible();
    await page.clock.runFor(100);

    const root = page.locator('[data-hero-stage]');
    await page.clock.runFor(20000);
    await expect(root).toHaveAttribute('data-index', '0');

    const animation = await page
      .locator('.segment.is-current')
      .evaluate((element) => getComputedStyle(element, '::after').animationName);
    expect(animation).toBe('none');
  });
});

test.describe('hero stage without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows slide 1 and the message block', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-slide]').first()).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByText('Every body needs a different diet.')).toBeVisible();

    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      await expect(page.getByText('Yours should fit your goal')).toBeVisible();
      await expect(page.getByText('YOUR GOAL', { exact: true })).toBeVisible();
    }
  });
});
