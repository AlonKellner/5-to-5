// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { permuteColors } from '../core/board';
import { encodePuzzle } from '../core/codec';
import type { DifficultyLevel, Puzzle } from '../core/puzzle';
import { Rng } from '../core/rng';
import type { PuzzleSource } from '../worker/client';
import { App, STORAGE_KEY } from './app';

const solution = legacyPuzzle().solution;
const rating = {
  level: 5 as const,
  score: 480,
  stats: { steps: [5, 2, 3, 0, 4], guessNodes: 0, effort: 60, tileClues: 4, relationClues: 12 },
};

class FakeSource implements PuzzleSource {
  calls: { seed: string; difficulty: DifficultyLevel }[] = [];
  next = legacyPuzzle();
  async generate(seed: string, difficulty: DifficultyLevel): Promise<Puzzle> {
    this.calls.push({ seed, difficulty });
    return { ...this.next, seed, rating: { ...rating, level: difficulty } };
  }
}

const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const cell = (i: number) => $(`#game-board > [data-cell="${i}"]`);
const spawnerCount = (color: number) =>
  Number($(`#spawner-grid [data-color="${color}"] .spawner-count`).textContent);

function pointer(type: string, target: EventTarget, x = 0, y = 0) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
}

describe('App', () => {
  let source: FakeSource;
  let app: App;
  let hitTarget: Element | null;
  let urls: URL[];
  let storage: Map<string, string> & Pick<Storage, 'getItem' | 'setItem'>;

  function drag(from: Element, to: Element) {
    hitTarget = to;
    pointer('pointerdown', from, 0, 0);
    pointer('pointermove', document, 50, 50);
    pointer('pointerup', document, 50, 50);
  }

  async function startApp(url = 'https://example.com/5-to-5/') {
    const root = document.getElementById('app')!;
    app = new App({
      root,
      source,
      rng: new Rng('app'),
      hitTest: () => hitTarget,
      url: new URL(url),
      onUrlChange: (u) => urls.push(u),
      newSeed: () => 'fresh-seed',
      clipboard: { writeText: vi.fn(async () => undefined) },
      storage,
    });
    await app.start();
  }

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    source = new FakeSource();
    hitTarget = null;
    urls = [];
    storage = Object.assign(new Map<string, string>(), {
      getItem(this: Map<string, string>, key: string) {
        return this.get(key) ?? null;
      },
      setItem(this: Map<string, string>, key: string, value: string) {
        this.set(key, value);
      },
    });
    await startApp();
  });

  afterEach(() => app.destroy());

  describe('rendering', () => {
    it('renders 25 cells, 5 spawners with tray counts and 10 note cells', () => {
      expect($$('#game-board > *')).toHaveLength(25);
      expect($$('#spawner-grid > .spawner')).toHaveLength(5);
      expect([0, 1, 2, 3, 4].map(spawnerCount)).toEqual([5, 5, 3, 4, 4]);
      expect($$('#spawner-notes-grid > .note-cell')).toHaveLength(10);
    });

    it('renders clue tiles locked with a lock icon and without drag handles', () => {
      const clue = cell(1);
      expect(clue.classList.contains('clue-piece')).toBe(true);
      expect(clue.classList.contains('color-4')).toBe(true);
      expect(clue.querySelector('.lock-icon')).not.toBeNull();
      expect(clue.dataset['drag']).toBeUndefined();
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
    });

    it('renders relation clues on the grid lines between their cells', () => {
      const badges = $$('#relationship-clues-container .relation-slot');
      expect(badges).toHaveLength(12);
      const firstRow = badges.find((b) => b.dataset['edge'] === '3')!;
      expect(firstRow.textContent).toBe('‹');
      expect(firstRow.style.gridRow).toBe('1');
      expect(firstRow.style.gridColumn).toBe('4 / span 2');
      const vertical = badges.find((b) => b.classList.contains('vertical'))!;
      expect(vertical.style.gridRow).toMatch(/span 2/);
    });

    it('renders the cycle arrows around the spawners', () => {
      expect($$('#spawner-clues-container .relationship-clue').map((b) => b.textContent)).toEqual(
        Array(6).fill('›'),
      );
    });

    it('shows the difficulty and loads the puzzle into the URL', () => {
      expect($('#puzzle-info').textContent).toContain('Medium (3/7)');
      expect(source.calls).toEqual([{ seed: 'fresh-seed', difficulty: 3 }]);
      const url = urls.at(-1)!;
      expect(url.searchParams.get('p')).toBe(encodePuzzle(legacyPuzzle()));
      expect(url.searchParams.get('d')).toBe('3');
    });
  });

  describe('moving tiles', () => {
    it('drags a tile from a spawner onto an empty cell', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      expect(cell(0).classList.contains('color-0')).toBe(true);
      expect(spawnerCount(0)).toBe(4);
    });

    it('swaps two placed tiles', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      drag($('#spawner-grid [data-drag="tray"][data-color="1"]'), cell(2));
      drag(cell(0), cell(2));
      expect(cell(0).classList.contains('color-1')).toBe(true);
      expect(cell(2).classList.contains('color-0')).toBe(true);
    });

    it('drags a placed tile back to its spawner', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      drag(cell(0), $('#spawner-grid [data-color="3"]'));
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
      expect(spawnerCount(0)).toBe(5);
    });

    it('returns a placed tile to the tray when clicked', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      pointer('pointerdown', cell(0));
      pointer('pointerup', document);
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
    });

    it('does not move clue tiles', () => {
      drag(cell(1), cell(0));
      expect(cell(1).classList.contains('color-4')).toBe(true);
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
    });
  });

  describe('notes', () => {
    it('opens a menu on an empty cell and shows chosen notes as dots', () => {
      cell(0).click();
      expect($$('.note-menu')).toHaveLength(1);
      ($$('.note-option')[2] as HTMLElement).click();
      expect(cell(0).querySelectorAll('.note-dot')).toHaveLength(1);
      expect(cell(0).querySelector('.note-dot')!.classList.contains('color-2')).toBe(true);
      pointer('pointerdown', $('h1'));
      expect($$('.note-menu')).toHaveLength(0);
    });

    it('does not open a menu on a placed tile', () => {
      cell(1).click();
      expect($$('.note-menu')).toHaveLength(0);
    });

    it('takes notes under the spawners', () => {
      const noteCell = $('#spawner-notes-grid [data-color="3"][data-slot="1"]');
      expect(noteCell.textContent).toContain('Notes');
      noteCell.click();
      ($$('.note-option')[0] as HTMLElement).click();
      ($$('.note-option')[4] as HTMLElement).click();
      const updated = $('#spawner-notes-grid [data-color="3"][data-slot="1"]');
      expect(updated.querySelectorAll('.note-dot')).toHaveLength(2);
      expect(updated.textContent).toContain('/');
    });
  });

  describe('controls', () => {
    it('saves and restores a checkpoint', () => {
      expect($('#restore-btn').hidden).toBe(true);
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      $('#checkpoint-btn').click();
      expect($('#restore-btn').hidden).toBe(false);
      expect(cell(0).classList.contains('checkpointed')).toBe(true);
      drag(cell(0), $('#spawner-grid [data-color="0"]'));
      expect(cell(0).classList.contains('checkpointed')).toBe(true);
      $('#restore-btn').click();
      expect(cell(0).classList.contains('color-0')).toBe(true);
    });

    it('reveals a clue and disables the button when nothing is left to reveal', () => {
      for (let i = 0; i < 21; i++) $('#clue-btn').click();
      expect($$('#game-board > .clue-piece')).toHaveLength(25);
      expect($('#win-modal').hidden).toBe(false);
    });

    it('solves the puzzle and shows post-game controls', () => {
      $('#reveal-btn').click();
      expect($$('#game-board > .clue-piece')).toHaveLength(25);
      expect($('#reset-btn').hidden).toBe(true);
      expect($('#clue-btn').hidden).toBe(true);
      expect($('#checkpoint-btn').hidden).toBe(true);
      expect($('#new-btn').hidden).toBe(false);
      expect($('#win-modal').hidden).toBe(true);
    });

    it('shows the win modal when the last tile is placed', () => {
      for (let i = 0; i < 25; i++) {
        if (cell(i).classList.contains('clue-piece') || i === 24) continue;
        drag($(`#spawner-grid [data-drag="tray"][data-color="${solution[i]}"]`), cell(i));
      }
      expect($('#win-modal').hidden).toBe(true);
      drag($(`#spawner-grid [data-drag="tray"][data-color="${solution[24]}"]`), cell(24));
      expect($('#win-modal').hidden).toBe(false);
      $('#close-win-modal-btn').click();
      expect($('#win-modal').hidden).toBe(true);
      expect($('#reset-btn').hidden).toBe(true);
    });

    it('resets the board to the clues', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      $('#reset-btn').click();
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
      expect(spawnerCount(0)).toBe(5);
    });

    it('generates a new puzzle with the selected difficulty', async () => {
      const select = $<HTMLSelectElement>('#difficulty-select');
      select.value = '6';
      select.dispatchEvent(new Event('change'));
      $('#new-btn').click();
      await vi.waitFor(() => expect(source.calls).toHaveLength(2));
      expect(source.calls[1]).toEqual({ seed: 'fresh-seed', difficulty: 6 });
      await vi.waitFor(() => expect($('#puzzle-info').textContent).toContain('Expert (6/7)'));
    });

    it('copies a share link', async () => {
      $('#share-btn').click();
      await vi.waitFor(() => expect($('#status').textContent).toMatch(/copied/i));
    });
  });

  describe('URL parameters', () => {
    it('loads a puzzle code without generating', async () => {
      app.destroy();
      document.body.innerHTML = '<div id="app"></div>';
      source = new FakeSource();
      await startApp(`https://example.com/?p=${encodePuzzle(legacyPuzzle())}&d=5`);
      expect(source.calls).toHaveLength(0);
      expect($('#puzzle-info').textContent).toMatch(/\(\d\/7\) · score \d+/);
      expect(cell(1).classList.contains('clue-piece')).toBe(true);
    });

    it('generates from a seed and difficulty', async () => {
      app.destroy();
      document.body.innerHTML = '<div id="app"></div>';
      source = new FakeSource();
      await startApp('https://example.com/?seed=abc&d=2');
      expect(source.calls).toEqual([{ seed: 'abc', difficulty: 2 }]);
      expect($<HTMLSelectElement>('#difficulty-select').value).toBe('2');
    });

    it('still understands level names from older links', async () => {
      app.destroy();
      document.body.innerHTML = '<div id="app"></div>';
      source = new FakeSource();
      await startApp('https://example.com/?seed=abc&d=expert');
      expect(source.calls).toEqual([{ seed: 'abc', difficulty: 6 }]);
    });

    it('falls back to generating when the code is invalid', async () => {
      app.destroy();
      document.body.innerHTML = '<div id="app"></div>';
      source = new FakeSource();
      await startApp('https://example.com/?p=garbage');
      expect(source.calls).toHaveLength(1);
    });
  });

  describe('persistence', () => {
    const reload = async (url: string) => {
      app.destroy();
      document.body.innerHTML = '<div id="app"></div>';
      await startApp(url);
    };

    it('restores tiles, notes and checkpoints after reloading the same puzzle', async () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      $('#checkpoint-btn').click();
      cell(2).click();
      ($$('.note-option')[1] as HTMLElement).click();
      await reload(urls.at(-1)!.toString());
      expect(source.calls).toHaveLength(1);
      expect(cell(0).classList.contains('color-0')).toBe(true);
      expect(cell(2).querySelectorAll('.note-dot')).toHaveLength(1);
      expect($('#restore-btn').hidden).toBe(false);
    });

    it('starts fresh for a different puzzle', async () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      source.next = { ...legacyPuzzle(), solution: permuteColors(solution, [1, 2, 3, 4, 0]) };
      $('#new-btn').click();
      await vi.waitFor(() => expect(source.calls).toHaveLength(2));
      await vi.waitFor(() => expect(cell(0).classList.contains('drop-zone')).toBe(true));
    });

    it('ignores corrupt saved data', async () => {
      storage.set(STORAGE_KEY, '{not json');
      await reload(urls.at(-1)!.toString());
      expect($$('#game-board > *')).toHaveLength(25);
    });
  });

  describe('undo', () => {
    const undoButton = () => $<HTMLButtonElement>('#undo-btn');

    it('is disabled until something changes', () => {
      expect(undoButton().disabled).toBe(true);
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      expect(undoButton().disabled).toBe(false);
    });

    it('reverts moves one step at a time', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      drag($('#spawner-grid [data-drag="tray"][data-color="1"]'), cell(2));
      undoButton().click();
      expect(cell(2).classList.contains('drop-zone')).toBe(true);
      expect(cell(0).classList.contains('color-0')).toBe(true);
      undoButton().click();
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
      expect(undoButton().disabled).toBe(true);
    });

    it('reverts notes, hints and resets', () => {
      cell(0).click();
      ($$('.note-option')[2] as HTMLElement).click();
      undoButton().click();
      expect(cell(0).querySelectorAll('.note-dot')).toHaveLength(0);

      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      $('#reset-btn').click();
      undoButton().click();
      expect(cell(0).classList.contains('color-0')).toBe(true);

      const locked = $$('#game-board > .clue-piece').length;
      $('#clue-btn').click();
      undoButton().click();
      expect($$('#game-board > .clue-piece')).toHaveLength(locked);
    });

    it('responds to Ctrl+Z and Cmd+Z', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
    });

    it('is not available once the puzzle is solved', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      $('#reveal-btn').click();
      expect(undoButton().hidden).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
      expect($$('#game-board > .clue-piece')).toHaveLength(25);
    });

    it('starts a fresh history for a new puzzle', async () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      source.next = { ...legacyPuzzle(), solution: permuteColors(solution, [1, 2, 3, 4, 0]) };
      $('#new-btn').click();
      await vi.waitFor(() => expect(source.calls).toHaveLength(2));
      await vi.waitFor(() => expect(undoButton().disabled).toBe(true));
    });
  });

  describe('check', () => {
    it('reports no mistakes when every placed tile is right', () => {
      drag($(`#spawner-grid [data-drag="tray"][data-color="${solution[0]}"]`), cell(0));
      $('#check-btn').click();
      expect($('#status').textContent).toMatch(/no mistakes/i);
      expect($$('#game-board > .mistake')).toHaveLength(0);
    });

    it('marks wrong tiles and counts them', () => {
      const wrong = (solution[0]! + 1) % 5;
      drag($(`#spawner-grid [data-drag="tray"][data-color="${wrong}"]`), cell(0));
      drag($(`#spawner-grid [data-drag="tray"][data-color="${solution[2]}"]`), cell(2));
      $('#check-btn').click();
      expect($('#status').textContent).toMatch(/1 tile is wrong/i);
      expect($$('#game-board > .mistake').map((c) => c.dataset['cell'])).toEqual(['0']);
    });

    it('clears the marks and message after the next change', () => {
      const wrong = (solution[0]! + 1) % 5;
      drag($(`#spawner-grid [data-drag="tray"][data-color="${wrong}"]`), cell(0));
      $('#check-btn').click();
      drag(cell(0), $(`#spawner-grid .spawner[data-color="${wrong}"]`));
      expect($$('#game-board > .mistake')).toHaveLength(0);
      expect($('#status').textContent).toBe('');
    });

    it('is hidden once the puzzle is solved', () => {
      $('#reveal-btn').click();
      expect($('#check-btn').hidden).toBe(true);
    });
  });
});
