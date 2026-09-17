/**
 * Exploration for a smoother difficulty score: solve like a person (always use the weakest
 * deduction that makes progress) and record how much of each deduction level a puzzle needs.
 * Usage: npm run exp:grading -- --boards 60
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clueSetFromMask, countClueKinds, SLOT_COUNT, type ClueSet } from '../../src/core/clues';
import { digClues, type DigCriterion } from '../../src/core/generator/dig';
import { Rng } from '../../src/core/rng';
import { LEVEL, propagate, propagateRound } from '../../src/core/solver/propagate';
import { countSolutions } from '../../src/core/solver/search';
import { createState, isSolved, STATE_SIZE } from '../../src/core/solver/state';
import { DATA_DIR, loadOrSampleBoards, mean, parseArgs, quantile, table } from './common';

interface Trace {
  steps: number[];
  eliminated: number[];
  searchNodes: number;
  ms: number;
}

const popcount = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};

function candidates(s: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < STATE_SIZE; i++) n += popcount(s[i]!);
  return n;
}

function trace(clues: ClueSet): Trace {
  const start = performance.now();
  const steps = [0, 0, 0, 0, 0];
  const eliminated = [0, 0, 0, 0, 0];
  let s = createState(clues);
  let searchNodes = 0;
  const hyp = new Uint8Array(STATE_SIZE);
  for (;;) {
    if (isSolved(s)) break;
    const before = candidates(s);
    let progressed = false;
    for (let level = LEVEL.COUNTS; level <= LEVEL.EXACT && !progressed; level++) {
      const t = s.slice();
      if (!propagateRound(t, clues, level)) throw new Error('contradiction in a unique puzzle');
      const after = candidates(t);
      if (after < before) {
        steps[level]!++;
        eliminated[level]! += before - after;
        s = t;
        progressed = true;
      }
    }
    if (progressed) continue;
    // One hypothesis that fails, then back to simple deductions.
    outer: for (let slot = 0; slot < STATE_SIZE; slot++) {
      const m = s[slot]!;
      if (popcount(m) < 2) continue;
      for (let c = 0; c < 5; c++) {
        if (!(m & (1 << c))) continue;
        hyp.set(s);
        hyp[slot] = 1 << c;
        if (!propagate(hyp, clues, LEVEL.EXACT)) {
          s = s.slice();
          s[slot] = m & ~(1 << c);
          steps[4]!++;
          eliminated[4]! += 1;
          progressed = true;
          break outer;
        }
      }
    }
    if (progressed) continue;
    const result = countSolutions(clues, { limit: 2, startState: s });
    searchNodes = result.nodes;
    break;
  }
  return { steps, eliminated, searchNodes, ms: performance.now() - start };
}

const args = parseArgs();
const boards = loadOrSampleBoards(Number(args.get('boards') ?? 60), args.get('seed') ?? 'exp');
const criteria: [string, DigCriterion][] = [
  ['P1', { kind: 'propagation', level: LEVEL.NEVER }],
  ['P2', { kind: 'propagation', level: LEVEL.MUST }],
  ['P3', { kind: 'propagation', level: LEVEL.EXACT }],
  ['P4', { kind: 'propagation', level: LEVEL.PROBE }],
  ['unique', { kind: 'unique' }],
];

const rows: Record<string, unknown>[] = [];
boards.forEach((board, b) => {
  for (const [name, criterion] of criteria) {
    const rng = new Rng(`grading-${name}-${b}`);
    const { mask } = digClues(board, rng, { criterion });
    const hidden = Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((i) => !mask[i]);
    rng.shuffle(hidden);
    for (const readd of [0, 2, 4, 8]) {
      const m = mask.slice();
      for (const slot of hidden.slice(0, readd)) m[slot] = 1;
      const clues = clueSetFromMask(board, m);
      const t = trace(clues);
      const maxLevel = t.searchNodes > 0 ? 5 : Math.max(...t.steps.map((n, i) => (n > 0 ? i : 0)));
      rows.push({
        variant: `${name}+${readd}`,
        clues: countClueKinds(m).total,
        maxLevel,
        ...Object.fromEntries(t.steps.map((n, i) => [`s${i}`, n])),
        ...Object.fromEntries(t.eliminated.map((n, i) => [`e${i}`, n])),
        searchNodes: t.searchNodes,
        ms: t.ms,
      });
    }
  }
});
writeFileSync(join(DATA_DIR, 'grading.json'), JSON.stringify(rows));

const WEIGHTS = [1, 2, 3, 5, 8];
const GUESS_WEIGHT = 10;
for (const r of rows) {
  const effort =
    WEIGHTS.reduce((acc, w, l) => acc + w * (r[`s${l}`] as number), 0) +
    GUESS_WEIGHT * (r['searchNodes'] as number);
  r['log2Effort'] = Math.log2(Math.max(1, effort));
}

const groups = new Map<string, Record<string, unknown>[]>();
for (const r of rows)
  groups.set(r['variant'] as string, [...(groups.get(r['variant'] as string) ?? []), r]);
const num = (rs: Record<string, unknown>[], k: string) => rs.map((r) => r[k] as number);
console.log(
  table(
    [
      'variant',
      'clues',
      'max level',
      's0',
      's1',
      's2',
      's3',
      's4',
      'search nodes p50/max',
      'log2 effort p10/p50/p90',
      'ms mean/max',
    ],
    [...groups.entries()].map(([v, rs]) => [
      v,
      mean(num(rs, 'clues')).toFixed(1),
      [0, 1, 2, 3, 4, 5].map((l) => rs.filter((r) => r['maxLevel'] === l).length).join('/'),
      ...[0, 1, 2, 3, 4].map((l) => mean(num(rs, `s${l}`)).toFixed(1)),
      `${quantile(num(rs, 'searchNodes'), 0.5)}/${Math.max(...num(rs, 'searchNodes'))}`,
      [0.1, 0.5, 0.9].map((q) => quantile(num(rs, 'log2Effort'), q).toFixed(1)).join('/'),
      `${mean(num(rs, 'ms')).toFixed(1)}/${Math.max(...num(rs, 'ms')).toFixed(0)}`,
    ]),
  ),
);
