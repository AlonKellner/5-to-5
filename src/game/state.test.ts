import { describe, expect, it } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { Rng } from '../core/rng';
import {
  canHint,
  createGame,
  moveTile,
  placeFromTray,
  restoreCheckpoint,
  returnToTray,
  revealHint,
  revealSolution,
  saveCheckpoint,
  toggleGridNote,
  toggleSpawnerNote,
  trayCount,
  type GameState,
} from './state';

const puzzle = legacyPuzzle();
const solution = puzzle.solution;
// Legacy clue tiles: cell 1 = p, cell 5 = y, cell 9 = g, cell 18 = g.
const CLUE_CELLS = [1, 5, 9, 18];

function fillCorrectly(state: GameState, except: number[] = []): GameState {
  let s = state;
  for (let cell = 0; cell < 25; cell++) {
    if (s.locked[cell] || except.includes(cell)) continue;
    s = placeFromTray(s, solution[cell]!, cell);
  }
  return s;
}

describe('createGame', () => {
  const game = createGame(puzzle);

  it('places and locks the clue tiles', () => {
    for (let cell = 0; cell < 25; cell++) {
      const isClue = CLUE_CELLS.includes(cell);
      expect(game.locked[cell]).toBe(isClue ? 1 : 0);
      expect(game.cells[cell]).toBe(isClue ? solution[cell] : -1);
    }
    expect(game.status).toBe('playing');
  });

  it('puts the remaining tiles in the tray', () => {
    expect([0, 1, 2, 3, 4].map((c) => trayCount(game, c))).toEqual([5, 5, 3, 4, 4]);
  });
});

describe('placing and moving tiles', () => {
  const game = createGame(puzzle);

  it('places a tile from the tray without mutating the previous state', () => {
    const next = placeFromTray(game, 0, 0);
    expect(next.cells[0]).toBe(0);
    expect(trayCount(next, 0)).toBe(4);
    expect(game.cells[0]).toBe(-1);
  });

  it('returns the displaced tile to the tray when placing onto an occupied cell', () => {
    const next = placeFromTray(placeFromTray(game, 0, 0), 1, 0);
    expect(next.cells[0]).toBe(1);
    expect(trayCount(next, 0)).toBe(5);
    expect(trayCount(next, 1)).toBe(4);
  });

  it('ignores placements on locked cells or with an empty tray', () => {
    expect(placeFromTray(game, 0, 1)).toBe(game);
    let s = game;
    for (const cell of [0, 2, 3, 4]) s = placeFromTray(s, 2, cell);
    expect(trayCount(s, 2)).toBe(0);
    expect(placeFromTray(s, 2, 6)).toBe(s);
  });

  it('moves a tile to an empty cell', () => {
    const next = moveTile(placeFromTray(game, 0, 0), 0, 2);
    expect(next.cells[0]).toBe(-1);
    expect(next.cells[2]).toBe(0);
  });

  it('swaps two tiles', () => {
    const s = placeFromTray(placeFromTray(game, 0, 0), 1, 2);
    const next = moveTile(s, 0, 2);
    expect(next.cells[0]).toBe(1);
    expect(next.cells[2]).toBe(0);
  });

  it('never moves locked tiles or onto locked cells', () => {
    const s = placeFromTray(game, 0, 0);
    expect(moveTile(s, 1, 0)).toBe(s);
    expect(moveTile(s, 0, 1)).toBe(s);
    expect(moveTile(s, 3, 4)).toBe(s);
  });

  it('returns a tile to the tray', () => {
    const s = placeFromTray(game, 0, 0);
    expect(returnToTray(s, 0).cells[0]).toBe(-1);
    expect(returnToTray(s, 1)).toBe(s);
  });
});

describe('notes', () => {
  const game = createGame(puzzle);

  it('toggles grid notes', () => {
    const s = toggleGridNote(toggleGridNote(game, 0, 2), 0, 4);
    expect(s.gridNotes[0]).toBe(0b10100);
    expect(toggleGridNote(s, 0, 2).gridNotes[0]).toBe(0b10000);
  });

  it('toggles spawner notes in two slots per color', () => {
    const s = toggleSpawnerNote(toggleSpawnerNote(game, 3, 1, 0), 3, 0, 4);
    expect(s.spawnerNotes[3 * 2 + 1]).toBe(0b00001);
    expect(s.spawnerNotes[3 * 2 + 0]).toBe(0b10000);
    expect(game.spawnerNotes.every((n) => n === 0)).toBe(true);
  });
});

