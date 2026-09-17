import { describe, expect, it } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { canUndo, commit, MAX_HISTORY, startHistory, undo } from './history';
import { createGame, placeFromTray } from './state';

const game = createGame(legacyPuzzle());

describe('history', () => {
  it('starts with nothing to undo', () => {
    const h = startHistory(game);
    expect(h.present).toBe(game);
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
  });

  it('undoes changes in reverse order', () => {
    const first = placeFromTray(game, 0, 0);
    const second = placeFromTray(first, 1, 2);
    let h = commit(commit(startHistory(game), first), second);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(first);
    h = undo(h);
    expect(h.present).toBe(game);
    expect(canUndo(h)).toBe(false);
  });

  it('ignores commits that change nothing', () => {
    const h = startHistory(game);
    expect(commit(h, game)).toBe(h);
  });

  it('keeps a bounded number of steps', () => {
    let h = startHistory(game);
    let state = game;
    for (let i = 0; i < MAX_HISTORY + 20; i++) {
      state = { ...state };
      h = commit(h, state);
    }
    expect(h.past).toHaveLength(MAX_HISTORY);
  });
});
