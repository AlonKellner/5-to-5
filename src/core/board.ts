import { CELL_COUNT, COLOR_COUNT, COLOR_KEYS, SIZE } from './constants';

/** A filled board: CELL_COUNT colors in row-major order. */
export type Board = Uint8Array;

export function createBoard(colors: ArrayLike<number>): Board {
  if (colors.length !== CELL_COUNT) {
    throw new RangeError(`A board needs ${CELL_COUNT} cells, got ${colors.length}`);
  }
  const board = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    const c = colors[i]!;
    if (!Number.isInteger(c) || c < 0 || c >= COLOR_COUNT) {
      throw new RangeError(`Invalid color ${c} at cell ${i}`);
    }
    board[i] = c;
  }
  return board;
}

/** Parses "bprrp/ygprg/..." (letters or digits; whitespace, '/' and '|' are ignored). */
export function parseBoard(text: string): Board {
  const chars = text.replace(/[\s/|,]/g, '');
  if (chars.length !== CELL_COUNT) {
    throw new SyntaxError(`Expected ${CELL_COUNT} cells, got ${chars.length}`);
  }
  return createBoard(
    [...chars].map((ch) => {
      const letter = COLOR_KEYS.indexOf(ch as (typeof COLOR_KEYS)[number]);
      if (letter >= 0) return letter;
      if (/^[0-4]$/.test(ch)) return Number(ch);
      throw new SyntaxError(`Unknown color "${ch}"`);
    }),
  );
}

export function formatBoard(board: Board, rowSeparator = '/'): string {
  const rows: string[] = [];
  for (let r = 0; r < SIZE; r++) {
    let row = '';
    for (let c = 0; c < SIZE; c++) row += COLOR_KEYS[board[r * SIZE + c]!];
    rows.push(row);
  }
  return rows.join(rowSeparator);
}

export function colorCounts(board: Board): Uint8Array {
  const counts = new Uint8Array(COLOR_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) counts[board[i]!]!++;
  return counts;
}

/** Base-5 number with cell 0 as the most significant digit (5^25 exceeds 2^53). */
export function boardKey(board: Board): bigint {
  let key = 0n;
  for (let i = 0; i < CELL_COUNT; i++) key = key * 5n + BigInt(board[i]!);
  return key;
}

export function boardFromKey(key: bigint): Board {
  const board = new Uint8Array(CELL_COUNT);
  for (let i = CELL_COUNT - 1; i >= 0; i--) {
    board[i] = Number(key % 5n);
    key /= 5n;
  }
  return board;
}

/**
 * The 8 symmetries of the square (dihedral group D4). Each entry maps a destination cell to
 * the source cell it reads from: transformed[i] = board[symmetry[i]]. Index 0 is the identity,
 * index 1 is a 90° rotation.
 */
export const SYMMETRIES: readonly Int8Array[] = (() => {
  const n = SIZE - 1;
  const coordinateMaps: ((r: number, c: number) => [number, number])[] = [
    (r, c) => [r, c],
    (r, c) => [c, n - r],
    (r, c) => [n - r, n - c],
    (r, c) => [n - c, r],
    (r, c) => [r, n - c],
    (r, c) => [n - r, c],
    (r, c) => [c, r],
    (r, c) => [n - c, n - r],
  ];
  return coordinateMaps.map((f) => {
    const map = new Int8Array(CELL_COUNT);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [sr, sc] = f(r, c);
        map[r * SIZE + c] = sr * SIZE + sc;
      }
    }
    return map;
  });
})();

export function transformBoard(board: Board, symmetry: Int8Array): Board {
  const out = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) out[i] = board[symmetry[i]!]!;
  return out;
}

/** Renames colors: color c becomes perm[c]. */
export function permuteColors(board: Board, perm: readonly number[]): Board {
  const out = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) out[i] = perm[board[i]!]!;
  return out;
}

/**
 * Smallest key over all symmetries and color relabelings. For a fixed symmetry the minimal
 * relabeling numbers colors by order of first appearance, so only 8 candidates are needed.
 */
export function canonicalBoardKey(board: Board): bigint {
  let best: bigint | null = null;
  const relabel = new Int8Array(COLOR_COUNT);
  for (const symmetry of SYMMETRIES) {
    relabel.fill(-1);
    let next = 0;
    let key = 0n;
    for (let i = 0; i < CELL_COUNT; i++) {
      const color = board[symmetry[i]!]!;
      if (relabel[color] === -1) relabel[color] = next++;
      key = key * 5n + BigInt(relabel[color]!);
    }
    if (best === null || key < best) best = key;
  }
  return best!;
}
