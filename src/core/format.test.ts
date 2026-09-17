import { describe, expect, it } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { fullMask } from './clues';
import { formatPuzzleAscii, formatRuleset } from './format';

describe('formatPuzzleAscii', () => {
  it('shows every clue of a fully revealed puzzle', () => {
    const lines = formatPuzzleAscii({ ...legacyPuzzle(), mask: fullMask() }).split('\n');
    expect(lines).toHaveLength(9);
    expect(lines[0]).toBe('b « p › r = r ‹ p');
    // Vertical deltas under row 0: b→y (+2), p→g (+3), r→p (+4), r→r (0), p→g (+3).
    expect(lines[1]).toBe('»   «   ‹   =   «');
    expect(lines.join('')).not.toContain('.');
  });

  it('draws hidden cells as dots and hidden relations as blanks', () => {
    const lines = formatPuzzleAscii(legacyPuzzle()).split('\n');
    expect(lines[0]).toBe('.   p   .   . ‹ .');
    expect(lines[1]).toBe('»                ');
  });

  it('can show the solution with clue tiles marked', () => {
    const text = formatPuzzleAscii(legacyPuzzle(), { showSolution: true });
    expect(text.split('\n')[0]).toBe('b   P   r   r ‹ p');
  });
});

describe('formatRuleset', () => {
  it('lists must and never neighbors per color', () => {
    expect(formatRuleset({ must: [0, 3, 4, 1, 2], never: [3, 1, 2, 0, 4] })).toBe(
      'r: must r, never y | b: must y, never b | g: must p, never g | y: must b, never r | p: must g, never p',
    );
  });
});
