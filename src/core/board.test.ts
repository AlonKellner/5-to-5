import { describe, expect, it } from 'vitest';
import { flat, HTML_SOLUTION } from '../../test/fixtures/legacy';
import {
  boardFromKey,
  boardKey,
  canonicalBoardKey,
  colorCounts,
  createBoard,
  formatBoard,
  parseBoard,
  permuteColors,
  SYMMETRIES,
  transformBoard,
} from './board';
import { PERMUTATIONS } from './rules';
import { Rng } from './rng';

const HTML_TEXT = 'bprrp/ygprg/ybgrr/ypygb/bgbpy';

function randomBoard(rng: Rng) {
  const cells = Array.from({ length: 25 }, (_, i) => Math.floor(i / 5));
  return createBoard(rng.shuffle(cells));
}

describe('board text format', () => {
  it('parses the letter format', () => {
    expect([...parseBoard(HTML_TEXT)]).toEqual(flat(HTML_SOLUTION));
  });

  it('accepts whitespace, newlines and digits', () => {
    const text = '14004\n32402\n31200\n34321\n12143';
    expect([...parseBoard(text)]).toEqual(flat(HTML_SOLUTION));
    expect([...parseBoard('bprrp ygprg ybgrr ypygb bgbpy')]).toEqual(flat(HTML_SOLUTION));
  });

  it('formats and round-trips', () => {
    const board = parseBoard(HTML_TEXT);
    expect(formatBoard(board)).toBe(HTML_TEXT);
    expect(formatBoard(board, '\n')).toBe(HTML_TEXT.replaceAll('/', '\n'));
  });

  it('rejects malformed text', () => {
    expect(() => parseBoard('bprrp')).toThrow();
    expect(() => parseBoard('xprrp/ygprg/ybgrr/ypygb/bgbpy')).toThrow();
  });

  it('createBoard rejects wrong sizes and out-of-range colors', () => {
    expect(() => createBoard([0, 1, 2])).toThrow();
    expect(() => createBoard(new Array(25).fill(5))).toThrow();
  });
});

describe('board keys', () => {
  it('round-trips through the bigint key', () => {
    const rng = new Rng('keys');
    for (let i = 0; i < 100; i++) {
      const board = randomBoard(rng);
      expect([...boardFromKey(boardKey(board))]).toEqual([...board]);
    }
  });

  it('gives distinct keys to distinct boards', () => {
    const rng = new Rng('distinct');
    const seen = new Map<bigint, string>();
    for (let i = 0; i < 2000; i++) {
      const board = randomBoard(rng);
      const key = boardKey(board);
      const text = formatBoard(board);
      if (seen.has(key)) expect(seen.get(key)).toBe(text);
      seen.set(key, text);
    }
  });

  it('counts colors', () => {
    expect([...colorCounts(parseBoard(HTML_TEXT))]).toEqual([5, 5, 5, 5, 5]);
  });
});

describe('symmetries', () => {
  const board = parseBoard(HTML_TEXT);

  it('has 8 symmetries producing 8 distinct boards for an asymmetric board', () => {
    expect(SYMMETRIES).toHaveLength(8);
    const images = new Set(SYMMETRIES.map((s) => formatBoard(transformBoard(board, s))));
    expect(images.size).toBe(8);
  });

  it('starts with the identity', () => {
    expect(formatBoard(transformBoard(board, SYMMETRIES[0]!))).toBe(HTML_TEXT);
  });

  it('rotating four times is the identity', () => {
    const rot90 = SYMMETRIES[1]!;
    let b = board;
    for (let i = 0; i < 4; i++) b = transformBoard(b, rot90);
    expect(formatBoard(b)).toBe(HTML_TEXT);
  });

  it('forms a group closed under composition', () => {
    const keys = new Set(SYMMETRIES.map((s) => formatBoard(transformBoard(board, s))));
    for (const s of SYMMETRIES) {
      for (const t of SYMMETRIES) {
        expect(keys.has(formatBoard(transformBoard(transformBoard(board, s), t)))).toBe(true);
      }
    }
  });

  it('keeps neighbors as neighbors', () => {
    const adjacent = (i: number, j: number) => {
      const [ri, ci, rj, cj] = [Math.floor(i / 5), i % 5, Math.floor(j / 5), j % 5];
      return Math.abs(ri - rj) + Math.abs(ci - cj) === 1;
    };
    for (const s of SYMMETRIES) {
      for (let i = 0; i < 25; i++) {
        for (let j = 0; j < 25; j++) {
          expect(adjacent(s[i]!, s[j]!)).toBe(adjacent(i, j));
        }
      }
    }
  });
});

describe('color permutations and canonical keys', () => {
  const board = parseBoard(HTML_TEXT);

  it('permutes colors', () => {
    const perm = [1, 2, 3, 4, 0];
    const permuted = permuteColors(board, perm);
    for (let i = 0; i < 25; i++) expect(permuted[i]).toBe(perm[board[i]!]);
  });

  it('gives the same canonical key to all 960 symmetric relabelings', () => {
    const expected = canonicalBoardKey(board);
    for (const s of SYMMETRIES) {
      for (const perm of PERMUTATIONS) {
        expect(canonicalBoardKey(permuteColors(transformBoard(board, s), perm))).toBe(expected);
      }
    }
  });

  it('distinguishes non-equivalent boards', () => {
    const other = parseBoard('rrrrr/bbbbb/ggggg/yyyyy/ppppp');
    expect(canonicalBoardKey(other)).not.toBe(canonicalBoardKey(board));
  });
});
