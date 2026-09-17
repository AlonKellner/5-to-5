import { createBoard, type Board } from '../../src/core/board';
import {
  emptyMask,
  horizontalEdge,
  slotOfEdge,
  verticalEdge,
  type ClueMask,
} from '../../src/core/clues';
import type { Puzzle } from '../../src/core/puzzle';
import {
  flat,
  HTML_HORIZONTAL_CLUES,
  HTML_SOLUTION,
  HTML_TILE_CLUES,
  HTML_VERTICAL_CLUES,
} from './legacy';

export function legacyPuzzleMask(): ClueMask {
  const mask = emptyMask();
  flat(HTML_TILE_CLUES).forEach((v, i) => {
    if (v !== 5) mask[i] = 1;
  });
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      if (HTML_HORIZONTAL_CLUES[r]![c] !== 5) mask[slotOfEdge(horizontalEdge(r, c))] = 1;
    }
  }
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      if (HTML_VERTICAL_CLUES[r]![c] !== 5) mask[slotOfEdge(verticalEdge(r, c))] = 1;
    }
  }
  return mask;
}

export function legacySolution(): Board {
  return createBoard(flat(HTML_SOLUTION));
}

export function legacyPuzzle(): Puzzle {
  return { solution: legacySolution(), mask: legacyPuzzleMask() };
}
