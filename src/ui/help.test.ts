// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { RELATION_SYMBOLS } from '../core/clues';
import { COLOR_NAMES } from '../core/constants';
import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES } from '../core/puzzle';
import { renderHelp } from './help';
import { BUTTON_ICONS } from './icons';
import { HIDDEN_RULES } from './rulesText';

let container: HTMLElement;
const text = () => container.textContent!;

describe('renderHelp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="help-body"></div>';
    container = document.getElementById('help-body')!;
    renderHelp(container);
  });

  it('states every nuance of the hidden rules', () => {
    for (const phrase of [
      /exactly one/i,
      /always/i,
      /never/i,
      /both ways|mutual/i,
      /its own/i,
      /different/i,
      /every tile/i,
      /no tile/i,
      /touches all five|common to all/i,
      /missing from all|touches none/i,
      /five tiles of each/i,
      /up, down, left or right/i,
      /not diagonal|never diagonal/i,
    ]) {
      expect(text(), String(phrase)).toMatch(phrase);
    }
  });

  it('lists every hidden rule from the text the tutorial uses', () => {
    for (const rule of Object.values(HIDDEN_RULES)) expect(text()).toContain(rule);
  });

  it('explains each relation symbol', () => {
    const badges = [...container.querySelectorAll('.help-legend .relationship-clue')];
    expect(badges.map((b) => b.textContent)).toEqual([...RELATION_SYMBOLS]);
    for (const phrase of [
      /same color/i,
      /next color/i,
      /two steps forward/i,
      /two steps back/i,
      /previous color/i,
    ]) {
      expect(text(), String(phrase)).toMatch(phrase);
    }
  });

  it('shows that vertical symbols are read downwards', () => {
    expect(text()).toMatch(/top to bottom/i);
    expect(container.querySelectorAll('.relation-slot.vertical').length).toBeGreaterThan(0);
  });

  it('shows the color cycle in order', () => {
    const dots = [...container.querySelectorAll('.help-cycle .note-dot')];
    expect(dots.map((d) => d.className)).toEqual([0, 1, 2, 3, 4].map((c) => `note-dot color-${c}`));
    for (const name of COLOR_NAMES) expect(text()).toContain(name);
  });

  it('lists all seven difficulty levels and what the score means', () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(text()).toContain(DIFFICULTY_NAMES[level]);
    }
    expect(text()).toMatch(/100/);
    expect(text()).toMatch(/exactly one solution/i);
  });

  it('lists every button with its icon, name and what it does', () => {
    const rows = [...container.querySelectorAll('.help-buttons .help-button-row')];
    expect(rows).toHaveLength(Object.keys(BUTTON_ICONS).length);
    for (const entry of Object.values(BUTTON_ICONS)) {
      const row = rows.find((r) => r.querySelector('strong')?.textContent === entry.label);
      expect(row, entry.label).toBeDefined();
      expect(row!.querySelector('svg.btn-icon'), entry.label).not.toBeNull();
      expect(row!.textContent, entry.label).toContain(entry.description);
    }
  });

  it('tells touch players to press and hold a button to learn about it', () => {
    expect(text()).toMatch(/press and hold/i);
    expect(text()).toMatch(/hover/i);
  });

  it('can be rendered again without stacking content', () => {
    const before = container.children.length;
    renderHelp(container);
    expect(container.children.length).toBe(before);
  });
});
