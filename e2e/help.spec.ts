import { expect, test } from '@playwright/test';
import { suppressTutorial, waitForPuzzle } from './helpers';

test.beforeEach(async ({ page }) => {
  await suppressTutorial(page);
  await page.goto('./?d=1');
  await waitForPuzzle(page);
});

test('opens the rules from the toolbar', async ({ page }) => {
  await expect(page.locator('#help-modal')).toBeHidden();
  await page.locator('#help-btn').click();
  const modal = page.locator('#help-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('ALWAYS');
  await expect(modal).toContainText('NEVER');
  await expect(modal.locator('.help-legend .relationship-clue')).toHaveCount(5);
  await page.screenshot({ path: `test-results/screenshots/${test.info().project.name}-help.png` });

  const guide = modal.locator('.help-buttons');
  await expect(guide.locator('.help-button-row')).toHaveCount(10);
  await expect(modal).toContainText('press and hold');
  await guide.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/screenshots/${test.info().project.name}-help-buttons.png`,
  });
});

test('closes the rules with the button, the scrim and Escape', async ({ page }) => {
  const modal = page.locator('#help-modal');

  await page.locator('#help-btn').click();
  await page.locator('#close-help-btn').click();
  await expect(modal).toBeHidden();

  await page.locator('#help-btn').click();
  await modal.click({ position: { x: 5, y: 5 } });
  await expect(modal).toBeHidden();

  await page.locator('#help-btn').click();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});

test('walks through the tour from the help dialog', async ({ page }) => {
  await page.locator('#help-btn').click();
  await page.locator('#start-tutorial-btn').click();

  const bubble = page.locator('.tutorial-bubble');
  const spotlight = page.locator('.tutorial-spotlight');
  await expect(bubble).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#help-modal')).toBeHidden();

  const board = (await page.locator('#board-panel').boundingBox())!;
  const firstLight = (await spotlight.boundingBox())!;
  expect(Math.abs(firstLight.x - board.x)).toBeLessThan(3);
  expect(Math.abs(firstLight.width - board.width)).toBeLessThan(3);
  await page.screenshot({
    path: `test-results/screenshots/${test.info().project.name}-tutorial.png`,
  });

  const next = page.locator('#tutorial-next-btn');
  for (let step = 0; step < 20 && (await next.textContent()) !== 'Done'; step++) {
    const viewport = page.viewportSize()!;
    const bubbleBox = (await bubble.boundingBox())!;
    expect(bubbleBox.x).toBeGreaterThanOrEqual(0);
    expect(bubbleBox.y).toBeGreaterThanOrEqual(0);
    expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bubbleBox.y + bubbleBox.height).toBeLessThanOrEqual(viewport.height + 1);
    if ((await page.locator('.tutorial-title').textContent()) === 'Hidden rule: ALWAYS') {
      await page.screenshot({
        path: `test-results/screenshots/${test.info().project.name}-tutorial-rule.png`,
      });
    }
    await next.click();
  }
  await expect(next).toHaveText('Done');
  await next.click();
  await expect(page.locator('.tutorial')).toHaveCount(0);
});

test('keeps the tour on screen after rotating', async ({ page }) => {
  await page.locator('#help-btn').click();
  await page.locator('#start-tutorial-btn').click();
  const bubble = page.locator('.tutorial-bubble');
  await expect(bubble).toBeVisible({ timeout: 60_000 });

  await page.setViewportSize({ width: 900, height: 420 });
  await expect(bubble).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = (await bubble.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
});

test.describe('first visit', () => {
  test('shows the tour, then never again', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('./?d=1');
    await expect(page.locator('.tutorial-bubble')).toBeVisible({ timeout: 90_000 });
    await page.locator('#tutorial-skip-btn').click();
    await expect(page.locator('.tutorial')).toHaveCount(0);

    await page.reload();
    await waitForPuzzle(page);
    await expect(page.locator('.tutorial')).toHaveCount(0);
    await context.close();
  });
});
