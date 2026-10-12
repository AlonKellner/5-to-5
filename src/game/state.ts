import type { Board } from '../core/board';
import type { ClueMask } from '../core/clues';
import { CELL_COUNT, COLOR_COUNT, TILES_PER_COLOR } from '../core/constants';
import type { Rng } from '../core/rng';

export const SPAWNER_NOTE_SLOTS = 2;

export type GameStatus = 'playing' | 'won' | 'revealed';

/** Every note square has a top and a bottom half, each with its own set of colors. */
export type NoteHalf = 'top' | 'bottom';

/** Bottom-half colors sit above the top-half ones in a note mask; old saves are all top half. */
const BOTTOM_SHIFT = COLOR_COUNT;
const HALF_MASK = (1 << COLOR_COUNT) - 1;
const MAX_NOTE_MASK = (1 << (2 * COLOR_COUNT)) - 1;

const noteBit = (color: number, half: NoteHalf) =>
  1 << (color + (half === 'bottom' ? BOTTOM_SHIFT : 0));

/** Splits a note mask into the colors noted in each half. */
export function noteHalves(mask: number): Record<NoteHalf, number> {
  return { top: mask & HALF_MASK, bottom: (mask >> BOTTOM_SHIFT) & HALF_MASK };
}

interface Progress {
  /** Color per cell, -1 when empty. */
  readonly cells: Int8Array;
  /** Note bitmask per cell: top-half colors in the low bits, bottom-half colors above them. */
  readonly gridNotes: Uint16Array;
  /** Note bitmask per color and slot: index color * SPAWNER_NOTE_SLOTS + slot. */
  readonly spawnerNotes: Uint16Array;
}

/** Immutable game state; every operation returns a new state (or the same one if nothing changed). */
export interface GameState extends Progress {
  readonly solution: Board;
  readonly mask: ClueMask;
  /** 1 for clue tiles and revealed hints. */
  readonly locked: Uint8Array;
  readonly checkpoint: Progress | null;
  readonly status: GameStatus;
}

export function createGame(puzzle: { solution: Board; mask: ClueMask }): GameState {
  const cells = new Int8Array(CELL_COUNT).fill(-1);
  const locked = new Uint8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (puzzle.mask[cell]) {
      cells[cell] = puzzle.solution[cell]!;
      locked[cell] = 1;
    }
  }
  return {
    solution: puzzle.solution,
    mask: puzzle.mask,
    cells,
    locked,
    gridNotes: new Uint16Array(CELL_COUNT),
    spawnerNotes: new Uint16Array(COLOR_COUNT * SPAWNER_NOTE_SLOTS),
    checkpoint: null,
    status: 'playing',
  };
}

export function trayCount(state: GameState, color: number): number {
  let placed = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) if (state.cells[cell] === color) placed++;
  return TILES_PER_COLOR - placed;
}

function withCells(state: GameState, cells: Int8Array, locked = state.locked): GameState {
  let won = true;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (cells[cell] !== state.solution[cell]) {
      won = false;
      break;
    }
  }
  return { ...state, cells, locked, status: won ? 'won' : state.status };
}

const isPlaying = (state: GameState) => state.status === 'playing';

export function placeFromTray(state: GameState, color: number, cell: number): GameState {
  if (!isPlaying(state) || state.locked[cell] || trayCount(state, color) === 0) return state;
  const cells = state.cells.slice();
  cells[cell] = color;
  return withCells(state, cells);
}

/** Moves a tile to another cell, swapping with the tile there if any. */
export function moveTile(state: GameState, from: number, to: number): GameState {
  if (!isPlaying(state) || from === to) return state;
  if (state.locked[from] || state.locked[to] || state.cells[from] === -1) return state;
  const cells = state.cells.slice();
  cells[to] = state.cells[from]!;
  cells[from] = state.cells[to]!;
  return withCells(state, cells);
}

export function returnToTray(state: GameState, cell: number): GameState {
  if (!isPlaying(state) || state.locked[cell] || state.cells[cell] === -1) return state;
  const cells = state.cells.slice();
  cells[cell] = -1;
  return withCells(state, cells);
}

export function toggleGridNote(
  state: GameState,
  cell: number,
  color: number,
  half: NoteHalf = 'top',
): GameState {
  const gridNotes = state.gridNotes.slice();
  gridNotes[cell]! ^= noteBit(color, half);
  return { ...state, gridNotes };
}

export function toggleSpawnerNote(
  state: GameState,
  color: number,
  slot: number,
  noteColor: number,
  half: NoteHalf = 'top',
): GameState {
  const spawnerNotes = state.spawnerNotes.slice();
  spawnerNotes[color * SPAWNER_NOTE_SLOTS + slot]! ^= noteBit(noteColor, half);
  return { ...state, spawnerNotes };
}

export function saveCheckpoint(state: GameState): GameState {
  return {
    ...state,
    checkpoint: {
      cells: state.cells.slice(),
      gridNotes: state.gridNotes.slice(),
      spawnerNotes: state.spawnerNotes.slice(),
    },
  };
}