describe('checkpoints', () => {
  it('restores tiles and notes', () => {
    let s = placeFromTray(createGame(puzzle), 0, 0);
    s = toggleGridNote(s, 3, 1);
    s = saveCheckpoint(s);
    expect(s.checkpoint).not.toBeNull();
    s = placeFromTray(returnToTray(s, 0), 4, 2);
    s = toggleGridNote(s, 3, 1);
    s = restoreCheckpoint(s);
    expect(s.cells[0]).toBe(0);
    expect(s.cells[2]).toBe(-1);
    expect(s.gridNotes[3]).toBe(0b00010);
  });

  it('keeps hints revealed after the checkpoint and never exceeds five tiles per color', () => {
    let s = createGame(puzzle);
    // Place all five blues where they do not belong, then checkpoint.
    const wrongForBlue = [...Array(25).keys()].filter((c) => !s.locked[c] && solution[c] !== 1);
    for (const cell of wrongForBlue.slice(0, 5)) s = placeFromTray(s, 1, cell);
    s = saveCheckpoint(s);
    const blueCell = [...Array(25).keys()].find((c) => solution[c] === 1)!;
    s = revealHint(s, new Rng('x'), blueCell);
    expect(s.locked[blueCell]).toBe(1);
    s = restoreCheckpoint(s);
    expect(s.cells[blueCell]).toBe(1);
    expect(s.locked[blueCell]).toBe(1);
    expect(trayCount(s, 1)).toBe(0);
    expect(s.cells.filter((c) => c === 1)).toHaveLength(5);
  });

  it('does nothing without a checkpoint', () => {
    const s = createGame(puzzle);
    expect(restoreCheckpoint(s)).toBe(s);
  });
});

describe('hints', () => {
  it('reveals and locks a random wrong or empty cell', () => {
    const s = revealHint(createGame(puzzle), new Rng('hint'));
    const revealed = [...Array(25).keys()].filter((c) => s.locked[c] && !CLUE_CELLS.includes(c));
    expect(revealed).toHaveLength(1);
    expect(s.cells[revealed[0]!]).toBe(solution[revealed[0]!]);
  });

  it('takes the tile from a wrong cell when the tray is empty', () => {
    let s = createGame(puzzle);
    const wrongForRed = [...Array(25).keys()].filter((c) => !s.locked[c] && solution[c] !== 0);
    for (const cell of wrongForRed.slice(0, 5)) s = placeFromTray(s, 0, cell);
    expect(trayCount(s, 0)).toBe(0);
    const redCell = [...Array(25).keys()].find((c) => solution[c] === 0)!;
    s = revealHint(s, new Rng('h'), redCell);
    expect(s.cells[redCell]).toBe(0);
    expect(s.cells.filter((c) => c === 0)).toHaveLength(5);
  });

  it('is unavailable when every unlocked cell is correct', () => {
    const s = fillCorrectly(createGame(puzzle), [0]);
    expect(canHint(s)).toBe(true);
    const done = revealHint(s, new Rng('last'));
    expect(done.status).toBe('won');
    expect(canHint(done)).toBe(false);
  });
});

describe('winning and revealing', () => {
  it('detects a win once every cell is correct', () => {
    const almost = fillCorrectly(createGame(puzzle), [0]);
    expect(almost.status).toBe('playing');
    const won = placeFromTray(almost, solution[0]!, 0);
    expect(won.status).toBe('won');
  });

  it('does not count a full but wrong board as a win', () => {
    let s = fillCorrectly(createGame(puzzle), [0, 2]);
    s = placeFromTray(s, solution[2]!, 0);
    s = placeFromTray(s, solution[0]!, 2);
    if (solution[0] !== solution[2]) expect(s.status).toBe('playing');
  });

  it('ignores moves after the game is over', () => {
    const won = fillCorrectly(createGame(puzzle));
    expect(won.status).toBe('won');
    expect(returnToTray(won, 0)).toBe(won);
  });

  it('reveals the whole solution', () => {
    const s = revealSolution(createGame(puzzle));
    expect([...s.cells]).toEqual([...solution]);
    expect(s.locked.every((l) => l === 1)).toBe(true);
    expect(s.status).toBe('revealed');
  });
});
