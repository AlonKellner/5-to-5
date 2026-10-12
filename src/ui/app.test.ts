// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { permuteColors } from '../core/board';
import { encodePuzzle } from '../core/codec';
import type { DifficultyLevel, Puzzle } from '../core/puzzle';
import { Rng } from '../core/rng';
import type { PuzzleSource } from '../worker/client';
import { App, STORAGE_KEY, TUTORIAL_MAX_ATTEMPTS } from './app';
import { COLOR_SHAPES } from './shapes';
import { TUTORIAL_SEEN_KEY } from './tutorialSteps';

const solution = legacyPuzzle().solution;
const rating = {
  level: 5 as const,
  score: 480,
  stats: { steps: [5, 2, 3, 0, 4], guessNodes: 0, effort: 60, tileClues: 4, relationClues: 12 },
};

class FakeSource implements PuzzleSource {
  calls: { seed: string; difficulty: DifficultyLevel }[] = [];
  next = legacyPuzzle();
  /** Puzzles handed out before `next`, for testing what the app does with specific puzzles. */
  queue: Puzzle[] = [];
  async generate(seed: string, difficulty: DifficultyLevel): Promise<Puzzle> {
    this.calls.push({ seed, difficulty });
    const puzzle = this.queue.shift() ?? this.next;
    return { ...puzzle, seed, rating: { ...rating, level: difficulty } };
  }
}

/** The legacy puzzle with every vertical relation clue hidden, which the tutorial cannot show. */
function puzzleWithoutVerticalClues(): Puzzle {
  const puzzle = legacyPuzzle();
  const mask = puzzle.mask.slice();
  for (let edge = 20; edge < 40; edge++) mask[25 + edge] = 0;
  return { ...puzzle, mask };
}

