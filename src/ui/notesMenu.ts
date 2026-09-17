import { COLOR_COUNT, COLOR_NAMES } from '../core/constants';
import { el } from './dom';

export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 10,
): { left: number; top: number } {
  let left = x;
  let top = y;
  if (left + width > viewportWidth) left = viewportWidth - width - margin;
  if (top + height > viewportHeight) top = viewportHeight - height - margin;
  return { left: Math.max(margin, left), top: Math.max(margin, top) };
}

/** Popup for toggling note colors; closes on any press outside it. */
export class NotesMenu {
  private menu: HTMLElement | null = null;

  constructor(private readonly doc: Document) {}

  get isOpen(): boolean {
    return this.menu !== null;
  }

  /** `onToggle` receives a color and returns the note mask after toggling it. */
  open(
    point: { x: number; y: number },
    selected: number,
    onToggle: (color: number) => number,
  ): void {
    this.close();
    const menu = el('div', { className: 'note-menu', attrs: { role: 'menu' } });
    for (let color = 0; color < COLOR_COUNT; color++) {
      const option = el('button', {
        className: `note-option color-${color}${selected & (1 << color) ? ' selected' : ''}`,
        dataset: { color },
        attrs: { 'aria-label': COLOR_NAMES[color]!, role: 'menuitemcheckbox' },
      });
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        const mask = onToggle(color);
        option.classList.toggle('selected', (mask & (1 << color)) !== 0);
      });
      menu.appendChild(option);
    }
    this.doc.body.appendChild(menu);
    const view = this.doc.defaultView;
    const rect = menu.getBoundingClientRect();
    const { left, top } = clampMenuPosition(
      point.x,
      point.y,
      rect.width,
      rect.height,
      view?.innerWidth ?? Infinity,
      view?.innerHeight ?? Infinity,
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    this.menu = menu;
    this.doc.addEventListener('pointerdown', this.onOutsidePress, true);
  }

  close(): void {
    this.menu?.remove();
    this.menu = null;
    this.doc.removeEventListener('pointerdown', this.onOutsidePress, true);
  }

  private readonly onOutsidePress = (event: Event) => {
    const target = event.target as Element | null;
    if (this.menu && target && !this.menu.contains(target)) this.close();
  };
}
