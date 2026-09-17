import { expect, test, type Locator, type Page } from '@playwright/test';

const cell = (page: Page, i: number) => page.locator(`#game-board > [data-cell="${i}"]`);
const trayTile = (page: Page, color: number) =>
  page.locator(`#spawner-grid [data-drag="tray"][data-color="${color}"]`);
const trayCount = async (page: Page, color: number) =>
  Number(await page.locator(`#spawner-grid [data-color="${color}"] .spawner-count`).textContent());

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragTo(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const start = await center(from);
  const end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
}

async function waitForPuzzle(page: Page) {
  await expect(page.locator('#game-board > *')).toHaveCount(25);
  await expect(page.locator('#status')).toHaveText('', { timeout: 30_000 });
}

test('generates a puzzle in a worker and records it in the URL', async ({ page }) => {
  await page.goto('./?d=1');
  await waitForPuzzle(page);
  await expect(page).toHaveURL(/[?&]p=1[\w-]+/);
  await expect(page).toHaveURL(/[?&]d=1/);
  await expect(page.locator('#puzzle-info')).toContainText('Beginner (1/7)');
  await page.screenshot({ path: `test-results/screenshots/${test.info().project.name}-start.png` });
});

test('drags tiles between the tray and the board', async ({ page }) => {
  await page.goto('./?d=1');
  await waitForPuzzle(page);
  const empty = page.locator('#game-board > .drop-zone').last();
  const index = Number(await empty.getAttribute('data-cell'));
  const color = Number(
    await page.locator('#spawner-grid [data-drag="tray"]').first().getAttribute('data-color'),
  );
  const before = await trayCount(page, color);

  await dragTo(page, trayTile(page, color), cell(page, index));
  await expect(cell(page, index)).toHaveClass(new RegExp(`color-${color}`));
  expect(await trayCount(page, color)).toBe(before - 1);

  await dragTo(
    page,
    cell(page, index),
    page.locator(`#spawner-grid .spawner[data-color="${color}"]`),
  );
  await expect(cell(page, index)).toHaveClass(/drop-zone/);
  expect(await trayCount(page, color)).toBe(before);
});

test('draws relation clues centered between their two cells', async ({ page }) => {
  await page.goto('./?d=1');
  await waitForPuzzle(page);
  const badges = page.locator('#relationship-clues-container .relation-slot');
  const count = await badges.count();
  expect(count).toBeGreaterThan(0);
  const edges = await badges.evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute('data-edge'))),
  );
  for (const [k, edge] of edges.entries()) {
    // Edges 0-19 are horizontal (row * 4 + col), 20-39 vertical (20 + row * 5 + col).
    const cellA = edge < 20 ? Math.floor(edge / 4) * 5 + (edge % 4) : edge - 20;
    const cellB = edge < 20 ? cellA + 1 : cellA + 5;
    const badge = await center(badges.nth(k).locator('.relationship-clue'));
    const ca = await center(cell(page, cellA));
    const cb = await center(cell(page, cellB));
    expect(Math.abs(badge.x - (ca.x + cb.x) / 2)).toBeLessThan(2);
    expect(Math.abs(badge.y - (ca.y + cb.y) / 2)).toBeLessThan(2);
  }
});

test('takes notes, reveals a clue and solves', async ({ page }) => {
  await page.goto('./?d=3');
  await waitForPuzzle(page);
  const empty = page.locator('#game-board > .drop-zone').first();
  await empty.click();
  await page.locator('.note-option').nth(3).click();
  await expect(empty.locator('.note-dot.color-3')).toHaveCount(1);
  await page.locator('h1').click();
  await expect(page.locator('.note-menu')).toHaveCount(0);

  const locked = await page.locator('#game-board > .clue-piece').count();
  await page.locator('#clue-btn').click();
  await expect(page.locator('#game-board > .clue-piece')).toHaveCount(locked + 1);

  await page.locator('#reveal-btn').click();
  await expect(page.locator('#game-board > .clue-piece')).toHaveCount(25);
  await expect(page.locator('#reset-btn')).toBeHidden();
  await page.screenshot({
    path: `test-results/screenshots/${test.info().project.name}-solved.png`,
  });
});

test('generates a new puzzle at the chosen difficulty', async ({ page }) => {
  await page.goto('./?d=1');
  await waitForPuzzle(page);
  const firstUrl = page.url();
  await page.locator('#difficulty-select').selectOption('5');
  await page.locator('#new-btn').click();
  await expect(page.locator('#puzzle-info')).toContainText('Hard (5/7)', { timeout: 30_000 });
  expect(page.url()).not.toBe(firstUrl);
});

test('reopens a shared puzzle link exactly', async ({ page }) => {
  await page.goto('./?d=1');
  await waitForPuzzle(page);
  const url = page.url();
  const clues = await page
    .locator('#game-board > .clue-piece')
    .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-cell')}:${e.className}`));
  await page.goto(url);
  await expect(page.locator('#game-board > *')).toHaveCount(25);
  const reopened = await page
    .locator('#game-board > .clue-piece')
    .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-cell')}:${e.className}`));
  expect(reopened).toEqual(clues);
});

test('undoes moves and checks for mistakes', async ({ page }) => {
  await page.goto('./?d=1');
  await waitForPuzzle(page);
  const empty = page.locator('#game-board > .drop-zone').last();
  const index = Number(await empty.getAttribute('data-cell'));
  const color = Number(
    await page.locator('#spawner-grid [data-drag="tray"]').first().getAttribute('data-color'),
  );

  await dragTo(page, trayTile(page, color), cell(page, index));
  await page.locator('#check-btn').click();
  await expect(page.locator('#status')).toHaveText(/no mistakes so far|1 tile is wrong/i);
  await page.screenshot({ path: `test-results/screenshots/${test.info().project.name}-check.png` });

  await page.locator('#undo-btn').click();
  await expect(cell(page, index)).toHaveClass(/drop-zone/);
  await expect(page.locator('#undo-btn')).toBeDisabled();
});
