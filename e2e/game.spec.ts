import { expect, test } from '@playwright/test';
import {
  box,
  cell,
  center,
  dragTo,
  suppressTutorial,
  trayCount,
  trayTile,
  waitForPuzzle,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await suppressTutorial(page);
});

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

test('returns a tapped tile to its bin without opening the notes menu', async ({ page }, info) => {
  await page.goto('./?d=1');
  await waitForPuzzle(page);
  const empty = page.locator('#game-board > .drop-zone').last();
  const index = Number(await empty.getAttribute('data-cell'));
  const color = Number(
    await page.locator('#spawner-grid [data-drag="tray"]').first().getAttribute('data-color'),
  );
  await dragTo(page, trayTile(page, color), cell(page, index));
  await expect(cell(page, index)).toHaveClass(new RegExp(`color-${color}`));

  const tile = cell(page, index);
  if (info.project.name === 'mobile-webkit') await tile.tap();
  else await tile.click();
  await expect(cell(page, index)).toHaveClass(/drop-zone/);
  await page.waitForTimeout(300);
  await expect(page.locator('.note-menu')).toHaveCount(0);

  // Pressing the empty cell again does open the menu.
  await cell(page, index).click();
  await expect(page.locator('.note-menu')).toHaveCount(1);
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
  await page.locator('.note-option').nth(1).click();
  await expect(empty.locator('.note-dot.color-3')).toHaveCount(1);
  await expect(empty.locator('.note-dot.color-3 .color-shape')).toHaveAttribute(
    'data-shape',
    'diamond',
  );
  await page.screenshot({ path: `test-results/screenshots/${test.info().project.name}-notes.png` });
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
  await expect(page.locator('#puzzle-info')).toContainText('Hard (5/7)', { timeout: 60_000 });
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

test('keeps top and bottom notes in their own halves', async ({ page }, info) => {
  await page.goto('./?d=3');
  await waitForPuzzle(page);
  const square = page.locator('#game-board > .drop-zone').first();
  const option = (color: number) => page.locator('.note-option').nth(color);
  const size = await box(square);
  const menu = page.locator('.note-menu');
  const shade = () => menu.evaluate((el) => getComputedStyle(el).backgroundColor);

  // Pressing the top half opens the top-half menu; a full top half is the most crowded one.
  await square.click({ position: { x: size.width / 2, y: size.height / 4 } });
  await expect(menu).toHaveAttribute('data-half', 'top');
  const topShade = await shade();
  for (const color of [0, 1, 2, 3, 4]) await option(color).click();
  await page.screenshot({
    path: `test-results/screenshots/${info.project.name}-note-menu-top.png`,
  });
  await page.locator('h1').click();

  // Pressing the bottom half opens the bottom-half menu, in a brighter shade.
  await square.click({ position: { x: size.width / 2, y: (size.height * 3) / 4 } });
  await expect(menu).toHaveAttribute('data-half', 'bottom');
  await expect(page.locator('.note-half-toggle')).toHaveAttribute('data-half', 'bottom');
  await expect.poll(shade).not.toBe(topShade);
  for (const color of [1, 3]) await option(color).click();
  await page.screenshot({ path: `test-results/screenshots/${info.project.name}-note-halves.png` });
  await page.locator('h1').click();

  const outline = await box(square);
  const middle = outline.y + outline.height / 2;
  const top = await square.locator('.note-half-top .note-dot').all();
  const bottom = await square.locator('.note-half-bottom .note-dot').all();
  expect(top).toHaveLength(5);
  expect(bottom).toHaveLength(2);
  for (const dot of top) {
    const b = await box(dot);
    expect(b.y).toBeGreaterThanOrEqual(outline.y);
    expect(b.y + b.height).toBeLessThanOrEqual(middle);
  }
  for (const dot of bottom) {
    const b = await box(dot);
    expect(b.y).toBeGreaterThanOrEqual(middle);
    expect(b.y + b.height).toBeLessThanOrEqual(outline.y + outline.height);
  }

  const divider = await box(square.locator('.note-divider'));
  expect(Math.abs(divider.y + divider.height / 2 - middle)).toBeLessThanOrEqual(1);
  expect(divider.x).toBeGreaterThan(outline.x + 4);
  expect(divider.x + divider.width).toBeLessThan(outline.x + outline.width - 4);
});
