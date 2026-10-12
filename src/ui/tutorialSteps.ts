import { edgeOfSlot, EDGES, isTileSlot, SLOT_COUNT } from '../core/clues';
import { CELL_COUNT, COLOR_COUNT, TILES_PER_COLOR } from '../core/constants';
import type { Puzzle } from '../core/puzzle';
import { HIDDEN_RULES as RULE } from './rulesText';

/** Things a puzzle must contain for the tutorial to be able to point at them. */
export type TutorialFeature =
  'locked-tile' | 'empty-cell' | 'horizontal-relation' | 'vertical-relation' | 'stocked-bin';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** Element to highlight, as a selector inside the app root. */
  target: string;
  requires?: TutorialFeature[];
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'goal',
    title: 'Welcome to 5-to-5',
    body: 'Fill this board with five tiles of each of the five colors. Every color secretly always touches one color and never touches another, and working out which is the real puzzle.',
    target: '#board-panel',
  },
  {
    id: 'board',
    title: 'The board',
    body: 'Twenty-five cells. Tiles touch when they share an edge — up, down, left or right, never diagonally.',
    target: '#game-board',
  },
  {
    id: 'rule-always',
    title: 'Hidden rule: ALWAYS',
    body: `${RULE.count} ${RULE.always}`,
    target: '#board-panel',
  },
  {
    id: 'rule-never',
    title: 'Hidden rule: NEVER',
    body: `${RULE.never} ${RULE.different}`,
    target: '#board-panel',
  },
  {
    id: 'rule-both-ways',
    title: 'Rules come in pairs',
    body: `${RULE.mutual} ${RULE.own}`,
    target: '#board-panel',
  },
  {
    id: 'rule-only-one',
    title: 'Exactly one of each',
    body: RULE.unique,
    target: '#board-panel',
  },
  {
    id: 'locked-tile',
    title: 'Given tiles',
    body: 'A tile with a padlock is a clue. It is already correct and cannot be moved.',
    target: '#game-board > .clue-piece',
    requires: ['locked-tile'],
  },
  {
    id: 'empty-cell',
    title: 'Empty cells',
    body: 'Drag a color here to place it, drag it away to move it, or tap a placed tile to send it back. Tapping an empty cell lets you pencil in colors you are considering; the last button in that menu switches between the top and bottom half of the cell, so you can keep two sets of ideas apart.',
    target: '#game-board > .drop-zone',
    requires: ['empty-cell'],
  },
  {
    id: 'relation-horizontal',
    title: 'Clues between tiles',
    body: 'This badge compares two neighbors along the color cycle: = is the same color, › the next one, » two steps on, ‹ the previous one and « two steps back.',
    target: '#relationship-clues-container .relation-slot:not(.vertical)',
    requires: ['horizontal-relation'],
  },
  {
    id: 'relation-vertical',
    title: 'Clues down a column',
    body: 'A badge between tiles in a column is read from top to bottom, which is why it is turned on its side.',
    target: '#relationship-clues-container .relation-slot.vertical',
    requires: ['vertical-relation'],
  },
  {
    id: 'bins',
    title: 'The color bins',
    body: 'Your remaining tiles, one bin per color. The number shows how many of that color are still unplaced.',
    target: '#tray-panel',
    requires: ['stocked-bin'],
  },
  {
    id: 'cycle-arrows',
    title: 'The color cycle',
    body: 'The arrows show the order the clue symbols count in: red, blue, green, yellow, purple and back to red.',
    target: '#spawner-clues-container',
  },
  {
    id: 'notes',
    title: 'Rule notes',
    body: 'Two note slots per color, for the two rules you are hunting: which color it always touches, and which it never touches.',
    target: '#notes-panel',
  },
  {
    id: 'top-controls',
    title: 'Puzzle controls',
    body: 'Pick a difficulty and start a new puzzle, reset the board back to its clues, reveal one correct tile, or give up and show the solution. Not sure what an icon means? Hover over it, or press and hold it on a touch screen.',
    target: '#top-controls',
  },
  {
    id: 'bottom-controls',
    title: 'While you solve',
    body: 'Undo your last move, check whether anything placed so far is wrong, and save a checkpoint you can come back to before trying an idea.',
    target: '#bottom-controls',
  },
  {
    id: 'share-help',
    title: 'Share and help',
    body: 'Copy a link to this exact puzzle to challenge someone, and open the help button any time for the full rules — or to see this tour again.',
    target: '.footer',
  },
];

export const REQUIRED_FEATURES: readonly TutorialFeature[] = [
  ...new Set(TUTORIAL_STEPS.flatMap((step) => step.requires ?? [])),
];

/** Which of the tutorial's features a puzzle shows, from its clue mask alone. */
export function puzzleFeatures(puzzle: Puzzle): Set<TutorialFeature> {
  const features = new Set<TutorialFeature>();
  const lockedPerColor = new Uint8Array(COLOR_COUNT);
  let lockedTiles = 0;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (!puzzle.mask[slot]) continue;
    if (isTileSlot(slot)) {
      features.add('locked-tile');
      lockedTiles++;
    } else {
      const orientation = EDGES[edgeOfSlot(slot)]!.orientation;
      features.add(orientation === 'h' ? 'horizontal-relation' : 'vertical-relation');
    }
  }
  if (lockedTiles < CELL_COUNT) features.add('empty-cell');
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (puzzle.mask[cell]) lockedPerColor[puzzle.solution[cell]!]!++;
  }
  if (lockedPerColor.some((locked) => locked < TILES_PER_COLOR)) features.add('stocked-bin');
  return features;
}

export function missingFeatures(puzzle: Puzzle): TutorialFeature[] {
  const features = puzzleFeatures(puzzle);
  return REQUIRED_FEATURES.filter((feature) => !features.has(feature));
}

export function puzzleSupportsTutorial(puzzle: Puzzle): boolean {
  return missingFeatures(puzzle).length === 0;
}

export const TUTORIAL_SEEN_KEY = '5-to-5:tutorial-seen';

type SeenStorage = Pick<Storage, 'getItem' | 'setItem'> | null | undefined;

/**
 * Whether the tour has run on this device. Without storage it counts as seen, so a browser that
 * blocks storage does not show the tutorial on every single load.
 */
export function hasSeenTutorial(storage: SeenStorage): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(TUTORIAL_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

export function markTutorialSeen(storage: SeenStorage): void {
  try {
    storage?.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch {
    // Storage can be unavailable; the tutorial simply runs again next time.
  }
}
