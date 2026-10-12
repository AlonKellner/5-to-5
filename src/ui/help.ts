import { RELATION_SYMBOLS } from '../core/clues';
import { COLOR_COUNT, COLOR_NAMES } from '../core/constants';
import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES } from '../core/puzzle';
import { el } from './dom';
import { BUTTON_ICONS } from './icons';
import { HIDDEN_RULES } from './rulesText';
import { COLOR_SHAPES, colorShape } from './shapes';

const RELATION_MEANINGS = [
  'the same color',
  'the next color in the cycle',
  'two steps forward in the cycle',
  'two steps back in the cycle',
  'the previous color in the cycle',
];

function section(title: string, ...children: (Node | null)[]): HTMLElement {
  return el('section', { className: 'help-section' }, [el('h3', { text: title }), ...children]);
}

function bullets(items: string[]): HTMLElement {
  return el(
    'ul',
    { className: 'help-list' },
    items.map((item) => el('li', { text: item })),
  );
}

function badge(symbol: string, vertical = false): HTMLElement {
  return el('div', { className: `relation-slot${vertical ? ' vertical' : ''}` }, [
    el('div', { className: 'relationship-clue', text: symbol }),
  ]);
}

/** Fills the help dialog. Content is built from the engine's own constants so it cannot drift. */
export function renderHelp(container: HTMLElement): void {
  const legend = el(
    'div',
    { className: 'help-legend' },
    RELATION_SYMBOLS.map((symbol, delta) =>
      el('div', { className: 'help-legend-row' }, [
        badge(symbol),
        el('span', { text: RELATION_MEANINGS[delta]! }),
      ]),
    ),
  );

  const cycle = el('div', { className: 'help-cycle' }, [
    ...Array.from({ length: COLOR_COUNT }, (_, color) =>
      el('span', { className: 'help-cycle-step' }, [
        el('span', { className: `note-dot color-${color}` }, [colorShape(color)]),
        el('span', { text: COLOR_NAMES[color]! }),
      ]),
    ),
  ]);

  const named = COLOR_NAMES.map((name, color) => `${name.toLowerCase()} ${COLOR_SHAPES[color]}`);
  const shapeNames = `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;

  const levels = el(
    'ul',
    { className: 'help-list' },
    DIFFICULTY_LEVELS.map((level) =>
      el('li', { text: `${level} · ${DIFFICULTY_NAMES[level]} — score about ${level * 100}.` }),
    ),
  );

  container.replaceChildren(
    section(
      'The goal',
      bullets([
        'Fill the board so it holds five tiles of each color.',
        `Each color also has its own shape: ${shapeNames}.`,
        'Tiles touch when they share an edge: up, down, left or right — not diagonally.',
        'Every puzzle has exactly one solution, so you never have to guess blindly.',
      ]),
    ),
    section('The hidden rules', bullets(Object.values(HIDDEN_RULES))),
    section(
      'Reading the clues',
      el('p', {
        text: 'Locked tiles are given. A badge between two tiles tells you how their colors differ along the cycle:',
      }),
      cycle,
      legend,
      el('div', { className: 'help-vertical-note' }, [
        badge('›', true),
        el('span', {
          text: 'Badges between tiles in a column are read from top to bottom, so this one means the lower tile is the next color.',
        }),
      ]),
    ),
    section(
      'The buttons',
      el('p', {
        text: 'Hover over a button with a mouse to see its name. On a touch screen, press and hold a button to see its name without pressing it.',
      }),
      el(
        'ul',
        { className: 'help-buttons' },
        Object.values(BUTTON_ICONS).map((entry) =>
          el('li', { className: 'help-button-row' }, [
            el('span', { className: 'help-button-icon' }, [entry.icon()]),
            el('span', {}, [
              el('strong', { text: entry.label }),
              el('span', { text: ` — ${entry.description}` }),
            ]),
          ]),
        ),
      ),
    ),
    section(
      'Difficulty',
      el('p', {
        text: 'The level says how much deduction a puzzle needs; the score is about 100 per level.',
      }),
      levels,
    ),
  );
}
