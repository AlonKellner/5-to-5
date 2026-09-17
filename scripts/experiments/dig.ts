/**
 * Exp-4/5: cost, clue mix and measured difficulty of each dig criterion and order.
 * Usage: npm run exp:dig -- --boards 100 [--seed exp]
 */
import { performance } from 'node:perf_hooks';
import { countClueKinds } from '../../src/core/clues';
import { gradePuzzle } from '../../src/core/generator/grade';
import { digClues, type DigCriterion, type DigOrder } from '../../src/core/generator/dig';
import { Rng } from '../../src/core/rng';
import { LEVEL } from '../../src/core/solver/propagate';
import { loadOrSampleBoards, mean, parseArgs, quantile, table } from './common';

const args = parseArgs();
const boardCount = Number(args.get('boards') ?? 100);
const seed = args.get('seed') ?? 'exp';
const boards = loadOrSampleBoards(boardCount, seed);

const variants: { name: string; criterion: DigCriterion; order: DigOrder }[] = [
  { name: 'P0 counts', criterion: { kind: 'propagation', level: LEVEL.COUNTS }, order: 'random' },
  { name: 'P1 never', criterion: { kind: 'propagation', level: LEVEL.NEVER }, order: 'random' },
  { name: 'P2 must', criterion: { kind: 'propagation', level: LEVEL.MUST }, order: 'random' },
  { name: 'P3 exact', criterion: { kind: 'propagation', level: LEVEL.EXACT }, order: 'random' },
  { name: 'P4 probe', criterion: { kind: 'propagation', level: LEVEL.PROBE }, order: 'random' },
  { name: 'unique', criterion: { kind: 'unique' }, order: 'random' },
  { name: 'unique tiles-first', criterion: { kind: 'unique' }, order: 'tiles-first' },
  { name: 'unique relations-first', criterion: { kind: 'unique' }, order: 'relations-first' },
];

const rows: (string | number)[][] = [];
for (const variant of variants) {
  const times: number[] = [];
  const clues: number[] = [];
  const tiles: number[] = [];
  const levels = [0, 0, 0, 0, 0, 0];
  const nodes: number[] = [];
  const depths: number[] = [];
  boards.forEach((board, i) => {
    const t0 = performance.now();
    const { mask } = digClues(board, new Rng(`${seed}-${variant.name}-${i}`), variant);
    times.push(performance.now() - t0);
    const kinds = countClueKinds(mask);
    clues.push(kinds.total);
    tiles.push(kinds.tiles);
    const { stats } = gradePuzzle(board, mask);
    const hardest = stats.guessNodes > 0 ? 5 : stats.steps.reduce((m, n, l) => (n > 0 ? l : m), 0);
    levels[hardest]!++;
    nodes.push(stats.guessNodes);
    depths.push(stats.effort);
  });
  const pct = (n: number) => `${Math.round((100 * n) / boards.length)}%`;
  rows.push([
    variant.name,
    mean(times).toFixed(1),
    quantile(times, 0.95).toFixed(1),
    mean(clues).toFixed(1),
    `${quantile(clues, 0.1)}–${quantile(clues, 0.9)}`,
    mean(tiles).toFixed(1),
    levels.map(pct).join(' / '),
    `${quantile(nodes, 0.5)} / ${quantile(nodes, 0.9)} / ${Math.max(...nodes)}`,
    `${quantile(depths, 0.5)} / ${Math.max(...depths)}`,
  ]);
  process.stderr.write(`  done ${variant.name}\n`);
}

console.log(`\nDig experiment: ${boards.length} uniformly sampled boards (seed "${seed}")\n`);
console.log(
  table(
    [
      'criterion',
      'ms mean',
      'ms p95',
      'clues',
      'clues p10–p90',
      'tiles',
      'needs P0/P1/P2/P3/P4/search',
      'guess nodes p50/p90/max',
      'effort p50/max',
    ],
    rows,
  ),
);
