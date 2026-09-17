// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clampMenuPosition, NotesMenu } from './notesMenu';

describe('clampMenuPosition', () => {
  it('keeps the requested position when the menu fits', () => {
    expect(clampMenuPosition(50, 60, 120, 180, 800, 600)).toEqual({ left: 50, top: 60 });
  });

  it('moves the menu back inside the viewport', () => {
    expect(clampMenuPosition(750, 550, 120, 180, 800, 600)).toEqual({ left: 670, top: 410 });
    expect(clampMenuPosition(2, 3, 120, 180, 800, 600)).toEqual({ left: 10, top: 10 });
  });
});

describe('NotesMenu', () => {
  let menu: NotesMenu;

  beforeEach(() => {
    document.body.innerHTML = '<div id="outside"></div><div data-note="cell" id="cell"></div>';
    menu = new NotesMenu(document);
  });

  it('opens with five options and marks the selected ones', () => {
    menu.open({ x: 10, y: 10 }, 0b00101, () => 0);
    const options = document.querySelectorAll('.note-option');
    expect(options).toHaveLength(5);
    expect([...options].map((o) => o.classList.contains('selected'))).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
    expect(menu.isOpen).toBe(true);
  });

  it('toggles an option and reflects the new selection', () => {
    const onToggle = vi.fn(() => 0b00011);
    menu.open({ x: 10, y: 10 }, 0b00001, onToggle);
    (document.querySelectorAll('.note-option')[1] as HTMLElement).click();
    expect(onToggle).toHaveBeenCalledWith(1);
    expect(document.querySelectorAll('.note-option.selected')).toHaveLength(2);
    expect(menu.isOpen).toBe(true);
  });

  it('replaces an open menu when opened again', () => {
    menu.open({ x: 10, y: 10 }, 0, () => 0);
    menu.open({ x: 20, y: 20 }, 0, () => 0);
    expect(document.querySelectorAll('.note-menu')).toHaveLength(1);
  });

  it('closes on a pointer press outside the menu', () => {
    menu.open({ x: 10, y: 10 }, 0, () => 0);
    document
      .getElementById('outside')!
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(document.querySelector('.note-menu')).toBeNull();
    expect(menu.isOpen).toBe(false);
  });

  it('stays open on presses inside the menu', () => {
    menu.open({ x: 10, y: 10 }, 0, () => 0);
    document
      .querySelector('.note-option')!
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(menu.isOpen).toBe(true);
  });
});