const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const cell = (i: number) => $(`#game-board > [data-cell="${i}"]`);
/** The color of an element with a color-N class, and the shape drawn on it. */
const colorAndShape = (node: Element) => [
  Number(/color-(\d)/.exec(node.className)![1]),
  node.querySelector<SVGElement>(':scope > .color-shape')?.dataset['shape'],
];
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
    // Existing tests play with the tutorial already seen; its own block clears the flag.
    storage.set(TUTORIAL_SEEN_KEY, '1');
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

    it('draws its color’s shape on every tile, on the board and in the bins', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      const tiles = $$('.piece');
      expect(tiles.length).toBeGreaterThan(5);
      for (const tile of tiles) {
        const [color, shape] = colorAndShape(tile);
        expect(shape, tile.className).toBe(COLOR_SHAPES[color as number]);
      }
      expect(cell(1).querySelector('.lock-icon')).not.toBeNull();
    });

    it('keeps the shape in a bin that has run out of tiles', () => {
      for (let i = 0; i < 3; i++) {
        const empty = $$('#game-board > .drop-zone')[0]!;
        drag($('#spawner-grid [data-drag="tray"][data-color="2"]'), empty);
      }
      expect(spawnerCount(2)).toBe(0);
      const bin = $('#spawner-grid [data-color="2"] .spawner-empty');
      expect(bin.querySelector<SVGElement>('.color-shape')!.dataset['shape']).toBe('trapezoid');
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

    it('places the cycle arrows with classes, so rotating needs no re-render', () => {
      const arrows = $$('#spawner-clues-container .relation-slot');
      expect(arrows).toHaveLength(6);
      arrows.forEach((arrow, index) => {
        expect(arrow.classList.contains(`arrow-${index}`), `arrow ${index}`).toBe(true);
        expect(arrow.getAttribute('style'), `arrow ${index}`).toBeNull();
      });
      expect(arrows[0]!.classList.contains('edge-start')).toBe(true);
      expect(arrows[5]!.classList.contains('edge-end')).toBe(true);
    });

    it('uses the same grid markup in both orientations', () => {
      expect($('#spawner-grid').className).toBe('grid5');
      expect($('#spawner-notes-grid').className).toBe('grid5');
      expect($('#spawner-clues-container').className).toBe('overlay grid5');
      expect($('#relationship-clues-container').className).toBe('overlay grid5');
    });

    it('shows the difficulty and loads the puzzle into the URL', () => {
      expect($('#puzzle-info').textContent).toContain('Medium (3/7)');
      expect(source.calls).toEqual([{ seed: 'fresh-seed', difficulty: 3 }]);
      const url = urls.at(-1)!;
      expect(url.searchParams.get('p')).toBe(encodePuzzle(legacyPuzzle()));
      expect(url.searchParams.get('d')).toBe('3');
    });
  });

  describe('icon buttons', () => {
    const ICON_BUTTONS = [
      'new-btn',
      'reset-btn',
      'clue-btn',
      'reveal-btn',
      'undo-btn',
      'check-btn',
      'checkpoint-btn',
      'restore-btn',
      'share-btn',
    ];

    it('shows every toolbar button as an icon with an accessible name', () => {
      for (const id of ICON_BUTTONS) {
        const button = $(`#${id}`);
        expect(button.querySelectorAll('svg.btn-icon'), id).toHaveLength(1);
        expect(button.textContent!.trim(), id).toBe('');
        expect(button.getAttribute('aria-label')?.length, id).toBeGreaterThan(0);
        expect(button.dataset['tooltip']?.length, id).toBeGreaterThan(0);
      }
    });

    it('names a button in a tooltip while the pointer is over it', () => {
      const event = new MouseEvent('pointerover', { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      $('#clue-btn svg').dispatchEvent(event);
      expect($('.tooltip').hidden).toBe(false);
      expect($('.tooltip').textContent).toBe('Reveal a clue');
    });

    it('keeps the difficulty levels readable as text', () => {
      const options = $$('#difficulty-select option');
      expect(options).toHaveLength(7);
      expect(options[0]!.textContent).toContain('Beginner');
      expect(options[6]!.textContent).toContain('Master');
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
      expect(colorAndShape(cell(0).querySelector('.note-dot')!)).toEqual([2, 'trapezoid']);
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
      expect(updated.textContent).toBe('');
    });

    describe('top and bottom halves', () => {
      const option = (color: number) => $$('.note-option')[color] as HTMLElement;
      const switchHalf = () => $('.note-half-toggle').click();
      const dots = (node: Element, half: 'top' | 'bottom') =>
        [...node.querySelectorAll(`.note-half-${half} .note-dot`)].map((d) =>
          Number(/color-(\d)/.exec(d.className)![1]),
        );

      /** Clicks a note square in its top or bottom half (the square is 40px tall at y 100). */
      const clickHalf = (node: HTMLElement, half: 'top' | 'bottom') => {
        node.getBoundingClientRect = () =>
          ({ left: 0, top: 100, right: 40, bottom: 140, width: 40, height: 40 }) as DOMRect;
        const y = half === 'top' ? 110 : 130;
        node.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: y }));
      };

      it('opens on the half of the square that was pressed', () => {
        clickHalf(cell(0), 'bottom');
        expect($('.note-menu').dataset['half']).toBe('bottom');
        option(2).click();
        expect(dots(cell(0), 'bottom')).toEqual([2]);
        clickHalf(cell(0), 'top');
        expect($('.note-menu').dataset['half']).toBe('top');
        const bin = $('#spawner-notes-grid [data-color="1"][data-slot="0"]');
        clickHalf(bin, 'bottom');
        option(4).click();
        expect(dots($('#spawner-notes-grid [data-color="1"][data-slot="0"]'), 'bottom')).toEqual([
          4,
        ]);
      });

      it('puts top notes in the top half and bottom notes in the bottom half', () => {
        cell(0).click();
        option(1).click();
        switchHalf();
        option(3).click();
        option(4).click();
        expect(dots(cell(0), 'top')).toEqual([1]);
        expect(dots(cell(0), 'bottom')).toEqual([3, 4]);
      });

      it('draws a divider whenever either half has notes', () => {
        const divider = () => cell(0).querySelector('.note-divider');
        expect(divider()).toBeNull();
        cell(0).click();
        option(1).click();
        expect(divider()).not.toBeNull();
        expect(dots(cell(0), 'top')).toEqual([1]);
        switchHalf();
        option(2).click();
        expect(divider()).not.toBeNull();
        switchHalf();
        option(1).click();
        expect(divider()).not.toBeNull();
        expect(dots(cell(0), 'bottom')).toEqual([2]);
        expect(cell(0).querySelector('.note-half-top')).toBeNull();
        switchHalf();
        option(2).click();
        expect(divider()).toBeNull();
      });

      it('works in the notes under the bins, and undo takes a bottom note back', () => {
        const noteCell = () => $('#spawner-notes-grid [data-color="0"][data-slot="0"]');
        noteCell().click();
        switchHalf();
        option(2).click();
        expect(dots(noteCell(), 'bottom')).toEqual([2]);
        $('#undo-btn').click();
        expect(noteCell().querySelector('.note-dot')).toBeNull();
        expect(noteCell().textContent).toContain('Notes');
      });
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

  describe('help', () => {
    it('opens from the toolbar and explains the rules', () => {
      expect($('#help-modal').hidden).toBe(true);
      $('#help-btn').click();
      expect($('#help-modal').hidden).toBe(false);
      expect($('#help-body').textContent).toMatch(/always/i);
      expect($('#help-body').textContent).toMatch(/never/i);
    });

    it('closes with the button, the scrim and Escape', () => {
      $('#help-btn').click();
      $('#close-help-btn').click();
      expect($('#help-modal').hidden).toBe(true);

      $('#help-btn').click();
      $('#help-modal').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect($('#help-modal').hidden).toBe(true);

      $('#help-btn').click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect($('#help-modal').hidden).toBe(true);
    });

    it('does not undo while the help is open', () => {
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      $('#help-btn').click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
      expect(cell(0).classList.contains('color-0')).toBe(true);
    });

    it('closes when the app is destroyed', () => {
      $('#help-btn').click();
      app.destroy();
      expect($('#help-modal').hidden).toBe(true);
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

  describe('tutorial', () => {
    const restart = async (url?: string) => {
      app.destroy();
      document.body.innerHTML = '<div id="app"></div>';
      storage.delete(TUTORIAL_SEEN_KEY);
      source.calls.length = 0;
      await startApp(url);
    };

    it('runs the first time the game is opened and remembers that it did', async () => {
      await restart();
      await vi.waitFor(() => expect($$('.tutorial-bubble')).toHaveLength(1));
      expect(storage.get(TUTORIAL_SEEN_KEY)).toBe('1');
      expect($('.tutorial-title').textContent!.length).toBeGreaterThan(0);
    });

    it('does not run again afterwards', () => {
      expect($$('.tutorial')).toHaveLength(0);
    });

    it('can be started from the help dialog, which it closes', async () => {
      $('#help-btn').click();
      $('#start-tutorial-btn').click();
      await vi.waitFor(() => expect($$('.tutorial-bubble')).toHaveLength(1));
      expect($('#help-modal').hidden).toBe(true);
    });

    it('generates another puzzle when this one cannot show every element', async () => {
      source.queue = [puzzleWithoutVerticalClues()];
      await restart();
      await vi.waitFor(() => expect(source.calls.length).toBeGreaterThanOrEqual(2));
      await vi.waitFor(() => expect($$('.tutorial-bubble')).toHaveLength(1));
      expect($$('#relationship-clues-container .relation-slot.vertical').length).toBeGreaterThan(0);
    });

    it('gives up after a few tries and runs on what it has', async () => {
      source.next = puzzleWithoutVerticalClues();
      await restart();
      await vi.waitFor(() => expect($$('.tutorial-bubble')).toHaveLength(1));
      expect(source.calls).toHaveLength(1 + TUTORIAL_MAX_ATTEMPTS);
      expect($('#status').textContent).toBe('');
    });

    it('keeps a shared puzzle exactly as it was', async () => {
      await restart(`https://example.com/?p=${encodePuzzle(puzzleWithoutVerticalClues())}`);
      await vi.waitFor(() => expect($$('.tutorial-bubble')).toHaveLength(1));
      expect(source.calls).toHaveLength(0);
    });

    it('blocks play while it runs', async () => {
      await restart();
      await vi.waitFor(() => expect($$('.tutorial-bubble')).toHaveLength(1));
      drag($('#spawner-grid [data-drag="tray"][data-color="0"]'), cell(0));
      expect(cell(0).classList.contains('drop-zone')).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
      expect($$('.tutorial-bubble')).toHaveLength(1);
      cell(0).click();
      expect($$('.note-menu')).toHaveLength(0);
    });

    it('stops when the app is destroyed', async () => {
      await restart();
      await vi.waitFor(() => expect($$('.tutorial-bubble')).toHaveLength(1));
      app.destroy();
      expect($$('.tutorial')).toHaveLength(0);
    });
  });
});