/** Restores tiles and notes; tiles locked since the checkpoint stay, and colors never exceed five. */
export function restoreCheckpoint(state: GameState): GameState {
  const { checkpoint } = state;
  if (!checkpoint || !isPlaying(state)) return state;
  const cells = checkpoint.cells.slice();
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (state.locked[cell]) cells[cell] = state.cells[cell]!;
  }
  for (let color = 0; color < COLOR_COUNT; color++) {
    let excess = -TILES_PER_COLOR;
    for (let cell = 0; cell < CELL_COUNT; cell++) if (cells[cell] === color) excess++;
    for (let cell = 0; cell < CELL_COUNT && excess > 0; cell++) {
      if (cells[cell] === color && !state.locked[cell] && state.solution[cell] !== color) {
        cells[cell] = -1;
        excess--;
      }
    }
    for (let cell = 0; cell < CELL_COUNT && excess > 0; cell++) {
      if (cells[cell] === color && !state.locked[cell]) {
        cells[cell] = -1;
        excess--;
      }
    }
  }
  return withCells(
    {
      ...state,
      gridNotes: checkpoint.gridNotes.slice(),
      spawnerNotes: checkpoint.spawnerNotes.slice(),
    },
    cells,
  );
}

function wrongCells(state: GameState): number[] {
  const cells: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (!state.locked[cell] && state.cells[cell] !== state.solution[cell]) cells.push(cell);
  }
  return cells;
}

/** Placed, unlocked tiles that do not match the solution. */
export function findMistakes(state: GameState): number[] {
  const mistakes: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const color = state.cells[cell]!;
    if (color >= 0 && !state.locked[cell] && color !== state.solution[cell]) mistakes.push(cell);
  }
  return mistakes;
}

export function canHint(state: GameState): boolean {
  return isPlaying(state) && wrongCells(state).length > 0;
}

/**
 * Places and locks the correct tile in a random wrong or empty cell (or in `cell`, if given). The
 * tile comes from the tray, or from a misplaced tile of that color when the tray is empty.
 */
export function revealHint(state: GameState, rng: Rng, cell?: number): GameState {
  const candidates = wrongCells(state);
  if (!isPlaying(state) || candidates.length === 0) return state;
  const target = cell !== undefined && candidates.includes(cell) ? cell : rng.pick(candidates);
  const color = state.solution[target]!;
  const cells = state.cells.slice();
  if (trayCount(state, color) === 0) {
    const source = candidates.find((c) => c !== target && cells[c] === color)!;
    cells[source] = cells[target]!;
  }
  cells[target] = color;
  const locked = state.locked.slice();
  locked[target] = 1;
  return withCells(state, cells, locked);
}

export function revealSolution(state: GameState): GameState {
  return {
    ...state,
    cells: Int8Array.from(state.solution),
    locked: new Uint8Array(CELL_COUNT).fill(1),
    status: 'revealed',
  };
}

export interface SerializedGame {
  cells: number[];
  locked: number[];
  gridNotes: number[];
  spawnerNotes: number[];
  checkpoint: { cells: number[]; gridNotes: number[]; spawnerNotes: number[] } | null;
  status: GameStatus;
}

export function serializeGame(state: GameState): SerializedGame {
  return {
    cells: [...state.cells],
    locked: [...state.locked],
    gridNotes: [...state.gridNotes],
    spawnerNotes: [...state.spawnerNotes],
    checkpoint: state.checkpoint && {
      cells: [...state.checkpoint.cells],
      gridNotes: [...state.checkpoint.gridNotes],
      spawnerNotes: [...state.checkpoint.spawnerNotes],
    },
    status: state.status,
  };
}

const isIntArray = (value: unknown, length: number, min: number, max: number): value is number[] =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((v) => Number.isInteger(v) && v >= min && v <= max);

/** Restores a saved game for `puzzle`, or null if the data does not fit the puzzle. */
export function deserializeGame(
  puzzle: { solution: Board; mask: ClueMask },
  data: unknown,
): GameState | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Partial<SerializedGame>;
  const noteSlots = COLOR_COUNT * SPAWNER_NOTE_SLOTS;
  const validProgress = (p: Partial<SerializedGame['checkpoint']> | null | undefined) =>
    !!p &&
    isIntArray(p.cells, CELL_COUNT, -1, COLOR_COUNT - 1) &&
    isIntArray(p.gridNotes, CELL_COUNT, 0, MAX_NOTE_MASK) &&
    isIntArray(p.spawnerNotes, noteSlots, 0, MAX_NOTE_MASK);
  if (
    !validProgress(d as SerializedGame['checkpoint']) ||
    !isIntArray(d.locked, CELL_COUNT, 0, 1)
  ) {
    return null;
  }
  if (d.checkpoint !== null && !validProgress(d.checkpoint)) return null;
  if (!['playing', 'won', 'revealed'].includes(d.status as string)) return null;
  const cells = Int8Array.from(d.cells!);
  const locked = Uint8Array.from(d.locked!);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (puzzle.mask[cell] && !locked[cell]) return null;
    if (locked[cell] && cells[cell] !== puzzle.solution[cell]) return null;
  }
  for (let color = 0; color < COLOR_COUNT; color++) {
    if (cells.filter((c) => c === color).length > TILES_PER_COLOR) return null;
  }
  return {
    solution: puzzle.solution,
    mask: puzzle.mask,
    cells,
    locked,
    gridNotes: Uint16Array.from(d.gridNotes!),
    spawnerNotes: Uint16Array.from(d.spawnerNotes!),
    checkpoint: d.checkpoint
      ? {
          cells: Int8Array.from(d.checkpoint.cells),
          gridNotes: Uint16Array.from(d.checkpoint.gridNotes),
          spawnerNotes: Uint16Array.from(d.checkpoint.spawnerNotes),
        }
      : null,
    status: d.status!,
  };
}
