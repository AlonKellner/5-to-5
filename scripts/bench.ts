import { performance } from 'node:perf_hooks';
import { createSampler, type SamplerKind } from '../src/core/generator/sampleBoard';
import { Rng } from '../src/core/rng';

const args = new Map(
  process.argv
    .slice(2)
    .flatMap((a, i, all) => (a.startsWith('--') ? [[a.slice(2), all[i + 1]]] : [])),
);
const boards = Number(args.get('boards') ?? 30);

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function benchSampler(kind: SamplerKind) {
  const rng = new Rng(args.get('seed') ?? 'bench');
  const times: number[] = [];
  let totalTrials = 0;
  const start = performance.now();
  for (let i = 0; i < boards; i++) {
    const sampler = createSampler(kind, rng);
    const t0 = performance.now();
    sampler.run(Number.POSITIVE_INFINITY);
    times.push(performance.now() - t0);
    totalTrials += sampler.trials;
  }
  const elapsed = performance.now() - start;
  times.sort((a, b) => a - b);
  console.log(`Sampler "${kind}" (${boards} boards)`);
  console.log(`  trials/s        ${Math.round((totalTrials / elapsed) * 1000).toLocaleString()}`);
  console.log(`  trials/board    ${Math.round(totalTrials / boards).toLocaleString()}`);
  console.log(`  density         ${(boards / totalTrials).toExponential(3)}`);
  console.log(
    `  ms/board        mean ${(elapsed / boards).toFixed(0)}  median ${quantile(times, 0.5).toFixed(0)}  p90 ${quantile(times, 0.9).toFixed(0)}  max ${times[times.length - 1]!.toFixed(0)}`,
  );
}

const only = args.get('sampler') as SamplerKind | undefined;
for (const kind of ['rejection', 'early-rejection'] as SamplerKind[]) {
  if (!only || only === kind) benchSampler(kind);
}
