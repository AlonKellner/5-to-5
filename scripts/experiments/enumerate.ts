/**
 * Exp-1: exact enumeration of all strictly valid boards for one ruleset of each relabeling class.
 * Results (counts and feature histograms, weighted to the full space) go to
 * docs/experiments/data/enumeration.json. Runs on all cores.
 * Usage: npm run exp:enumerate [-- --threads 10]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { emptyClueSet } from '../../src/core/clues';
import { rulesetClass, VALID_RULESETS, type Ruleset } from '../../src/core/rules';
import { countSolutions } from '../../src/core/solver/search';
import { DATA_DIR, parseArgs } from './common';
import {
  addToHistograms,
  boardFeatures,
  emptyHistograms,
  mergeHistograms,
  type FeatureHistograms,
} from './features';

interface Task {
  classIndex: number;
  ruleset: Ruleset;
  prefix: number[];
}

interface TaskResult {
  classIndex: number;
  count: number;
  nodes: number;
  histograms: FeatureHistograms;
}

const PREFIX_CELLS = [0, 1, 2];

function runTask(task: Task): TaskResult {
  const clues = emptyClueSet();
  task.prefix.forEach((color, i) => (clues.tiles[PREFIX_CELLS[i]!] = color));
  const histograms = emptyHistograms();
  const result = countSolutions(clues, {
    limit: Number.POSITIVE_INFINITY,
    ruleset: task.ruleset,
    onSolution: (board) => addToHistograms(histograms, boardFeatures(board)),
  });
  return { classIndex: task.classIndex, count: result.count, nodes: result.nodes, histograms };
}

if (!isMainThread) {
  parentPort!.on('message', (task: Task) => parentPort!.postMessage(runTask(task)));
} else {
  const args = parseArgs();
  const threads = Number(args.get('threads') ?? availableParallelism());
  const classes = [0, 1, 2].map((k) => {
    const members = VALID_RULESETS.filter((rs) => rulesetClass(rs) === k);
    return { index: k, representative: members[0]!, size: members.length };
  });
  const tasks: Task[] = [];
  for (const cls of classes) {
    for (let a = 0; a < 5; a++)
      for (let b = 0; b < 5; b++)
        for (let c = 0; c < 5; c++)
          tasks.push({ classIndex: cls.index, ruleset: cls.representative, prefix: [a, b, c] });
  }

  const perClass = classes.map(() => ({ count: 0, nodes: 0, histograms: emptyHistograms() }));
  const start = performance.now();
  let next = 0;
  let done = 0;
  await new Promise<void>((resolve, reject) => {
    for (let t = 0; t < threads; t++) {
      const worker = new Worker(new URL(import.meta.url), { execArgv: ['--import', 'tsx'] });
      const feed = () => {
        if (next < tasks.length) worker.postMessage(tasks[next++]);
        else void worker.terminate();
      };
      worker.on('message', (r: TaskResult) => {
        const acc = perClass[r.classIndex]!;
        acc.count += r.count;
        acc.nodes += r.nodes;
        mergeHistograms(acc.histograms, r.histograms);
        done++;
        if (done % 25 === 0 || done === tasks.length) {
          const elapsed = (performance.now() - start) / 1000;
          process.stderr.write(`  ${done}/${tasks.length} tasks, ${elapsed.toFixed(0)}s\n`);
        }
        if (done === tasks.length) resolve();
        feed();
      });
      worker.on('error', reject);
      feed();
    }
  });

  const total = classes.reduce((acc, cls) => acc + cls.size * perClass[cls.index]!.count, 0);
  const weighted = emptyHistograms();
  classes.forEach((cls) => mergeHistograms(weighted, perClass[cls.index]!.histograms, cls.size));
  const arrangements =
    25n *
    24n *
    23n *
    22n *
    21n *
    20n *
    19n *
    18n *
    17n *
    16n *
    15n *
    14n *
    13n *
    12n *
    11n *
    10n *
    9n *
    8n *
    7n *
    6n *
    5n *
    4n *
    3n *
    2n;
  const multiset = arrangements / 120n ** 5n;
  const report = {
    seconds: (performance.now() - start) / 1000,
    classes: classes.map((cls) => ({
      index: cls.index,
      representative: cls.representative,
      labelings: cls.size,
      boardsPerLabeling: perClass[cls.index]!.count,
      nodes: perClass[cls.index]!.nodes,
      histograms: perClass[cls.index]!.histograms,
    })),
    totalValidBoards: total,
    arrangements: multiset.toString(),
    density: total / Number(multiset),
    weightedHistograms: weighted,
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'enumeration.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ...report,
        classes: report.classes.map(({ histograms: _h, ...c }) => c),
        weightedHistograms: undefined,
      },
      null,
      2,
    ),
  );
}
