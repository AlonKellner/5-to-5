import { expect, test } from '@playwright/test';
import { waitForPuzzle } from './helpers';

test.beforeEach(async ({ page }) => {
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
