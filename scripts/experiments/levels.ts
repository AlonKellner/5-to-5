/**
 * Calibration of the 7 difficulty levels: for each level, dig puzzles on uniformly sampled boards
 * and report how often a dig lands in the level, how long it takes, and the resulting scores.
 * Usage: npm run exp:levels -- --boards 40
 */
import { performance } from 'node:perf_hooks';
import { countClueKinds } from '../../src/core/clues';
import { puzzleForBoard } from '../../src/core/generator/generate';
import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES } from '../../src/core/puzzle';
import { Rng } from '../../src/core/rng';
import { loadOrSampleBoards, mean, parseArgs, quantile, table } from './common';

const args = parseArgs();
const digs = Number(args.get('digs') ?? 4);
const boards = loadOrSampleBoards(Number(args.get('boards') ?? 40), args.get('seed') ?? 'exp');

const rows: (string | number)[][] = [];
for (const level of DIFFICULTY_LEVELS) {
  const times: number[] = [];
  const scores: number[] = [];
  const clues: number[] = [];
  const guesses: number[] = [];
  let found = 0;
  boards.forEach((board, i) => {
    const t0 = performance.now();
    const result = puzzleForBoard(board, level, new Rng(`levels-${level}-${i}`), digs);
    times.push(performance.now() - t0);
    if (!result) return;
    found++;
    scores.push(result.rating.score);
    clues.push(countClueKinds(result.mask).total);
    guesses.push(result.rating.stats.guessNodes);
  });
  rows.push([
    `${level} ${DIFFICULTY_NAMES[level]}`,
    `${Math.round((100 * found) / boards.length)}%`,
    `${mean(times).toFixed(0)} / ${quantile(times, 0.9).toFixed(0)} / ${Math.max(...times).toFixed(0)}`,
    scores.length
      ? `${mean(scores).toFixed(0)} (${Math.min(...scores)}–${Math.max(...scores)})`
      : '-',
    clues.length ? mean(clues).toFixed(1) : '-',
    guesses.length
      ? `${Math.round((100 * guesses.filter((g) => g > 0).length) / guesses.length)}%`
      : '-',
  ]);
  process.stderr.write(`  level ${level} done\n`);
}

console.log(`\nLevel calibration on ${boards.length} boards (up to ${digs} digs per board)\n`);
console.log(
  table(
    [
      'level',
      'board yields level',
      'ms per board mean / p90 / max',
      'score mean (range)',
      'clues',
      'needs guessing',
    ],
    rows,
  ),
);
