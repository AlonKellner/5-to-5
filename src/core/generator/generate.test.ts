import { describe, expect, it, vi } from 'vitest';
import { formatBoard } from '../board';
import { clueSetFromMask } from '../clues';
import { DIFFICULTY_LEVELS, type DifficultyStats } from '../puzzle';
import { countSolutions } from '../solver/search';
import { isValidBoard } from '../validator';
import { classifyDifficulty, difficultyScore, generatePuzzle } from './generate';

const stats = (propagationLevel: number | null, nodes = 1): DifficultyStats => ({
  propagationLevel,
  nodes,
  guessDepth: 0,
  tileClues: 5,
  relationClues: 8,
});

describe('classifyDifficulty', () => {
  it('maps the needed deduction level to a difficulty', () => {
    expect(classifyDifficulty(stats(0))).toBe('easy');
    expect(classifyDifficulty(stats(1))).toBe('easy');
    expect(classifyDifficulty(stats(2))).toBe('medium');
    expect(classifyDifficulty(stats(3))).toBe('medium');
    expect(classifyDifficulty(stats(4))).toBe('hard');
    expect(classifyDifficulty(stats(null, 500))).toBe('expert');
  });

  it('scores harder puzzles higher', () => {
    expect(difficultyScore(stats(1))).toBeLessThan(difficultyScore(stats(2)));
    expect(difficultyScore(stats(3))).toBeLessThan(difficultyScore(stats(4, 30)));
    expect(difficultyScore(stats(4, 30))).toBeLessThan(difficultyScore(stats(null, 30)));
    expect(difficultyScore(stats(null, 30))).toBeLessThan(difficultyScore(stats(null, 3000)));
  });
});

describe('generatePuzzle', () => {
  it.each(DIFFICULTY_LEVELS)('generates a unique %s puzzle of that difficulty', (difficulty) => {
    const puzzle = generatePuzzle({ seed: 'test', difficulty });
    expect(isValidBoard(puzzle.solution)).toBe(true);
    expect(
      countSolutions(clueSetFromMask(puzzle.solution, puzzle.mask), { limit: 2 }),
    ).toMatchObject({
      status: 'complete',
      count: 1,
    });
    expect(puzzle.rating?.level).toBe(difficulty);
    expect(puzzle.seed).toBe('test');
  });

  it('is deterministic for a seed and difficulty', () => {
    const a = generatePuzzle({ seed: 'same', difficulty: 'medium' });
    const b = generatePuzzle({ seed: 'same', difficulty: 'medium' });
    expect(formatBoard(a.solution)).toBe(formatBoard(b.solution));
    expect([...a.mask]).toEqual([...b.mask]);
  });

  it('gives different puzzles for different seeds', () => {
    const a = generatePuzzle({ seed: 'one', difficulty: 'easy' });
    const b = generatePuzzle({ seed: 'two', difficulty: 'easy' });
    expect(formatBoard(a.solution)).not.toBe(formatBoard(b.solution));
  });

  it('reports progress', () => {
    const onProgress = vi.fn();
    generatePuzzle({ seed: 'progress', difficulty: 'hard', onProgress, progressInterval: 5000 });
    const phases = new Set(onProgress.mock.calls.map(([event]) => event.phase));
    expect(phases).toContain('board');
    expect(phases).toContain('clues');
  });
});
