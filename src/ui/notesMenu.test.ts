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

  it('draws each color’s shape on its option', () => {
    menu.open({ x: 10, y: 10 }, 0, () => 0);
    const shapes = [...document.querySelectorAll<SVGElement>('.note-option .color-shape')];
    expect(shapes.map((shape) => shape.dataset['shape'])).toEqual([
      'circle',
      'square',
      'trapezoid',
      'diamond',
      'pentagon',
    ]);
  });

  it('toggles an option and reflects the new selection', () => {
    const onToggle = vi.fn(() => 0b00011);
    menu.open({ x: 10, y: 10 }, 0b00001, onToggle);
    (document.querySelectorAll('.note-option')[1] as HTMLElement).click();
    expect(onToggle).toHaveBeenCalledWith(1, 'top');
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

  describe('the half switch', () => {
    const toggle = () => document.querySelector<HTMLButtonElement>('.note-half-toggle')!;
    const selected = () =>
      [...document.querySelectorAll('.note-option')].map((o) => o.classList.contains('selected'));
    // Top half: red and green; bottom half: blue.
    const mask = 0b00101 | (0b00010 << 5);

    it('is the sixth button, and starts on the top half', () => {
      menu.open({ x: 10, y: 10 }, mask, () => mask);
      const buttons = document.querySelectorAll('.note-menu button');
      expect(buttons).toHaveLength(6);
      expect(buttons[5]).toBe(toggle());
      expect(toggle().dataset['half']).toBe('top');
      expect(toggle().getAttribute('aria-label')).toMatch(/top half/i);
      expect(toggle().querySelector('svg .half-highlight')).not.toBeNull();
      expect(selected()).toEqual([true, false, true, false, false]);
    });

    it('switches to the bottom half and back, showing that half’s colors', () => {
      menu.open({ x: 10, y: 10 }, mask, () => mask);
      toggle().click();
      expect(toggle().dataset['half']).toBe('bottom');
      expect(toggle().getAttribute('aria-label')).toMatch(/bottom half/i);
      expect(selected()).toEqual([false, true, false, false, false]);
      toggle().click();
      expect(toggle().dataset['half']).toBe('top');
      expect(selected()).toEqual([true, false, true, false, false]);
      expect(menu.isOpen).toBe(true);
    });

    it('writes colors into the chosen half', () => {
      const onToggle = vi.fn(() => mask | (0b10000 << 5));
      menu.open({ x: 10, y: 10 }, mask, onToggle);
      toggle().click();
      (document.querySelectorAll('.note-option')[4] as HTMLElement).click();
      expect(onToggle).toHaveBeenCalledWith(4, 'bottom');
      expect(selected()).toEqual([false, true, false, false, true]);
    });

    it('starts on the top half unless asked for the bottom one', () => {
      menu.open({ x: 10, y: 10 }, mask, () => mask);
      toggle().click();
      menu.open({ x: 10, y: 10 }, mask, () => mask);
      expect(toggle().dataset['half']).toBe('top');
      menu.open({ x: 10, y: 10 }, mask, () => mask, 'bottom');
      expect(toggle().dataset['half']).toBe('bottom');
      expect(selected()).toEqual([false, true, false, false, false]);
    });

    it('marks the whole menu with its half, which sets its background', () => {
      menu.open({ x: 10, y: 10 }, mask, () => mask);
      const panel = document.querySelector<HTMLElement>('.note-menu')!;
      expect(panel.dataset['half']).toBe('top');
      toggle().click();
      expect(panel.dataset['half']).toBe('bottom');
    });
  });
});
