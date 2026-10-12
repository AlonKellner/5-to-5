// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { placeTooltip, Tooltips } from './tooltip';

const VIEW = { width: 400, height: 800 };
const rect = (left: number, top: number, width = 40, height = 40) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('placeTooltip', () => {
  it('centres the tooltip below its button', () => {
    expect(placeTooltip(rect(180, 100), { width: 100, height: 24 }, VIEW)).toEqual({
      left: 150,
      top: 146,
    });
  });

  it('opens upwards when asked to', () => {
    expect(placeTooltip(rect(180, 700), { width: 100, height: 24 }, VIEW, 'above')).toEqual({
      left: 150,
      top: 670,
    });
  });

  it('opens upwards when there is no room below', () => {
    expect(placeTooltip(rect(180, 770, 40, 28), { width: 100, height: 24 }, VIEW).top).toBe(740);
  });

  it('keeps tooltips of edge buttons inside the window', () => {
    expect(placeTooltip(rect(370, 100), { width: 140, height: 24 }, VIEW).left).toBe(254);
    expect(placeTooltip(rect(0, 100), { width: 140, height: 24 }, VIEW).left).toBe(6);
  });
});

describe('Tooltips', () => {
  let tooltips: Tooltips;
  const tip = () => document.querySelector<HTMLElement>('.tooltip');
  const pointer = (type: string, target: Element, pointerType = 'mouse') => {
    const event = new MouseEvent(type, { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    target.dispatchEvent(event);
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <button id="a" data-tooltip="Reveal a clue"><svg></svg></button>
        <button id="b" data-tooltip="Copy a link" data-tooltip-position="above"></button>
        <span id="plain">no tooltip</span>
      </div>`;
    tooltips = new Tooltips(document.getElementById('root')!);
  });

  afterEach(() => tooltips.destroy());

  it('shows the text while the mouse is over the button, even over its icon', () => {
    pointer('pointerover', document.querySelector('#a svg')!);
    expect(tip()!.hidden).toBe(false);
    expect(tip()!.textContent).toBe('Reveal a clue');
    expect(tip()!.getAttribute('role')).toBe('tooltip');
    pointer('pointerout', document.getElementById('a')!);
    expect(tip()!.hidden).toBe(true);
  });

  it('switches text when moving to another button', () => {
    pointer('pointerover', document.getElementById('a')!);
    pointer('pointerover', document.getElementById('b')!);
    expect(tip()!.textContent).toBe('Copy a link');
    expect(document.querySelectorAll('.tooltip')).toHaveLength(1);
  });

  it('ignores touches, which have no hover', () => {
    pointer('pointerover', document.getElementById('a')!, 'touch');
    expect(tip()?.hidden ?? true).toBe(true);
  });

  it('ignores elements without a tooltip', () => {
    pointer('pointerover', document.getElementById('plain')!);
    expect(tip()?.hidden ?? true).toBe(true);
  });

  it('shows for keyboard focus and hides on blur', () => {
    const a = document.getElementById('a')!;
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tip()!.hidden).toBe(false);
    a.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(tip()!.hidden).toBe(true);
  });

  it('hides when the button is pressed, so it never covers what the button changes', () => {
    const a = document.getElementById('a')!;
    pointer('pointerover', a);
    pointer('pointerdown', a);
    expect(tip()!.hidden).toBe(true);
  });

  it('removes itself and stops listening once destroyed', () => {
    pointer('pointerover', document.getElementById('a')!);
    tooltips.destroy();
    expect(tip()).toBeNull();
    pointer('pointerover', document.getElementById('a')!);
    expect(tip()).toBeNull();
  });
});
