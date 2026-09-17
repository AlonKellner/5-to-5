import { describe, expect, it, vi } from 'vitest';
import { formatBoard } from '../board';
import { clueSetFromMask } from '../clues';
import { DIFFICULTY_LEVELS } from '../puzzle';
import { Rng } from '../rng';
import { countSolutions } from '../solver/search';
import { isValidBoard } from '../validator';
import { sampledBoards } from '../../../test/fixtures/boards';
import { generatePuzzle, puzzleForBoard, ratePuzzle, scoreBand } from './generate';

describe('scoreBand', () => {
  it('covers the scores that round to the level', () => {
    expect(scoreBand(1)).toEqual({ min: 50, max: 149 });
    expect(scoreBand(7)).toEqual({ min: 650, max: 749 });
  });
});

describe('puzzleForBoard', () => {
  it('lands inside the band and reports the rating of the returned mask', () => {
    const board = sampledBoards()[0]!;
    const found = puzzleForBoard(board, 3, new Rng('pfb'), 6)!;
    expect(found).not.toBeNull();
    const band = scoreBand(3);
    expect(found.rating.score).toBeGreaterThanOrEqual(band.min);
    expect(found.rating.score).toBeLessThanOrEqual(band.max);
    expect(ratePuzzle(board, found.mask)).toEqual(found.rating);
  });

  it('averages near 100 × level', () => {
    for (const level of [2, 4] as const) {
      const scores = sampledBoards().map(
        (board, i) => puzzleForBoard(board, level, new Rng(`avg-${level}-${i}`), 6)!.rating.score,
      );
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      expect(Math.abs(mean - level * 100)).toBeLessThan(25);
    }
  });
});

describe('generatePuzzle', () => {
  it.each(DIFFICULTY_LEVELS)('generates a unique level %i puzzle', (difficulty) => {
    const puzzle = generatePuzzle({ seed: 'test', difficulty });
    expect(isValidBoard(puzzle.solution)).toBe(true);
    expect(
      countSolutions(clueSetFromMask(puzzle.solution, puzzle.mask), { limit: 2 }),
    ).toMatchObject({ status: 'complete', count: 1 });
    expect(puzzle.rating?.level).toBe(difficulty);
    expect(puzzle.seed).toBe('test');
  });

  it('is deterministic for a seed and difficulty', () => {
    const a = generatePuzzle({ seed: 'same', difficulty: 3 });
    const b = generatePuzzle({ seed: 'same', difficulty: 3 });
    expect(formatBoard(a.solution)).toBe(formatBoard(b.solution));
    expect([...a.mask]).toEqual([...b.mask]);
  });

  it('gives different puzzles for different seeds', () => {
    const a = generatePuzzle({ seed: 'one', difficulty: 2 });
    const b = generatePuzzle({ seed: 'two', difficulty: 2 });
    expect(formatBoard(a.solution)).not.toBe(formatBoard(b.solution));
  });

  it('reports progress', () => {
    const onProgress = vi.fn();
    generatePuzzle({ seed: 'progress', difficulty: 5, onProgress, progressInterval: 5000 });
    const phases = new Set(onProgress.mock.calls.map(([event]) => event.phase));
    expect(phases).toContain('board');
    expect(phases).toContain('clues');
  });
});
