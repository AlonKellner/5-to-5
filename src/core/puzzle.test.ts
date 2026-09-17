import { describe, expect, it } from 'vitest';
import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES, parseDifficulty } from './puzzle';

describe('difficulty levels', () => {
  it('has seven named levels', () => {
    expect(DIFFICULTY_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(Object.values(DIFFICULTY_NAMES)).size).toBe(7);
  });

  it('parses numbers and names', () => {
    expect(parseDifficulty('4')).toBe(4);
    expect(parseDifficulty('Master')).toBe(7);
    expect(parseDifficulty(' hard ')).toBe(5);
    expect(parseDifficulty('8')).toBeNull();
    expect(parseDifficulty('impossible')).toBeNull();
    expect(parseDifficulty(null)).toBeNull();
  });
});
