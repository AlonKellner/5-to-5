import { beforeAll, describe, expect, it } from 'vitest';
import { flat, HTML_RULESET, HTML_SOLUTION } from '../../../test/fixtures/legacy';
import { legacyPuzzleMask } from '../../../test/fixtures/legacyPuzzle';
import { sampledBoards } from '../../../test/fixtures/boards';
import { bruteForceSolutions } from '../../../test/reference/bruteSolver';
import {
  createBoard,
  formatBoard,
  permuteColors,
  SYMMETRIES,
  transformBoard,
  type Board,
} from '../board';
import {
  allClues,
  clueSetFromMask,
  cluesFromMask,
  EDGES,
  emptyClueSet,
  fullMask,
  SLOT_COUNT,
  type ClueMask,
} from '../clues';
import { PERMUTATIONS } from '../rules';
import { Rng } from '../rng';
import { deriveRuleset } from '../validator';
import { countSolutions, solveByPropagation } from './search';

const legacyBoard = createBoard(flat(HTML_SOLUTION));

function consistentWithClues(board: Board, solution: Board, mask: ClueMask): boolean {
  return cluesFromMask(solution, mask).every((clue) =>
    clue.kind === 'tile'
      ? board[clue.cell] === clue.color
      : (((board[clue.b]! - board[clue.a]!) % 5) + 5) % 5 === clue.delta,
  );
}

describe('countSolutions on the legacy puzzle', () => {
  it('finds exactly one solution, equal to the intended board', () => {
    const clues = clueSetFromMask(legacyBoard, legacyPuzzleMask());
    const result = countSolutions(clues, { limit: 2, collect: true });
    expect(result.status).toBe('complete');
    expect(result.count).toBe(1);
    expect(formatBoard(result.solutions[0]!)).toBe(formatBoard(legacyBoard));
  });

  it('finds several solutions when a necessary clue is removed', () => {
    const mask = legacyPuzzleMask();
    let foundNecessary = false;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!mask[slot]) continue;
      const reduced = mask.slice();
      reduced[slot] = 0;
      const result = countSolutions(clueSetFromMask(legacyBoard, reduced), {
        limit: 2,
        collect: true,
      });
      expect(result.count).toBeGreaterThanOrEqual(1);
      for (const s of result.solutions) {
        expect(deriveRuleset(s)).not.toBeNull();
        expect(consistentWithClues(s, legacyBoard, reduced)).toBe(true);
      }
      if (result.count === 2) {
        foundNecessary = true;
        expect(formatBoard(result.solutions[0]!)).not.toBe(formatBoard(result.solutions[1]!));
      }
    }
    expect(foundNecessary).toBe(true);
  });
});

describe('countSolutions edge cases', () => {
  it('solves a fully clued board by propagation alone', () => {
    const clues = clueSetFromMask(legacyBoard, fullMask());
    const result = countSolutions(clues, { limit: 2 });
    expect(result.count).toBe(1);
    expect(result.maxDepth).toBe(0);
    expect(solveByPropagation(clues, 0).solved).toBe(true);
  });

  it('stops at the limit when there are no clues', () => {
    const result = countSolutions(emptyClueSet(), { limit: 2 });
    expect(result.status).toBe('limit');
    expect(result.count).toBe(2);
  });

  it('reports a timeout when the node budget runs out', () => {
    const result = countSolutions(emptyClueSet(), { limit: 1000, maxNodes: 5 });
    expect(result.status).toBe('timeout');
  });

  it('reports zero solutions for contradictory clues', () => {
    const clues = emptyClueSet();
    clues.tiles[0] = 0;
    clues.relations[0] = 0;
    clues.tiles[1] = 1;
    const result = countSolutions(clues, { limit: 2 });
    expect(result).toMatchObject({ status: 'complete', count: 0 });
  });

  it('respects a pinned ruleset', () => {
    const result = countSolutions(emptyClueSet(), {
      limit: 3,
      collect: true,
      ruleset: HTML_RULESET,
    });
    expect(result.count).toBe(3);
    for (const s of result.solutions) expect(deriveRuleset(s)).toEqual(HTML_RULESET);
  });

  it('counts the same with a randomized value order', () => {
    const clues = clueSetFromMask(legacyBoard, legacyPuzzleMask());
    for (const seed of ['a', 'b', 'c']) {
      expect(countSolutions(clues, { limit: 2, rng: new Rng(seed) }).count).toBe(1);
    }
  });

  it('is invariant under symmetries and relabeling of the puzzle', () => {
    const rng = new Rng('invariance');
    const mask = legacyPuzzleMask();
    for (let k = 0; k < 10; k++) {
      const symmetry = rng.pick(SYMMETRIES);
      const perm = rng.pick(PERMUTATIONS);
      const board = permuteColors(transformBoard(legacyBoard, symmetry), perm);
      // Transform the clue mask by re-deriving which clue slots map where.
      const transformedMask = new Uint8Array(SLOT_COUNT);
      const inverse = new Int8Array(25);
      symmetry.forEach((src, dst) => (inverse[src] = dst));
      allClues(legacyBoard).forEach((clue) => {
        if (!mask[clue.slot]) return;
        if (clue.kind === 'tile') transformedMask[inverse[clue.cell]!] = 1;
        else {
          const [a, b] = [inverse[clue.a]!, inverse[clue.b]!];
          const edge = EDGES.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
          transformedMask[25 + edge] = 1;
        }
      });
      const result = countSolutions(clueSetFromMask(board, transformedMask), { limit: 2 });
      expect(result.count).toBe(1);
    }
  });
});

