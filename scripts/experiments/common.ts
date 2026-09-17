import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBoard, parseBoard, type Board } from '../../src/core/board';
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
