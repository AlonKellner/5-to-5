/**
 * Exp-3: compares the board distribution of each sampler with the exact enumeration (Exp-1).
 * Requires docs/experiments/data/enumeration.json (npm run exp:enumerate).
 * Usage: npm run exp:bias -- --boards 3000 [--threads 11]
 */
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { canonicalBoardKey, permuteColors, SYMMETRIES, transformBoard } from '../../src/core/board';
import { createSampler, type SamplerKind } from '../../src/core/generator/sampleBoard';
import { PERMUTATIONS } from '../../src/core/rules';
import { Rng } from '../../src/core/rng';
import { DATA_DIR, parseArgs, table } from './common';
import {
  addToHistograms,
  boardFeatures,
  emptyHistograms,
  FEATURE_NAMES,
  mergeHistograms,
  type FeatureHistograms,
} from './features';
import { goodnessOfFit } from './stats';

type Variant = SamplerKind | 'dfs+symmetry';

interface Job {
  variant: Variant;
  count: number;
  seed: string;
}

interface JobResult {
  histograms: FeatureHistograms;
  keys: string[];
  trials: number;
  ms: number;
}

function runJob(job: Job): JobResult {
  const rng = new Rng(job.seed);
  const sampler = createSampler(job.variant === 'dfs+symmetry' ? 'dfs' : job.variant, rng);
  const histograms = emptyHistograms();
  const keys: string[] = [];
  const start = performance.now();
  for (let i = 0; i < job.count; i++) {
    let board = sampler.run(Number.POSITIVE_INFINITY)!;
    if (job.variant === 'dfs+symmetry') {
      board = permuteColors(transformBoard(board, rng.pick(SYMMETRIES)), rng.pick(PERMUTATIONS));
    }
    addToHistograms(histograms, boardFeatures(board));
    keys.push(canonicalBoardKey(board).toString(36));
  }
  return { histograms, keys, trials: sampler.trials, ms: performance.now() - start };
}

if (!isMainThread) {
  parentPort!.on('message', (job: Job) => parentPort!.postMessage(runJob(job)));
} else {
  const args = parseArgs();
  const boards = Number(args.get('boards') ?? 3000);
  const threads = Number(args.get('threads') ?? availableParallelism());
  const enumeration = JSON.parse(readFileSync(join(DATA_DIR, 'enumeration.json'), 'utf8')) as {
    totalValidBoards: number;
    weightedHistograms: FeatureHistograms;
  };
  const variants: Variant[] = (args.get('samplers')?.split(',') as Variant[]) ?? [
    'early-rejection',
    'dfs',
    'dfs+symmetry',
  ];

  const pool = Array.from(
    { length: threads },
    () => new Worker(new URL(import.meta.url), { execArgv: ['--import', 'tsx'] }),
  );
  const run = (worker: Worker, job: Job) =>
    new Promise<JobResult>((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.postMessage(job);
    });

  const rows: (string | number)[][] = [];
  for (const variant of variants) {
    const start = performance.now();
    const per = Math.ceil(boards / threads);
    const results = await Promise.all(
      pool.map((w, t) => run(w, { variant, count: per, seed: `bias-${variant}-${t}` })),
    );
    const wall = performance.now() - start;
    const histograms = emptyHistograms();
    const keys = new Set<string>();
    let samples = 0;
    let duplicates = 0;
    let cpuMs = 0;
    for (const r of results) {
      mergeHistograms(histograms, r.histograms);
      cpuMs += r.ms;
      for (const k of r.keys) {
        samples++;
        if (keys.has(k)) duplicates++;
        else keys.add(k);
      }
    }
    // Most boards have 960 distinct symmetric relabelings.
    const orbits = enumeration.totalValidBoards / 960;
    const expectedDuplicates = (samples * (samples - 1)) / (2 * orbits);
    const fits = FEATURE_NAMES.map((name) =>
      goodnessOfFit(histograms[name], enumeration.weightedHistograms[name]),
    );
    rows.push([
      variant,
      samples,
      (cpuMs / samples).toFixed(1),
      ...fits.map((f) => `${f.chi2.toFixed(1)} (df ${f.df}) p=${f.pValue.toExponential(1)}`),
      `${duplicates} vs ${expectedDuplicates.toFixed(1)}`,
    ]);
    process.stderr.write(`  done ${variant} in ${(wall / 1000).toFixed(0)}s\n`);
  }
  await Promise.all(pool.map((w) => w.terminate()));

  console.log(
    `\nBias experiment: samplers vs exact enumeration (${enumeration.totalValidBoards} boards)\n`,
  );
  console.log(
    table(
      [
        'sampler',
        'samples',
        'cpu ms/board',
        ...FEATURE_NAMES.map((n) => `χ² ${n}`),
        'duplicate orbits (observed vs uniform)',
      ],
      rows,
    ),
  );
}
