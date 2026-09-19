import type { ClueSet } from '../clues';
import { COLOR_COUNT } from '../constants';
import { deriveRuleset } from '../validator';
import { POPCOUNT } from './bits';
import { LEVEL, propagate, propagateRound } from './propagate';
import { boardOfSolvedState, isSolved, STATE_SIZE, type SolverState } from './state';

export function candidateCount(s: SolverState): number {
  let n = 0;
  for (let i = 0; i < STATE_SIZE; i++) n += POPCOUNT[s[i]!]!;
  return n;
}

const hypothesis = new Uint8Array(STATE_SIZE);
const scratch = new Uint8Array(STATE_SIZE);

/** Finds one candidate whose assumption leads to a contradiction and removes it from `s`. */
export function eliminateByHypothesis(s: SolverState, clues: ClueSet): boolean {
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

export interface ReasonStep {
  /** Deduction level used. */
  level: number;
  /** Candidates eliminated; -1 marks a contradiction. */
  gain: number;
}

/**
 * One step of person-like solving: apply a single round of the weakest deduction that makes
 * progress, or eliminate one candidate by hypothesis when `maxLevel` allows it. Mutates `s` and
 * returns null when no step is available.
 */
export function reasonStep(s: SolverState, clues: ClueSet, maxLevel: number): ReasonStep | null {
  const before = candidateCount(s);
  const deductionLevels = Math.min(maxLevel, LEVEL.EXACT);
  for (let level = LEVEL.COUNTS; level <= deductionLevels; level++) {
    scratch.set(s);
    if (!propagateRound(scratch, clues, level)) {
      s.set(scratch);
      return { level, gain: -1 };
    }
    const gain = before - candidateCount(scratch);
    if (gain > 0) {
      s.set(scratch);
      return { level, gain };
    }
  }
  if (maxLevel >= LEVEL.PROBE && eliminateByHypothesis(s, clues)) {
    return { level: LEVEL.PROBE, gain: 1 };
  }
  return null;
}

/** Applies reason steps until nothing more can be deduced; returns the steps taken per level. */
export function reasonToFixpoint(
  s: SolverState,
  clues: ClueSet,
  maxLevel: number,
): { steps: number[]; contradiction: boolean } {
  const steps = [0, 0, 0, 0, 0];
  for (;;) {
    if (isSolved(s)) return { steps, contradiction: false };
    const step = reasonStep(s, clues, maxLevel);
    if (!step) return { steps, contradiction: false };
    if (step.gain < 0) return { steps, contradiction: true };
    steps[step.level]!++;
  }
}
