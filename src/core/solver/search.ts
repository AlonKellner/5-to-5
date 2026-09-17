import type { Board } from '../board';
import type { ClueSet } from '../clues';
import { CELL_COUNT, COLOR_COUNT } from '../constants';
import type { Rng } from '../rng';
import type { Ruleset } from '../rules';
import { deriveRuleset } from '../validator';
import { POPCOUNT } from './bits';
import { MAX_LEVEL, propagate } from './propagate';
import {
  boardOfSolvedState,
  createState,
  isSolved,
  MUST,
  NEVER,
  STATE_SIZE,
  type SolverState,
} from './state';

export interface SearchOptions {
  /** Stop after this many solutions (default 2, enough to decide uniqueness). */
  limit?: number;
  /** Abort after this many search nodes. */
  maxNodes?: number;
  /** Keep the solutions found (default false). */
  collect?: boolean;
  /** Randomizes the order in which colors are tried. */
  rng?: Rng;
  /** Propagation level used at every node (default: strongest). */
  level?: number;
  /** Pin the hidden rules. */
  ruleset?: Ruleset;
  /** Called for every solution; return false to stop the search. */
  onSolution?: (board: Board, ruleset: Ruleset) => boolean | void;
}

export interface SearchResult {
  /** complete: the whole space was explored; limit: stopped at `limit`; timeout: node budget hit. */
  status: 'complete' | 'limit' | 'timeout';
  count: number;
  solutions: Board[];
  nodes: number;
  /** Deepest nesting of guesses. */
  maxDepth: number;
}

function rulesetFitsDomains(s: SolverState, rs: Ruleset): boolean {
  for (let c = 0; c < COLOR_COUNT; c++) {
    if (!(s[MUST + c]! & (1 << rs.must[c]!)) || !(s[NEVER + c]! & (1 << rs.never[c]!)))
      return false;
  }
  return true;
}

export function countSolutions(clues: ClueSet, options: SearchOptions = {}): SearchResult {
  const limit = options.limit ?? 2;
  const maxNodes = options.maxNodes ?? Number.POSITIVE_INFINITY;
  const level = options.level ?? MAX_LEVEL;
  const { rng, collect, onSolution } = options;
  const stack = new Uint8Array(STATE_SIZE * (CELL_COUNT + 1));
  stack.set(createState(clues, options.ruleset));
  const result: SearchResult = {
    status: 'complete',
    count: 0,
    solutions: [],
    nodes: 0,
    maxDepth: 0,
  };
  const orders = new Uint8Array(COLOR_COUNT * (CELL_COUNT + 1));

  const dfs = (depth: number): boolean => {
    if (++result.nodes > maxNodes) {
      result.status = 'timeout';
      return true;
    }
    const s = stack.subarray(depth * STATE_SIZE, (depth + 1) * STATE_SIZE);
    if (!propagate(s, clues, level)) return false;

    let cell = -1;
    let best = COLOR_COUNT + 1;
    for (let x = 0; x < CELL_COUNT; x++) {
      const pc = POPCOUNT[s[x]!]!;
      if (pc > 1 && pc < best) {
        best = pc;
        cell = x;
        if (pc === 2) break;
      }
    }

    if (cell < 0) {
      const board = boardOfSolvedState(s);
      const ruleset = deriveRuleset(board);
      if (!ruleset || !rulesetFitsDomains(s, ruleset)) return false;
      result.count++;
      if (collect) result.solutions.push(board);
      if (onSolution?.(board, ruleset) === false || result.count >= limit) {
        result.status = 'limit';
        return true;
      }
      return false;
    }

    if (depth + 1 > result.maxDepth) result.maxDepth = depth + 1;
    const mask = s[cell]!;
    const order = orders.subarray(depth * COLOR_COUNT, (depth + 1) * COLOR_COUNT);
    let n = 0;
    for (let c = 0; c < COLOR_COUNT; c++) if (mask & (1 << c)) order[n++] = c;
    if (rng) rng.shuffle(order.subarray(0, n));
    const child = stack.subarray((depth + 1) * STATE_SIZE, (depth + 2) * STATE_SIZE);
    for (let k = 0; k < n; k++) {
      child.set(s);
      child[cell] = 1 << order[k]!;
      if (dfs(depth + 1)) return true;
    }
    return false;
  };

  dfs(0);
  return result;
}

/** Tries to solve with propagation only (no guessing) at the given level. */
export function solveByPropagation(
  clues: ClueSet,
  level: number,
): { consistent: boolean; solved: boolean; state: SolverState } {
  const state = createState(clues);
  const consistent = propagate(state, clues, level);
  const solved = consistent && isSolved(state) && deriveRuleset(boardOfSolvedState(state)) !== null;
  return { consistent, solved, state };
}
