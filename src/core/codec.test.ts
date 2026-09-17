import { describe, expect, it } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { formatBoard } from './board';
import { fullMask } from './clues';
import { decodePuzzle, encodePuzzle } from './codec';

describe('puzzle codec', () => {
  it('round-trips the legacy puzzle', () => {
    const puzzle = legacyPuzzle();
    const code = encodePuzzle(puzzle);
    const decoded = decodePuzzle(code);
    expect(formatBoard(decoded.solution)).toBe(formatBoard(puzzle.solution));
    expect([...decoded.mask]).toEqual([...puzzle.mask]);
  });

  it('produces a short URL-safe string', () => {
    const code = encodePuzzle({ ...legacyPuzzle(), mask: fullMask() });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThanOrEqual(24);
  });

  it('rejects malformed codes', () => {
    expect(() => decodePuzzle('')).toThrow();
    expect(() => decodePuzzle('not a code!')).toThrow();
    const code = encodePuzzle(legacyPuzzle());
    expect(() => decodePuzzle(code.slice(0, -2))).toThrow();
    expect(() => decodePuzzle('9' + code.slice(1))).toThrow();
  });

  it('rejects codes whose board does not have five tiles of each color', () => {
    const puzzle = legacyPuzzle();
    const solution = puzzle.solution.slice();
    solution[0] = solution[0] === 0 ? 1 : 0;
    expect(() => decodePuzzle(encodePuzzle({ ...puzzle, solution }))).toThrow();
  });
});
