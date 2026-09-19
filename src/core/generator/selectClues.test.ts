import { describe, expect, it } from 'vitest';
import { sampledBoards } from '../../../test/fixtures/boards';
import { legacySolution } from '../../../test/fixtures/legacyPuzzle';
import { clueAt, clueSetFromMask, countClueKinds, SLOT_COUNT } from '../clues';
import { Rng } from '../rng';
import { LEVEL } from '../solver/propagate';
import { countSolutions, solveByPropagation } from '../solver/search';
import { gradePuzzle } from './grade';
import { selectCluesByReasoning } from './selectClues';

const solution = legacySolution();

describe('selectCluesByReasoning', () => {
  it('builds a clue set with exactly one solution', () => {
    const { mask } = selectCluesByReasoning(solution, new Rng('reason'));
    expect(countSolutions(clueSetFromMask(solution, mask), { limit: 2 })).toMatchObject({
      status: 'complete',
      count: 1,
    });
  });

  it('keeps the puzzle solvable with the deductions the chain was allowed to use', () => {
    for (const level of [LEVEL.EXACT, LEVEL.PROBE]) {
      const { mask } = selectCluesByReasoning(solution, new Rng(`solvable-${level}`), {
        solveLevel: level,
      });
      expect(solveByPropagation(clueSetFromMask(solution, mask), level).solved).toBe(true);
    }
  });

  it('adds every clue at a point where it unblocks progress', () => {
    const { steps } = selectCluesByReasoning(solution, new Rng('unblock'), { trace: true });
    const placements = steps.filter((s) => s.kind === 'clue');
    expect(placements.length).toBeGreaterThan(0);
    for (const step of placements) expect(step.gain).toBeGreaterThan(0);
    // The chain alternates: clues are only placed when deduction stalled.
    expect(steps.filter((s) => s.kind === 'deduction').length).toBeGreaterThan(placements.length);
  });

  it('uses fewer clues when stronger deductions are allowed', () => {
    let weak = 0;
    let strong = 0;
    for (const board of sampledBoards().slice(0, 4)) {
      weak += countClueKinds(
        selectCluesByReasoning(board, new Rng('w'), { solveLevel: LEVEL.NEVER }).mask,
      ).total;
      strong += countClueKinds(
        selectCluesByReasoning(board, new Rng('w'), { solveLevel: LEVEL.PROBE }).mask,
      ).total;
    }
    expect(strong).toBeLessThan(weak);
  });

  it('places clues that agree with the solution', () => {
    const { mask } = selectCluesByReasoning(solution, new Rng('agree'));
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!mask[slot]) continue;
      const clue = clueAt(solution, slot);
      if (clue.kind === 'tile') expect(solution[clue.cell]).toBe(clue.color);
      else expect((solution[clue.b]! - solution[clue.a]! + 5) % 5).toBe(clue.delta);
    }
  });

  it('is deterministic for a seed and varies between seeds', () => {
    const a = selectCluesByReasoning(solution, new Rng('same'));
    const b = selectCluesByReasoning(solution, new Rng('same'));
    const c = selectCluesByReasoning(solution, new Rng('other'));
    expect([...a.mask]).toEqual([...b.mask]);
    expect([...c.mask]).not.toEqual([...a.mask]);
  });

  it('produces puzzles that need no guessing when the chain avoids it', () => {
    for (const board of sampledBoards().slice(0, 3)) {
      const { mask } = selectCluesByReasoning(board, new Rng('noguess'), {
        solveLevel: LEVEL.EXACT,
      });
      expect(gradePuzzle(board, mask).stats.guessNodes).toBe(0);
    }
  });
});
