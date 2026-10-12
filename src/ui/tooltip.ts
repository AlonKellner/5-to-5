import type { Rect, Size } from './bubblePosition';

const GAP = 6;
const MARGIN = 6;
/** How long a finger must rest on a button before it is explained instead of pressed. */
export const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

/** Centres a tooltip under (or over) its button and keeps it inside the window. */
export function placeTooltip(
  target: Rect,
  size: Size,
  viewport: Size,
  prefer?: 'above',
): { left: number; top: number } {
  const centered = target.left + target.width / 2 - size.width / 2;
  const left = Math.max(MARGIN, Math.min(centered, viewport.width - MARGIN - size.width));
  const below = target.bottom + GAP;
  const above = target.top - GAP - size.height;
  const fitsBelow = below + size.height <= viewport.height - MARGIN;
  const useAbove = (prefer === 'above' && above >= MARGIN) || !fitsBelow;
  return { left, top: useAbove ? Math.max(MARGIN, above) : below };
}

interface Press {
  target: HTMLElement;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Explains every element under `root` that has a data-tooltip attribute. One floating element is
 * positioned inside the window, so it never widens the page or spills off screen.
 *
 * - Mouse hover and keyboard focus show the name (data-tooltip).
 * - On touch screens, which have no hover, pressing and holding shows the same name and keeps it
 *   until the next touch; the tap that ends the hold is swallowed, so learning what a button does
 *   never triggers it.
 */
export class Tooltips {
  private tip: HTMLElement | null = null;
  private current: HTMLElement | null = null;
  /** Shown by a long press: it outlives the finger and waits for the next touch. */
  private pinned = false;
  private press: Press | null = null;
  private swallowClick = false;
  /** Focus that follows a press came from the pointer, not the keyboard. */
  private pointerPressed = false;
  private readonly doc: Document;

  constructor(private readonly root: HTMLElement) {
    this.doc = root.ownerDocument;
    root.addEventListener('pointerover', this.onPointerOver);
    root.addEventListener('pointerout', this.onPointerOut);
    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('pointerup', this.endPress);
    root.addEventListener('pointercancel', this.endPress);
    root.addEventListener('click', this.onClick, true);
    root.addEventListener('contextmenu', this.onContextMenu);
    root.addEventListener('focusin', this.onFocusIn);
    root.addEventListener('focusout', this.onFocusOut);
    this.doc.addEventListener('pointerdown', this.onAnyPointerDown, true);
    this.doc.addEventListener('keydown', this.onKeyDown);
  }

  destroy(): void {
    this.cancelPress();
    this.root.removeEventListener('pointerover', this.onPointerOver);
    this.root.removeEventListener('pointerout', this.onPointerOut);
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerup', this.endPress);
    this.root.removeEventListener('pointercancel', this.endPress);
    this.root.removeEventListener('click', this.onClick, true);
    this.root.removeEventListener('contextmenu', this.onContextMenu);
    this.root.removeEventListener('focusin', this.onFocusIn);
    this.root.removeEventListener('focusout', this.onFocusOut);
    this.doc.removeEventListener('pointerdown', this.onAnyPointerDown, true);
    this.doc.removeEventListener('keydown', this.onKeyDown);
    this.tip?.remove();
    this.tip = null;
    this.current = null;
  }

  private show(target: HTMLElement, pinned: boolean): void {
    const tip = this.ensureTip();
    this.current = target;
    this.pinned = pinned;
    tip.textContent = target.dataset['tooltip'] ?? '';
    tip.hidden = false;
    const view = this.doc.defaultView;
    // A finger covers the button and the space under it, so long-press tooltips open upwards.
    const prefer = pinned || target.dataset['tooltipPosition'] === 'above' ? 'above' : undefined;
    const { left, top } = placeTooltip(
      target.getBoundingClientRect(),
      tip.getBoundingClientRect(),
      { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
      prefer,
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  private hide(): void {
    if (this.tip) this.tip.hidden = true;
    this.current = null;
    this.pinned = false;
  }

  private ensureTip(): HTMLElement {
    if (!this.tip) {
      this.tip = this.doc.createElement('div');
      this.tip.className = 'tooltip';
      this.tip.setAttribute('role', 'tooltip');
      this.tip.hidden = true;
      this.doc.body.appendChild(this.tip);
    }
    return this.tip;
  }

  private tooltipTarget(event: Event): HTMLElement | null {
    const target = (event.target as Element | null)?.closest?.<HTMLElement>('[data-tooltip]');
    return target && this.root.contains(target) ? target : null;
  }

  /**
   * Disabled buttons do not receive pointer events (the stylesheet lets them fall through to the
   * toolbar), so they are found by position instead.
   */
  private disabledTargetAt(x: number, y: number): HTMLElement | null {
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-tooltip]:disabled')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
    }
    return null;
  }

  private cancelPress(): void {
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
  }

  private readonly onAnyPointerDown = () => {
    // A new touch anywhere dismisses a long-press tooltip and ends any pending click swallowing.
    this.swallowClick = false;
    if (this.pinned) this.hide();
  };

  private readonly onPointerDown = (event: Event) => {
    const pointer = event as PointerEvent;
    this.pointerPressed = true;
    this.hide();
    this.cancelPress();
    if (pointer.pointerType !== 'touch' && pointer.pointerType !== 'pen') return;
    const target =
      this.tooltipTarget(event) ?? this.disabledTargetAt(pointer.clientX, pointer.clientY);
    if (!target) return;
    this.press = {
      target,
      x: pointer.clientX,
      y: pointer.clientY,
      timer: setTimeout(() => {
        this.press = null;
        this.swallowClick = true;
        this.show(target, true);
      }, LONG_PRESS_MS),
    };
  };

  private readonly onPointerMove = (event: Event) => {
    const pointer = event as PointerEvent;
    if (this.press) {
      const moved = Math.hypot(pointer.clientX - this.press.x, pointer.clientY - this.press.y);
      if (moved > MOVE_TOLERANCE) this.cancelPress();
      return;
    }
    if (pointer.pointerType !== 'mouse' || this.tooltipTarget(event)) return;
    const disabled = this.disabledTargetAt(pointer.clientX, pointer.clientY);
    if (disabled && disabled !== this.current) this.show(disabled, false);
    else if (!disabled && this.current?.matches(':disabled')) this.hide();
  };

  private readonly endPress = () => {
    this.cancelPress();
  };

  private readonly onClick = (event: Event) => {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onContextMenu = (event: Event) => {
    const mouse = event as MouseEvent;
    if (this.tooltipTarget(event) ?? this.disabledTargetAt(mouse.clientX, mouse.clientY)) {
      event.preventDefault();
    }
  };

  private readonly onPointerOver = (event: Event) => {
    if ((event as PointerEvent).pointerType === 'touch' || this.pinned) return;
    const target = this.tooltipTarget(event);
    if (target) this.show(target, false);
    else this.hide();
  };

  private readonly onPointerOut = (event: Event) => {
    if (this.pinned) return;
    const next = (event as PointerEvent).relatedTarget as Node | null;
    if (this.current && next && this.current.contains(next)) return;
    this.hide();
  };

  private readonly onKeyDown = () => {
    this.pointerPressed = false;
  };

  private readonly onFocusIn = (event: Event) => {
    if (this.pointerPressed) return;
    const target = this.tooltipTarget(event);
    if (target) this.show(target, false);
  };

  private readonly onFocusOut = () => {
    if (!this.pinned) this.hide();
  };
}
