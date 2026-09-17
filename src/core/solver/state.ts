import type { Board } from '../board';
import type { ClueSet } from '../clues';
import { ALL_COLORS_MASK, CELL_COUNT, COLOR_COUNT } from '../constants';
import type { Ruleset } from '../rules';
import { isSingleton } from './bits';

/**
 * Solver state is one flat byte array of candidate bitmasks:
 * [0, 25) cells, [25, 30) must-rule domains, [30, 35) never-rule domains.
 */
export type SolverState = Uint8Array;

export const MUST = CELL_COUNT;
export const NEVER = CELL_COUNT + COLOR_COUNT;
export const STATE_SIZE = CELL_COUNT + 2 * COLOR_COUNT;

export function createState(clues: ClueSet, ruleset?: Ruleset): SolverState {
  const state = new Uint8Array(STATE_SIZE).fill(ALL_COLORS_MASK);
  for (let i = 0; i < CELL_COUNT; i++) {
    const tile = clues.tiles[i]!;
    if (tile >= 0) state[i] = 1 << tile;
  }
  if (ruleset) {
    for (let c = 0; c < COLOR_COUNT; c++) {
      state[MUST + c] = 1 << ruleset.must[c]!;
      state[NEVER + c] = 1 << ruleset.never[c]!;
    }
  }
  return state;
}

export function isSolved(state: SolverState): boolean {
  for (let i = 0; i < CELL_COUNT; i++) if (!isSingleton(state[i]!)) return false;
  return true;
}

export function boardOfSolvedState(state: SolverState): Board {
  const board = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) board[i] = 31 - Math.clz32(state[i]!);
  return board;
}
