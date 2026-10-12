import { expect, test } from '@playwright/test';
import { suppressTutorial, waitForPuzzle } from './helpers';

test.beforeEach(async ({ page }) => {
  await suppressTutorial(page);
  await page.goto('./?d=1');
  await waitForPuzzle(page);
});

test('names a button as soon as the pointer is over it', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-webkit', 'touch screens have no hover');
  const tooltip = page.locator('.tooltip');
  await page.locator('#clue-btn').hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText('Reveal a clue');
  await page.screenshot({ path: `test-results/screenshots/${info.project.name}-tooltip.png` });

  await page.locator('h1').hover();
  await expect(tooltip).toBeHidden();
});

test('names a button reached with the keyboard', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-webkit', 'touch screens have no keyboard');
  await page.locator('#checkpoint-btn').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#check-btn')).toBeFocused();
  await expect(page.locator('.tooltip')).toHaveText('Check for mistakes');
});

for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 720 }],
  ['narrow portrait window', { width: 414, height: 896 }],
] as const) {
  test(`keeps every tooltip inside a ${name}`, async ({ page }, info) => {
    test.skip(info.project.name === 'mobile-webkit', 'touch screens have no hover');
    await page.setViewportSize(viewport);
    const tooltip = page.locator('.tooltip');
    for (const id of ['new-btn', 'help-btn', 'undo-btn', 'checkpoint-btn', 'share-btn']) {
      await page.locator(`#${id}`).hover();
      await expect(tooltip, id).toBeVisible();
      const box = (await tooltip.boundingBox())!;
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height, id).toBeLessThanOrEqual(viewport.height);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('leaves no tooltip behind after a tap', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-webkit', 'only touch screens tap');
  await page.locator('#check-btn').tap();
  await expect(page.locator('.tooltip')).toHaveCount(0);
});
