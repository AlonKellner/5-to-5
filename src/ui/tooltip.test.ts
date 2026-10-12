// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS, placeTooltip, Tooltips } from './tooltip';

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

describe('long press on touch screens', () => {
  let tooltips: Tooltips;
  let clicks: number;
  const tip = () => document.querySelector<HTMLElement>('.tooltip');
  const touch = (type: string, target: Element, x = 20, y = 20) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="root">
        <button id="reveal" data-tooltip="Show the solution">eye</button>
        <button id="undo" aria-label="Undo" data-tooltip="Undo (Ctrl+Z)" disabled>undo</button>
      </div>`;
    clicks = 0;
    document.getElementById('reveal')!.addEventListener('click', () => clicks++);
    tooltips = new Tooltips(document.getElementById('root')!);
  });

  afterEach(() => {
    tooltips.destroy();
    vi.useRealTimers();
  });

  it('names the button after a press and hold', () => {
    const reveal = document.getElementById('reveal')!;
    touch('pointerdown', reveal);
    expect(tip()?.hidden ?? true).toBe(true);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(tip()!.hidden).toBe(false);
    expect(tip()!.textContent).toBe('Show the solution');
  });

  it('does not press the button when the long press ends', () => {
    const reveal = document.getElementById('reveal')!;
    touch('pointerdown', reveal);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    touch('pointerup', reveal);
    reveal.click();
    expect(clicks).toBe(0);
  });

  it('still presses the button on a normal tap', () => {
    const reveal = document.getElementById('reveal')!;
    touch('pointerdown', reveal);
    vi.advanceTimersByTime(LONG_PRESS_MS / 3);
    touch('pointerup', reveal);
    reveal.click();
    expect(clicks).toBe(1);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(tip()?.hidden ?? true).toBe(true);
  });

  it('only swallows the one click that ends the long press', () => {
    const reveal = document.getElementById('reveal')!;
    touch('pointerdown', reveal);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    touch('pointerup', reveal);
    touch('pointerdown', reveal);
    touch('pointerup', reveal);
    reveal.click();
    expect(clicks).toBe(1);
  });

  it('cancels when the finger moves away', () => {
    const reveal = document.getElementById('reveal')!;
    touch('pointerdown', reveal, 20, 20);
    touch('pointermove', reveal, 60, 20);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(tip()?.hidden ?? true).toBe(true);
  });

  it('keeps the tooltip after the finger lifts, until the next touch anywhere', () => {
    const reveal = document.getElementById('reveal')!;
    touch('pointerdown', reveal);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    touch('pointerup', reveal);
    expect(tip()!.hidden).toBe(false);
    touch('pointerdown', document.body);
    expect(tip()!.hidden).toBe(true);
  });

  it('stops the browser’s own long-press menu on buttons', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.getElementById('reveal')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('names disabled buttons too, which do not receive touches themselves', () => {
    const undo = document.getElementById('undo')!;
    undo.getBoundingClientRect = () =>
      ({ left: 100, top: 0, right: 140, bottom: 40, width: 40, height: 40 }) as DOMRect;
    touch('pointerdown', document.getElementById('root')!, 120, 20);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(tip()!.textContent).toBe('Undo (Ctrl+Z)');
  });

  it('shows exactly what hovering shows', () => {
    const reveal = document.getElementById('reveal')!;
    const event = new MouseEvent('pointerover', { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    reveal.dispatchEvent(event);
    const hovered = tip()!.innerHTML;
    touch('pointerdown', reveal);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(tip()!.innerHTML).toBe(hovered);
  });
});
