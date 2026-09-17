/**
 * Puzzles and boards taken verbatim from legacy/5-to-5.html and legacy/colab-gpu-attempts.
 * Legacy color indices: 0=r, 1=b, 2=g, 3=y, 4=p. Legacy "no clue" marker: 5.
 * Legacy relation values are signed deltas (right - left, bottom - top): 0, ±1, ±2.
 */

export const HTML_SOLUTION = [
  [1, 4, 0, 0, 4],
  [3, 2, 4, 0, 2],
  [3, 1, 2, 0, 0],
  [3, 4, 3, 2, 1],
  [1, 2, 1, 4, 3],
];

export const HTML_TILE_CLUES = [
  [5, 4, 5, 5, 5],
  [3, 5, 5, 5, 2],
  [5, 5, 5, 5, 5],
  [5, 5, 5, 2, 5],
  [5, 5, 5, 5, 5],
];

export const HTML_HORIZONTAL_CLUES = [
  [5, 5, 5, -1],
  [5, 2, 5, 2],
  [5, 1, 5, 0],
  [1, -1, -1, 5],
  [5, 5, -2, 5],
];

export const HTML_VERTICAL_CLUES = [
  [2, 5, 5, 5, 5],
  [0, 5, 5, 5, 5],
  [5, 5, 5, 5, 5],
  [5, -2, 5, 5, 5],
];

export const HTML_RULESET = { must: [0, 3, 4, 1, 2], never: [3, 1, 2, 0, 4] };

/** From fubai_solver_test.py */
export const SOLVER_TEST_SOLUTION = [
  [1, 2, 1, 2, 1],
  [1, 4, 3, 4, 2],
  [2, 0, 0, 0, 0],
  [2, 4, 0, 3, 4],
  [1, 3, 3, 4, 3],
];
export const SOLVER_TEST_RULESET = { must: [0, 2, 1, 4, 3], never: [1, 0, 3, 2, 4] };

/** From fubai_square_puzzle_creator.py */
export const CREATOR_SOLUTION = [
  [2, 4, 0, 0, 4],
  [1, 3, 4, 0, 3],
  [1, 2, 3, 0, 0],
  [1, 4, 1, 3, 2],
  [2, 3, 2, 4, 1],
];
export const CREATOR_RULESET = { must: [0, 2, 1, 4, 3], never: [1, 0, 2, 3, 4] };

export const flat = (rows: number[][]): number[] => rows.flat();
