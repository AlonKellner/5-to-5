import type { Board } from '../board';
import {
  clueAt,
  edgeOfSlot,
  emptyClueSet,
  emptyMask,
  isTileSlot,
  SLOT_COUNT,
  type ClueMask,
  type ClueSet,
} from '../clues';
import type { Rng } from '../rng';
import { LEVEL, propagate } from '../solver/propagate';
import { candidateCount, reasonStep } from '../solver/reason';
import { createState, isSolved, STATE_SIZE, type SolverState } from '../solver/state';

export interface ReasoningStep {
  kind: 'deduction' | 'clue';
  /** Candidates eliminated by this step. */
  gain: number;
  /** Deduction level used, for 'deduction' steps. */
  level?: number;
  /** Clue slot, for 'clue' steps. */
  slot?: number;
}

export interface ReasoningSelection {
  mask: ClueMask;
  /** Clues placed. */
  placed: number;
  /** Deduction steps taken between placements. */
  rounds: number;
  steps: ReasoningStep[];
}

export interface ReasoningOptions {
  /** Strongest deduction the chain may use before another clue is needed. */
  solveLevel?: number;
  /** Clues within this fraction of the best progress are picked at random. */
  tolerance?: number;
  /** Record the chain in `steps`. */
  trace?: boolean;
}

/** Adds a clue to the clue set and, for tile clues, to the state (only createState reads tiles). */
function addClue(clues: ClueSet, state: SolverState, solution: Board, slot: number): void {
  const clue = clueAt(solution, slot);
  if (clue.kind === 'tile') {
    clues.tiles[clue.cell] = clue.color;
    state[clue.cell] = 1 << clue.color;
  } else {
    clues.relations[clue.edge] = clue.delta;
  }
}

function removeClue(clues: ClueSet, slot: number): void {
  if (isTileSlot(slot)) clues.tiles[slot] = -1;
  else clues.relations[edgeOfSlot(slot)] = -1;
}

/**
 * Builds a clue set from the solver's own reasoning: deduce as far as the allowed deductions go
 * and, whenever that stalls, add the clue that unblocks the most progress. Every clue earns its
 * place in a solving chain, unlike the clues left over by removing them at random.
 */
export function selectCluesByReasoning(
  solution: Board,
  rng: Rng,
  options: ReasoningOptions = {},
): ReasoningSelection {
  const solveLevel = options.solveLevel ?? LEVEL.EXACT;
  const tolerance = options.tolerance ?? 0.9;
  const clues = emptyClueSet();
  const mask = emptyMask();
  const steps: ReasoningStep[] = [];
  const state = createState(clues);
  const scratch = new Uint8Array(STATE_SIZE);
  const gains = new Int16Array(SLOT_COUNT);
  let placed = 0;
  let rounds = 0;

  for (;;) {
    // Follow the chain as far as the allowed deductions reach.
    for (;;) {
      if (isSolved(state)) return { mask, placed, rounds, steps };
      const step = reasonStep(state, clues, solveLevel);
      if (!step || step.gain < 0) break;
      rounds++;
      if (options.trace) steps.push({ kind: 'deduction', gain: step.gain, level: step.level });
    }
    if (isSolved(state)) return { mask, placed, rounds, steps };

    // Stuck: rank the hidden clues by how much reasoning each one unblocks. Ranking uses the plain
    // deductions even when the chain may use hypotheses, because it runs for every candidate.
    const before = candidateCount(state);
    let bestGain = 0;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      gains[slot] = -1;
      if (mask[slot]) continue;
      scratch.set(state);
      addClue(clues, scratch, solution, slot);
      const consistent = propagate(scratch, clues, LEVEL.EXACT);
      removeClue(clues, slot);
      if (!consistent) continue;
      const gain = before - candidateCount(scratch);
      gains[slot] = gain;
      if (gain > bestGain) bestGain = gain;
    }
    if (bestGain === 0) return { mask, placed, rounds, steps };

    const pool: number[] = [];
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (gains[slot]! >= tolerance * bestGain) pool.push(slot);
    }
    const chosen = rng.pick(pool);
    addClue(clues, state, solution, chosen);
    mask[chosen] = 1;
    placed++;
    if (options.trace) steps.push({ kind: 'clue', gain: gains[chosen]!, slot: chosen });
  }
}
