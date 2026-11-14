import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  fillQuestionnaire,
  VEG_HARYANA,
  KERALA_PCOS,
  JAIN_GUJARAT,
  TEEN,
  PREGNANT,
  HOSTEL,
  seedDraft,
  answersFor,
} from './helpers';

async function noViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function clickText(page: import('@playwright/test').Page, text: string) {
  await page.getByText(text, { exact: true }).click();
  await page.waitForTimeout(300);
}

async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}

test.describe('questionnaire personas', () => {
  test.skip(({ viewport }) => viewport?.width === 768, 'personas run at 375 and 1440');

  test('veg male from Haryana gets a veg recipe plan', async ({ page }) => {
    await fillQuestionnaire(page, VEG_HARYANA);
    await expect(page).toHaveURL(/\/my-plan\/?$/);
    const days = page.getByRole('tablist', { name: 'Choose a day' });
    await expect(days.getByRole('tab')).toHaveCount(7);
    await days.getByRole('tab', { name: 'Mon' }).click();
    await expect(page.locator('.pv-meal')).toHaveCount(5);
    await expect(page.locator('.pv-stat')).toHaveCount(7);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\b(chicken|fish|eggs?|mutton)\b/i);
  });

  test('Kerala woman with PCOS sees her health note', async ({ page }) => {
    await fillQuestionnaire(page, KERALA_PCOS);
    await expect(page.getByText('PCOS / PCOD')).toBeVisible();
    const days = page.getByRole('tablist', { name: 'Choose a day' });
    await days.getByRole('tab', { name: 'Mon' }).click();
    await expect(page.locator('.pv-meal')).toHaveCount(3);
  });

  test('Jain user from Gujarat gets Jain-style notes and no aloo gobhi', async ({ page }) => {
    await fillQuestionnaire(page, JAIN_GUJARAT);
    await expect(page.getByText(/Jain-style/).first()).toBeVisible();
    await expect(page.getByText('Aloo gobhi')).toHaveCount(0);
  });

  test('teen gets guidance with no numbers', async ({ page }) => {
    await fillQuestionnaire(page, TEEN);
    await expect(page.locator('[data-kind="guidance"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /simple meals/i })).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/kcal|\d+\s?g protein|\d+\s?kg/i);
    await expect(page.getByText(/parent or doctor/i).first()).toBeVisible();
  });

  test('pregnant user gets guidance with the gynaecologist note', async ({ page }) => {
    await fillQuestionnaire(page, PREGNANT);
    await expect(page.getByText(/gynaecologist/i).first()).toBeVisible();
  });

  test('hostel user gets plate rules', async ({ page }) => {
    await fillQuestionnaire(page, HOSTEL);
    await expect(page.getByText('Build your plate').first()).toBeVisible();
    await expect(page.getByText('2 idli + extra sambar').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Choose a day' })).toHaveCount(0);
  });
});

test.describe('questionnaire behaviour', () => {
  test('autosaves and offers to continue on the next step', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    await clickText(page, 'Lose fat');
    await clickText(page, 'Male');
    await page.locator('#age-input').fill('28');
    await clickNext(page);
    await page.getByRole('button', { name: 'cm', exact: true }).click();
    await page.locator('#height-cm').fill('175');
    await clickNext(page);
    await page.locator('#weight-input').fill('82');
    await clickNext(page);
    await expect(page.locator('.qc-legend')).toHaveText('Do you have a target weight?');

    await page.reload();
    await page.getByRole('button', { name: /Continue where you left off/ }).click();
    await expect(page.locator('.qc-legend')).toHaveText('Do you have a target weight?');
  });

  test('back arrow and browser back go to the previous question', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    await clickText(page, 'Lose fat');
    await clickText(page, 'Male');
    const legend = page.locator('.qc-legend');
    await expect(legend).toHaveText('How old are you?');

    await page.getByRole('button', { name: 'Previous question' }).click();
    await expect(legend).toHaveText('Your sex');

    await page.goBack();
    await expect(legend).toHaveText("What's your goal?");
  });

  test('keyboard selection does not auto-advance; Enter does', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    const lose = page.getByRole('radio', { name: /^Lose fat/ });
    await lose.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.qc-legend')).toHaveText("What's your goal?");
    await page.keyboard.press('Enter');
    await expect(page.locator('.qc-legend')).toHaveText('Your sex');
  });

  test('rejects an age outside 13–90 and keeps Next aria-disabled', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    await clickText(page, 'Lose fat');
    await clickText(page, 'Male');
    await page.locator('#age-input').fill('12');
    await expect(page.getByText('Enter an age between 13 and 90.')).toBeVisible();
    const next = page.getByRole('button', { name: 'Next', exact: true });
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    // Pressing it must not advance, and the reason stays visible. force:true
    // because Playwright treats aria-disabled as a disabled control.
    await next.click({ force: true });
    await expect(page.locator('.qc-legend')).toHaveText('How old are you?');
    await expect(page.getByText('Enter an age between 13 and 90.')).toBeVisible();
  });

  test('warns when the target weight is below a healthy BMI', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    await clickText(page, 'Lose fat');
    await clickText(page, 'Male');
    await page.locator('#age-input').fill('18');
    await clickNext(page);
    await page.getByRole('button', { name: 'cm', exact: true }).click();
    await page.locator('#height-cm').fill('165');
    await clickNext(page);
    await page.locator('#weight-input').fill('70');
    await clickNext(page);
    await expect(page.locator('.qc-legend')).toHaveText('Do you have a target weight?');
    await page.locator('#targetWeight-input').fill('48');
    await expect(page.getByText("Let's aim for 51 kg or above.")).toBeVisible();
  });

  test('has no horizontal scroll and 44px option targets', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    const noScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noScroll).toBe(true);
    const heights = await page
      .locator('.qc-option')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('questionnaire axe', () => {
  test.skip(({ viewport }) => viewport?.width === 768, 'axe runs at 375 and 1440');

  test('intro', async ({ page }) => {
    await page.goto('/plan/');
    await noViolations(page);
  });

  test('single-choice question', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    await noViolations(page);
  });

  test('conditions multi-select', async ({ page }) => {
    await seedDraft(page, answersFor(VEG_HARYANA), 'conditions');
    await page.goto('/plan/?step=conditions');
    await page.getByRole('button', { name: /Continue where you left off/ }).click();
    await expect(page.locator('.qc-legend')).toHaveText('Any of these apply to you?');
    await noViolations(page);
  });

  test('state combobox open', async ({ page }) => {
    await seedDraft(page, answersFor(VEG_HARYANA), 'state');
    await page.goto('/plan/?step=state');
    await page.getByRole('button', { name: /Continue where you left off/ }).click();
    await page.locator('.qc-combobox input').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await noViolations(page);
  });

  test('review', async ({ page }) => {
    await seedDraft(page, answersFor(VEG_HARYANA), 'review');
    await page.goto('/plan/?step=review');
    await page.getByRole('button', { name: /Continue where you left off/ }).click();
    await expect(page.locator('.qc-legend')).toHaveText('Check your answers');
    await noViolations(page);
  });
});

test.describe('questionnaire reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('step transitions have no animation', async ({ page }) => {
    await page.goto('/plan/');
    await page.getByRole('button', { name: /^Start/ }).click();
    const animation = await page
      .locator('.qc-step-anim')
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe('none');
  });
});
