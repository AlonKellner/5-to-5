// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyButtonIcons, BUTTON_ICONS } from './icons';

const ICON_BUTTON_IDS = [
  'new-btn',
  'reset-btn',
  'clue-btn',
  'reveal-btn',
  'undo-btn',
  'check-btn',
  'checkpoint-btn',
  'restore-btn',
  'share-btn',
  'help-btn',
];

describe('BUTTON_ICONS', () => {
  it('covers exactly the toolbar buttons', () => {
    expect(Object.keys(BUTTON_ICONS).sort()).toEqual([...ICON_BUTTON_IDS].sort());
  });

  it('builds an accessible, CSS-sized svg for every button', () => {
    for (const [id, entry] of Object.entries(BUTTON_ICONS)) {
      const icon = entry.icon();
      expect(icon.tagName, id).toBe('svg');
      expect(icon.getAttribute('class'), id).toBe('btn-icon');
      expect(icon.getAttribute('viewBox'), id).toBe('0 0 24 24');
      expect(icon.getAttribute('aria-hidden'), id).toBe('true');
      expect(icon.childNodes.length, id).toBeGreaterThan(0);
      expect(icon.getAttribute('width'), id).toBeNull();
      expect(entry.label.length, id).toBeGreaterThan(0);
    }
  });

  it('explains what every button does in a full sentence', () => {
    for (const [id, entry] of Object.entries(BUTTON_ICONS)) {
      expect(entry.description.length, id).toBeGreaterThan(20);
      expect(entry.description, id).toMatch(/\.$/);
    }
  });

  it('gives every button a different icon', () => {
    const shapes = Object.values(BUTTON_ICONS).map((entry) => entry.icon().innerHTML);
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});

describe('applyButtonIcons', () => {
  beforeEach(() => {
    document.body.innerHTML = ICON_BUTTON_IDS.map(
      (id) => `<button id="${id}">some text</button>`,
    ).join('');
  });

  it('replaces the text with an icon and names the button', () => {
    applyButtonIcons(document.body);
    const button = document.getElementById('new-btn')!;
    expect(button.textContent).toBe('');
    expect(button.querySelectorAll('svg.btn-icon')).toHaveLength(1);
    expect(button.getAttribute('aria-label')).toBe('New puzzle');
    expect(button.dataset['tooltip']).toBe('New puzzle');
    // A native title tooltip would show a second, slower tooltip on top of ours.
    expect(button.hasAttribute('title')).toBe(false);
  });

  it('attaches the longer explanation for long presses', () => {
    applyButtonIcons(document.body);
    const reveal = document.getElementById('reveal-btn')!;
    expect(reveal.dataset['tooltipDetail']).toBe(BUTTON_ICONS['reveal-btn']!.description);
  });

  it('keeps the keyboard shortcut in the tooltip of Undo', () => {
    applyButtonIcons(document.body);
    const undo = document.getElementById('undo-btn')!;
    expect(undo.getAttribute('aria-label')).toBe('Undo');
    expect(undo.dataset['tooltip']).toMatch(/Ctrl\+Z/);
  });

  it('opens tooltips upwards for buttons near the bottom of the page', () => {
    applyButtonIcons(document.body);
    expect(document.getElementById('share-btn')!.dataset['tooltipPosition']).toBe('above');
    expect(document.getElementById('new-btn')!.dataset['tooltipPosition']).toBeUndefined();
  });

  it('removes a title left over in the markup', () => {
    document.getElementById('undo-btn')!.setAttribute('title', 'old');
    applyButtonIcons(document.body);
    expect(document.getElementById('undo-btn')!.hasAttribute('title')).toBe(false);
  });

  it('ignores buttons that are not on the page', () => {
    document.body.innerHTML = '<button id="new-btn"></button>';
    expect(() => applyButtonIcons(document.body)).not.toThrow();
    expect(document.querySelectorAll('svg.btn-icon')).toHaveLength(1);
  });

  it('is idempotent', () => {
    applyButtonIcons(document.body);
    applyButtonIcons(document.body);
    for (const id of ICON_BUTTON_IDS) {
      expect(document.getElementById(id)!.querySelectorAll('svg')).toHaveLength(1);
    }
  });
});
