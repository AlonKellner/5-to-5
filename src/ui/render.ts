import { EDGES, RELATION_SYMBOLS, slotOfEdge, clueAt, EDGE_COUNT } from '../core/clues';
import { CELL_COUNT, COLOR_COUNT, colOf, rowOf } from '../core/constants';
import { noteHalves, SPAWNER_NOTE_SLOTS, trayCount, type GameState } from '../game/state';
import { el, lockIcon } from './dom';
import { colorShape } from './shapes';

function halfDots(colors: number, half: 'top' | 'bottom'): HTMLElement | null {
  if (!colors) return null;
  const dots: HTMLElement[] = [];
  for (let color = 0; color < COLOR_COUNT; color++) {
    if (colors & (1 << color)) {
      dots.push(el('div', { className: `note-dot color-${color}` }, [colorShape(color)]));
    }
  }
  return el('div', { className: `note-half note-half-${half}` }, dots);
}

/** Top-half notes fill the top of the square and bottom-half notes the bottom, split by a line
 *  as soon as either half is in use, so a lone half still reads as top or bottom. */
function noteDots(mask: number): HTMLElement | null {
  const { top, bottom } = noteHalves(mask);
  if (!top && !bottom) return null;
  return el('div', { className: 'note-container' }, [
    halfDots(top, 'top'),
    el('div', { className: 'note-divider' }),
    halfDots(bottom, 'bottom'),
  ]);
}

function relationBadge(symbol: string, placement: Record<string, string>, className = '') {
  return el('div', { className: `relation-slot ${className}`.trim(), style: placement }, [
    el('div', { className: 'relationship-clue', text: symbol }),
  ]);
}

/**
 * Cycle arrows around the color bins. Their place in the grid comes from CSS classes, not inline
 * styles, so the same DOM works for the horizontal row (portrait) and the vertical strip
 * (landscape) without re-rendering.
 */
function spawnerArrow(index: number, edge: '' | 'edge-start' | 'edge-end') {
  return el('div', { className: `relation-slot spawner-arrow arrow-${index} ${edge}`.trim() }, [
    el('div', { className: 'relationship-clue', text: '›' }),
  ]);
}

export function renderBoard(
  board: HTMLElement,
  overlay: HTMLElement,
  state: GameState,
  mistakes: ReadonlySet<number> = new Set(),
): void {
  const cells: HTMLElement[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const color = state.cells[cell]!;
    const saved = state.checkpoint && !state.locked[cell] ? state.checkpoint.cells[cell]! : -1;
    let node: HTMLElement;
    if (color >= 0) {
      node = el('div', { className: `piece color-${color}`, dataset: { cell, drop: 'cell' } }, [
        colorShape(color),
      ]);
      if (state.locked[cell]) {
        node.classList.add('clue-piece');
        node.appendChild(lockIcon());
      } else {
        node.classList.add('draggable-piece');
        node.dataset['drag'] = 'cell';
      }
    } else {
      node = el('div', {
        className: 'grid-cell drop-zone',
        dataset: { cell, drop: 'cell', note: 'cell' },
      });
      const dots = noteDots(state.gridNotes[cell]!);
      if (dots) node.appendChild(dots);
    }
    if (mistakes.has(cell)) node.classList.add('mistake');
    if (saved >= 0) {
      node.classList.add('checkpointed');
      node.style.boxShadow = `inset 0 0 0 3px var(--shadow-${saved})`;
    }
    cells.push(node);
  }
  board.replaceChildren(...cells);

  const badges: HTMLElement[] = [];
  for (let edge = 0; edge < EDGE_COUNT; edge++) {
    if (!state.mask[slotOfEdge(edge)]) continue;
    const clue = clueAt(state.solution, slotOfEdge(edge));
    if (clue.kind !== 'relation') continue;
    const { a, orientation } = EDGES[edge]!;
    const row = rowOf(a) + 1;
    const col = colOf(a) + 1;
    const badge =
      orientation === 'h'
        ? relationBadge(RELATION_SYMBOLS[clue.delta]!, {
            'grid-row': `${row}`,
            'grid-column': `${col} / span 2`,
          })
        : relationBadge(
            RELATION_SYMBOLS[clue.delta]!,
            { 'grid-row': `${row} / span 2`, 'grid-column': `${col}` },
            'vertical',
          );
    badge.dataset['edge'] = String(edge);
    badges.push(badge);
  }
  overlay.replaceChildren(...badges);
}

export function renderSpawners(grid: HTMLElement, overlay: HTMLElement, state: GameState): void {
  const spawners: HTMLElement[] = [];
  for (let color = 0; color < COLOR_COUNT; color++) {
    const count = trayCount(state, color);
    const piece =
      count > 0
        ? el(
            'div',
            { className: `piece color-${color} draggable-piece`, dataset: { drag: 'tray', color } },
            [colorShape(color)],
          )
        : el('div', { className: 'spawner-empty', style: { color: `var(--color-${color})` } }, [
            colorShape(color),
          ]);
    spawners.push(
      el('div', { className: 'spawner', dataset: { drop: 'tray', color } }, [
        piece,
        el('div', { className: 'spawner-count', text: String(count) }),
      ]),
    );
  }
  grid.replaceChildren(...spawners);

  const arrows = [spawnerArrow(0, 'edge-start')];
  for (let index = 1; index < COLOR_COUNT; index++) arrows.push(spawnerArrow(index, ''));
  arrows.push(spawnerArrow(COLOR_COUNT, 'edge-end'));
  overlay.replaceChildren(...arrows);
}

export function renderSpawnerNotes(grid: HTMLElement, state: GameState): void {
  const cells: HTMLElement[] = [];
  for (let slot = 0; slot < SPAWNER_NOTE_SLOTS; slot++) {
    for (let color = 0; color < COLOR_COUNT; color++) {
      const mask = state.spawnerNotes[color * SPAWNER_NOTE_SLOTS + slot]!;
      const node = el('div', {
        className: 'grid-cell note-cell',
        dataset: { note: 'spawner', color, slot },
      });
      node.appendChild(
        noteDots(mask) ?? el('span', { className: 'note-placeholder', text: 'Notes…' }),
      );
      cells.push(node);
    }
  }
  grid.replaceChildren(...cells);
}
