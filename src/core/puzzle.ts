import type { Board } from './board';
import type { ClueMask } from './clues';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ['easy', 'medium', 'hard', 'expert'];

export interface DifficultyStats {
  /** Lowest propagation level that solves the puzzle without guessing, or null if guessing is needed. */
  propagationLevel: number | null;
  /** Search nodes needed to solve and prove uniqueness at the strongest propagation level. */
  nodes: number;
  /** Deepest guess nesting during that search. */
  guessDepth: number;
  tileClues: number;
  relationClues: number;
}

export interface Rating {
  level: DifficultyLevel;
  score: number;
  stats: DifficultyStats;
}

export interface Puzzle {
  solution: Board;
  mask: ClueMask;
  seed?: string;
  rating?: Rating;
}
