import type { Board } from './board';
import { CELL_COUNT, COLOR_COUNT, SIZE } from './constants';

export type EdgeOrientation = 'h' | 'v';

export interface Edge {
  /** Left cell (horizontal) or top cell (vertical). */
  a: number;
  /** Right cell (horizontal) or bottom cell (vertical). */
  b: number;
  orientation: EdgeOrientation;
}

export const HORIZONTAL_EDGE_COUNT = SIZE * (SIZE - 1);
export const EDGE_COUNT = 2 * HORIZONTAL_EDGE_COUNT;
export const SLOT_COUNT = CELL_COUNT + EDGE_COUNT;

export const horizontalEdge = (row: number, col: number): number => row * (SIZE - 1) + col;
export const verticalEdge = (row: number, col: number): number =>
  HORIZONTAL_EDGE_COUNT + row * SIZE + col;
export const slotOfEdge = (edge: number): number => CELL_COUNT + edge;
export const edgeOfSlot = (slot: number): number => slot - CELL_COUNT;
export const isTileSlot = (slot: number): boolean => slot < CELL_COUNT;

export const EDGES: readonly Edge[] = (() => {
  const edges: Edge[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      edges.push({ a: r * SIZE + c, b: r * SIZE + c + 1, orientation: 'h' });
    }
  }
  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE; c++) {
      edges.push({ a: r * SIZE + c, b: (r + 1) * SIZE + c, orientation: 'v' });
    }
  }
  return edges;
})();

/** Symbol for each cyclic delta (b - a) mod 5, read left→right or top→bottom. */
export const RELATION_SYMBOLS = ['=', '›', '»', '«', '‹'] as const;

export const relationDelta = (a: number, b: number): number =>
  (((b - a) % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT;

export type Clue =
  | { kind: 'tile'; slot: number; cell: number; color: number }
  | { kind: 'relation'; slot: number; edge: number; a: number; b: number; delta: number };

/** One byte per slot (0 = hidden, 1 = shown): tiles first, then edges. */
export type ClueMask = Uint8Array;

export const emptyMask = (): ClueMask => new Uint8Array(SLOT_COUNT);
export const fullMask = (): ClueMask => new Uint8Array(SLOT_COUNT).fill(1);

export function clueAt(board: Board, slot: number): Clue {
  if (isTileSlot(slot)) return { kind: 'tile', slot, cell: slot, color: board[slot]! };
  const edge = edgeOfSlot(slot);
  const { a, b } = EDGES[edge]!;
  return { kind: 'relation', slot, edge, a, b, delta: relationDelta(board[a]!, board[b]!) };
}

export function allClues(board: Board): Clue[] {
  return Array.from({ length: SLOT_COUNT }, (_, slot) => clueAt(board, slot));
}

export function cluesFromMask(board: Board, mask: ClueMask): Clue[] {
  const clues: Clue[] = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) if (mask[slot]) clues.push(clueAt(board, slot));
  return clues;
}

export function countClueKinds(mask: ClueMask): {
  tiles: number;
  relations: number;
  total: number;
} {
  let tiles = 0;
  let relations = 0;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (!mask[slot]) continue;
    if (isTileSlot(slot)) tiles++;
    else relations++;
  }
  return { tiles, relations, total: tiles + relations };
}

/** Clues in the dense form the solver consumes; -1 marks an absent clue. */
export interface ClueSet {
  tiles: Int8Array;
  relations: Int8Array;
}

export function emptyClueSet(): ClueSet {
  return {
    tiles: new Int8Array(CELL_COUNT).fill(-1),
    relations: new Int8Array(EDGE_COUNT).fill(-1),
  };
}

export function clueSetFromMask(board: Board, mask: ClueMask): ClueSet {
  const set = emptyClueSet();
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (!mask[slot]) continue;
    const clue = clueAt(board, slot);
    if (clue.kind === 'tile') set.tiles[clue.cell] = clue.color;
    else set.relations[clue.edge] = clue.delta;
  }
  return set;
}
