import { describe, expect, it } from 'vitest';
import { isValidBoard } from '../../src/core/validator';
import { sampledBoards } from './boards';

describe('fixture boards', () => {
  it('are all valid', () => {
    for (const board of sampledBoards()) expect(isValidBoard(board)).toBe(true);
  });
});
