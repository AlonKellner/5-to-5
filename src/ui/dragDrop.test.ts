// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { createGame, placeFromTray, trayCount } from '../game/state';
import { applyDrop, attachDragController, dragSourceOf, dropTargetOf } from './dragDrop';

function pointer(type: string, target: EventTarget, x: number, y: number) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
}

describe('drag sources and drop targets', () => {
  it('reads sources and targets from data attributes of the closest element', () => {
    document.body.innerHTML = `
      <div data-drag="tray" data-color="3"><span id="inner"></span></div>
      <div data-drag="cell" data-cell="7" data-drop="cell" id="piece"></div>
      <div data-drop="tray" id="spawner"></div>
      <div id="none"></div>`;
    expect(dragSourceOf(document.getElementById('inner'))).toEqual({ kind: 'tray', color: 3 });
    expect(dragSourceOf(document.getElementById('piece'))).toEqual({ kind: 'cell', cell: 7 });
    expect(dropTargetOf(document.getElementById('piece'))).toEqual({ kind: 'cell', cell: 7 });
    expect(dropTargetOf(document.getElementById('spawner'))).toEqual({ kind: 'tray' });
    expect(dragSourceOf(document.getElementById('none'))).toBeNull();
    expect(dropTargetOf(null)).toBeNull();
  });
});

describe('applyDrop', () => {
  const game = createGame(legacyPuzzle());

  it('places a tray tile on a cell', () => {
    const next = applyDrop(game, { kind: 'tray', color: 0 }, { kind: 'cell', cell: 0 });
    expect(next.cells[0]).toBe(0);
  });

  it('moves or swaps a board tile', () => {
    const s = placeFromTray(placeFromTray(game, 0, 0), 1, 2);
    const next = applyDrop(s, { kind: 'cell', cell: 0 }, { kind: 'cell', cell: 2 });
    expect([next.cells[0], next.cells[2]]).toEqual([1, 0]);
  });

  it('returns a board tile to the tray', () => {
    const s = placeFromTray(game, 0, 0);
    const next = applyDrop(s, { kind: 'cell', cell: 0 }, { kind: 'tray' });
    expect(next.cells[0]).toBe(-1);
    expect(trayCount(next, 0)).toBe(5);
  });

  it('ignores dropping a tray tile back on the tray', () => {
    expect(applyDrop(game, { kind: 'tray', color: 0 }, { kind: 'tray' })).toBe(game);
  });
});

describe('attachDragController', () => {
  let root: HTMLElement;
  let hitTarget: Element | null;
  const onDrop = vi.fn();
  const onClick = vi.fn();
  let detach: () => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <div class="piece" data-drag="tray" data-color="2" id="source"></div>
        <div class="drop-zone" data-drop="cell" data-cell="4" id="target"></div>
      </div>`;
    root = document.getElementById('root')!;
    hitTarget = null;
    onDrop.mockReset();
    onClick.mockReset();
    detach = attachDragController({ root, onDrop, onClick, hitTest: () => hitTarget });
  });

  afterEach(() => detach());

  it('drags past the threshold and drops on the element under the pointer', () => {
    const source = document.getElementById('source')!;
    hitTarget = document.getElementById('target');
    pointer('pointerdown', source, 10, 10);
    pointer('pointermove', document, 40, 40);
    expect(document.querySelector('.ghost-piece')).not.toBeNull();
    expect(source.classList.contains('dragging-source')).toBe(true);
    expect(hitTarget!.classList.contains('drag-over')).toBe(true);
    pointer('pointerup', document, 40, 40);
    expect(onDrop).toHaveBeenCalledWith({ kind: 'tray', color: 2 }, { kind: 'cell', cell: 4 });
    expect(onClick).not.toHaveBeenCalled();
    expect(document.querySelector('.ghost-piece')).toBeNull();
    expect(document.querySelector('.drag-over')).toBeNull();
  });

  it('treats a press without movement as a click', () => {
    const source = document.getElementById('source')!;
    pointer('pointerdown', source, 10, 10);
    pointer('pointerup', document, 11, 11);
    expect(onClick).toHaveBeenCalledWith({ kind: 'tray', color: 2 });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('cancels without dropping when released outside any target', () => {
    const source = document.getElementById('source')!;
    pointer('pointerdown', source, 10, 10);
    pointer('pointermove', document, 80, 80);
    pointer('pointerup', document, 80, 80);
    expect(onDrop).not.toHaveBeenCalled();
    expect(document.querySelector('.ghost-piece')).toBeNull();
  });

  it('ignores presses outside draggable elements', () => {
    pointer('pointerdown', document.getElementById('target')!, 10, 10);
    pointer('pointermove', document, 80, 80);
    pointer('pointerup', document, 80, 80);
    expect(onDrop).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stops listening once detached', () => {
    detach();
    pointer('pointerdown', document.getElementById('source')!, 10, 10);
    pointer('pointerup', document, 10, 10);
    expect(onClick).not.toHaveBeenCalled();
  });
});
