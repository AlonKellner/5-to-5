import { describe, expect, it } from 'vitest';
import { legacySolution } from '../../../test/fixtures/legacyPuzzle';
import { clueSetFromMask, emptyClueSet, horizontalEdge } from '../clues';
import { digClues } from '../generator/dig';
import { Rng } from '../rng';
import { solveByPropagation } from './search';
import { createState, MUST, NEVER } from './state';
import { LEVEL, propagate, propagateRound } from './propagate';

const R = 0b00001;
const B = 0b00010;
const G = 0b00100;
const Y = 0b01000;
const P = 0b10000;
const ALL = 0b11111;

function statesWithTiles(tiles: Record<number, number>) {
  const clues = emptyClueSet();
  for (const [cell, color] of Object.entries(tiles)) clues.tiles[Number(cell)] = color;
  return { clues, state: createState(clues) };
}

describe('level 0: counts and relations', () => {
  it('removes a color everywhere else once five copies are placed', () => {
    const { clues, state } = statesWithTiles({ 0: 0, 6: 0, 12: 0, 18: 0, 24: 0 });
    expect(propagate(state, clues, LEVEL.COUNTS)).toBe(true);
    for (let i = 0; i < 25; i++) {
      if ([0, 6, 12, 18, 24].includes(i)) expect(state[i]).toBe(R);
      else expect(state[i]! & R).toBe(0);
    }
  });

  it('forces a color into its only five candidate cells (hidden singles)', () => {
    const clues = emptyClueSet();
    const state = createState(clues);
    for (let i = 5; i < 25; i++) state[i] = ALL & ~R;
    expect(propagate(state, clues, LEVEL.COUNTS)).toBe(true);
    for (let i = 0; i < 5; i++) expect(state[i]).toBe(R);
  });

  it('fails when a color has fewer than five candidate cells', () => {
    const clues = emptyClueSet();
    const state = createState(clues);
    for (let i = 4; i < 25; i++) state[i] = ALL & ~R;
    expect(propagate(state, clues, LEVEL.COUNTS)).toBe(false);
  });

  it('fails when a color is placed more than five times', () => {
    const { clues, state } = statesWithTiles({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(propagate(state, clues, LEVEL.COUNTS)).toBe(false);
  });

  it('narrows both ends of a relation clue', () => {
    const clues = emptyClueSet();
    clues.relations[horizontalEdge(0, 0)] = 1;
    const state = createState(clues);
    state[0] = R | B;
    expect(propagate(state, clues, LEVEL.COUNTS)).toBe(true);
    expect(state[1]).toBe(B | G);

    const clues2 = emptyClueSet();
    clues2.relations[horizontalEdge(0, 0)] = 2;
    const state2 = createState(clues2);
    state2[1] = P;
    expect(propagate(state2, clues2, LEVEL.COUNTS)).toBe(true);
    expect(state2[0]).toBe(G);
  });

  it('does not touch rule domains', () => {
    const { clues, state } = statesWithTiles({ 0: 0, 1: 1 });
    expect(propagate(state, clues, LEVEL.COUNTS)).toBe(true);
    for (let i = 0; i < 5; i++) {
      expect(state[MUST + i]).toBe(ALL);
      expect(state[NEVER + i]).toBe(ALL);
    }
  });
});

describe('level 1: never rules', () => {
  it('rules out adjacent colors as never-neighbors, symmetrically', () => {
    const { clues, state } = statesWithTiles({ 0: 0, 1: 1 });
    expect(propagate(state, clues, LEVEL.NEVER)).toBe(true);
    expect(state[NEVER + 0]! & B).toBe(0);
    expect(state[NEVER + 1]! & R).toBe(0);
  });

  it('keeps pinned never rules symmetric (involution)', () => {
    const { clues, state } = statesWithTiles({});
    state[NEVER + 0] = G;
    expect(propagate(state, clues, LEVEL.NEVER)).toBe(true);
    expect(state[NEVER + 2]).toBe(R);
    for (const i of [1, 3, 4]) {
      expect(state[NEVER + i]! & (R | G)).toBe(0);
    }
  });

  it('removes a pinned never color from the neighbors of a placed tile', () => {
    const { clues, state } = statesWithTiles({ 6: 0 });
    state[NEVER + 0] = B;
    expect(propagate(state, clues, LEVEL.NEVER)).toBe(true);
    for (const n of [1, 5, 7, 11]) expect(state[n]! & B).toBe(0);
  });

  it('fails when a placed tile touches all five colors', () => {
    // Tile 6 (r) touches r, b, g and y; tile 1 (r) also touches p.
    const { clues, state } = statesWithTiles({ 6: 0, 1: 0, 5: 1, 7: 2, 11: 3, 2: 4 });
    expect(propagate(state.slice(), clues, LEVEL.COUNTS)).toBe(true);
    expect(propagate(state, clues, LEVEL.NEVER)).toBe(false);
  });
});

describe('level 2: must rules', () => {
  it('limits must to colors next to a placed tile', () => {
    const { clues, state } = statesWithTiles({ 0: 0, 1: 2, 5: 2 });
    expect(propagate(state, clues, LEVEL.MUST)).toBe(true);
    expect(state[MUST + 0]).toBe(G);
    expect(state[MUST + 2]).toBe(R);
  });

  it('forces the only neighbor that can supply a pinned must color', () => {
    const { clues, state } = statesWithTiles({ 0: 0 });
    state[MUST + 0] = G;
    state[5] = ALL & ~G;
    expect(propagate(state, clues, LEVEL.MUST)).toBe(true);
    expect(state[1]).toBe(G);
  });

  it('removes a color from cells where no neighbor can supply its must color', () => {
    const { clues, state } = statesWithTiles({});
    state[MUST + 0] = Y;
    state[1] = ALL & ~Y;
    state[5] = ALL & ~Y;
    expect(propagate(state, clues, LEVEL.MUST)).toBe(true);
    expect(state[0]! & R).toBe(0);
  });
});

describe('level 3: exactness', () => {
  it('fails when a color cannot touch two different colors', () => {
    const rCells = [0, 4, 12, 20, 24];
    const tiles: Record<number, number> = {};
    for (const c of rCells) tiles[c] = 0;
    const { clues, state } = statesWithTiles(tiles);
    for (const n of [1, 5, 3, 9, 7, 11, 13, 17, 15, 21, 19, 23]) state[n] = ALL & ~(G | Y);
    expect(propagate(state.slice(), clues, LEVEL.MUST)).toBe(true);
    expect(propagate(state, clues, LEVEL.EXACT)).toBe(false);
  });

  it('pins never when a color cannot touch exactly one color', () => {
    const { clues, state } = statesWithTiles({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    for (const n of [5, 6, 7, 8, 9]) state[n] = ALL & ~Y;
    expect(propagate(state, clues, LEVEL.EXACT)).toBe(true);
    expect(state[NEVER + 0]).toBe(Y);
    expect(state[NEVER + 3]).toBe(R);
  });

  it('fails when all copies of a color share two definite neighbor colors', () => {
    const { clues, state } = statesWithTiles({
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 1,
      6: 1,
      7: 1,
      8: 1,
      9: 1,
    });
    expect(propagate(state.slice(), clues, LEVEL.MUST)).toBe(true);
    expect(propagate(state, clues, LEVEL.EXACT)).toBe(false);
  });
});

describe('level 4: probing', () => {
  const solution = legacySolution();

  it('never eliminates the intended solution of a unique puzzle', () => {
    const rng = new Rng('probe-sound');
    for (let k = 0; k < 6; k++) {
      const { mask } = digClues(solution, rng, { criterion: { kind: 'unique' } });
      const clues = clueSetFromMask(solution, mask);
      const state = createState(clues);
      expect(propagate(state, clues, LEVEL.PROBE)).toBe(true);
      for (let i = 0; i < 25; i++) expect(state[i]! & (1 << solution[i]!)).not.toBe(0);
    }
  });

  it('solves puzzles that level 3 alone cannot', () => {
    let needsProbing = 0;
    for (let k = 0; k < 8; k++) {
      const { mask } = digClues(solution, new Rng(`probe-${k}`), {
        criterion: { kind: 'propagation', level: LEVEL.PROBE },
      });
      const clues = clueSetFromMask(solution, mask);
      expect(solveByPropagation(clues, LEVEL.PROBE).solved).toBe(true);
      if (!solveByPropagation(clues, LEVEL.EXACT).solved) needsProbing++;
    }
    expect(needsProbing).toBeGreaterThan(0);
  });
});

describe('propagateRound', () => {
  it('does one round at a time and repeated rounds reach the fixpoint', () => {
    const solution = legacySolution();
    const { mask } = digClues(solution, new Rng('rounds'), {
      criterion: { kind: 'propagation', level: LEVEL.EXACT },
    });
    const clues = clueSetFromMask(solution, mask);
    const fixpoint = createState(clues);
    expect(propagate(fixpoint, clues, LEVEL.EXACT)).toBe(true);

    const stepped = createState(clues);
    let rounds = 0;
    for (;;) {
      const before = stepped.slice();
      expect(propagateRound(stepped, clues, LEVEL.EXACT)).toBe(true);
      for (let i = 0; i < stepped.length; i++) {
        expect(stepped[i]! & fixpoint[i]!).toBe(fixpoint[i]);
      }
      if (stepped.every((v, i) => v === before[i])) break;
      rounds++;
    }
    expect(rounds).toBeGreaterThan(1);
    expect([...stepped]).toEqual([...fixpoint]);
  });
});
