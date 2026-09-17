import type { Board } from './board';
import type { ClueMask } from './clues';

/** 1 (easiest) to 7 (hardest); a puzzle's level is its score rounded to hundreds. */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = [1, 2, 3, 4, 5, 6, 7];
export const DIFFICULTY_NAMES: Record<DifficultyLevel, string> = {
  1: 'Beginner',
  2: 'Easy',
  3: 'Medium',
  4: 'Tricky',
  5: 'Hard',
  6: 'Expert',
  7: 'Master',
};

export interface GradeStats {
  /** Deduction rounds used per level: counts, never, must, exactness, hypotheses. */
  steps: number[];
  /** Search nodes needed once deductions were stuck. */
  guessNodes: number;
  /** Weighted sum of steps and guesses. */
  effort: number;
  tileClues: number;
  relationClues: number;
}

export interface Rating {
  level: DifficultyLevel;
  /** About 100 per level: log-scaled solving effort. */
  score: number;
  stats: GradeStats;
}

export interface Puzzle {
  solution: Board;
  mask: ClueMask;
  seed?: string;
  rating?: Rating;
}

/** Reads a level from "1"–"7" or a level name (case-insensitive); null if unrecognized. */
export function parseDifficulty(value: string | null | undefined): DifficultyLevel | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const byNumber = DIFFICULTY_LEVELS.find((level) => String(level) === trimmed);
  if (byNumber) return byNumber;
  return (
    DIFFICULTY_LEVELS.find((level) => DIFFICULTY_NAMES[level].toLowerCase() === trimmed) ?? null
  );
}
