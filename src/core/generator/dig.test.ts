import { describe, expect, it } from 'vitest';
import { legacySolution } from '../../../test/fixtures/legacyPuzzle';
import { clueSetFromMask, countClueKinds, SLOT_COUNT } from '../clues';
import { Rng } from '../rng';
import { countSolutions, solveByPropagation } from '../solver/search';
import { LEVEL } from '../solver/propagate';
import { digClues, shuffledSlots } from './dig';

const solution = legacySolution();

describe('shuffledSlots', () => {
  it('returns a permutation of all slots', () => {
    const order = shuffledSlots(new Rng('order'), 'random');
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: SLOT_COUNT }, (_, i) => i),
    );
  });

  it('puts tiles first or last when asked', () => {
    const tilesFirst = shuffledSlots(new Rng('order'), 'tiles-first');
    expect(tilesFirst.slice(0, 25).every((s) => s < 25)).toBe(true);
    const relationsFirst = shuffledSlots(new Rng('order'), 'relations-first');
    expect(relationsFirst.slice(0, 40).every((s) => s >= 25)).toBe(true);
  });
});

describe('digClues with the uniqueness criterion', () => {
  const result = digClues(solution, new Rng('dig-unique'), { criterion: { kind: 'unique' } });

  it('leaves a puzzle with exactly one solution', () => {
    const count = countSolutions(clueSetFromMask(solution, result.mask), { limit: 2 });
    expect(count).toMatchObject({ status: 'complete', count: 1 });
  });

  it('leaves only necessary clues', () => {
    expect(result.timeouts).toBe(0);
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!result.mask[slot]) continue;
      const reduced = result.mask.slice();
      reduced[slot] = 0;
      expect(countSolutions(clueSetFromMask(solution, reduced), { limit: 2 }).count).toBe(2);
    }
  });

  it('removes most clues', () => {
    expect(countClueKinds(result.mask).total).toBeLessThan(30);
  });

  it('is deterministic for a seed', () => {
    const again = digClues(solution, new Rng('dig-unique'), { criterion: { kind: 'unique' } });
    expect([...again.mask]).toEqual([...result.mask]);
  });

  it('checks every slot once', () => {
    expect(result.checks).toBe(SLOT_COUNT);
  });
});

describe('digClues with a propagation criterion', () => {
  it.each([LEVEL.MUST, LEVEL.EXACT])(
    'keeps the puzzle solvable at level %i and leaves only clues needed at that level',
    (level) => {
      const result = digClues(solution, new Rng(`dig-level-${level}`), {
        criterion: { kind: 'propagation', level },
      });
      const clues = clueSetFromMask(solution, result.mask);
      expect(solveByPropagation(clues, level).solved).toBe(true);
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        if (!result.mask[slot]) continue;
        const reduced = result.mask.slice();
        reduced[slot] = 0;
        expect(solveByPropagation(clueSetFromMask(solution, reduced), level).solved).toBe(false);
      }
    },
  );

  it('needs at least as many clues at a weaker level (on average)', () => {
    let weak = 0;
    let strong = 0;
    for (let i = 0; i < 4; i++) {
      weak += countClueKinds(
        digClues(solution, new Rng(`w${i}`), {
          criterion: { kind: 'propagation', level: LEVEL.NEVER },
        }).mask,
      ).total;
      strong += countClueKinds(
        digClues(solution, new Rng(`w${i}`), { criterion: { kind: 'unique' } }).mask,
      ).total;
    }
    expect(weak).toBeGreaterThanOrEqual(strong);
  });
});

describe('digClues order option', () => {
  it('shifts the clue mix toward the kind removed last', () => {
    let tilesWhenTilesFirst = 0;
    let tilesWhenRelationsFirst = 0;
    for (let i = 0; i < 4; i++) {
      tilesWhenTilesFirst += countClueKinds(
        digClues(solution, new Rng(`mix${i}`), { order: 'tiles-first' }).mask,
      ).tiles;
      tilesWhenRelationsFirst += countClueKinds(
        digClues(solution, new Rng(`mix${i}`), { order: 'relations-first' }).mask,
      ).tiles;
    }
    expect(tilesWhenTilesFirst).toBeLessThan(tilesWhenRelationsFirst);
  });
});
