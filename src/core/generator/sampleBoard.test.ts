import { describe, expect, it } from 'vitest';
import { flat, HTML_SOLUTION } from '../../../test/fixtures/legacy';
import { createBoard, formatBoard, permuteColors, SYMMETRIES, transformBoard } from '../board';
import { PERMUTATIONS } from '../rules';
import { Rng } from '../rng';
import { isValidBalancedBoard, isValidBoard } from '../validator';
import {
  createSampler,
  sampleBoardRejection,
  SuffixChecker,
  type SamplerKind,
} from './sampleBoard';

const KINDS: SamplerKind[] = ['rejection', 'early-rejection', 'dfs'];

describe.each(KINDS)('%s sampler', (kind) => {
  it('returns a strictly valid board', () => {
    const result = sampleBoardRejection(new Rng(`valid-${kind}`), { kind });
    expect(result).not.toBeNull();
    expect(isValidBoard(result!.board)).toBe(true);
    expect(result!.trials).toBeGreaterThan(0);
  });

  it('is deterministic for a seed', () => {
    const a = sampleBoardRejection(new Rng('det'), { kind })!;
    const b = sampleBoardRejection(new Rng('det'), { kind })!;
    expect(formatBoard(a.board)).toBe(formatBoard(b.board));
    expect(a.trials).toBe(b.trials);
  });

  it('gives up after maxTrials', () => {
    expect(sampleBoardRejection(new Rng('limit'), { maxTrials: 0, kind })).toBeNull();
  });

  it('can be run in chunks with the same result as one call', () => {
    const whole = sampleBoardRejection(new Rng('chunks'), { kind })!;
    const sampler = createSampler(kind, new Rng('chunks'));
    let board = null;
    while (board === null) board = sampler.run(1000);
    expect(formatBoard(board)).toBe(formatBoard(whole.board));
    expect(sampler.trials).toBe(whole.trials);
  });
});

describe('SuffixChecker', () => {
  function replay(cells: ArrayLike<number>): boolean {
    const checker = new SuffixChecker();
    checker.reset();
    for (let i = 24; i >= 0; i--) if (!checker.fix(cells, i)) return false;
    return checker.finish();
  }

  it('accepts every symmetric relabeling of a valid board', () => {
    const board = createBoard(flat(HTML_SOLUTION));
    for (const s of SYMMETRIES) {
      for (const perm of PERMUTATIONS) {
        expect(replay(permuteColors(transformBoard(board, s), perm))).toBe(true);
      }
    }
  });

  it('never rejects early a board the full validator accepts, and agrees at the end', () => {
    const rng = new Rng('suffix-oracle');
    const base = createBoard(flat(HTML_SOLUTION));
    for (let n = 0; n < 20_000; n++) {
      const cells =
        n % 2 === 0
          ? rng.shuffle(Uint8Array.from({ length: 25 }, (_, k) => Math.floor(k / 5)))
          : (() => {
              const b = base.slice();
              for (let s = 0; s < 1 + (n % 3); s++) {
                const i = rng.nextInt(25);
                const j = rng.nextInt(25);
                [b[i], b[j]] = [b[j]!, b[i]!];
              }
              return b;
            })();
      expect(replay(cells)).toBe(isValidBalancedBoard(cells));
    }
  });
});
