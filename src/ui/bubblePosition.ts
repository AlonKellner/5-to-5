export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

const MARGIN = 10;
const GAP = 12;

const clamp = (value: number, max: number) => Math.max(MARGIN, Math.min(value, max - MARGIN));

/**
 * Places the tutorial bubble next to the element it describes: below it, else above it, else to
 * one side, so the highlight itself stays visible. Falls back to the nearest spot inside the
 * viewport when the target fills the screen.
 */
export function placeBubble(
  target: Rect,
  bubble: Size,
  viewport: Size,
): { left: number; top: number } {
  const fitsBelow = target.bottom + GAP + bubble.height <= viewport.height - MARGIN;
  const fitsAbove = target.top - GAP - bubble.height >= MARGIN;
  if (fitsBelow || fitsAbove) {
    const top = fitsBelow ? target.bottom + GAP : target.top - GAP - bubble.height;
    return { left: clamp(target.left, viewport.width - bubble.width), top };
  }

  const fitsRight = target.right + GAP + bubble.width <= viewport.width - MARGIN;
  const fitsLeft = target.left - GAP - bubble.width >= MARGIN;
  if (fitsRight || fitsLeft) {
    const left = fitsRight ? target.right + GAP : target.left - GAP - bubble.width;
    const centered = target.top + target.height / 2 - bubble.height / 2;
    return { left, top: clamp(centered, viewport.height - bubble.height) };
  }

  return {
    left: clamp(target.left, viewport.width - bubble.width),
    top: clamp(target.bottom + GAP, viewport.height - bubble.height),
  };
}
