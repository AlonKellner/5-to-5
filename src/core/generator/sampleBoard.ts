import type { Board } from '../board';
import { ALL_COLORS_MASK, CELL_COUNT, COLOR_COUNT, SIZE, TILES_PER_COLOR } from '../constants';
import { emptyClueSet } from '../clues';
import type { Rng } from '../rng';
import { countSolutions } from '../solver/search';
import { isValidBalancedBoard, neighborMask, rulesetFromAnalysis } from '../validator';

const FIVES = [5, 5, 5, 5, 5];

export interface BoardSampler {
  readonly trials: number;
  /** Runs up to `maxTrials` attempts; returns a valid board or null if none was found yet. */
  run(maxTrials: number): Board | null;
}

/**
 * Exactly uniform sampler over strictly valid boards: shuffle the 25-tile multiset uniformly and
 * accept only valid arrangements.
 */
export class RejectionSampler implements BoardSampler {
  trials = 0;
  private readonly cells = new Uint8Array(CELL_COUNT);

  constructor(private readonly rng: Rng) {
    for (let i = 0; i < CELL_COUNT; i++) this.cells[i] = Math.floor(i / TILES_PER_COLOR);
  }

  run(maxTrials: number): Board | null {
    const { cells, rng } = this;
    for (let t = 0; t < maxTrials; t++) {
      this.trials++;
      rng.shuffle(cells);
      if (isValidBalancedBoard(cells)) return cells.slice();
    }
    return null;
  }
}

/** Cells whose whole neighborhood is fixed once cell i is fixed (cells are fixed from 24 down to 0). */
const COMPLETED_WHEN_FIXED: readonly (readonly number[])[] = Array.from(
  { length: CELL_COUNT },
  (_, i) => {
    const done: number[] = [];
    if (i + SIZE < CELL_COUNT) done.push(i + SIZE);
    if (i < SIZE && i % SIZE < SIZE - 1) done.push(i + 1);
    if (i === 0) done.push(0);
    return done;
  },
);

/**
 * Checks the strict rules incrementally while cells are fixed in order 24, 23, …, 0. A `false`
 * from `fix` is final: every completion of the fixed suffix is invalid.
 */
export class SuffixChecker {
  private readonly common = new Uint8Array(COLOR_COUNT);
  private readonly seen = new Uint8Array(COLOR_COUNT);

  reset(): void {
    this.common.fill(ALL_COLORS_MASK);
    this.seen.fill(0);
  }

  /** Call after cells[i] took its final value; reads only cells[i..24]. */
  fix(cells: ArrayLike<number>, i: number): boolean {
    const { common } = this;
    const color = cells[i]!;
    if (i % SIZE < SIZE - 1 && !this.pair(color, cells[i + 1]!)) return false;
    if (i + SIZE < CELL_COUNT && !this.pair(color, cells[i + SIZE]!)) return false;
    for (const done of COMPLETED_WHEN_FIXED[i]!) {
      const c = cells[done]!;
      if ((common[c]! &= neighborMask(cells, done)) === 0) return false;
    }
    return true;
  }

  /** Call after all cells are fixed. */
  finish(): boolean {
    return rulesetFromAnalysis({ counts: FIVES, common: this.common, seen: this.seen }) !== null;
  }

  private pair(a: number, b: number): boolean {
    const { seen } = this;
    return (seen[a]! |= 1 << b) !== ALL_COLORS_MASK && (seen[b]! |= 1 << a) !== ALL_COLORS_MASK;
  }
}

/**
 * Same distribution as RejectionSampler (exactly uniform), but abandons a shuffle as soon as the
 * already-fixed cells violate the rules, saving random draws and checks.
 */
export class EarlyRejectionSampler implements BoardSampler {
  trials = 0;
  private readonly cells = new Uint8Array(CELL_COUNT);
  private readonly checker = new SuffixChecker();

  constructor(private readonly rng: Rng) {
    for (let i = 0; i < CELL_COUNT; i++) this.cells[i] = Math.floor(i / TILES_PER_COLOR);
  }

  run(maxTrials: number): Board | null {
    const { cells, rng, checker } = this;
    for (let t = 0; t < maxTrials; t++) {
      this.trials++;
      checker.reset();
      let ok = true;
      for (let i = CELL_COUNT - 1; i >= 0; i--) {
        if (i > 0) {
          const j = rng.nextInt(i + 1);
          const tmp = cells[i]!;
          cells[i] = cells[j]!;
          cells[j] = tmp;
        }
        if (!checker.fix(cells, i)) {
          ok = false;
          break;
        }
      }
      if (ok && checker.finish()) return cells.slice();
    }
    return null;
  }
}

/**
 * Fast but biased: a solver run with a randomized color order returns the first valid board it
 * reaches. Each trial is one search capped at `nodesPerTrial` nodes.
 */
export class DfsSampler implements BoardSampler {
  trials = 0;

  constructor(
    private readonly rng: Rng,
    private readonly nodesPerTrial = 2000,
  ) {}

  run(maxTrials: number): Board | null {
    for (let t = 0; t < maxTrials; t++) {
      this.trials++;
      const result = countSolutions(emptyClueSet(), {
        limit: 1,
        collect: true,
        rng: this.rng,
        maxNodes: this.nodesPerTrial,
      });
      if (result.count > 0) return result.solutions[0]!;
    }
    return null;
  }
}

export interface SampleResult {
  board: Board;
  trials: number;
}

export type SamplerKind = 'rejection' | 'early-rejection' | 'dfs';

export function createSampler(kind: SamplerKind, rng: Rng): BoardSampler {
  switch (kind) {
    case 'rejection':
      return new RejectionSampler(rng);
    case 'early-rejection':
      return new EarlyRejectionSampler(rng);
    case 'dfs':
      return new DfsSampler(rng);
  }
}

export function sampleBoardRejection(
  rng: Rng,
  options: { maxTrials?: number; kind?: SamplerKind } = {},
): SampleResult | null {
  const sampler = createSampler(options.kind ?? 'early-rejection', rng);
  const board = sampler.run(options.maxTrials ?? Number.POSITIVE_INFINITY);
  return board ? { board, trials: sampler.trials } : null;
}
