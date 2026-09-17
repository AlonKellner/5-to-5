export const SIZE = 5;
export const CELL_COUNT = SIZE * SIZE;
export const COLOR_COUNT = 5;
export const TILES_PER_COLOR = 5;
export const ALL_COLORS_MASK = (1 << COLOR_COUNT) - 1;

/** Colors in cycle order; relation clues are cyclic differences in this order. */
export const COLOR_KEYS = ['r', 'b', 'g', 'y', 'p'] as const;
export const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const rowOf = (cell: number): number => Math.floor(cell / SIZE);
export const colOf = (cell: number): number => cell % SIZE;
export const cellAt = (row: number, col: number): number => row * SIZE + col;

function computeNeighbors(cell: number): number[] {
  const r = rowOf(cell);
  const c = colOf(cell);
  const out: number[] = [];
  if (r > 0) out.push(cell - SIZE);
  if (r < SIZE - 1) out.push(cell + SIZE);
  if (c > 0) out.push(cell - 1);
  if (c < SIZE - 1) out.push(cell + 1);
  return out;
}

/** 4-connected neighbors of each cell. */
export const NEIGHBORS: readonly (readonly number[])[] = Array.from(
  { length: CELL_COUNT },
  (_, i) => computeNeighbors(i),
);

/** Flat neighbor table for hot loops: NEIGHBOR_TABLE[cell * 4 + k], padded with -1. */
export const NEIGHBOR_TABLE: Int8Array = (() => {
  const table = new Int8Array(CELL_COUNT * 4).fill(-1);
  NEIGHBORS.forEach((ns, cell) => ns.forEach((n, k) => (table[cell * 4 + k] = n)));
  return table;
})();
