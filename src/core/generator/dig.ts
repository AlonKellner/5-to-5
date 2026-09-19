import type { Board } from '../board';
import { clueSetFromMask, fullMask, SLOT_COUNT, type ClueMask } from '../clues';
import { CELL_COUNT } from '../constants';
import type { Rng } from '../rng';
import { countSolutions, solveByPropagation } from '../solver/search';
import { gradeClues } from './grade';

export type DigOrder = 'random' | 'tiles-first' | 'relations-first';

export type DigCriterion =
  /** Keep removing clues while the puzzle has exactly one solution. */
  | { kind: 'unique'; maxNodes?: number }
  /** Keep removing clues while propagation at `level` alone still solves the puzzle. */
  | { kind: 'propagation'; level: number }
  /**
   * Keep removing clues while the puzzle stays unique and its score stays at most `maxScore`.
   * The score is not strictly monotone in the clues, so a kept clue may not be strictly necessary.
   */
  | { kind: 'score'; maxScore: number; maxNodes?: number };

export interface DigOptions {
  criterion?: DigCriterion;
  order?: DigOrder;
  /** Clue set to dig from; defaults to every clue. */
  start?: ClueMask;
}

export interface DigResult {
  mask: ClueMask;
  /** Solver or propagation calls made. */
  checks: number;
  /** Search nodes used by uniqueness checks. */
  nodes: number;
  /** Uniqueness checks that ran out of budget (the clue was kept). */
  timeouts: number;
}

export function shuffledSlots(rng: Rng, order: DigOrder): number[] {
  const tiles = rng.shuffle(Array.from({ length: CELL_COUNT }, (_, i) => i));
  const relations = rng.shuffle(
    Array.from({ length: SLOT_COUNT - CELL_COUNT }, (_, i) => CELL_COUNT + i),
  );
  if (order === 'tiles-first') return [...tiles, ...relations];
  if (order === 'relations-first') return [...relations, ...tiles];
  return rng.shuffle([...tiles, ...relations]);
}

/**
 * Removes clues one at a time in a random order, keeping a removal only if the criterion still
 * holds. For the uniqueness and propagation criteria a single pass leaves only necessary clues:
 * once a removal fails, later removals only weaken the puzzle, so it would fail again.
 */
export function digClues(solution: Board, rng: Rng, options: DigOptions = {}): DigResult {
  const criterion = options.criterion ?? { kind: 'unique' };
  const mask = options.start ? options.start.slice() : fullMask();
  const result: DigResult = { mask, checks: 0, nodes: 0, timeouts: 0 };

  for (const slot of shuffledSlots(rng, options.order ?? 'random')) {
    if (!mask[slot]) continue;
    mask[slot] = 0;

    result.checks++;
    const clues = clueSetFromMask(solution, mask);
    if (criterion.kind === 'propagation') {
      if (!solveByPropagation(clues, criterion.level).solved) mask[slot] = 1;
      continue;
    }
    if (criterion.kind === 'score') {
      const grade = gradeClues(clues, { maxNodes: criterion.maxNodes });
      result.nodes += grade.stats.guessNodes;
      if (grade.timedOut) result.timeouts++;
      if (!grade.unique || grade.timedOut || grade.score > criterion.maxScore) mask[slot] = 1;
      continue;
    }

    const search = countSolutions(clues, { limit: 2, maxNodes: criterion.maxNodes });
    result.nodes += search.nodes;
    if (search.status === 'timeout') {
      result.timeouts++;
      mask[slot] = 1;
    } else if (search.count > 1) {
      mask[slot] = 1;
    }
  }
  return result;
}
