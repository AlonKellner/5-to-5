import { moveTile, placeFromTray, returnToTray, type GameState } from '../game/state';

export type DragSource = { kind: 'tray'; color: number } | { kind: 'cell'; cell: number };
export type DropTarget = { kind: 'tray' } | { kind: 'cell'; cell: number };

/** Draggable elements carry data-drag="tray" + data-color, or data-drag="cell" + data-cell. */
export function dragSourceOf(node: Element | null): DragSource | null {
  const el = node?.closest<HTMLElement>('[data-drag]');
  if (!el) return null;
  if (el.dataset['drag'] === 'tray') return { kind: 'tray', color: Number(el.dataset['color']) };
  return { kind: 'cell', cell: Number(el.dataset['cell']) };
}

/** Drop targets carry data-drop="tray", or data-drop="cell" + data-cell. */
export function dropTargetOf(node: Element | null): DropTarget | null {
  const el = node?.closest<HTMLElement>('[data-drop]');
  if (!el) return null;
  if (el.dataset['drop'] === 'tray') return { kind: 'tray' };
  return { kind: 'cell', cell: Number(el.dataset['cell']) };
}

export function applyDrop(state: GameState, source: DragSource, target: DropTarget): GameState {
  if (source.kind === 'tray') {
    return target.kind === 'cell' ? placeFromTray(state, source.color, target.cell) : state;
  }
  return target.kind === 'cell'
    ? moveTile(state, source.cell, target.cell)
    : returnToTray(state, source.cell);
}

export interface DragControllerOptions {
  root: HTMLElement;
  onDrop: (source: DragSource, target: DropTarget) => void;
  onClick: (source: DragSource) => void;
  /** Element under a viewport point; injectable because layout does not exist in tests. */
  hitTest?: (x: number, y: number) => Element | null;
  /** Pointer travel in pixels before a press becomes a drag. */
  threshold?: number;
}

/**
 * Pointer-events drag and drop for mouse, pen and touch alike: a press that travels past the
 * threshold drags a ghost copy of the tile; a press that does not is a click.
 */
export function attachDragController(options: DragControllerOptions): () => void {
  const { root, onDrop, onClick } = options;
  const doc = root.ownerDocument;
  const hitTest = options.hitTest ?? ((x, y) => doc.elementFromPoint(x, y));
  const threshold = options.threshold ?? 6;

  let press: { source: DragSource; element: HTMLElement; x: number; y: number } | null = null;
  let ghost: HTMLElement | null = null;
  let highlighted: Element | null = null;

  const setHighlight = (node: Element | null) => {
    const target = node?.closest('[data-drop]') ?? null;
    if (target === highlighted) return;
    highlighted?.classList.remove('drag-over');
    target?.classList.add('drag-over');
    highlighted = target;
  };

  const moveGhost = (x: number, y: number) => {
    if (!ghost) return;
    ghost.style.left = `${x - ghost.offsetWidth / 2}px`;
    ghost.style.top = `${y - ghost.offsetHeight / 2}px`;
  };

  const cleanUp = () => {
    ghost?.remove();
    ghost = null;
    setHighlight(null);
    press?.element.classList.remove('dragging-source');
    press = null;
    doc.removeEventListener('pointermove', onPointerMove);
    doc.removeEventListener('pointerup', onPointerUp);
    doc.removeEventListener('pointercancel', cleanUp);
  };

  function onPointerMove(event: PointerEvent) {
    if (!press) return;
    if (!ghost) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < threshold) return;
      const rect = press.element.getBoundingClientRect();
      ghost = press.element.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost-piece');
      ghost.removeAttribute('data-drag');
      ghost.removeAttribute('data-drop');
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      doc.body.appendChild(ghost);
      press.element.classList.add('dragging-source');
    }
    event.preventDefault?.();
    moveGhost(event.clientX, event.clientY);
    setHighlight(hitTest(event.clientX, event.clientY));
  }

  function onPointerUp(event: PointerEvent) {
    if (!press) return;
    const { source } = press;
    const dragging = ghost !== null;
    const target = dragging ? dropTargetOf(hitTest(event.clientX, event.clientY)) : null;
    cleanUp();
    if (!dragging) onClick(source);
    else if (target) onDrop(source, target);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || press) return;
    const element = (event.target as Element).closest<HTMLElement>('[data-drag]');
    const source = dragSourceOf(element);
    if (!element || !source) return;
    press = { source, element, x: event.clientX, y: event.clientY };
    doc.addEventListener('pointermove', onPointerMove);
    doc.addEventListener('pointerup', onPointerUp);
    doc.addEventListener('pointercancel', cleanUp);
  }

  root.addEventListener('pointerdown', onPointerDown);
  return () => {
    cleanUp();
    root.removeEventListener('pointerdown', onPointerDown);
  };
}
