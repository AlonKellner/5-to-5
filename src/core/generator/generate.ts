import type { Board } from '../board';
import type { ClueMask } from '../clues';
import type { DifficultyLevel, DifficultyStats, Puzzle, Rating } from '../puzzle';
import { Rng } from '../rng';
import { LEVEL } from '../solver/propagate';
import { measureDifficulty } from './difficulty';
import { digClues, type DigCriterion } from './dig';
import { EarlyRejectionSampler } from './sampleBoard';

/** Bump when generation changes, so old seeds are not silently remapped to different puzzles. */
export const GENERATOR_VERSION = 1;

interface DifficultyProfile {
  criterion: DigCriterion;
}

/**
 * Each tier digs clues while the puzzle stays solvable with that tier's deductions, which makes
 * the result need exactly those deductions (see docs/experiments/decision.md).
 */
const PROFILES: Record<DifficultyLevel, DifficultyProfile> = {
  easy: { criterion: { kind: 'propagation', level: LEVEL.NEVER } },
  medium: { criterion: { kind: 'propagation', level: LEVEL.EXACT } },
  hard: { criterion: { kind: 'propagation', level: LEVEL.PROBE } },
  expert: { criterion: { kind: 'unique', maxNodes: 200_000 } },
};

export function classifyDifficulty(stats: DifficultyStats): DifficultyLevel {
  const level = stats.propagationLevel;
  if (level === null) return 'expert';
  if (level >= LEVEL.PROBE) return 'hard';
  if (level >= LEVEL.MUST) return 'medium';
  return 'easy';
}

/** A finer, sortable difficulty number: the tier dominates, search effort and clue count refine it. */
export function difficultyScore(stats: DifficultyStats): number {
  const tier = stats.propagationLevel ?? LEVEL.PROBE + 1;
  const clues = stats.tileClues + stats.relationClues;
  return Math.round(100 * tier + 10 * Math.log2(stats.nodes) + Math.max(0, 30 - clues));
}

export function ratePuzzle(solution: Board, mask: ClueMask): Rating {
  const stats = measureDifficulty(solution, mask);
  return { level: classifyDifficulty(stats), score: difficultyScore(stats), stats };
}

export type GenerateProgress =
  { phase: 'board'; attempt: number; trials: number } | { phase: 'clues'; attempt: number };

export interface GenerateOptions {
  seed: string;
  difficulty: DifficultyLevel;
  onProgress?: (progress: GenerateProgress) => void;
  /** Sampler trials between progress reports. */
  progressInterval?: number;
  /** Clue digs tried on one board before sampling a new one. */
  digsPerBoard?: number;
  maxBoards?: number;
}

export function generatePuzzle(options: GenerateOptions): Puzzle {
  const { seed, difficulty, onProgress } = options;
  const interval = options.progressInterval ?? 50_000;
  const digsPerBoard = options.digsPerBoard ?? 3;
  const maxBoards = options.maxBoards ?? 50;
  const rng = new Rng(`5-to-5|v${GENERATOR_VERSION}|${difficulty}|${seed}`);
  const { criterion } = PROFILES[difficulty];

  for (let attempt = 1; attempt <= maxBoards; attempt++) {
    const sampler = new EarlyRejectionSampler(rng.split());
    let solution: Board | null = null;
    while (!solution) {
      solution = sampler.run(interval);
      onProgress?.({ phase: 'board', attempt, trials: sampler.trials });
    }
    for (let dig = 0; dig < digsPerBoard; dig++) {
      onProgress?.({ phase: 'clues', attempt });
      const { mask } = digClues(solution, rng.split(), { criterion });
      const rating = ratePuzzle(solution, mask);
      if (rating.level === difficulty) return { solution, mask, seed, rating };
    }
  }
  throw new Error(`Could not generate a ${difficulty} puzzle after ${maxBoards} boards`);
}
