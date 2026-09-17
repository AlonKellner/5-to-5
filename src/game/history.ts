import type { GameState } from './state';

export const MAX_HISTORY = 500;

/** Undo stack over immutable game states. */
export interface History {
  readonly past: readonly GameState[];
  readonly present: GameState;
}

export function startHistory(state: GameState): History {
  return { past: [], present: state };
}

export function commit(history: History, next: GameState): History {
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-MAX_HISTORY), present: next };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function undo(history: History): History {
  if (!canUndo(history)) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1]! };
}
