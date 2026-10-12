/**
 * The hidden rules in the exact words both the help dialog and the tutorial use, so the two can
 * never explain the puzzle differently.
 */
export const HIDDEN_RULES = {
  count:
    'Every color has exactly one ALWAYS color and exactly one NEVER color. Finding those ten facts is the puzzle.',
  always:
    'ALWAYS means every tile of that color touches at least one tile of its ALWAYS color — no exceptions.',
  never: 'NEVER means no tile of that color touches the NEVER color anywhere on the board.',
  mutual:
    'The pairing goes both ways: if red always touches blue, blue always touches red. The same holds for NEVER.',
  own: 'A color can be its own ALWAYS color (its tiles always touch each other) or its own NEVER color (its tiles never touch each other).',
  different: 'A color’s ALWAYS color is always different from its NEVER color.',
  unique:
    'Only one color touches all five tiles of a color, and only one color touches none of them. If two colors touched every tile of red, the board would be wrong.',
} as const;
