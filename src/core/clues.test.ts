import { describe, expect, it } from 'vitest';
import {
  flat,
  HTML_HORIZONTAL_CLUES,
  HTML_SOLUTION,
  HTML_TILE_CLUES,
  HTML_VERTICAL_CLUES,
} from '../../test/fixtures/legacy';
import { legacyPuzzleMask } from '../../test/fixtures/legacyPuzzle';
import { createBoard } from './board';
import {
  allClues,
  clueSetFromMask,
  cluesFromMask,
  countClueKinds,
  EDGE_COUNT,
  EDGES,
  emptyMask,
  fullMask,
  horizontalEdge,
  RELATION_SYMBOLS,
  relationDelta,
  SLOT_COUNT,
  slotOfEdge,
  verticalEdge,
} from './clues';

const board = createBoard(flat(HTML_SOLUTION));

describe('clue slots and edges', () => {
  it('has 25 tile slots + 40 edges = 65 slots', () => {
    expect(EDGE_COUNT).toBe(40);
    expect(SLOT_COUNT).toBe(65);
  });

  it('indexes horizontal and vertical edges bijectively', () => {
    const seen = new Set<number>();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 4; c++) {
        const e = horizontalEdge(r, c);
        expect(EDGES[e]).toEqual({ a: r * 5 + c, b: r * 5 + c + 1, orientation: 'h' });
        seen.add(e);
      }
    }
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const e = verticalEdge(r, c);
        expect(EDGES[e]).toEqual({ a: r * 5 + c, b: (r + 1) * 5 + c, orientation: 'v' });
        seen.add(e);
      }
    }
    expect(seen.size).toBe(40);
    expect(slotOfEdge(0)).toBe(25);
  });
});

describe('relations', () => {
  it('computes cyclic deltas', () => {
    expect(relationDelta(0, 0)).toBe(0);
    expect(relationDelta(0, 1)).toBe(1);
    expect(relationDelta(4, 0)).toBe(1);
    expect(relationDelta(1, 0)).toBe(4);
    expect(relationDelta(0, 3)).toBe(3);
  });

  it('maps deltas to the legacy symbols', () => {
    expect(RELATION_SYMBOLS).toEqual(['=', '›', '»', '«', '‹']);
  });
});

describe('allClues', () => {
  const clues = allClues(board);

  it('produces 25 tile clues and 40 relation clues', () => {
    expect(clues).toHaveLength(65);
    expect(clues.filter((c) => c.kind === 'tile')).toHaveLength(25);
    expect(clues.filter((c) => c.kind === 'relation')).toHaveLength(40);
    clues.forEach((c, slot) => expect(c.slot).toBe(slot));
  });

  it('reproduces every relation in the legacy HTML clue layouts', () => {
    const legacyToDelta = (v: number) => ((v % 5) + 5) % 5;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 4; c++) {
        const legacy = HTML_HORIZONTAL_CLUES[r]![c]!;
        if (legacy === 5) continue;
        const clue = clues[slotOfEdge(horizontalEdge(r, c))]!;
        expect(clue.kind === 'relation' && clue.delta).toBe(legacyToDelta(legacy));
      }
    }
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const legacy = HTML_VERTICAL_CLUES[r]![c]!;
        if (legacy === 5) continue;
        const clue = clues[slotOfEdge(verticalEdge(r, c))]!;
        expect(clue.kind === 'relation' && clue.delta).toBe(legacyToDelta(legacy));
      }
    }
  });

  it('reproduces the legacy tile clues', () => {
    for (let i = 0; i < 25; i++) {
      const legacy = flat(HTML_TILE_CLUES)[i]!;
      if (legacy === 5) continue;
      expect(clues[i]).toMatchObject({ kind: 'tile', cell: i, color: legacy });
    }
  });
});

describe('masks', () => {
  it('builds empty and full masks', () => {
    expect([...emptyMask()].every((v) => v === 0)).toBe(true);
    expect([...fullMask()].every((v) => v === 1)).toBe(true);
    expect(emptyMask()).toHaveLength(65);
  });

  it('filters clues by mask and counts kinds', () => {
    const mask = legacyPuzzleMask();
    const clues = cluesFromMask(board, mask);
    expect(countClueKinds(mask)).toEqual({ tiles: 4, relations: 12, total: 16 });
    expect(clues).toHaveLength(16);
  });

  it('builds a solver clue set', () => {
    const set = clueSetFromMask(board, legacyPuzzleMask());
    expect(set.tiles[1]).toBe(4);
    expect(set.tiles[0]).toBe(-1);
    expect(set.relations[horizontalEdge(0, 3)]).toBe(4);
    expect(set.relations[horizontalEdge(0, 0)]).toBe(-1);
    expect([...set.tiles].filter((t) => t >= 0)).toHaveLength(4);
    expect([...set.relations].filter((t) => t >= 0)).toHaveLength(12);
  });
});
