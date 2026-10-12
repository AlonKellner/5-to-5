import { expect, test, type Locator, type Page } from '@playwright/test';
import { center, suppressTutorial, waitForPuzzle } from './helpers';

/** A press and hold built from pointer events, on whatever element receives the touch. */
async function syntheticLongPress(page: Page, button: Locator, receiver: Locator = button) {
  const point = await center(button);
  const init = { pointerType: 'touch', isPrimary: true, clientX: point.x, clientY: point.y };
  await receiver.dispatchEvent('pointerdown', init);
  await page.waitForTimeout(700);
  await receiver.dispatchEvent('pointerup', init);
  await receiver.dispatchEvent('click', { clientX: point.x, clientY: point.y });
}

const lockedTiles = (page: Page) => page.locator('#game-board > .clue-piece').count();

test.beforeEach(async ({ page }) => {
  await suppressTutorial(page);
  await page.goto('./?d=1');
  await waitForPuzzle(page);
});

test('explains a button on a long press instead of pressing it', async ({ page }, info) => {
  const before = await lockedTiles(page);
  await syntheticLongPress(page, page.locator('#reveal-btn'));
  const tip = page.locator('.tooltip-detailed');
  await expect(tip).toBeVisible();
  await expect(tip.locator('.tooltip-title')).toHaveText('Show the solution');
  await expect(tip.locator('.tooltip-detail')).toContainText('ends the game');
  await page.screenshot({ path: `test-results/screenshots/${info.project.name}-longpress.png` });

  expect(await lockedTiles(page)).toBe(before);
  await expect(page.locator('#reset-btn')).toBeVisible();

  const viewport = page.viewportSize()!;
  const box = (await tip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  await page.locator('h1').dispatchEvent('pointerdown', { pointerType: 'touch' });
  await expect(tip).toBeHidden();
});

test('explains a disabled button, whose touches fall through to the toolbar', async ({ page }) => {
  await expect(page.locator('#undo-btn')).toBeDisabled();
  await syntheticLongPress(page, page.locator('#undo-btn'), page.locator('#bottom-controls'));
  await expect(page.locator('.tooltip-detailed .tooltip-title')).toHaveText('Undo');
});

test.describe('a real finger on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 414, height: 896 } });

  test('holding shows the explanation and the lifted finger does not press', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'raw touch input needs the Chromium protocol');
    const cdp = await page.context().newCDPSession(page);
    const before = await lockedTiles(page);
    const { x, y } = await center(page.locator('#clue-btn'));
    const touch = (type: 'touchStart' | 'touchEnd') =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });

    await touch('touchStart');
    await page.waitForTimeout(800);
    await expect(page.locator('.tooltip-detailed .tooltip-title')).toHaveText('Reveal a clue');
    await touch('touchEnd');
    await page.waitForTimeout(300);
    expect(await lockedTiles(page)).toBe(before);

    await page.locator('#clue-btn').tap();
    await expect.poll(() => lockedTiles(page)).toBe(before + 1);
  });
});
