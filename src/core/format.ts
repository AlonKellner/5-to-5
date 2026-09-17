import { clueAt, horizontalEdge, RELATION_SYMBOLS, slotOfEdge, verticalEdge } from './clues';
import { COLOR_KEYS, SIZE } from './constants';
import type { Puzzle } from './puzzle';
import type { Ruleset } from './rules';

export interface AsciiOptions {
  /** Print every cell; clue tiles are upper-case. */
  showSolution?: boolean;
}

/**
 * Text rendering of a puzzle: cells on even lines with horizontal relations between them,
 * vertical relations (read top to bottom) on the odd lines below each cell.
 */
export function formatPuzzleAscii(
  puzzle: Pick<Puzzle, 'solution' | 'mask'>,
  options: AsciiOptions = {},
): string {
  const { solution, mask } = puzzle;
  const relation = (slot: number): string => {
    if (!mask[slot]) return ' ';
    const clue = clueAt(solution, slot);
    return clue.kind === 'relation' ? RELATION_SYMBOLS[clue.delta]! : ' ';
  };
  const lines: string[] = [];
  for (let r = 0; r < SIZE; r++) {
    let line = '';
    for (let c = 0; c < SIZE; c++) {
      const cell = r * SIZE + c;
      const key = COLOR_KEYS[solution[cell]!]!;
      if (mask[cell]) line += options.showSolution ? key.toUpperCase() : key;
      else line += options.showSolution ? key : '.';
      if (c < SIZE - 1) line += ` ${relation(slotOfEdge(horizontalEdge(r, c)))} `;
    }
    lines.push(line);
    if (r < SIZE - 1) {
      lines.push(
        Array.from({ length: SIZE }, (_, c) => relation(slotOfEdge(verticalEdge(r, c)))).join(
          '   ',
        ),
      );
    }
  }
  return lines.join('\n');
}

export function formatRuleset(ruleset: Ruleset): string {
  return COLOR_KEYS.map(
    (key, c) =>
      `${key}: must ${COLOR_KEYS[ruleset.must[c]!]}, never ${COLOR_KEYS[ruleset.never[c]!]}`,
  ).join(' | ');
}
