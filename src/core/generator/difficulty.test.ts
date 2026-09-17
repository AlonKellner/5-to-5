import { describe, expect, it } from 'vitest';
import { legacyPuzzleMask, legacySolution } from '../../../test/fixtures/legacyPuzzle';
import { fullMask, SLOT_COUNT } from '../clues';
import { Rng } from '../rng';
import { LEVEL } from '../solver/propagate';
import { measureDifficulty } from './difficulty';
import { digClues } from './dig';

const solution = legacySolution();

describe('measureDifficulty', () => {
  it('rates a fully clued board as trivial', () => {
    expect(measureDifficulty(solution, fullMask())).toEqual({
      propagationLevel: LEVEL.COUNTS,
      nodes: 1,
      guessDepth: 0,
      tileClues: 25,
      relationClues: 40,
    });
  });

  it('measures the legacy puzzle', () => {
    const stats = measureDifficulty(solution, legacyPuzzleMask());
    expect(stats.tileClues).toBe(4);
    expect(stats.relationClues).toBe(12);
    expect(stats.nodes).toBeGreaterThanOrEqual(1);
    expect(stats).toMatchSnapshot();
  });

  it('reports the lowest propagation level that solves a level-dug puzzle', () => {
    for (const level of [LEVEL.NEVER, LEVEL.MUST, LEVEL.EXACT]) {
      const { mask } = digClues(solution, new Rng(`measure-${level}`), {
        criterion: { kind: 'propagation', level },
      });
      const stats = measureDifficulty(solution, mask);
      expect(stats.propagationLevel).not.toBeNull();
      expect(stats.propagationLevel!).toBeLessThanOrEqual(level);
      expect(stats.guessDepth).toBe(0);
    }
  });

  it('never needs a stronger propagation level when clues are added', () => {
    const rng = new Rng('monotone');
    const { mask } = digClues(solution, rng, {
      criterion: { kind: 'propagation', level: LEVEL.EXACT },
    });
    let previous = measureDifficulty(solution, mask).propagationLevel!;
    const current = mask.slice();
    const hidden = Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((s) => !current[s]);
    for (const slot of rng.shuffle(hidden).slice(0, 15)) {
      current[slot] = 1;
      const level = measureDifficulty(solution, current).propagationLevel!;
      expect(level).toBeLessThanOrEqual(previous);
      previous = level;
    }
  });
});
