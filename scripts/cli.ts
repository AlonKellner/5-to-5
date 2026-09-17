/**
 * Generate puzzles from the terminal.
 * Usage: npm run puzzle -- [--seed s] [--difficulty easy|medium|hard|expert] [--count n]
 *                          [--solution] [--json]
 */
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { formatBoard } from '../src/core/board';
import { countClueKinds } from '../src/core/clues';
import { encodePuzzle } from '../src/core/codec';
import { formatPuzzleAscii, formatRuleset } from '../src/core/format';
import { generatePuzzle } from '../src/core/generator/generate';
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '../src/core/puzzle';
import { deriveRuleset } from '../src/core/validator';

export function runCli(argv: string[]): string {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args.set(a.slice(2), 'true');
    else args.set(a.slice(2), argv[++i]!);
  }
  const difficulty = (args.get('difficulty') ?? 'medium') as DifficultyLevel;
  if (!DIFFICULTY_LEVELS.includes(difficulty)) {
    throw new Error(`--difficulty must be one of ${DIFFICULTY_LEVELS.join(', ')}`);
  }
  const count = Number(args.get('count') ?? 1);
  const baseSeed = args.get('seed') ?? String(Date.now());
  const out: string[] = [];
  const json: unknown[] = [];

  for (let i = 0; i < count; i++) {
    const seed = count === 1 ? baseSeed : `${baseSeed}-${i}`;
    const start = performance.now();
    const puzzle = generatePuzzle({ seed, difficulty });
    const ms = performance.now() - start;
    const ruleset = deriveRuleset(puzzle.solution)!;
    const kinds = countClueKinds(puzzle.mask);
    const code = encodePuzzle(puzzle);
    if (args.has('json')) {
      json.push({
        seed,
        difficulty,
        code,
        solution: formatBoard(puzzle.solution),
        ruleset,
        rating: puzzle.rating,
        clues: kinds,
        ms: Math.round(ms),
      });
      continue;
    }
    out.push(
      `seed ${seed} · ${puzzle.rating!.level} (score ${puzzle.rating!.score}) · ` +
        `${kinds.tiles} tiles + ${kinds.relations} relations · ${ms.toFixed(0)} ms · code ${code}`,
      '',
      formatPuzzleAscii(puzzle),
      '',
    );
    if (args.has('solution')) {
      out.push(formatPuzzleAscii(puzzle, { showSolution: true }), '', formatRuleset(ruleset), '');
    }
  }
  return args.has('json') ? JSON.stringify(count === 1 ? json[0] : json, null, 2) : out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(runCli(process.argv.slice(2)));
}
