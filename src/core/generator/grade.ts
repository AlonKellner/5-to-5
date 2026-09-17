import type { Board } from '../board';
import { clueSetFromMask, countClueKinds, type ClueMask, type ClueSet } from '../clues';
import { COLOR_COUNT } from '../constants';
import type { DifficultyLevel, GradeStats } from '../puzzle';
import { POPCOUNT } from '../solver/bits';
import { LEVEL, propagate, propagateRound } from '../solver/propagate';
import { countSolutions } from '../solver/search';
import {
  boardOfSolvedState,
  createState,
  isSolved,
  STATE_SIZE,
  type SolverState,
} from '../solver/state';
import { deriveRuleset } from '../validator';

/** Effort of one deduction round per level: counts, never, must, exactness, one hypothesis. */
export const DEDUCTION_WEIGHTS = [1, 2, 3, 5, 8] as const;
/** Effort of one search node once deductions are stuck. */
export const GUESS_WEIGHT = 10;

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 7;

/** log2(effort) 3.5 → score 100 and 11.5 → 700, so each level is ~2.5× the effort of the last. */
export function scoreFromEffort(effort: number): number {
  return Math.max(0, Math.round(100 + 75 * (Math.log2(Math.max(1, effort)) - 3.5)));
}

export function levelFromScore(score: number): DifficultyLevel {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(score / 100))) as DifficultyLevel;
}

export interface Grade {
  unique: boolean;
  score: number;
  level: DifficultyLevel;
  stats: GradeStats;
}

function candidateCount(s: SolverState): number {
  let n = 0;
  for (let i = 0; i < STATE_SIZE; i++) n += POPCOUNT[s[i]!]!;
  return n;
}

const hypothesis = new Uint8Array(STATE_SIZE);

/** Finds one candidate whose assumption leads to a contradiction and removes it from `s`. */
function eliminateByHypothesis(s: SolverState, clues: ClueSet): boolean {
  for (let slot = 0; slot < STATE_SIZE; slot++) {
    const m = s[slot]!;
    if (POPCOUNT[m]! < 2) continue;
    for (let c = 0; c < COLOR_COUNT; c++) {
      const bit = 1 << c;
      if (!(m & bit)) continue;
      hypothesis.set(s);
      hypothesis[slot] = bit;
      const consistent = propagate(hypothesis, clues, LEVEL.EXACT);
      if (!consistent || (isSolved(hypothesis) && !deriveRuleset(boardOfSolvedState(hypothesis)))) {
        s[slot] = m & ~bit;
        return true;
      }
    }
  }
  return false;
}

/**
 * Solves the way a person would: always apply one round of the weakest deduction that makes
 * progress, try single hypotheses only when no deduction helps, and search only when stuck.
 */
export function gradeClues(
  clues: ClueSet,
  options: { maxNodes?: number } = {},
): {
  unique: boolean;
  timedOut: boolean;
  score: number;
  level: DifficultyLevel;
  stats: TraceStats;
} {
  const steps = [0, 0, 0, 0, 0];
  let s = createState(clues);
  let guessNodes = 0;
  let unique = false;
  let timedOut = false;

  solving: for (;;) {
    if (isSolved(s)) {
      unique = deriveRuleset(boardOfSolvedState(s)) !== null;
      break;
    }
    const before = candidateCount(s);
    for (let level = LEVEL.COUNTS; level <= LEVEL.EXACT; level++) {
      const next = s.slice();
      if (!propagateRound(next, clues, level)) break solving;
      if (candidateCount(next) < before) {
        steps[level]!++;
        s = next;
        continue solving;
      }
    }
    const next = s.slice();
    if (eliminateByHypothesis(next, clues)) {
      steps[LEVEL.PROBE]!++;
      s = next;
      continue;
    }
    const search = countSolutions(clues, { limit: 2, startState: s, maxNodes: options.maxNodes });
    guessNodes = search.nodes;
    unique = search.status === 'complete' && search.count === 1;
    timedOut = search.status === 'timeout';
    break;
  }

  const effort =
    steps.reduce((acc, n, level) => acc + n * DEDUCTION_WEIGHTS[level]!, 0) +
    GUESS_WEIGHT * guessNodes;
  const score = scoreFromEffort(effort);
  return {
    unique,
    timedOut,
    score,
    level: levelFromScore(score),
    stats: { steps, guessNodes, effort },
  };
}

type TraceStats = Omit<GradeStats, 'tileClues' | 'relationClues'>;

export function gradePuzzle(
  solution: Board,
  mask: ClueMask,
  options: { maxNodes?: number } = {},
): Grade {
  const { unique, score, level, stats } = gradeClues(clueSetFromMask(solution, mask), options);
  const kinds = countClueKinds(mask);
  return {
    unique,
    score,
    level,
    stats: { ...stats, tileClues: kinds.tiles, relationClues: kinds.relations },
  };
}
