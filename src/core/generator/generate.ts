import type { Board } from '../board';
import type { ClueMask } from '../clues';
import type { DifficultyLevel, Puzzle, Rating } from '../puzzle';
import { Rng } from '../rng';
import { LEVEL } from '../solver/propagate';
import { digClues } from './dig';
import { gradePuzzle } from './grade';
import { selectCluesByReasoning } from './selectClues';
import { EarlyRejectionSampler } from './sampleBoard';

/** Bump when generation changes, so old seeds are not silently remapped to different puzzles. */
export const GENERATOR_VERSION = 3;

/** Search budget for uniqueness checks while digging; puzzles that need more are not generated. */
const MAX_SEARCH_NODES = 20_000;

export function ratePuzzle(solution: Board, mask: ClueMask): Rating {
  const { level, score, stats } = gradePuzzle(solution, mask);
  return { level, score, stats };
}

/**
 * A dig stops at or below its cap, typically ~20 points under it, so caps are drawn from the upper
 * part of the band to center the resulting scores (docs/experiments/decision.md).
 */
const CAP_OFFSET = 30;

/** Scores that round to `level`: [100·level − 50, 100·level + 50). */
export function scoreBand(level: DifficultyLevel): { min: number; max: number } {
  return { min: level * 100 - 50, max: level * 100 + 49 };
}

export type ClueStyle = 'reasoning' | 'random';

/**
 * The chain is built with the weakest reasoning, which places the most clues. Stronger chains
 * place fewer clues and leave too little to prune, which makes hard levels unreachable
 * (docs/experiments/decision.md).
 */
const CHAIN_LEVEL = LEVEL.NEVER;

/**
 * The clue set a level's digs start from: with the reasoning style, clues placed where the solver
 * got stuck; with the random style, every clue.
 */
function startingClues(solution: Board, rng: Rng, style: ClueStyle): ClueMask | undefined {
  return style === 'reasoning'
    ? selectCluesByReasoning(solution, rng, { solveLevel: CHAIN_LEVEL }).mask
    : undefined;
}

/** A dig this close to the level's center is accepted without trying more digs. */
const GOOD_ENOUGH = 15;

/**
 * Digs clues toward target scores drawn from the level's band and keeps the result closest to
 * 100 × level, so each level's scores center on its hundred. Returns null if no dig lands in the
 * level.
 */
export function puzzleForBoard(
  solution: Board,
  difficulty: DifficultyLevel,
  rng: Rng,
  digs: number,
  style: ClueStyle = 'reasoning',
): { mask: ClueMask; rating: Rating } | null {
  const band = scoreBand(difficulty);
  const center = difficulty * 100;
  const start = startingClues(solution, rng.split(), style);
  let best: { mask: ClueMask; rating: Rating } | null = null;
  for (let dig = 0; dig < digs; dig++) {
    const lowestCap = band.min + CAP_OFFSET;
    const maxScore = lowestCap + rng.nextInt(band.max - lowestCap + 1);
    const { mask } = digClues(solution, rng.split(), {
      criterion: { kind: 'score', maxScore, maxNodes: MAX_SEARCH_NODES },
      start,
    });
    const rating = ratePuzzle(solution, mask);
    if (rating.level !== difficulty) continue;
    if (!best || Math.abs(rating.score - center) < Math.abs(best.rating.score - center)) {
      best = { mask, rating };
    }
    if (Math.abs(rating.score - center) <= GOOD_ENOUGH) break;
  }
  return best;
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
  /** How clues are chosen: from the solver's reasoning chain (default) or by random removal. */
  clueStyle?: ClueStyle;
  maxBoards?: number;
}

export function generatePuzzle(options: GenerateOptions): Puzzle {
  const { seed, difficulty, onProgress } = options;
  const interval = options.progressInterval ?? 50_000;
  const digsPerBoard = options.digsPerBoard ?? 6;
  const maxBoards = options.maxBoards ?? 50;
  const rng = new Rng(`5-to-5|v${GENERATOR_VERSION}|${difficulty}|${seed}`);

  for (let attempt = 1; attempt <= maxBoards; attempt++) {
    const sampler = new EarlyRejectionSampler(rng.split());
    let solution: Board | null = null;
    while (!solution) {
      solution = sampler.run(interval);
      onProgress?.({ phase: 'board', attempt, trials: sampler.trials });
    }
    onProgress?.({ phase: 'clues', attempt });
    const found = puzzleForBoard(
      solution,
      difficulty,
      rng.split(),
      digsPerBoard,
      options.clueStyle ?? 'reasoning',
    );
    if (found) return { solution, seed, ...found };
  }
  throw new Error(`Could not generate a level ${difficulty} puzzle after ${maxBoards} boards`);
}
