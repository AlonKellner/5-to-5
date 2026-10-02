import { expect, test, type Page } from '@playwright/test';
import { box, cell, waitForPuzzle } from './helpers';

const PORTRAIT = { width: 414, height: 896 };
const LANDSCAPE = { width: 896, height: 414 };

const boardCell = (page: Page) => cell(page, 0);
const bins = (page: Page) => page.locator('#spawner-grid .spawner');
const noteCells = (page: Page) => page.locator('#spawner-notes-grid .note-cell');

async function boxes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

for (const [name, viewport] of [
  ['portrait', PORTRAIT],
  ['landscape', LANDSCAPE],
] as const) {
  test.describe(name, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('./?d=1');
      await waitForPuzzle(page);
    });

    test('sizes color bins and note cells exactly like board cells', async ({ page }) => {
      const board = await box(boardCell(page));
      const bin = await box(bins(page).first());
      const note = await box(noteCells(page).first());
      expect(Math.abs(board.width - board.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(bin.width - board.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(bin.height - board.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(note.width - board.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(note.height - board.height)).toBeLessThanOrEqual(1);
    });

    test('never scrolls horizontally', async ({ page }) => {
      const overflow = await page.evaluate(() => ({
        root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      }));
      expect(overflow.root).toBeLessThanOrEqual(1);
      expect(overflow.body).toBeLessThanOrEqual(1);
    });

    test('draws relation clues centered between their two cells', async ({ page }) => {
      const badges = page.locator('#relationship-clues-container .relation-slot');
      const edges = await badges.evaluateAll((els) =>
        els.map((e) => Number(e.getAttribute('data-edge'))),
      );
      expect(edges.length).toBeGreaterThan(0);
      for (const [k, edge] of edges.entries()) {
        // Edges 0-19 are horizontal (row * 4 + col), 20-39 vertical (20 + row * 5 + col).
        const cellA = edge < 20 ? Math.floor(edge / 4) * 5 + (edge % 4) : edge - 20;
        const cellB = edge < 20 ? cellA + 1 : cellA + 5;
        const badge = await box(badges.nth(k).locator('.relationship-clue'));
        const a = await box(cell(page, cellA));
        const b = await box(cell(page, cellB));
        expect(
          Math.abs(badge.x + badge.width / 2 - (a.x + a.width / 2 + b.x + b.width / 2) / 2),
        ).toBeLessThan(2);
        expect(
          Math.abs(badge.y + badge.height / 2 - (a.y + a.height / 2 + b.y + b.height / 2) / 2),
        ).toBeLessThan(2);
      }
    });
  });
}

test.describe('portrait layout', () => {
  test.use({ viewport: PORTRAIT });

  test.beforeEach(async ({ page }) => {
    await page.goto('./?d=1');
    await waitForPuzzle(page);
  });

  test('puts the bins and the notes below the board', async ({ page }) => {
    const board = await box(page.locator('#board-panel'));
    const tray = await box(page.locator('#tray-panel'));
    const notes = await box(page.locator('#notes-panel'));
    expect(tray.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
    expect(notes.y).toBeGreaterThanOrEqual(tray.y + tray.height - 1);
  });

  test('lays the bins out as a horizontal row', async ({ page }) => {
    const spawners = await boxes(page, '#spawner-grid .spawner');
    expect(spawners).toHaveLength(5);
    for (let i = 1; i < spawners.length; i++) {
      expect(Math.abs(spawners[i]!.y - spawners[0]!.y)).toBeLessThanOrEqual(1);
      expect(spawners[i]!.x).toBeGreaterThan(spawners[i - 1]!.x);
    }
  });
});

test.describe('landscape layout', () => {
  test.use({ viewport: LANDSCAPE });

  test.beforeEach(async ({ page }) => {
    await page.goto('./?d=1');
    await waitForPuzzle(page);
  });

  test('puts the bins and the notes to the right of the board', async ({ page }) => {
    const board = await box(page.locator('#board-panel'));
    const tray = await box(page.locator('#tray-panel'));
    const notes = await box(page.locator('#notes-panel'));
    expect(tray.x).toBeGreaterThanOrEqual(board.x + board.width - 1);
    expect(notes.x).toBeGreaterThanOrEqual(tray.x + tray.width - 1);
    const overlap =
      Math.min(board.y + board.height, tray.y + tray.height) - Math.max(board.y, tray.y);
    expect(overlap).toBeGreaterThan(0);
  });

  test('stacks the bins as a vertical strip one cell wide', async ({ page }) => {
    const spawners = await boxes(page, '#spawner-grid .spawner');
    expect(spawners).toHaveLength(5);
    for (let i = 1; i < spawners.length; i++) {
      expect(Math.abs(spawners[i]!.x - spawners[0]!.x)).toBeLessThanOrEqual(1);
      expect(spawners[i]!.y).toBeGreaterThan(spawners[i - 1]!.y);
    }
    const grid = await box(page.locator('#spawner-grid'));
    expect(Math.abs(grid.width - spawners[0]!.width)).toBeLessThanOrEqual(1);
  });

  test('lines each bin up with its own notes row', async ({ page }) => {
    const spawners = await boxes(page, '#spawner-grid .spawner');
    for (let color = 0; color < 5; color++) {
      const note = await box(
        page.locator(`#spawner-notes-grid [data-color="${color}"][data-slot="0"]`),
      );
      expect(Math.abs(note.y - spawners[color]!.y)).toBeLessThanOrEqual(1);
    }
  });

  test('points the cycle arrows down the strip', async ({ page }) => {
    const spawners = await boxes(page, '#spawner-grid .spawner');
    const arrows = await boxes(page, '#spawner-clues-container .relationship-clue');
    expect(arrows).toHaveLength(6);
    const centerY = (b: { y: number; height: number }) => b.y + b.height / 2;
    const centerX = (b: { x: number; width: number }) => b.x + b.width / 2;
    for (let i = 1; i <= 4; i++) {
      const midpoint = (centerY(spawners[i - 1]!) + centerY(spawners[i]!)) / 2;
      expect(Math.abs(centerY(arrows[i]!) - midpoint)).toBeLessThan(2);
      expect(Math.abs(centerX(arrows[i]!) - centerX(spawners[i]!))).toBeLessThan(2);
    }
    expect(centerY(arrows[0]!)).toBeLessThan(centerY(spawners[0]!));
    expect(centerY(arrows[5]!)).toBeGreaterThan(centerY(spawners[4]!));
  });
});
