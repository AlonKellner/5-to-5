import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBoard, parseBoard, type Board } from '../../src/core/board';
import { clueSetFromMask, SLOT_COUNT, type ClueMask } from '../../src/core/clues';
import { CELL_COUNT, NEIGHBORS } from '../../src/core/constants';
import { LEVEL } from '../../src/core/solver/propagate';
import { reasonStep } from '../../src/core/solver/reason';
import { countSolutions } from '../../src/core/solver/search';
import { createState } from '../../src/core/solver/state';
import { sampleBoardRejection } from '../../src/core/generator/sampleBoard';
import { Rng } from '../../src/core/rng';

export const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/experiments/data',
);

export function parseArgs(argv = process.argv.slice(2)): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args.set(a.slice(2), 'true');
    else {
      args.set(a.slice(2), next);
      i++;
    }
  }
  return args;
}

/** Uniformly sampled boards, cached on disk so experiments can be re-run quickly. */
export function loadOrSampleBoards(count: number, seed: string): Board[] {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = join(DATA_DIR, `boards-${seed}.txt`);
  const cached = existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(parseBoard)
    : [];
  if (cached.length >= count) return cached.slice(0, count);
  const rng = new Rng(`${seed}#${cached.length}`);
  const boards = [...cached];
  while (boards.length < count) {
    boards.push(sampleBoardRejection(rng)!.board);
    if (boards.length % 25 === 0) process.stderr.write(`  sampled ${boards.length}/${count}\n`);
  }
  writeFileSync(file, boards.map((b) => formatBoard(b)).join('\n') + '\n');
  return boards;
}

export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

export const mean = (values: readonly number[]): number =>
  values.reduce((a, b) => a + b, 0) / values.length;

/** Clues that can be dropped without losing uniqueness: clues the solver never really needs. */
export function redundantClues(board: Board, mask: ClueMask): number {
  let redundant = 0;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (!mask[slot]) continue;
    const reduced = mask.slice();
    reduced[slot] = 0;
    if (countSolutions(clueSetFromMask(board, reduced), { limit: 2 }).count === 1) redundant++;
  }
  return redundant;
}

/** Share of clued tiles that touch another clued tile: high means the clues clump together. */
export function clueClustering(mask: ClueMask): number {
  const clued = new Set<number>();
  for (let cell = 0; cell < CELL_COUNT; cell++) if (mask[cell]) clued.add(cell);
  if (clued.size === 0) return 0;
  let touching = 0;
  for (const cell of clued) if (NEIGHBORS[cell]!.some((n) => clued.has(n))) touching++;
  return touching / clued.size;
}

/**
 * Mean distance the solving front travels between consecutive deduction steps. Lower means the
 * reasoning flows from one part of the board to the next instead of jumping around.
 */
export function solvingLocality(board: Board, mask: ClueMask): number {
  const clues = clueSetFromMask(board, mask);
  const state = createState(clues);
  let previous: { row: number; col: number } | null = null;
  const distances: number[] = [];
  for (;;) {
    const before = state.slice();
    const step = reasonStep(state, clues, LEVEL.PROBE);
    if (!step || step.gain < 0) break;
    let sumRow = 0;
    let sumCol = 0;
    let changed = 0;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (state[cell] === before[cell]) continue;
      sumRow += Math.floor(cell / 5);
      sumCol += cell % 5;
      changed++;
    }
    if (changed === 0) continue;
    const centroid = { row: sumRow / changed, col: sumCol / changed };
    if (previous) {
      distances.push(Math.abs(centroid.row - previous.row) + Math.abs(centroid.col - previous.col));
    }
    previous = centroid;
  }
  return distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
}

export function table(headers: string[], rows: (string | number)[][]): string {
  const cells = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, i) => Math.max(...cells.map((r) => r[i]!.length)));
  const line = (r: string[]) => `| ${r.map((c, i) => c.padEnd(widths[i]!)).join(' | ')} |`;
  return [
    line(cells[0]!),
    `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`,
    ...cells.slice(1).map(line),
  ].join('\n');
}
