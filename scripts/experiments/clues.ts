/**
 * Exp-7: clue sets built from the solver's reasoning chain, compared with random digging.
 * Usage: npm run exp:clues -- --boards 60
 */
import { performance } from 'node:perf_hooks';
import { countClueKinds, type ClueMask } from '../../src/core/clues';
import { digClues } from '../../src/core/generator/dig';
import { gradePuzzle } from '../../src/core/generator/grade';
import { selectCluesByReasoning } from '../../src/core/generator/selectClues';
import type { Board } from '../../src/core/board';
import { Rng } from '../../src/core/rng';
import { LEVEL } from '../../src/core/solver/propagate';
import {
  clueClustering,
  loadOrSampleBoards,
  mean,
  parseArgs,
  quantile,
  redundantClues,
  table,
} from './common';

const args = parseArgs();
const boards = loadOrSampleBoards(Number(args.get('boards') ?? 60), args.get('seed') ?? 'exp');

interface Variant {
  name: string;
  build: (board: Board, rng: Rng) => ClueMask;
}

const variants: Variant[] = [
  {
    name: 'dig P2 (random)',
    build: (b, r) => digClues(b, r, { criterion: { kind: 'propagation', level: LEVEL.MUST } }).mask,
  },
  {
    name: 'dig P3 (random)',
    build: (b, r) =>
      digClues(b, r, { criterion: { kind: 'propagation', level: LEVEL.EXACT } }).mask,
  },
  {
    name: 'dig P4 (random)',
    build: (b, r) =>
      digClues(b, r, { criterion: { kind: 'propagation', level: LEVEL.PROBE } }).mask,
  },
  {
    name: 'dig unique (random)',
    build: (b, r) => digClues(b, r, { criterion: { kind: 'unique' } }).mask,
  },
  ...[LEVEL.NEVER, LEVEL.MUST, LEVEL.EXACT, LEVEL.PROBE].map((level) => ({
    name: `reasoning P${level}`,
    build: (b: Board, r: Rng) => selectCluesByReasoning(b, r, { solveLevel: level }).mask,
  })),
  ...[LEVEL.EXACT, LEVEL.PROBE].map((level) => ({
    name: `reasoning P${level} + prune`,
    build: (b: Board, r: Rng) => {
      const { mask } = selectCluesByReasoning(b, r, { solveLevel: level });
      return digClues(b, r, { criterion: { kind: 'unique' }, start: mask }).mask;
    },
  })),
];

const rows: (string | number)[][] = [];
for (const variant of variants) {
  const times: number[] = [];
  const clues: number[] = [];
  const tiles: number[] = [];
  const scores: number[] = [];
  const redundant: number[] = [];
  const clustering: number[] = [];
  let guessing = 0;
  boards.forEach((board, i) => {
    const t0 = performance.now();
    const mask = variant.build(board, new Rng(`clues-${variant.name}-${i}`));
    times.push(performance.now() - t0);
    const kinds = countClueKinds(mask);
    clues.push(kinds.total);
    tiles.push(kinds.tiles);
    const grade = gradePuzzle(board, mask);
    scores.push(grade.score);
    if (grade.stats.guessNodes > 0) guessing++;
    redundant.push(redundantClues(board, mask));
    clustering.push(clueClustering(mask));
  });
  rows.push([
    variant.name,
    mean(times).toFixed(0),
    mean(clues).toFixed(1),
    mean(tiles).toFixed(1),
    `${mean(scores).toFixed(0)} (${quantile(scores, 0.1).toFixed(0)}–${quantile(scores, 0.9).toFixed(0)})`,
    mean(redundant).toFixed(1),
    `${Math.round(100 * mean(clustering))}%`,
    `${Math.round((100 * guessing) / boards.length)}%`,
  ]);
  process.stderr.write(`  done ${variant.name}\n`);
}

console.log(`\nClue selection on ${boards.length} boards\n`);
console.log(
  table(
    [
      'variant',
      'ms',
      'clues',
      'tiles',
      'score mean (p10–p90)',
      'redundant clues',
      'clue tiles touching',
      'needs guessing',
    ],
    rows,
  ),
);
