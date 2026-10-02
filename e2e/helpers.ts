import { expect, type Locator, type Page } from '@playwright/test';

export const cell = (page: Page, i: number) => page.locator(`#game-board > [data-cell="${i}"]`);

export const trayTile = (page: Page, color: number) =>
  page.locator(`#spawner-grid [data-drag="tray"][data-color="${color}"]`);

export const trayCount = async (page: Page, color: number) =>
  Number(await page.locator(`#spawner-grid [data-color="${color}"] .spawner-count`).textContent());

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Element is not visible');
  return found;
}

export async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const found = await box(locator);
  return { x: found.x + found.width / 2, y: found.y + found.height / 2 };
}

export async function dragTo(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = await center(from);
  const end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
}

/** Waits for a generated puzzle: 25 board cells and a cleared progress message. */
export async function waitForPuzzle(page: Page): Promise<void> {
  await expect(page.locator('#game-board > *')).toHaveCount(25, { timeout: 60_000 });
  await expect(page.locator('#status')).toHaveText('', { timeout: 60_000 });
}
