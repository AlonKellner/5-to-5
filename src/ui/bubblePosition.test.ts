import { describe, expect, it } from 'vitest';
import { placeBubble } from './bubblePosition';

const VIEW = { width: 1000, height: 800 };
const bubble = { width: 300, height: 200 };
const place = (target: { left: number; top: number; width: number; height: number }) =>
  placeBubble(
    { ...target, right: target.left + target.width, bottom: target.top + target.height },
    bubble,
    VIEW,
  );

describe('placeBubble', () => {
  it('sits below the target when there is room', () => {
    expect(place({ left: 100, top: 100, width: 200, height: 100 })).toEqual({
      left: 100,
      top: 212,
    });
  });

  it('sits above the target when there is no room below', () => {
    expect(place({ left: 100, top: 500, width: 200, height: 280 })).toEqual({
      left: 100,
      top: 288,
    });
  });

  it('sits beside the target when there is no room above or below', () => {
    const placed = place({ left: 100, top: 20, width: 200, height: 760 });
    expect(placed.left).toBe(312);
    expect(placed.top).toBeGreaterThanOrEqual(10);
  });

  it('uses the left side when the right side does not fit', () => {
    const placed = place({ left: 600, top: 20, width: 380, height: 760 });
    expect(placed.left).toBe(288);
  });

  it('never leaves the viewport, even when nothing fits', () => {
    const placed = place({ left: 0, top: 0, width: 1000, height: 800 });
    expect(placed.left).toBeGreaterThanOrEqual(10);
    expect(placed.top).toBeGreaterThanOrEqual(10);
    expect(placed.left + bubble.width).toBeLessThanOrEqual(VIEW.width);
    expect(placed.top + bubble.height).toBeLessThanOrEqual(VIEW.height);
  });

  it('keeps a wide bubble inside a narrow screen', () => {
    const placed = placeBubble(
      { left: 10, top: 10, width: 100, height: 100, right: 110, bottom: 110 },
      { width: 380, height: 150 },
      { width: 390, height: 844 },
    );
    expect(placed.left).toBeGreaterThanOrEqual(0);
    expect(placed.left + 380).toBeLessThanOrEqual(390);
  });
});
