import { describe, expect, it, vi } from 'vitest';
import { legacyPuzzle, legacySolution } from '../../test/fixtures/legacyPuzzle';
import {
  emptyMask,
  fullMask,
  horizontalEdge,
  slotOfEdge,
  verticalEdge,
  type ClueMask,
} from '../core/clues';
import { CELL_COUNT } from '../core/constants';
import type { Puzzle } from '../core/puzzle';
import {
  hasSeenTutorial,
  markTutorialSeen,
  missingFeatures,
  puzzleFeatures,
  puzzleSupportsTutorial,
  REQUIRED_FEATURES,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_STEPS,
} from './tutorialSteps';

const puzzleWith = (mask: ClueMask): Puzzle => ({ solution: legacySolution(), mask });

describe('TUTORIAL_STEPS', () => {
  it('gives every step an id, a title, a body and a target', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.id.length, step.id).toBeGreaterThan(0);
      expect(step.title.length, step.id).toBeGreaterThan(0);
      expect(step.body.length, step.id).toBeGreaterThan(10);
      expect(step.target.length, step.id).toBeGreaterThan(0);
    }
    const ids = TUTORIAL_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the board, the clues, the bins, the notes and the controls', () => {
    const ids = new Set(TUTORIAL_STEPS.map((step) => step.id));
    for (const id of [
      'goal',
      'board',
      'locked-tile',
      'empty-cell',
      'relation-horizontal',
      'relation-vertical',
      'bins',
      'cycle-arrows',
      'notes',
      'top-controls',
      'bottom-controls',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('only requires features that a step actually uses', () => {
    const used = new Set(TUTORIAL_STEPS.flatMap((step) => step.requires ?? []));
    expect([...REQUIRED_FEATURES].sort()).toEqual([...used].sort());
  });
});

describe('puzzleFeatures', () => {
  it('finds every feature in a normal puzzle', () => {
    expect(puzzleSupportsTutorial(legacyPuzzle())).toBe(true);
    expect(missingFeatures(legacyPuzzle())).toEqual([]);
    for (const feature of REQUIRED_FEATURES) {
      expect(puzzleFeatures(legacyPuzzle()).has(feature), feature).toBe(true);
    }
  });

  it('notices a puzzle without a horizontal relation clue', () => {
    const mask = emptyMask();
    mask[0] = 1;
    mask[slotOfEdge(verticalEdge(0, 0))] = 1;
    expect(missingFeatures(puzzleWith(mask))).toEqual(['horizontal-relation']);
    expect(puzzleSupportsTutorial(puzzleWith(mask))).toBe(false);
  });

  it('notices a puzzle without a vertical relation clue', () => {
    const mask = emptyMask();
    mask[0] = 1;
    mask[slotOfEdge(horizontalEdge(0, 0))] = 1;
    expect(missingFeatures(puzzleWith(mask))).toEqual(['vertical-relation']);
  });

  it('notices a puzzle without a locked tile', () => {
    const mask = emptyMask();
    mask[slotOfEdge(horizontalEdge(0, 0))] = 1;
    mask[slotOfEdge(verticalEdge(0, 0))] = 1;
    expect(missingFeatures(puzzleWith(mask))).toEqual(['locked-tile']);
  });

  it('notices a board with no empty cell and no tiles left in the bins', () => {
    const missing = missingFeatures(puzzleWith(fullMask()));
    expect(missing).toContain('empty-cell');
    expect(missing).toContain('stocked-bin');
  });

  it('counts a bin as stocked while any tile of that color is unplaced', () => {
    const mask = emptyMask();
    for (let cell = 0; cell < CELL_COUNT; cell++) mask[cell] = 1;
    mask[0] = 0;
    mask[slotOfEdge(horizontalEdge(0, 0))] = 1;
    mask[slotOfEdge(verticalEdge(0, 0))] = 1;
    expect(puzzleFeatures(puzzleWith(mask)).has('stocked-bin')).toBe(true);
    expect(puzzleSupportsTutorial(puzzleWith(mask))).toBe(true);
  });
});

describe('the seen flag', () => {
  const store = (value: string | null) => ({
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  });

  it('is false until the tutorial has run', () => {
    expect(hasSeenTutorial(store(null))).toBe(false);
    expect(hasSeenTutorial(store('1'))).toBe(true);
  });

  it('counts as seen when there is no storage, so it never repeats on every load', () => {
    expect(hasSeenTutorial(null)).toBe(true);
    expect(hasSeenTutorial(undefined)).toBe(true);
    expect(
      hasSeenTutorial({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: vi.fn(),
      }),
    ).toBe(true);
  });

  it('records that the tutorial ran, ignoring write failures', () => {
    const storage = store(null);
    markTutorialSeen(storage);
    expect(storage.setItem).toHaveBeenCalledWith(TUTORIAL_SEEN_KEY, '1');
    expect(() =>
      markTutorialSeen({
        getItem: () => null,
        setItem: () => {
          throw new Error('full');
        },
      }),
    ).not.toThrow();
    expect(() => markTutorialSeen(null)).not.toThrow();
  });
});
