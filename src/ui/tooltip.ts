import type { Rect, Size } from './bubblePosition';

const GAP = 6;
const MARGIN = 6;

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

/**
 * Instant tooltips for every element under `root` with a data-tooltip attribute. One floating
 * element is positioned in the window, so a tooltip never widens the page and never spills off
 * screen. Shown on mouse hover and keyboard focus; touches have no hover and are ignored.
 */
export class Tooltips {
  private tip: HTMLElement | null = null;
  private current: HTMLElement | null = null;
  /** Focus that follows a press came from the pointer, not the keyboard. */
  private pointerPressed = false;
  private readonly doc: Document;

  constructor(private readonly root: HTMLElement) {
    this.doc = root.ownerDocument;
    root.addEventListener('pointerover', this.onPointerOver);
    root.addEventListener('pointerout', this.onPointerOut);
    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('focusin', this.onFocusIn);
    root.addEventListener('focusout', this.hide);
    this.doc.addEventListener('keydown', this.onKeyDown);
  }

  destroy(): void {
    this.root.removeEventListener('pointerover', this.onPointerOver);
    this.root.removeEventListener('pointerout', this.onPointerOut);
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('focusin', this.onFocusIn);
    this.root.removeEventListener('focusout', this.hide);
    this.doc.removeEventListener('keydown', this.onKeyDown);
    this.tip?.remove();
    this.tip = null;
    this.current = null;
  }

  private show(target: HTMLElement): void {
    const tip = this.ensureTip();
    this.current = target;
    tip.textContent = target.dataset['tooltip'] ?? '';
    tip.hidden = false;
    const view = this.doc.defaultView;
    const { left, top } = placeTooltip(
      target.getBoundingClientRect(),
      tip.getBoundingClientRect(),
      { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
      target.dataset['tooltipPosition'] === 'above' ? 'above' : undefined,
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  private readonly hide = (): void => {
    if (this.tip) this.tip.hidden = true;
    this.current = null;
  };

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

  private readonly onPointerOver = (event: Event) => {
    if ((event as PointerEvent).pointerType === 'touch') return;
    const target = this.tooltipTarget(event);
    if (target) this.show(target);
    else this.hide();
  };

  private readonly onPointerOut = (event: Event) => {
    const next = (event as PointerEvent).relatedTarget as Node | null;
    if (this.current && next && this.current.contains(next)) return;
    this.hide();
  };

  private readonly onPointerDown = () => {
    this.pointerPressed = true;
    this.hide();
  };

  private readonly onKeyDown = () => {
    this.pointerPressed = false;
  };

  private readonly onFocusIn = (event: Event) => {
    if (this.pointerPressed) return;
    const target = this.tooltipTarget(event);
    if (target) this.show(target);
  };
}
