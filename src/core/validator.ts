import type { Board } from './board';
import {
  ALL_COLORS_MASK,
  CELL_COUNT,
  COLOR_COUNT,
  NEIGHBOR_TABLE,
  TILES_PER_COLOR,
} from './constants';
import type { Ruleset } from './rules';

export interface BoardAnalysis {
  /** Tiles per color. */
  counts: ArrayLike<number>;
  /** Bitmask per color: colors adjacent to every copy of that color. */
  common: ArrayLike<number>;
  /** Bitmask per color: colors adjacent to at least one copy of that color. */
  seen: ArrayLike<number>;
}

export type Violation =
  | { kind: 'count'; color: number }
  | { kind: 'common'; color: number }
  | { kind: 'missing'; color: number }
  | { kind: 'must-involution'; color: number };

const isSingleton = (mask: number) => mask !== 0 && (mask & (mask - 1)) === 0;
const bitIndex = (mask: number) => 31 - Math.clz32(mask);

export function neighborMask(board: ArrayLike<number>, cell: number): number {
  let mask = 0;
  const base = cell * 4;
  for (let k = 0; k < 4; k++) {
    const n = NEIGHBOR_TABLE[base + k]!;
    if (n >= 0) mask |= 1 << board[n]!;
  }
  return mask;
}

export function analyzeBoard(board: Board): BoardAnalysis {
  const counts = new Uint8Array(COLOR_COUNT);
  const common = new Uint8Array(COLOR_COUNT).fill(ALL_COLORS_MASK);
  const seen = new Uint8Array(COLOR_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    const color = board[i]!;
    const mask = neighborMask(board, i);
    counts[color]!++;
    common[color]! &= mask;
    seen[color]! |= mask;
  }
  return { counts, common, seen };
}

export function boardViolations(board: Board): Violation[] {
  const analysis = analyzeBoard(board);
  const violations: Violation[] = [];
  const must: number[] = [];
  for (let color = 0; color < COLOR_COUNT; color++) {
    if (analysis.counts[color] !== TILES_PER_COLOR) violations.push({ kind: 'count', color });
    const common = analysis.common[color]!;
    if (!isSingleton(common)) violations.push({ kind: 'common', color });
    if (!isSingleton(ALL_COLORS_MASK & ~analysis.seen[color]!)) {
      violations.push({ kind: 'missing', color });
    }
    must.push(isSingleton(common) ? bitIndex(common) : -1);
  }
  for (let color = 0; color < COLOR_COUNT; color++) {
    const m = must[color]!;
    if (m >= 0 && must[m]! >= 0 && must[m] !== color) {
      violations.push({ kind: 'must-involution', color });
    }
  }
  return violations;
}

/**
 * Derives the hidden rules from analysis data, or null if the strict rules are violated:
 * exactly one color touches every copy (must), exactly one touches none (never), and must is an
 * involution. never is always symmetric and must ≠ never always holds for such boards.
 */
export function rulesetFromAnalysis(analysis: BoardAnalysis): Ruleset | null {
  const must: number[] = [];
  const never: number[] = [];
  for (let color = 0; color < COLOR_COUNT; color++) {
    if (analysis.counts[color] !== TILES_PER_COLOR) return null;
    const common = analysis.common[color]!;
    const missing = ALL_COLORS_MASK & ~analysis.seen[color]!;
    if (!isSingleton(common) || !isSingleton(missing)) return null;
    must.push(bitIndex(common));
    never.push(bitIndex(missing));
  }
  for (let color = 0; color < COLOR_COUNT; color++) {
    if (must[must[color]!] !== color || never[never[color]!] !== color) return null;
  }
  return { must, never };
}

export function deriveRuleset(board: Board): Ruleset | null {
  return rulesetFromAnalysis(analyzeBoard(board));
}

/**
 * Allocation-free validity check for hot loops (rejection sampling). Assumes the board already
 * has five tiles of each color.
 */
export function isValidBalancedBoard(board: ArrayLike<number>): boolean {
  let c0 = ALL_COLORS_MASK,
    c1 = ALL_COLORS_MASK,
    c2 = ALL_COLORS_MASK,
    c3 = ALL_COLORS_MASK,
    c4 = ALL_COLORS_MASK;
  let s0 = 0,
    s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    const mask = neighborMask(board, i);
    switch (board[i]) {
      case 0:
        c0 &= mask;
        s0 |= mask;
        if (s0 === ALL_COLORS_MASK || c0 === 0) return false;
        break;
      case 1:
        c1 &= mask;
        s1 |= mask;
        if (s1 === ALL_COLORS_MASK || c1 === 0) return false;
        break;
      case 2:
        c2 &= mask;
        s2 |= mask;
        if (s2 === ALL_COLORS_MASK || c2 === 0) return false;
        break;
      case 3:
        c3 &= mask;
        s3 |= mask;
        if (s3 === ALL_COLORS_MASK || c3 === 0) return false;
        break;
      default:
        c4 &= mask;
        s4 |= mask;
        if (s4 === ALL_COLORS_MASK || c4 === 0) return false;
    }
  }
  return (
    rulesetFromAnalysis({
      counts: [5, 5, 5, 5, 5],
      common: [c0, c1, c2, c3, c4],
      seen: [s0, s1, s2, s3, s4],
    }) !== null
  );
}

export function isValidBoard(board: Board): boolean {
  return deriveRuleset(board) !== null;
}
