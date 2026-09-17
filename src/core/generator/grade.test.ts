import { describe, expect, it } from 'vitest';
import { legacyPuzzleMask, legacySolution } from '../../../test/fixtures/legacyPuzzle';
import { sampledBoards } from '../../../test/fixtures/boards';
import { clueSetFromMask, fullMask, SLOT_COUNT } from '../clues';
import { Rng } from '../rng';
import { LEVEL } from '../solver/propagate';
import { countSolutions } from '../solver/search';
import { digClues } from './dig';
import {
  DEDUCTION_WEIGHTS,
  GUESS_WEIGHT,
  gradePuzzle,
  levelFromScore,
  scoreFromEffort,
} from './grade';

const solution = legacySolution();

describe('scoreFromEffort and levelFromScore', () => {
  it('maps effort on a log scale: 2^3.5 → 100, 2^11.5 → 700', () => {
    expect(scoreFromEffort(2 ** 3.5)).toBe(100);
    expect(scoreFromEffort(2 ** 11.5)).toBe(700);
    expect(scoreFromEffort(2 ** 7.5)).toBe(400);
  });

  it('is monotone and never negative', () => {
    let previous = -1;
    for (let effort = 1; effort < 1e6; effort *= 1.7) {
      const score = scoreFromEffort(effort);
      expect(score).toBeGreaterThanOrEqual(previous);
      expect(score).toBeGreaterThanOrEqual(0);
      previous = score;
    }
  });

  it('rounds scores to the nearest hundred and clamps to levels 1–7', () => {
    expect(levelFromScore(0)).toBe(1);
    expect(levelFromScore(149)).toBe(1);
    expect(levelFromScore(150)).toBe(2);
    expect(levelFromScore(449)).toBe(4);
    expect(levelFromScore(700)).toBe(7);
    expect(levelFromScore(2000)).toBe(7);
  });
});

describe('gradePuzzle', () => {
  it('grades a fully clued board as trivial', () => {
    const grade = gradePuzzle(solution, fullMask());
    expect(grade.unique).toBe(true);
    expect(grade.stats.steps.slice(1)).toEqual([0, 0, 0, 0]);
    expect(grade.stats.guessNodes).toBe(0);
    expect(grade.level).toBe(1);
  });

  it('computes effort from weighted deduction steps and guesses', () => {
    const { stats, score } = gradePuzzle(solution, legacyPuzzleMask());
    const effort =
      stats.steps.reduce((acc, n, level) => acc + n * DEDUCTION_WEIGHTS[level]!, 0) +
      GUESS_WEIGHT * stats.guessNodes;
    expect(stats.effort).toBe(effort);
    expect(score).toBe(scoreFromEffort(effort));
    expect(stats).toMatchObject({ tileClues: 4, relationClues: 12 });
  });

  it('needs hypotheses but no guessing for the legacy puzzle', () => {
    const grade = gradePuzzle(solution, legacyPuzzleMask());
    expect(grade.unique).toBe(true);
    expect(grade.stats.steps[LEVEL.PROBE]).toBeGreaterThan(0);
    expect(grade.stats.guessNodes).toBe(0);
  });

  it('only uses the deductions a level-dug puzzle was dug with', () => {
    const { mask } = digClues(solution, new Rng('grade-p1'), {
      criterion: { kind: 'propagation', level: LEVEL.NEVER },
    });
    const { stats, unique } = gradePuzzle(solution, mask);
    expect(unique).toBe(true);
    expect(stats.steps[LEVEL.NEVER]).toBeGreaterThan(0);
    expect(stats.steps.slice(LEVEL.MUST)).toEqual([0, 0, 0]);
    expect(stats.guessNodes).toBe(0);
  });

  it('detects puzzles with more than one solution', () => {
    const mask = legacyPuzzleMask();
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!mask[slot]) continue;
      const reduced = mask.slice();
      reduced[slot] = 0;
      const expected = countSolutions(clueSetFromMask(solution, reduced), { limit: 2 }).count === 1;
      expect(gradePuzzle(solution, reduced).unique).toBe(expected);
    }
  });

  it('rates minimal unique puzzles harder than hypothesis-only puzzles on average', () => {
    let probe = 0;
    let unique = 0;
    sampledBoards()
      .slice(0, 4)
      .forEach((board, i) => {
        probe += gradePuzzle(
          board,
          digClues(board, new Rng(`p${i}`), {
            criterion: { kind: 'propagation', level: LEVEL.PROBE },
          }).mask,
        ).score;
        unique += gradePuzzle(
          board,
          digClues(board, new Rng(`u${i}`), { criterion: { kind: 'unique' } }).mask,
        ).score;
      });
    expect(unique).toBeGreaterThan(probe);
  });

  it('is deterministic', () => {
    expect(gradePuzzle(solution, legacyPuzzleMask())).toEqual(
      gradePuzzle(solution, legacyPuzzleMask()),
    );
  });
});
