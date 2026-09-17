import { describe, expect, it } from 'vitest';
import {
  CREATOR_RULESET,
  CREATOR_SOLUTION,
  flat,
  HTML_RULESET,
  HTML_SOLUTION,
  SOLVER_TEST_RULESET,
  SOLVER_TEST_SOLUTION,
} from '../../test/fixtures/legacy';
import { referenceDeriveRuleset } from '../../test/reference/referenceValidator';
import { createBoard, parseBoard, permuteColors, SYMMETRIES, transformBoard } from './board';
import { PERMUTATIONS, permuteRuleset } from './rules';
import { Rng } from './rng';
import {
  analyzeBoard,
  boardViolations,
  deriveRuleset,
  isValidBalancedBoard,
  isValidBoard,
  rulesetFromAnalysis,
} from './validator';

describe('validator on known valid boards', () => {
  it.each([
    ['legacy HTML puzzle', HTML_SOLUTION, HTML_RULESET],
    ['solver test', SOLVER_TEST_SOLUTION, SOLVER_TEST_RULESET],
    ['puzzle creator', CREATOR_SOLUTION, CREATOR_RULESET],
  ])('accepts the %s board and derives its ruleset', (_name, rows, ruleset) => {
    const board = createBoard(flat(rows));
    expect(isValidBoard(board)).toBe(true);
    expect(deriveRuleset(board)).toEqual(ruleset);
    expect(boardViolations(board)).toEqual([]);
  });
});

describe('validator on invalid boards', () => {
  it('rejects wrong color counts', () => {
    const cells = flat(HTML_SOLUTION);
    cells[0] = cells[0] === 0 ? 1 : 0;
    const board = createBoard(cells);
    expect(isValidBoard(board)).toBe(false);
    expect(boardViolations(board).map((v) => v.kind)).toContain('count');
  });

  it('rejects a color whose copies are all adjacent to two common colors', () => {
    const board = parseBoard('rrrrr/bbbbb/ggggg/yyyyy/ppppp');
    const analysis = analyzeBoard(board);
    expect(analysis.common[0]).toBe(0b00011); // r and b
    expect(isValidBoard(board)).toBe(false);
    expect(boardViolations(board)).toContainEqual({ kind: 'common', color: 0 });
  });

  it('rejects a color that touches all five colors (nothing is missing)', () => {
    const board = parseBoard('rrbbb/gypbb/ggggp/yyyyp/rrrpp');
    expect(analyzeBoard(board).seen[0]).toBe(0b11111);
    expect(isValidBoard(board)).toBe(false);
    expect(boardViolations(board)).toContainEqual({ kind: 'missing', color: 0 });
  });

  it('rejects derived rules where must is not an involution', () => {
    // r must b, b must g, g must r: singletons everywhere but not an involution.
    const analysis = {
      counts: [5, 5, 5, 5, 5],
      common: [0b00010, 0b00100, 0b00001, 0b01000, 0b10000],
      seen: [0b01111, 0b11101, 0b11011, 0b10111, 0b11110],
    };
    expect(rulesetFromAnalysis(analysis)).toBeNull();
  });
});

describe('validator invariances', () => {
  const board = createBoard(flat(HTML_SOLUTION));

  it('is invariant under the 8 board symmetries', () => {
    for (const s of SYMMETRIES) {
      expect(deriveRuleset(transformBoard(board, s))).toEqual(HTML_RULESET);
    }
  });

  it('transforms the derived ruleset under color relabeling', () => {
    for (const perm of PERMUTATIONS) {
      expect(deriveRuleset(permuteColors(board, perm))).toEqual(permuteRuleset(HTML_RULESET, perm));
    }
  });
});

describe('validator agrees with an independent reference implementation', () => {
  it('on random shuffles and on local mutations of valid boards', () => {
    const rng = new Rng('validator-oracle');
    const valid = [HTML_SOLUTION, SOLVER_TEST_SOLUTION, CREATOR_SOLUTION].map(flat);
    for (let i = 0; i < 3000; i++) {
      let cells: number[];
      if (i % 2 === 0) {
        cells = rng.shuffle(Array.from({ length: 25 }, (_, k) => Math.floor(k / 5)));
      } else {
        cells = [...rng.pick(valid)];
        const a = rng.nextInt(25);
        const b = rng.nextInt(25);
        [cells[a], cells[b]] = [cells[b]!, cells[a]!];
      }
      const board = createBoard(cells);
      const expected = referenceDeriveRuleset(cells);
      expect(deriveRuleset(board)).toEqual(expected);
      if (cells.filter((c) => c === 0).length === 5) {
        expect(isValidBalancedBoard(board)).toBe(expected !== null);
      }
    }
  });
});