describe('countSolutions agrees with the brute-force oracle', () => {
  const boards: Board[] = [];

  beforeAll(() => {
    boards.push(...sampledBoards().slice(0, 4), legacyBoard);
  });

  it('on random dense-to-medium clue sets', () => {
    const rng = new Rng('oracle-masks');
    for (const board of boards) {
      for (let m = 0; m < 6; m++) {
        const density = 0.45 + 0.1 * (m % 3);
        const mask = new Uint8Array(SLOT_COUNT);
        for (let s = 0; s < SLOT_COUNT; s++) mask[s] = rng.nextFloat() < density ? 1 : 0;
        const clues = cluesFromMask(board, mask);
        const tiles = new Array<number>(25).fill(-1);
        const relations: [number, number, number][] = [];
        for (const c of clues) {
          if (c.kind === 'tile') tiles[c.cell] = c.color;
          else relations.push([c.a, c.b, c.delta]);
        }
        const expected = bruteForceSolutions({ tiles, relations }, 50);
        const actual = countSolutions(clueSetFromMask(board, mask), { limit: 50, collect: true });
        expect(actual.count).toBe(expected.length);
        expect(actual.solutions.map((s) => formatBoard(s)).sort()).toEqual(
          expected.map((e) => formatBoard(createBoard(e.cells))).sort(),
        );
      }
    }
  });

  it('on sparse tile-only clue sets with many solutions', () => {
    const rng = new Rng('oracle-sparse');
    let multiSolutionCases = 0;
    for (const board of boards) {
      for (let m = 0; m < 4; m++) {
        const cells = rng.shuffle(Array.from({ length: 25 }, (_, i) => i)).slice(0, 15);
        const mask = new Uint8Array(SLOT_COUNT);
        const tiles = new Array<number>(25).fill(-1);
        for (const c of cells) {
          mask[c] = 1;
          tiles[c] = board[c]!;
        }
        const expected = bruteForceSolutions({ tiles, relations: [] }, 10_000);
        const actual = countSolutions(clueSetFromMask(board, mask), {
          limit: 10_000,
          collect: true,
        });
        expect(actual.status).toBe('complete');
        expect(actual.solutions.map((s) => formatBoard(s)).sort()).toEqual(
          expected.map((e) => formatBoard(createBoard(e.cells))).sort(),
        );
        if (expected.length > 1) multiSolutionCases++;
      }
    }
    expect(multiSolutionCases).toBeGreaterThan(0);
  });

  it('proves every sampled board unique under its full clue set', () => {
    for (const board of boards) {
      expect(countSolutions(clueSetFromMask(board, fullMask()), { limit: 2 }).count).toBe(1);
    }
  });
});
