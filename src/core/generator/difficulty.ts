import type { Board } from '../board';
import { clueSetFromMask, countClueKinds, type ClueMask } from '../clues';
import type { DifficultyStats } from '../puzzle';
import { MAX_LEVEL } from '../solver/propagate';
import { countSolutions, solveByPropagation } from '../solver/search';

/** Measures how much deduction a (unique) puzzle needs. */
export function measureDifficulty(solution: Board, mask: ClueMask): DifficultyStats {
  const clues = clueSetFromMask(solution, mask);
  let propagationLevel: number | null = null;
  for (let level = 0; level <= MAX_LEVEL; level++) {
    if (solveByPropagation(clues, level).solved) {
      propagationLevel = level;
      break;
    }
  }
  const search = countSolutions(clues, { limit: 2 });
  const kinds = countClueKinds(mask);
  return {
    propagationLevel,
    nodes: search.nodes,
    guessDepth: search.maxDepth,
    tileClues: kinds.tiles,
    relationClues: kinds.relations,
  };
}
