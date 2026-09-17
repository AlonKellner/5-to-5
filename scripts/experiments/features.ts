import type { Board } from '../../src/core/board';
import { CELL_COUNT, NEIGHBORS } from '../../src/core/constants';
import { rulesetClass } from '../../src/core/rules';
import { deriveRuleset } from '../../src/core/validator';

/** Features invariant under board symmetries and color relabeling, used to compare distributions. */
export interface BoardFeatures {
  rulesetClass: number;
  /** Adjacent pairs with the same color (0..40). */
  sameColorPairs: number;
  /** Connected same-color regions (5..25). */
  regions: number;
  /** Largest same-color region (1..5). */
  largestRegion: number;
}

export const FEATURE_NAMES = [
  'rulesetClass',
  'sameColorPairs',
  'regions',
  'largestRegion',
] as const;

const stack = new Int8Array(CELL_COUNT);
const seen = new Uint8Array(CELL_COUNT);

export function boardFeatures(board: Board): BoardFeatures {
  const ruleset = deriveRuleset(board);
  if (!ruleset) throw new Error('Features are only defined for valid boards');
  let sameColorPairs = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    for (const n of NEIGHBORS[i]!) if (n > i && board[n] === board[i]) sameColorPairs++;
  }
  seen.fill(0);
  let regions = 0;
  let largestRegion = 0;
  for (let start = 0; start < CELL_COUNT; start++) {
    if (seen[start]) continue;
    regions++;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const x = stack[--top]!;
      size++;
      for (const n of NEIGHBORS[x]!) {
        if (!seen[n] && board[n] === board[x]) {
          seen[n] = 1;
          stack[top++] = n;
        }
      }
    }
    largestRegion = Math.max(largestRegion, size);
  }
  return { rulesetClass: rulesetClass(ruleset), sameColorPairs, regions, largestRegion };
}

export type Histogram = Record<string, number>;
export type FeatureHistograms = Record<(typeof FEATURE_NAMES)[number], Histogram>;

export function emptyHistograms(): FeatureHistograms {
  return { rulesetClass: {}, sameColorPairs: {}, regions: {}, largestRegion: {} };
}

export function addToHistograms(h: FeatureHistograms, f: BoardFeatures, weight = 1): void {
  for (const name of FEATURE_NAMES) {
    const key = String(f[name]);
    h[name][key] = (h[name][key] ?? 0) + weight;
  }
}

export function mergeHistograms(
  into: FeatureHistograms,
  from: FeatureHistograms,
  weight = 1,
): void {
  for (const name of FEATURE_NAMES) {
    for (const [key, count] of Object.entries(from[name])) {
      into[name][key] = (into[name][key] ?? 0) + count * weight;
    }
  }
}
